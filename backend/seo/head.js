/*
 * The <head> tags of one page of the site, as the server sends them:
 *
 *   1. built-in tags from `seo_meta` (title, description, keywords, robots,
 *      canonical, Open Graph, X card, Search Console code, icons, theme
 *      colour), with the page's own values: the admin's per-page override,
 *      or for /metal/:slug, /service/:slug and /blog/:slug the metal,
 *      service or post itself;
 *   2. the admin's own tags (`head_tags`, seo/headTags.js) for that page.
 *      One with the same name as a built-in one (a meta name/property, a
 *      link rel such as canonical or icon) replaces it on those pages.
 *
 *   buildHead(path, { origin, seoMeta, headTags, client }) ->
 *     { path, title, tags: [{ tag, attrs, content? }], html }
 *
 * `html` is the same list as escaped HTML, ready for <head>. Every element
 * but <title> carries data-head="dms": the app (utils/seo applyHeadTags)
 * swaps exactly those when the visitor moves to another page. Attribute
 * values are plain strings; on/off attributes are ''.
 *
 * Mirrors resolveSeo in client/src/utils/seo.js (the app's fallback and
 * the admin preview); keep the two in step.
 */
const db = require('../db');
const { validateSeoMeta } = require('../utils/seoSettings');
const { validateHeadTags, appliesTo } = require('./headTags');
const { PUBLIC_WHERE } = require('../blog/service');

// What the site showed before anything was set in admin.
const FALLBACK = {
    title: 'Dynamic Manufacturing Solutions',
    description: 'Custom laser-cut, bent and CNC-machined metal parts from Dallas, Texas. Upload a STEP or DXF file and get an instant price.',
    siteName: 'Dynamic Manufacturing Solutions',
    favicon: '/favicon.ico',
};

// Private/utility routes are never indexed (same list as the app).
const NOINDEX_PREFIXES = ['/admin', '/cart', '/checkout', '/orders', '/settings', '/login', '/signup'];
// One customer's order (/track-order/1042); the Track order page itself is indexed.
const NOINDEX_PATTERNS = [/^\/track-order\/./];
const isNoindexPath = (path) => NOINDEX_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
    || NOINDEX_PATTERNS.some(re => re.test(path));
const isAdminPath = (path) => /^\/admin(\/|$)/.test(path);

/* '/metals/?x=1#y' -> '/metals' ; always starts with one /. */
function cleanPath(raw) {
    let p = String(raw || '/').split(/[?#]/)[0].replace(/\/{2,}/g, '/');
    if (!p.startsWith('/')) p = `/${p}`;
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return (p || '/').slice(0, 300);
}

const ORIGIN_RE = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i;
const cleanOrigin = (value) => (typeof value === 'string' && value.length <= 200 && ORIGIN_RE.test(value) ? value.toLowerCase() : '');

const short = (value, max = 300) => {
    const s = String(value || '').replace(/\s+/g, ' ').trim();
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).replace(/[\s,.;:–-]+$/, '')}…`;
};

/* Admin metal names are typed in capitals; same rule as utils/metalDisplay.js displayMetalName. */
const displayMetalName = (name = '') => {
    if (!/[A-Z]/.test(name) || name !== name.toUpperCase()) return name;
    return name.split(' ').map((word) => {
        if (/[\d&]/.test(word) || !/[AEIOUY]/.test(word)) return word;
        return word.replace(/[A-Z]+/, (letters) => letters[0] + letters.slice(1).toLowerCase());
    }).join(' ');
};

// Link previews (Facebook, LinkedIn…) cannot show AVIF or SVG.
const shareable = (src) => typeof src === 'string'
    && /^(\/(?!\/)|https?:\/\/)[^\s"'<>\\`]+$/i.test(src)
    && !/\.(avif|svg)(\?|#|$)/i.test(src);
const firstShareable = (...list) => list.find(shareable) || '';

const SLUG_RE = /^[A-Za-z0-9._~%-]{1,200}$/;

/*
 * The page's own values when it shows one metal, service or blog post:
 * { title, description, image, canonicalPath, type?, publishedTime?, modifiedTime? } or null.
 */
async function loadPage(path, client = db) {
    let m = path.match(/^\/metal\/([^/]+)$/);
    if (m && SLUG_RE.test(m[1])) {
        const r = await client.query(
            `SELECT slug, id, name, description, image_path, about_section->>'text' AS about
             FROM metals WHERE slug = $1 OR id::text = $1 ORDER BY COALESCE(slug = $1, false) DESC LIMIT 1`, [m[1]]);
        const row = r.rows[0];
        if (!row) return null;
        return {
            title: displayMetalName(row.name || ''),
            description: short(row.description || row.about),
            image: firstShareable(row.image_path),
            canonicalPath: `/metal/${row.slug || row.id}`,
        };
    }
    m = path.match(/^\/service\/([^/]+)$/);
    if (m && SLUG_RE.test(m[1])) {
        const r = await client.query(
            `SELECT s.slug, s.title, s.description, s.image_path, hs.hero_image
             FROM services s LEFT JOIN hero_sections hs ON hs.service_id = s.id
             WHERE s.slug = $1 AND COALESCE(s.is_active, true) = true LIMIT 1`, [m[1]]);
        const row = r.rows[0];
        if (!row) return null;
        const hero = row.hero_image && typeof row.hero_image === 'object' ? row.hero_image : {};
        return {
            title: row.title || '',
            description: short(row.description),
            image: firstShareable(hero.jpg, hero.webp, hero.src, row.image_path),
            canonicalPath: `/service/${row.slug}`,
        };
    }
    m = path.match(/^\/blog\/([^/]+)$/);
    if (m && SLUG_RE.test(m[1])) {
        const cols = 'p.slug, p.title, p.excerpt, p.seo_title, p.seo_description, p.og_image, p.cover_image, p.published_at, p.updated_at';
        let r = await client.query(`SELECT ${cols} FROM blog_posts p WHERE p.slug = $1 AND ${PUBLIC_WHERE} LIMIT 1`, [m[1]]);
        // An old address of a renamed post: the post, with its current address as canonical.
        if (!r.rowCount) r = await client.query(`SELECT ${cols} FROM blog_posts p WHERE $1 = ANY(p.previous_slugs) AND ${PUBLIC_WHERE} ORDER BY p.published_at DESC LIMIT 1`, [m[1]]);
        const row = r.rows[0];
        if (!row) return null;
        const iso = (d) => (d ? new Date(d).toISOString() : '');
        return {
            title: row.seo_title || row.title || '',
            description: short(row.seo_description || row.excerpt),
            image: firstShareable(row.og_image, row.cover_image),
            canonicalPath: `/blog/${row.slug}`,
            type: 'article',
            publishedTime: iso(row.published_at),
            modifiedTime: iso(row.updated_at || row.published_at),
        };
    }
    return null;
}

/* For the admin preview: '/metal/*' -> the first metal's page, etc. */
async function examplePath(key, client = db) {
    const queries = {
        '/metal/*': `SELECT COALESCE(slug, id::text) AS slug FROM metals ORDER BY display_order, id LIMIT 1`,
        '/service/*': `SELECT slug FROM services WHERE COALESCE(is_active, true) = true AND slug IS NOT NULL ORDER BY display_order, id LIMIT 1`,
        '/blog/*': `SELECT p.slug FROM blog_posts p WHERE ${PUBLIC_WHERE} ORDER BY p.published_at DESC LIMIT 1`,
    };
    if (!queries[key]) return key;
    const r = await client.query(queries[key]);
    return r.rows[0]?.slug ? `${key.slice(0, -1)}${r.rows[0].slug}` : `${key.slice(0, -1)}example`;
}

const absoluteUrl = (value, base) => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    return base ? `${base}${value.startsWith('/') ? '' : '/'}${value}` : value;
};

const iconType = (href) => {
    const ext = (String(href).split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
    return { ico: 'image/x-icon', svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', gif: 'image/gif', jpg: 'image/jpeg', jpeg: 'image/jpeg' }[ext] || '';
};

/* The identity that lets an admin tag replace a built-in one. */
function overrideKey(tag, attrs) {
    if (tag === 'meta') {
        if (attrs.name) return `meta:name:${attrs.name.toLowerCase()}`;
        if (attrs.property) return `meta:property:${attrs.property.toLowerCase()}`;
    }
    if (tag === 'link' && attrs.rel) {
        const rel = attrs.rel.toLowerCase().split(/\s+/).filter(r => r !== 'shortcut').sort().join(' ');
        return `link:${rel}:${attrs.sizes || ''}:${attrs.hreflang || ''}:${attrs.media || ''}`;
    }
    return null;
}

/*
 * Built-in tags. page: the page's own values (loadPage) or null; meta: the
 * validated seo_meta; base: site address for absolute URLs ('' = leave relative).
 * path null = only what every page shares (no canonical, no page text).
 */
/*
 * The business itself (schema.org LocalBusiness) for the home and contact
 * pages, from Admin > Contact (footer_contact), the header logo and the social
 * links. Social links that are only a network's home page
 * (https://linkedin.com) are left out: they are not the shop's profile.
 */
const BUSINESS_PATHS = new Set(['/', '/contact']);

function postalAddress(text) {
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return null;
    // "10723 Colewood ln Dallas Texas, 75243" / "…, Dallas, TX 75243"
    const m = raw.match(/^(.+?),\s*([^,]+?),?\s+(Texas|TX)\s*,?\s*(\d{5}(?:-\d{4})?)$/i) // "street, City, TX 75243"
        || raw.match(/^(.+)\s+([A-Za-z.'-]+)\s+(Texas|TX)\s*,?\s*(\d{5}(?:-\d{4})?)$/i); // "street City Texas, 75243"
    if (!m) return { '@type': 'PostalAddress', streetAddress: raw, addressCountry: 'US' };
    return {
        '@type': 'PostalAddress',
        streetAddress: m[1].trim().replace(/\bln$/i, 'Ln'),
        addressLocality: m[2].trim(),
        addressRegion: 'TX',
        postalCode: m[4],
        addressCountry: 'US',
    };
}

function businessTag(meta, settings, base) {
    const contact = settings.footer_contact && typeof settings.footer_contact === 'object' ? settings.footer_contact : {};
    const logo = typeof settings.navbar_logo === 'string' && settings.navbar_logo ? absoluteUrl(settings.navbar_logo, base) : '';
    const sameAs = (Array.isArray(settings.social_links) ? settings.social_links : [])
        .filter(l => l && l.enabled !== false && /^https:\/\/[^/\s]+\/[^\s]+$/i.test(String(l.url || '')))
        .map(l => l.url);
    const digits = String(contact.phone || '').replace(/[^\d+]/g, '');
    const data = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: meta.defaults.siteName || 'Dynamic Manufacturing Solutions',
        description: meta.defaults.description || undefined,
        url: base ? `${base}/` : undefined,
        logo: logo || undefined,
        image: logo || undefined,
        email: contact.email || undefined,
        telephone: digits || undefined,
        address: postalAddress(contact.address) || undefined,
        areaServed: { '@type': 'Country', name: 'United States' },
        sameAs: sameAs.length ? sameAs : undefined,
    };
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    return { tag: 'script', attrs: { type: 'application/ld+json' }, content: json };
}

function builtIns(meta, path, page, base) {
    const d = meta.defaults;
    const own = page || (path ? meta.pages[path] : null) || {};
    const ownTitle = own.title || '';
    const ownDescription = own.description || '';
    const template = d.titleTemplate && d.titleTemplate.includes('%s') ? d.titleTemplate : '';

    // Like the app: the template wraps page titles; the default title is used as is.
    const title = ownTitle ? (template ? template.replace('%s', () => ownTitle) : ownTitle) : (d.title || FALLBACK.title);
    const description = ownDescription || d.description || FALLBACK.description;
    const ogTitle = ownTitle ? title : (d.ogTitle || title);
    const ogDescription = ownDescription || d.ogDescription || description;
    const image = absoluteUrl(own.image || own.ogImage || d.ogImage, base);
    const noindex = d.robots === 'noindex' || Boolean(path && isNoindexPath(path));
    const canonicalPath = path ? (own.canonicalPath || path) : '';
    const canonical = base && canonicalPath ? `${base}${canonicalPath}` : '';
    const article = own.type === 'article';

    const tags = [{ tag: 'title', content: title }];
    const meta_ = (key, value, attr = 'name') => { if (value) tags.push({ tag: 'meta', attrs: { [attr]: key, content: value } }); };
    const link = (attrs) => tags.push({ tag: 'link', attrs });

    meta_('description', description);
    meta_('keywords', d.keywords);
    meta_('robots', noindex ? 'noindex, nofollow' : 'index, follow');
    if (canonical) link({ rel: 'canonical', href: canonical });
    meta_('google-site-verification', d.googleVerification);
    meta_('og:type', article ? 'article' : 'website', 'property');
    meta_('og:site_name', d.siteName || FALLBACK.siteName, 'property');
    meta_('og:title', ogTitle, 'property');
    meta_('og:description', ogDescription, 'property');
    meta_('og:image', image, 'property');
    meta_('og:url', canonical, 'property');
    if (article) {
        meta_('article:published_time', own.publishedTime, 'property');
        meta_('article:modified_time', own.modifiedTime, 'property');
    }
    meta_('twitter:card', image ? d.twitterCard || 'summary_large_image' : 'summary');
    meta_('twitter:site', d.twitterSite);
    meta_('twitter:title', ogTitle);
    meta_('twitter:description', ogDescription);
    meta_('twitter:image', image);
    const favicon = d.favicon || FALLBACK.favicon;
    link({ rel: 'icon', ...(iconType(favicon) ? { type: iconType(favicon) } : {}), href: favicon });
    if (d.appleTouchIcon) link({ rel: 'apple-touch-icon', href: d.appleTouchIcon });
    meta_('theme-color', d.themeColor);
    return tags;
}

/* The admin's tags for this path, in their order, noscript ones last. */
function customTags(headTags, path) {
    if (path && isAdminPath(path)) return [];
    const list = (headTags.tags || []).filter(t => t.enabled && appliesTo(t.pages, path || '\u0000') && (path || t.pages === 'all'));
    const toOutput = (t) => {
        const attrs = {};
        for (const [name, value] of Object.entries(t.attrs || {})) attrs[name] = value === true ? '' : String(value);
        const out = { tag: t.tag, attrs };
        if (t.tag === 'script' || t.tag === 'noscript') {
            // JSON-LD: < written as < so the text can never close the script.
            out.content = t.attrs?.type === 'application/ld+json' ? String(t.content || '').replace(/</g, '\\u003c') : String(t.content || '');
        }
        return out;
    };
    return [...list.filter(t => t.tag !== 'noscript'), ...list.filter(t => t.tag === 'noscript')].map(toOutput);
}

// ── HTML ────────────────────────────────────────────────────────────────

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function tagHtml(t) {
    if (t.tag === 'title') return `<title>${escapeText(t.content)}</title>`;
    const attrs = Object.entries(t.attrs || {})
        .map(([name, value]) => (value === '' ? ` ${name}` : ` ${name}="${escapeAttr(value)}"`))
        .join('');
    if (t.tag === 'meta' || t.tag === 'link') return `<${t.tag}${attrs} data-head="dms">`;
    // script / noscript bodies were checked when saved (seo/headTags.js) and cannot close the tag early.
    return `<${t.tag}${attrs} data-head="dms">${t.content || ''}</${t.tag}>`;
}

const toHtml = (tags) => tags.map(tagHtml).join('\n  ');

// site_settings.value is JSON text (or already parsed, depending on the column type).
const parseValue = (raw) => {
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); } catch { return raw; }
};

/* Stored settings, made safe to use (a value that no longer validates counts as empty). */
function settle(raw, validate, fallback) {
    const checked = validate(raw ?? {});
    if (checked.error) console.warn('[seo head] ignoring an invalid setting:', checked.error);
    return checked.value || fallback;
}

/*
 * The page's tags. seoMeta / headTags: values to use instead of the saved
 * ones (already validated: the admin preview); origin: the address the
 * visitor used, for absolute URLs when no site address is set.
 * withFallback: also return `fallback`, the HTML of what every page shares.
 * annotate (admin preview): each tag also gets source 'site' or 'yours',
 * and `replaced` lists the built-in tags the admin's own replaced.
 */
async function buildHead(rawPath, { origin, seoMeta, headTags, withFallback = false, annotate = false, client = db } = {}) {
    const path = cleanPath(rawPath);
    // Both settings in one query, alongside the page's own data.
    const [stored, page] = await Promise.all([
        seoMeta !== undefined && headTags !== undefined ? {}
            : client.query(`SELECT key, value FROM site_settings WHERE key = ANY($1::text[])`, [['seo_meta', 'head_tags', 'footer_contact', 'navbar_logo', 'social_links']])
                .then(r => Object.fromEntries(r.rows.map(row => [row.key, parseValue(row.value)]))),
        loadPage(path, client).catch((err) => {
            console.warn('[seo head] could not read the page data for', path, err.message);
            return null;
        }),
    ]);
    const meta = settle(seoMeta === undefined ? stored.seo_meta : seoMeta, validateSeoMeta, validateSeoMeta({}).value);
    const custom = settle(headTags === undefined ? stored.head_tags : headTags, validateHeadTags, { tags: [] });
    const base = meta.defaults.siteUrl || cleanOrigin(origin);

    const dropped = [];
    const assemble = (forPath, forPage) => {
        const own = customTags(custom, forPath);
        const replaced = new Set(own.map(t => overrideKey(t.tag, t.attrs)).filter(Boolean));
        const built = builtIns(meta, forPath, forPage, base).filter((t) => {
            const hit = replaced.has(overrideKey(t.tag, t.attrs || {}));
            if (hit && forPath) dropped.push(tagHtml(t));
            return !hit;
        });
        if (!annotate) return [...built, ...own];
        return [...built.map(t => ({ ...t, source: 'site' })), ...own.map(t => ({ ...t, source: 'yours' }))];
    };

    const tags = assemble(path, page);
    // Business details on the home and contact pages (before any <noscript>, which stays last).
    if (BUSINESS_PATHS.has(path) && !annotate) {
        const at = tags.findIndex(t => t.tag === 'noscript');
        tags.splice(at === -1 ? tags.length : at, 0, businessTag(meta, stored, base));
    }
    const result = { path, title: tags[0].content, tags, html: toHtml(tags) };
    if (annotate) result.replaced = dropped;
    if (withFallback) result.fallback = toHtml(assemble(null, null));
    return result;
}

module.exports = { buildHead, examplePath, cleanPath, FALLBACK };

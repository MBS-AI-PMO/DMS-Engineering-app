/**
 * seo.js - Client-side head manager for the admin-managed `seo_meta` setting.
 *
 * The server puts each page's tags into its HTML (client/vite/headTags.js,
 * built by backend/seo/head.js). On every route change SeoTrackingManager
 * asks for the new page's list (services/pageHead.js) and applyHeadTags()
 * swaps the tags marked data-head="dms". applySeo()/resolveSeo() below are
 * the fallback when that request fails, and drive the admin previews.
 * Values are only ever written with textContent / setAttribute (never as HTML).
 *
 * Setting shape (validated by backend/utils/seoSettings.js):
 *   { defaults: { siteName, title, titleTemplate, description, keywords, siteUrl,
 *                 robots, googleVerification, ogTitle, ogDescription, ogImage,
 *                 twitterCard, twitterSite, favicon, appleTouchIcon, themeColor },
 *     pages: { '/metals': { title, description, ogImage }, ... } }
 */

// Public routes that can carry per-page overrides. Keep in sync with
// SEO_PAGE_PATHS in backend/utils/seoSettings.js.
export const SEO_PAGES = [
    { path: '/', label: 'Home' },
    { path: '/get-instant-pricing', label: 'Instant Pricing' },
    { path: '/metals', label: 'Metals' },
    { path: '/services', label: 'Services' },
    { path: '/guidelines', label: 'Guidelines' },
    { path: '/faq', label: 'FAQ' },
    { path: '/contact', label: 'Contact' },
    { path: '/about', label: 'About' },
    { path: '/quote', label: 'Quote' },
    { path: '/privacy-policy', label: 'Privacy Policy' },
    { path: '/terms-of-service', label: 'Terms of Service' },
    { path: '/blog', label: 'Blog' },
    { path: '/track-order', label: 'Track order' },
];
const SEO_PAGE_SET = new Set(SEO_PAGES.map(p => p.path));

// Private/utility routes are always noindex regardless of the site setting.
const NOINDEX_PREFIXES = ['/admin', '/cart', '/checkout', '/orders', '/settings', '/login', '/signup'];
// One customer's order (/track-order/1042); the Track order page itself is indexed.
const NOINDEX_PATTERNS = [/^\/track-order\/./];

export const isAdminPath = (pathname = '') => /^\/admin(\/|$)/.test(pathname);

// Dispatched on window by the admin SEO page after a successful save.
export const SEO_SETTINGS_SAVED_EVENT = 'dms:seo-settings-saved';

const text = (value, max = 500) => (
    typeof value === 'string' || typeof value === 'number'
        ? String(value).replace(/\s+/g, ' ').trim().slice(0, max)
        : ''
);

export const isSafeImageUrl = (value) => {
    if (typeof value !== 'string' || !value || /[\s"'<>\\`]/.test(value)) return false;
    if (value.startsWith('/') && !value.startsWith('//')) return true;
    return /^https?:\/\/[^/]/i.test(value);
};

const imageUrl = (value) => (isSafeImageUrl(value) ? value.slice(0, 1000) : '');

/** Normalize whatever is stored (or missing) into the full, safe shape. */
export function normalizeSeoMeta(raw) {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const d = src.defaults && typeof src.defaults === 'object' ? src.defaults : {};
    const template = text(d.titleTemplate, 150);
    const siteUrl = /^https?:\/\/[^/\s]+$/i.test(text(d.siteUrl, 200)) ? text(d.siteUrl, 200) : '';
    const defaults = {
        siteName: text(d.siteName, 100),
        title: text(d.title, 150),
        titleTemplate: template.includes('%s') ? template : '',
        description: text(d.description),
        keywords: text(d.keywords),
        siteUrl,
        robots: d.robots === 'noindex' ? 'noindex' : 'index',
        googleVerification: /^[A-Za-z0-9_-]{10,100}$/.test(d.googleVerification || '') ? d.googleVerification : '',
        ogTitle: text(d.ogTitle, 150),
        ogDescription: text(d.ogDescription),
        ogImage: imageUrl(d.ogImage),
        twitterCard: d.twitterCard === 'summary' ? 'summary' : 'summary_large_image',
        twitterSite: /^@[A-Za-z0-9_]{1,15}$/.test(d.twitterSite || '') ? d.twitterSite : '',
        favicon: imageUrl(d.favicon),
        appleTouchIcon: imageUrl(d.appleTouchIcon),
        themeColor: /^#[0-9a-f]{6}$/i.test(d.themeColor || '') ? d.themeColor.toLowerCase() : '',
    };
    const pages = {};
    const p = src.pages && typeof src.pages === 'object' ? src.pages : {};
    for (const path of Object.keys(p)) {
        if (!SEO_PAGE_SET.has(path) || !p[path] || typeof p[path] !== 'object') continue;
        pages[path] = {
            title: text(p[path].title, 150),
            description: text(p[path].description),
            ogImage: imageUrl(p[path].ogImage),
        };
    }
    return { defaults, pages };
}

const normalizePath = (pathname = '/') => (pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/') || '/';

// Tags a page sets from its own data (a blog post: its title, description,
// picture). They count for that one path only and win over the admin's
// page override. SeoTrackingManager re-applies the head when they change.
export const SEO_ROUTE_EVENT = 'dms:seo-route';
let routeSeo = null;

/**
 * seo: { title, description, image, type ('article'), publishedTime, modifiedTime }
 * or null to drop what this path set.
 */
export function setRouteSeo(pathname, seo) {
    const path = normalizePath(pathname);
    if (seo) routeSeo = { ...seo, path };
    else if (routeSeo && routeSeo.path === path) routeSeo = null;
    else return;
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SEO_ROUTE_EVENT));
}

const absoluteUrl = (value, base) => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    return `${base}${value.startsWith('/') ? '' : '/'}${value}`;
};

/**
 * Resolve the tags for a route. `fallback` holds the static index.html values
 * used when nothing is configured.
 */
export function resolveSeo(meta, pathname, fallback = {}, origin = '') {
    const { defaults: d, pages } = normalizeSeoMeta(meta);
    const path = normalizePath(pathname);
    const own = routeSeo && routeSeo.path === path ? routeSeo : null;
    const page = own
        ? { title: text(own.title, 150), description: text(own.description), ogImage: imageUrl(own.image) }
        : pages[path] || {};
    const base = d.siteUrl || origin;

    // Like react-helmet: the template wraps page titles; the default title is used as is.
    const title = page.title
        ? (d.titleTemplate ? d.titleTemplate.replace('%s', page.title) : page.title)
        : (d.title || fallback.title || '');
    const description = page.description || d.description || fallback.description || '';
    const ogTitle = page.title ? title : (d.ogTitle || title);
    const ogDescription = page.description || d.ogDescription || description;
    const image = absoluteUrl(page.ogImage || d.ogImage, base);
    const noindex = d.robots === 'noindex' || NOINDEX_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
        || NOINDEX_PATTERNS.some(re => re.test(path));
    const canonical = base ? `${base}${path === '/' ? '/' : path}` : '';

    return {
        title,
        description,
        keywords: d.keywords,
        robots: noindex ? 'noindex, nofollow' : 'index, follow',
        canonical,
        googleVerification: d.googleVerification,
        article: own?.type === 'article' ? {
            published_time: text(own.publishedTime, 40),
            modified_time: text(own.modifiedTime, 40),
        } : {},
        og: {
            type: own?.type === 'article' ? 'article' : 'website',
            site_name: d.siteName || fallback.siteName || '',
            title: ogTitle,
            description: ogDescription,
            image,
            url: canonical,
        },
        twitter: {
            card: image ? d.twitterCard : 'summary',
            site: d.twitterSite,
            title: ogTitle,
            description: ogDescription,
            image,
        },
    };
}

// ── DOM helpers ─────────────────────────────────────────────────────────────

const upsertMeta = (attr, key, content) => {
    if (typeof document === 'undefined') return;
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!content) {
        if (el) el.remove();
        return;
    }
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    if (el.getAttribute('content') !== content) el.setAttribute('content', content);
};

const upsertCanonical = (href) => {
    let el = document.head.querySelector('link[rel="canonical"]');
    if (!href) {
        if (el) el.remove();
        return;
    }
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', 'canonical');
        document.head.appendChild(el);
    }
    if (el.getAttribute('href') !== href) el.setAttribute('href', href);
};

// Static values shipped in index.html, captured once before we change anything.
let staticFallback = null;
const getStaticFallback = () => {
    if (!staticFallback && typeof document !== 'undefined') {
        const read = (sel) => document.head.querySelector(sel)?.getAttribute('content') || '';
        staticFallback = {
            title: document.title,
            description: read('meta[name="description"]'),
            siteName: read('meta[property="og:site_name"]'),
        };
    }
    return staticFallback || {};
};

/** Apply `seo_meta` (raw setting value) for the given route to document.head. */
export function applySeo(meta, pathname) {
    if (typeof document === 'undefined') return null;
    const tags = resolveSeo(meta, pathname, getStaticFallback(), window.location.origin);

    if (tags.title && document.title !== tags.title) document.title = tags.title;
    upsertMeta('name', 'description', tags.description);
    upsertMeta('name', 'keywords', tags.keywords);
    upsertMeta('name', 'robots', tags.robots);
    upsertMeta('name', 'google-site-verification', tags.googleVerification);
    Object.entries(tags.og).forEach(([key, value]) => upsertMeta('property', `og:${key}`, value));
    ['published_time', 'modified_time'].forEach(key => upsertMeta('property', `article:${key}`, tags.article[key]));
    Object.entries(tags.twitter).forEach(([key, value]) => upsertMeta('name', `twitter:${key}`, value));
    upsertCanonical(tags.canonical);
    return tags;
}

/**
 * Structured data (JSON-LD) for the current page, e.g. a blog post's
 * BlogPosting. Written as the text of a <script type="application/ld+json">
 * in <head> (never parsed as HTML); null removes it.
 */
export function setJsonLd(id, data) {
    if (typeof document === 'undefined') return;
    const elId = `ld-${id}`;
    let el = document.getElementById(elId);
    if (!data) {
        if (el) el.remove();
        return;
    }
    if (!el) {
        el = document.createElement('script');
        el.type = 'application/ld+json';
        el.id = elId;
        document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
}

// ── The server's tag list (GET /api/seo/head) ───────────────────────────────

const HEAD_MARK = 'data-head';
const HEAD_ELEMENTS = new Set(['meta', 'link', 'script', 'noscript']);
const ATTR_NAME_RE = /^[a-z][a-z0-9:._-]*$/i;

/* One string per tag: name, attributes (sorted, without the mark) and text.
 * The HTML parser turns \r\n into \n, so text is compared the same way. */
const headKey = (tag, attrs, content) => [
    tag,
    ...Object.keys(attrs).filter(name => name !== HEAD_MARK).sort().map(name => `${name}=${attrs[name]}`),
    tag === 'script' || tag === 'noscript' ? String(content || '').replace(/\r\n?/g, '\n') : '',
].join('\u0001');

const elementKey = (el) => {
    const attrs = {};
    for (const a of el.attributes) attrs[a.name] = a.value;
    return headKey(el.tagName.toLowerCase(), attrs, el.textContent);
};

/**
 * Make <head> match a page's list from the server: { title, tags: [{ tag,
 * attrs, content? }] }. Only elements marked data-head="dms" are touched:
 * those on both pages stay as they are (a script never runs twice), the
 * previous page's others go, the new page's are added in list order.
 */
export function applyHeadTags(head) {
    if (typeof document === 'undefined' || !head) return;
    if (typeof head.title === 'string' && head.title && document.title !== head.title) document.title = head.title;

    const present = new Map(); // key -> [element]
    document.head.querySelectorAll(`[${HEAD_MARK}="dms"]`).forEach((el) => {
        const key = elementKey(el);
        if (!present.has(key)) present.set(key, []);
        present.get(key).push(el);
    });

    let previous = null;
    for (const t of Array.isArray(head.tags) ? head.tags : []) {
        if (!t || !HEAD_ELEMENTS.has(t.tag)) continue; // <title> is set above
        const attrs = t.attrs && typeof t.attrs === 'object' ? t.attrs : {};
        const kept = present.get(headKey(t.tag, attrs, t.content))?.shift();
        if (kept) {
            previous = kept;
            continue;
        }
        const el = document.createElement(t.tag);
        Object.entries(attrs).forEach(([name, value]) => {
            if (ATTR_NAME_RE.test(name) && name !== HEAD_MARK) el.setAttribute(name, String(value));
        });
        el.setAttribute(HEAD_MARK, 'dms');
        if (t.tag === 'script' || t.tag === 'noscript') el.textContent = t.content || '';
        if (previous && previous.parentNode === document.head) previous.after(el);
        else document.head.appendChild(el);
        previous = el;
    }
    present.forEach(list => list.forEach(el => el.remove()));
}

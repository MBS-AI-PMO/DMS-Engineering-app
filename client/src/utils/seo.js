/**
 * seo.js - Client-side head manager for the admin-managed `seo_meta` setting.
 *
 * Applies site-wide defaults plus the current route's override on every route
 * change: document.title, <meta name|property> tags and <link rel=canonical>.
 * Values are only ever written with textContent / setAttribute (never as HTML).
 *
 * Setting shape (validated by backend/utils/seoSettings.js):
 *   { defaults: { siteName, title, titleTemplate, description, keywords, siteUrl,
 *                 robots, googleVerification, ogTitle, ogDescription, ogImage,
 *                 twitterCard, twitterSite },
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
];
const SEO_PAGE_SET = new Set(SEO_PAGES.map(p => p.path));

// Private/utility routes are always noindex regardless of the site setting.
const NOINDEX_PREFIXES = ['/admin', '/cart', '/checkout', '/orders', '/settings', '/login', '/signup'];

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
    const page = pages[path] || {};
    const base = d.siteUrl || origin;

    // Like react-helmet: the template wraps page titles; the default title is used as is.
    const title = page.title
        ? (d.titleTemplate ? d.titleTemplate.replace('%s', page.title) : page.title)
        : (d.title || fallback.title || '');
    const description = page.description || d.description || fallback.description || '';
    const ogTitle = page.title ? title : (d.ogTitle || title);
    const ogDescription = page.description || d.ogDescription || description;
    const image = absoluteUrl(page.ogImage || d.ogImage, base);
    const noindex = d.robots === 'noindex' || NOINDEX_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
    const canonical = base ? `${base}${path === '/' ? '/' : path}` : '';

    return {
        title,
        description,
        keywords: d.keywords,
        robots: noindex ? 'noindex, nofollow' : 'index, follow',
        canonical,
        googleVerification: d.googleVerification,
        og: {
            type: 'website',
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
    Object.entries(tags.twitter).forEach(([key, value]) => upsertMeta('name', `twitter:${key}`, value));
    upsertCanonical(tags.canonical);
    return tags;
}

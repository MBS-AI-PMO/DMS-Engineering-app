/*
 * The pages of the public site an FAQ can be placed on, and how a visited
 * address maps to placements.
 *
 *   page key      what is stored in faq_placements.page_key:
 *                   '/about'                     one page
 *                   '/metal/6061-t6-aluminum'    one metal / service page
 *                   '/metal/*', '/service/*'     every page of that type
 *   keysForPath   '/metal/abc' -> ['/metal/abc', '/metal/*'] (exact first)
 *   catalogue     every page admin can pick, grouped main / metal / service
 *
 * The main pages are the SEO pages (utils/seoSettings.js, same list as the
 * client's utils/seo.js SEO_PAGES) without the FAQ page itself, plus the
 * shopping and account pages that use the public layout.
 */
const { SEO_PAGE_PATHS } = require('../utils/seoSettings');
const { badRequest } = require('../helpers');

const LABELS = {
    '/': 'Home',
    '/get-instant-pricing': 'Instant pricing',
    '/metals': 'Metals',
    '/services': 'Services',
    '/guidelines': 'Guidelines',
    '/contact': 'Contact',
    '/about': 'About',
    '/quote': 'Quote',
    '/privacy-policy': 'Privacy policy',
    '/terms-of-service': 'Terms of service',
    '/blog': 'Blog',
    '/track-order': 'Track order',
    '/cart': 'Cart',
    '/checkout': 'Checkout',
    '/orders': 'My orders',
    '/settings': 'Account settings',
};
const EXTRA_PAGES = ['/cart', '/checkout', '/orders', '/settings'];
const NOT_PLACEABLE = new Set(['/faq']); // the FAQ page lists every FAQ already

// '/new-page' -> 'New page' for a page added to the SEO list without a label here.
const labelOf = (key) => LABELS[key] || (key.slice(1).charAt(0).toUpperCase() + key.slice(2)).replace(/-/g, ' ') || key;

const MAIN_PAGES = [...SEO_PAGE_PATHS, ...EXTRA_PAGES]
    .filter((key, i, all) => !NOT_PLACEABLE.has(key) && all.indexOf(key) === i)
    .map(key => ({ key, label: labelOf(key), group: 'main' }));
const MAIN_KEYS = new Set(MAIN_PAGES.map(p => p.key));

const TYPES = {
    metal: { prefix: '/metal/', all: '/metal/*', allLabel: 'All metal pages' },
    service: { prefix: '/service/', all: '/service/*', allLabel: 'All service pages' },
};
const WILDCARDS = new Set(Object.values(TYPES).map(t => t.all));

const MAX_KEY = 300;
const SAFE_PATH = /^\/[a-z0-9\-._~/]*$/;

/**
 * A visited address as a page key: lower case, no query or hash, no trailing
 * slash. null when it is not a plain site path.
 */
function normalizePath(raw) {
    if (typeof raw !== 'string') return null;
    let path = raw.trim().split(/[?#]/)[0].toLowerCase();
    try { path = decodeURIComponent(path); } catch { return null; }
    path = path.replace(/\/{2,}/g, '/');
    if (path.length > 1) path = path.replace(/\/+$/, '');
    if (!path.startsWith('/') || path.length > MAX_KEY || !SAFE_PATH.test(path)) return null;
    return path;
}

/** The keys whose FAQs show on a path, the exact page first. */
function keysForPath(path) {
    const segments = path.split('/').filter(Boolean);
    return segments.length >= 2 ? [path, `/${segments[0]}/*`] : [path];
}

/* Metal and service pages, from their tables. */
async function typePages(client) {
    const [metals, services] = await Promise.all([
        client.query('SELECT slug, name FROM metals WHERE slug IS NOT NULL ORDER BY display_order NULLS LAST, name'),
        client.query('SELECT slug, title, is_active FROM services WHERE slug IS NOT NULL ORDER BY display_order NULLS LAST, title'),
    ]);
    return [
        { key: TYPES.metal.all, label: TYPES.metal.allLabel, group: 'metal', wildcard: true },
        ...metals.rows.map(m => ({ key: `${TYPES.metal.prefix}${m.slug}`, label: m.name, group: 'metal' })),
        { key: TYPES.service.all, label: TYPES.service.allLabel, group: 'service', wildcard: true },
        ...services.rows.map(s => ({
            key: `${TYPES.service.prefix}${s.slug}`,
            label: s.title,
            group: 'service',
            ...(s.is_active === false ? { hidden: true } : {}),
        })),
    ];
}

/** Every page admin can choose, in picker order. */
async function catalogue(client) {
    return [...MAIN_PAGES.map(p => ({ ...p })), ...(await typePages(client))];
}

/**
 * Checks page keys sent by admin: each must be a page of the site, except
 * keys listed in `keep` (already stored, e.g. a metal that was renamed since),
 * which stay as they are. Returns the clean, de-duplicated list.
 */
async function checkPageKeys(client, raw, keep = []) {
    const kept = new Set(keep);
    const keys = [];
    for (const value of raw) {
        if (typeof value !== 'string') throw badRequest('Each page must be a page address.');
        const key = kept.has(value) || WILDCARDS.has(value) ? value : normalizePath(value);
        if (!key) throw badRequest(`"${String(value).slice(0, 60)}" is not a page address.`);
        if (!keys.includes(key)) keys.push(key);
    }
    const unknown = keys.filter(k => !kept.has(k) && !MAIN_KEYS.has(k) && !WILDCARDS.has(k));
    if (unknown.length) {
        const known = new Set((await typePages(client)).map(p => p.key));
        const missing = unknown.filter(k => !known.has(k));
        if (missing.length) {
            const reason = missing.some(k => NOT_PLACEABLE.has(k))
                ? 'The FAQ page already lists every FAQ.'
                : 'Pick pages from the list.';
            throw badRequest(`Unknown page: ${missing.slice(0, 3).join(', ')}. ${reason}`);
        }
    }
    return keys;
}

module.exports = { normalizePath, keysForPath, catalogue, checkPageKeys, MAX_KEY };

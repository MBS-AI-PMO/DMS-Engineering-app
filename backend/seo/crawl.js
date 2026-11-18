/*
 * robots.txt and sitemap.xml, built from the site's own data. Served at
 * /api/seo/robots.txt and /api/seo/sitemap.xml; the Vite server (dev and
 * preview) answers /robots.txt and /sitemap.xml with them (client/vite.config.js).
 *
 * The sitemap lists the public pages (utils/seoSettings SEO_PAGE_PATHS), every
 * metal and active service page, and every live blog post, with the date each
 * last changed where the database has one. When Admin > SEO sets the whole
 * site to noindex, the sitemap is empty and robots.txt still allows crawling
 * (crawlers must reach a page to see its noindex tag).
 */
const db = require('../db');
const { SEO_PAGE_PATHS } = require('../utils/seoSettings');

const ORIGIN_RE = /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i;

// Never in search results: carts, accounts, checkout, admin, one customer's order.
const PRIVATE_PATHS = ['/admin', '/cart', '/checkout', '/orders', '/settings', '/track-order/', '/api/'];

const parse = (raw) => {
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); } catch { return raw; }
};

async function readSeo(client = db) {
    const row = (await client.query("SELECT value FROM site_settings WHERE key = 'seo_meta'")).rows[0];
    return parse(row?.value) || {};
}

/* The site's address: Admin > SEO "Site address", else the address the visitor used. */
function siteBase(seo, req) {
    const set = String(seo?.defaults?.siteUrl || '').trim().replace(/\/+$/, '');
    if (ORIGIN_RE.test(set)) return set;
    const host = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
    const proto = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    const guess = `${proto}://${host}`;
    return ORIGIN_RE.test(guess) ? guess : 'https://dmscuts.com';
}

function robotsTxt(base) {
    return [
        'User-agent: *',
        'Allow: /',
        ...PRIVATE_PATHS.map(p => `Disallow: ${p}`),
        '',
        `Sitemap: ${base}/sitemap.xml`,
        '',
    ].join('\n');
}

const day = (value) => {
    const d = value ? new Date(value) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
};
const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function sitemapEntries(client = db) {
    const [metals, services, posts] = [
        await client.query("SELECT slug, updated_at FROM metals WHERE slug IS NOT NULL AND slug <> '' ORDER BY display_order NULLS LAST, name"),
        await client.query("SELECT slug FROM services WHERE slug IS NOT NULL AND slug <> '' AND COALESCE(is_active, true) ORDER BY display_order NULLS LAST, title"),
        await client.query(`SELECT slug, COALESCE(updated_at, published_at) AS changed FROM blog_posts p
                            WHERE p.status IN ('scheduled', 'published') AND p.published_at <= NOW() ORDER BY published_at DESC`)
            .catch(() => ({ rows: [] })), // no blog table yet
    ];
    return [
        ...SEO_PAGE_PATHS.map(path => ({ path, priority: path === '/' ? '1.0' : '0.8' })),
        ...metals.rows.map(m => ({ path: `/metal/${m.slug}`, lastmod: day(m.updated_at), priority: '0.7' })),
        ...services.rows.map(s => ({ path: `/service/${s.slug}`, priority: '0.7' })),
        ...posts.rows.map(p => ({ path: `/blog/${p.slug}`, lastmod: day(p.changed), priority: '0.6' })),
    ];
}

function sitemapXml(base, entries) {
    const urls = entries.map(e => [
        '  <url>',
        `    <loc>${xmlEscape(base + (e.path === '/' ? '/' : e.path))}</loc>`,
        e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : '',
        `    <priority>${e.priority}</priority>`,
        '  </url>',
    ].filter(Boolean).join('\n'));
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// Built at most once every 10 minutes (the database can be slow to reach).
const TTL_MS = 10 * 60 * 1000;
let cached = null; // { at, key, promise }

async function build(req) {
    const seo = await readSeo();
    const base = siteBase(seo, req);
    const noindex = String(seo?.defaults?.robots || 'index').toLowerCase().startsWith('noindex');
    const key = `${base}|${noindex}`;
    if (cached && cached.key === key && Date.now() - cached.at < TTL_MS) return cached.promise;
    const entry = {
        at: Date.now(),
        key,
        promise: (noindex ? Promise.resolve([]) : sitemapEntries()).then(entries => ({ robots: robotsTxt(base), sitemap: sitemapXml(base, entries), count: entries.length })),
    };
    cached = entry;
    entry.promise.catch(() => { if (cached === entry) cached = null; });
    return entry.promise;
}

const clearCrawlCache = () => { cached = null; };
// Any admin change (a post published, a metal renamed, SEO settings) rebuilds them.
require('../utils/publicCache').onPublicCacheClear(clearCrawlCache);

module.exports = { build, clearCrawlCache, robotsTxt, sitemapXml };

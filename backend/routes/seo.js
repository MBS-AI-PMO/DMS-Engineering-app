/*
 * The <head> tags of the site's pages (seo/head.js). Mounted at /api/seo.
 *
 *   Public  GET  /head?path=/metals[&origin=https://dmscuts.com][&fallback=1]
 *                -> { path, title, tags: [{ tag, attrs, content? }], html[, fallback] }
 *                Built-in tags (seo_meta, and the metal/service/post on that
 *                path) then the admin's own (head_tags). html: the same list as
 *                escaped HTML for <head>; fallback (with fallback=1): the part
 *                every page shares, which the Vite server keeps for when it
 *                cannot reach this route. origin: the address the visitor used,
 *                for full URLs while no site address is set in admin.
 *                The Vite server (client/vite/headTags.js) puts html into every
 *                page it sends; the app applies `tags` when it changes page.
 *                Cached by utils/publicCache (emptied when an admin saves).
 *   Public  GET  /robots.txt, /sitemap.xml  (seo/crawl.js; the Vite server answers /robots.txt and /sitemap.xml with them)
 *   Admin   POST /admin/head-preview  { path, seo_meta?, head_tags? }
 *                -> the same shape, built from the (unsaved) values sent, each
 *                tag with source 'site' | 'yours', plus replaced: [html of the
 *                built-in tags the admin's own replaced]. path may be '/metal/*',
 *                '/service/*' or '/blog/*' (an example page of that kind).
 */
const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, badRequest, validate: v } = require('../helpers');
const { validateSeoMeta } = require('../utils/seoSettings');
const { validateHeadTags } = require('../seo/headTags');
const { buildHead, examplePath } = require('../seo/head');
const crawl = require('../seo/crawl');

const router = express.Router();
const admin = [authenticate, requireAdmin];

const readPath = (value) => {
    const path = v.text(value, 'Page', { required: true, max: 500 });
    if (!path.startsWith('/')) throw badRequest('Page must start with /.');
    return path;
};

router.get('/head', route('load the page tags', async (req, res) => {
    const path = readPath(req.query.path);
    ok(res, await buildHead(path, { origin: req.query.origin, withFallback: v.bool(req.query.fallback) }));
}));

// GET /api/seo/robots.txt and /api/seo/sitemap.xml (served at /robots.txt and /sitemap.xml by the Vite server)
router.get('/robots.txt', route('build robots.txt', async (req, res) => {
    const out = await crawl.build(req);
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('text/plain').send(out.robots);
}));
router.get('/sitemap.xml', route('build the sitemap', async (req, res) => {
    const out = await crawl.build(req);
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('application/xml').send(out.sitemap);
}));

router.post('/admin/head-preview', admin, route('preview the page tags', async (req, res) => {
    // Only reads: this admin request must not empty the public cache (utils/publicCache).
    res.locals.keepPublicCache = true;
    const body = req.body || {};
    const check = (value, validate) => {
        if (value === undefined) return undefined;
        const checked = validate(value);
        if (checked.error) throw badRequest(checked.error);
        return checked.value;
    };
    const seoMeta = check(body.seo_meta, validateSeoMeta);
    const headTags = check(body.head_tags, validateHeadTags);
    const path = await examplePath(readPath(body.path));
    ok(res, await buildHead(path, { origin: body.origin, seoMeta, headTags, annotate: true }));
}));

module.exports = router;

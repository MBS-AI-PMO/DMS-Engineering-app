/*
 * Hero pictures: the wide picture at the top of a public page. Mounted at
 * /api/hero-sections; admin only. Public pages read their picture from
 * GET /api/settings (hero_image for home, page_heroes for the other pages)
 * and from GET /api/services/slug/:slug (hero_image) for service pages.
 * Page list and exact sizes: backend/heroes/slots.js.
 *
 *   GET    /admin               every service with its hero_image
 *   GET    /admin/pages         { pages: [slot + image], service: { size, phone, position } }
 *   POST   /admin/upload        upload a picture -> { avif, webp, jpg, src }
 *   PUT    /admin/pages/:key    set a page's picture   { image: '/uploads/…' }
 *   DELETE /admin/pages/:key    back to the page's built-in picture
 *   PUT    /admin/:serviceId    set a service's hero_image
 *   DELETE /admin/:serviceId    back to the default picture
 */
const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, validate, badRequest, notFound, imageUpload, handleUpload, saveImage, readSetting, writeSetting, withTransaction } = require('../helpers');
const { SITE_PAGES, SERVICE_PAGE, PAGE_KEYS } = require('../heroes/slots');

const router = express.Router();
router.use('/admin', authenticate, requireAdmin);

/* hero_image / page_heroes values are { avif, webp, jpg, src } objects or plain strings. */
const pictureOf = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    return value.webp || value.jpg || value.src || value.avif || '';
};

const pageKey = (raw) => {
    const key = String(raw || '');
    if (!PAGE_KEYS.has(key)) throw notFound('Page hero');
    return key;
};

const pictureUrl = (raw) => {
    const src = typeof raw === 'string' ? raw.trim() : '';
    if (!/^\/uploads\/[\w./-]+\.(webp|avif|jpe?g|png)$/i.test(src) || src.includes('..')) throw badRequest('Upload the picture first, then save it');
    return src;
};

// GET /api/hero-sections/admin
router.get('/admin', route('load the hero sections', async (req, res) => {
    const result = await db.query(`
        SELECT
            s.id AS service_id,
            s.title,
            s.slug,
            s.display_order,
            hs.hero_image,
            hs.updated_at
        FROM services s
        LEFT JOIN hero_sections hs ON hs.service_id = s.id
        ORDER BY s.display_order, s.id
    `);
    ok(res, result.rows);
}));

// GET /api/hero-sections/admin/pages
router.get('/admin/pages', route('load the page heroes', async (req, res) => {
    const [home, pages] = [await readSetting('hero_image', ''), await readSetting('page_heroes', {})];
    ok(res, {
        pages: SITE_PAGES.map(slot => {
            const stored = slot.key === 'home' ? home : pages?.[slot.key];
            return { ...slot, image: pictureOf(stored), updated_at: (slot.key !== 'home' && stored?.updated_at) || null };
        }),
        service: SERVICE_PAGE,
    });
}));

// POST /api/hero-sections/admin/upload — one WebP under uploads/service-heroes.
// Kept whole (not cropped): the page crops it to fit, differently on phones.
router.post('/admin/upload',
    handleUpload(imageUpload({ maxMb: 25, maxFiles: 1 }).single('image'), { maxMb: 25, maxFiles: 1 }),
    route('upload the hero image', async (req, res) => {
        const img = await saveImage(req.file, { folder: 'service-heroes', maxWidth: 2400, thumbWidth: 0, quality: 80 });
        ok(res, { avif: '', webp: img.url, jpg: '', src: img.url });
    }));

// PUT /api/hero-sections/admin/pages/:key
router.put('/admin/pages/:key', route('save the page hero', async (req, res) => {
    const key = pageKey(req.params.key);
    const src = pictureUrl(req.body?.image);
    const updatedAt = new Date().toISOString();
    if (key === 'home') {
        await writeSetting('hero_image', { avif: '', webp: src, jpg: '', src });
    } else {
        await withTransaction(async (client) => {
            await client.query("SELECT pg_advisory_xact_lock(hashtext('page_heroes'))");
            const pages = (await readSetting('page_heroes', {}, client)) || {};
            pages[key] = { src, updated_at: updatedAt };
            await writeSetting('page_heroes', pages, client);
        });
    }
    ok(res, { key, image: src, updated_at: key === 'home' ? null : updatedAt });
}));

// DELETE /api/hero-sections/admin/pages/:key
router.delete('/admin/pages/:key', route('remove the page hero', async (req, res) => {
    const key = pageKey(req.params.key);
    if (key === 'home') {
        await writeSetting('hero_image', '');
    } else {
        await withTransaction(async (client) => {
            await client.query("SELECT pg_advisory_xact_lock(hashtext('page_heroes'))");
            const pages = (await readSetting('page_heroes', {}, client)) || {};
            delete pages[key];
            await writeSetting('page_heroes', pages, client);
        });
    }
    ok(res, undefined, { message: 'Hero picture removed' });
}));

// PUT /api/hero-sections/admin/:serviceId
router.put('/admin/:serviceId', route('save the hero section', async (req, res) => {
    const serviceId = validate.id(req.params.serviceId, 'Service');
    const heroImage = validate.json(req.body.hero_image, 'Hero image', { fallback: {} });
    const result = await db.query(`
        INSERT INTO hero_sections (service_id, hero_image)
        VALUES ($1, $2)
        ON CONFLICT (service_id)
        DO UPDATE SET
            hero_image = EXCLUDED.hero_image,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `, [serviceId, JSON.stringify(heroImage)]);
    ok(res, result.rows[0]);
}));

// DELETE /api/hero-sections/admin/:serviceId
router.delete('/admin/:serviceId', route('remove the hero section', async (req, res) => {
    await db.query('DELETE FROM hero_sections WHERE service_id = $1', [validate.id(req.params.serviceId, 'Service')]);
    ok(res, undefined, { message: 'Hero image removed' });
}));

module.exports = router;

/*
 * Hero pictures for the service pages (/service/:slug). Mounted at
 * /api/hero-sections; admin only. The public page reads the picture through
 * GET /api/services/slug/:slug (hero_image).
 *
 *   GET    /admin              every service with its hero_image
 *   POST   /admin/upload       upload a picture -> { avif, webp, jpg, src }
 *   PUT    /admin/:serviceId   set a service's hero_image
 *   DELETE /admin/:serviceId   back to the default picture
 */
const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, validate, imageUpload, handleUpload, saveImage } = require('../helpers');

const router = express.Router();
router.use('/admin', authenticate, requireAdmin);

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

// POST /api/hero-sections/admin/upload — one WebP under uploads/service-heroes.
// The service page shows webp (or src) when avif/jpg are empty.
router.post('/admin/upload',
    handleUpload(imageUpload({ maxMb: 25, maxFiles: 1 }).single('image'), { maxMb: 25, maxFiles: 1 }),
    route('upload the hero image', async (req, res) => {
        const img = await saveImage(req.file, { folder: 'service-heroes', maxWidth: 2200, thumbWidth: 0, quality: 78 });
        ok(res, { avif: '', webp: img.url, jpg: '', src: img.url });
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

const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure multer for service images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/services');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        cb(null, `${Date.now()}_${name}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp|svg/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) return cb(null, true);
        cb(new Error('Only images (jpg, png, webp, svg) are allowed'));
    }
});

// ── Public ───────────────────────────────────────────────

// GET /api/services — List all services
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM services ORDER BY display_order, id'
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching services:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch services' });
    }
});

// GET /api/services/usage — Services with metal usage counts
router.get('/usage', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT s.*,
                (SELECT COUNT(*) FROM metals m
                 WHERE m.services IS NOT NULL
                   AND jsonb_typeof(m.services) = 'array'
                   AND m.services::jsonb @> to_jsonb(s.id)
                ) as metal_count
            FROM services s
            ORDER BY s.display_order, s.id
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching services usage:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch services usage: ' + err.message });
    }
});

// GET /api/services/:id/metals — Metals using a specific service
router.get('/:id/metals', async (req, res) => {
    try {
        const serviceId = parseInt(req.params.id);
        if (isNaN(serviceId)) {
            return res.status(400).json({ success: false, error: 'Invalid service ID' });
        }

        const result = await db.query(`
            SELECT m.name, m.slug, m.image_path,
                m.services::jsonb @> to_jsonb($1::int) as metal_level,
                EXISTS (
                    SELECT 1 FROM jsonb_array_elements(m.quick_look->'thicknesses') t
                    WHERE t->'services' @> to_jsonb($1::int)
                ) as thickness_level
            FROM metals m
            WHERE m.services::jsonb @> to_jsonb($1::int)
               OR EXISTS (
                    SELECT 1 FROM jsonb_array_elements(m.quick_look->'thicknesses') t
                    WHERE t->'services' @> to_jsonb($1::int)
                )
            ORDER BY m.name
        `, [serviceId]);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching metals for service:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch metals for service' });
    }
});

// ── Admin ────────────────────────────────────────────────

// POST /api/services/admin/upload — Upload service image
router.post('/admin/upload', authenticate, requireAdmin, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const relativePath = `/uploads/services/${req.file.filename}`;
    res.json({ success: true, data: { path: relativePath } });
});

// POST /api/services/admin
router.post('/admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const { title, description, image_path, display_order } = req.body;
        if (!title) return res.status(400).json({ success: false, error: 'Title is required' });

        const result = await db.query(
            'INSERT INTO services (title, description, image_path, display_order) VALUES ($1,$2,$3,$4) RETURNING *',
            [title, description, image_path, display_order || 0]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error creating service:', err);
        res.status(500).json({ success: false, error: 'Failed to create service' });
    }
});

// PUT /api/services/admin/:id
router.put('/admin/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { title, description, image_path, display_order } = req.body;

        const result = await db.query(`
            UPDATE services SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                image_path = COALESCE($3, image_path),
                display_order = COALESCE($4, display_order)
            WHERE id = $5
            RETURNING *
        `, [title, description, image_path, display_order, req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error updating service:', err);
        res.status(500).json({ success: false, error: 'Failed to update service' });
    }
});

// DELETE /api/services/admin/:id
router.delete('/admin/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query('DELETE FROM services WHERE id = $1 RETURNING title', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }
        res.json({ success: true, message: `Service "${result.rows[0].title}" deleted` });
    } catch (err) {
        console.error('Error deleting service:', err);
        res.status(500).json({ success: false, error: 'Failed to delete service' });
    }
});

module.exports = router;

const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { optimizeImage } = require('../utils/imageOptimizer');

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
            'SELECT * FROM services ORDER BY parent_id NULLS FIRST, display_order, id'
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
router.post('/admin/upload', authenticate, requireAdmin, upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    // Optimize the uploaded image immediately
    const optimizedFilename = await optimizeImage(req.file.path);
    const relativePath = `/uploads/services/${optimizedFilename}`;
    
    res.json({ success: true, data: { path: relativePath } });
});

// POST /api/services/admin
router.post('/admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            `INSERT INTO services (
                title, description, image_path, display_order, is_production, parent_id,
                min_length, max_length, min_width, max_width, min_height, max_height,
                dimensions_unit, service_options, base_price
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
            [
                title, description, image_path, display_order || 0, is_production || false, parent_id || null,
                min_length || 0, max_length || 0, min_width || 0, max_width || 0, min_height || 0, max_height || 0,
                dimensions_unit || 'in', JSON.stringify(req.body.service_options || []),
                parseFloat(req.body.base_price) || 0
            ]
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
        const {
            title, description, image_path, display_order, is_production, parent_id,
            min_length, max_length, min_width, max_width, min_height, max_height,
            dimensions_unit
        } = req.body;

        const result = await db.query(`
            UPDATE services SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                image_path = COALESCE($3, image_path),
                display_order = COALESCE($4, display_order),
                is_production = COALESCE($5, is_production),
                parent_id = $6,
                min_length = COALESCE($7, min_length),
                max_length = COALESCE($8, max_length),
                min_width = COALESCE($9, min_width),
                max_width = COALESCE($10, max_width),
                min_height = COALESCE($11, min_height),
                max_height = COALESCE($12, max_height),
                dimensions_unit = COALESCE($13, dimensions_unit),
                service_options = COALESCE($14, service_options),
                base_price = COALESCE($15, base_price)
            WHERE id = $16
            RETURNING *
        `, [
            title, description, image_path, display_order, is_production, parent_id || null,
            min_length, max_length, min_width, max_width, min_height, max_height,
            dimensions_unit,
            JSON.stringify(req.body.service_options),
            parseFloat(req.body.base_price) || 0,
            req.params.id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error updating service:', err);
        res.status(500).json({ success: false, error: 'Failed to update service' });
    }
});

// PUT /api/services/admin/:id/metals — Bulk update metal/thickness assignments for this service
router.put('/admin/:id/metals', authenticate, requireAdmin, async (req, res) => {
    const serviceId = parseInt(req.params.id);
    const { assignments } = req.body; // Array of { id, assigned, thicknesses: [value1, ...] }

    if (!assignments || !Array.isArray(assignments)) {
        return res.status(400).json({ success: false, error: 'Assignments array is required' });
    }

    try {
        await db.query('BEGIN');
        for (const ass of assignments) {
            // 1. Fetch current metal
            const metalRes = await db.query('SELECT id, services, quick_look FROM metals WHERE id = $1', [ass.id]);
            if (metalRes.rows.length === 0) continue;

            let { services, quick_look } = metalRes.rows[0];

            // Normalize services array
            if (!services) services = [];
            else if (typeof services === 'string') {
                try { services = JSON.parse(services); } catch (e) { services = []; }
            }
            if (!Array.isArray(services)) services = [];

            // 2. Update metal-level services
            const numServiceId = parseInt(serviceId);
            if (ass.assigned) {
                if (!services.some(id => Number(id) === numServiceId)) {
                    services.push(numServiceId);
                }
            } else {
                services = services.filter(id => Number(id) !== numServiceId);
            }

            // 3. Update thickness-level services
            if (quick_look && Array.isArray(quick_look.thicknesses)) {
                quick_look.thicknesses = quick_look.thicknesses.map(t => {
                    let tServices = t.services || [];
                    if (!Array.isArray(tServices)) tServices = [];

                    if (ass.thicknesses && ass.thicknesses.includes(t.value)) {
                        if (!tServices.some(id => Number(id) === numServiceId)) {
                            tServices.push(numServiceId);
                        }
                    } else {
                        tServices = tServices.filter(id => Number(id) !== numServiceId);
                    }
                    return { ...t, services: tServices };
                });
            }

            // 4. Save back
            await db.query(
                'UPDATE metals SET services = $1, quick_look = $2 WHERE id = $3',
                [JSON.stringify(services), JSON.stringify(quick_look), ass.id]
            );
        }
        await db.query('COMMIT');
        res.json({ success: true, message: 'Metal assignments updated successfully' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Error updating metal assignments:', err);
        res.status(500).json({ success: false, error: 'Failed to update metal assignments: ' + err.message });
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

const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { optimizeImage } = require('../utils/imageOptimizer');

const router = express.Router();

// Helper to generate slug
const generateSlug = (title) => {
    return title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
};

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
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp|svg/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) return cb(null, true);
        cb(new Error('Only images (jpg, png, webp, svg) are allowed'));
    }
});

// ── Public ───────────────────────────────────────────────

// GET /api/services — List all services with their parent IDs
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT s.*, 
                   COALESCE((
                       SELECT jsonb_agg(parent_id) 
                       FROM service_relationships 
                       WHERE service_id = s.id
                   ), '[]'::jsonb) as parent_ids
            FROM services s 
            ORDER BY s.display_order, s.id
        `);
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
                COALESCE((SELECT jsonb_agg(parent_id) 
                  FROM service_relationships 
                  WHERE service_id = s.id
                ), '[]'::jsonb) as parent_ids,
                s.pricing_config,
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

// GET /api/services/:id/metals — Metals using a specific service (full data for frontend)
router.get('/:id/metals', async (req, res) => {
    try {
        const serviceId = parseInt(req.params.id);
        if (isNaN(serviceId)) {
            return res.status(400).json({ success: false, error: 'Invalid service ID' });
        }

        const result = await db.query(`
            SELECT m.*,
                mc.name as category_name,
                mc.slug as category_slug,
                m.services::jsonb @> to_jsonb($1::int) as metal_level,
                EXISTS (
                    SELECT 1 FROM jsonb_array_elements(
                        CASE WHEN m.quick_look IS NOT NULL AND m.quick_look ? 'thicknesses'
                             THEN m.quick_look->'thicknesses'
                             ELSE '[]'::jsonb END
                    ) t
                    WHERE t->'services' @> to_jsonb($1::int)
                ) as thickness_level
            FROM metals m
            LEFT JOIN metal_categories mc ON m.category_id = mc.id
            WHERE (m.services IS NOT NULL AND jsonb_typeof(m.services::jsonb) = 'array' AND m.services::jsonb @> to_jsonb($1::int))
               OR EXISTS (
                    SELECT 1 FROM jsonb_array_elements(
                        CASE WHEN m.quick_look IS NOT NULL AND m.quick_look ? 'thicknesses'
                             THEN m.quick_look->'thicknesses'
                             ELSE '[]'::jsonb END
                    ) t
                    WHERE t->'services' @> to_jsonb($1::int)
                )
            ORDER BY m.display_order, m.name
        `, [serviceId]);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching metals for service:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch metals for service' });
    }
});

// GET /api/services/slug/:slug — Fetch a single service by its slug
router.get('/slug/:slug', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT s.*, 
              hs.hero_image,
                   COALESCE((
                       SELECT jsonb_agg(parent_id) 
                       FROM service_relationships 
                       WHERE service_id = s.id
                   ), '[]'::jsonb) as parent_ids
            FROM services s 
            LEFT JOIN hero_sections hs ON hs.service_id = s.id
            WHERE s.slug = $1
        `, [req.params.slug]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: true, data: null, message: 'Service not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error fetching service by slug:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch service' });
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
    const {
        title, description, image_path, display_order, is_production, parent_ids,
        min_length, max_length, min_width, max_width, min_height, max_height,
        dimensions_unit, service_options, base_price, pricing_config
    } = req.body;

    try {
        await db.query('BEGIN');

        const serviceSlug = generateSlug(title);

        const serviceResult = await db.query(
            `INSERT INTO services (
                title, description, image_path, display_order, is_production,
                min_length, max_length, min_width, max_width, min_height, max_height,
                dimensions_unit, service_options, base_price, pricing_config, slug
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
            [
                title, description, image_path, display_order || 0, is_production || false,
                min_length || 0, max_length || 0, min_width || 0, max_width || 0, min_height || 0, max_height || 0,
                dimensions_unit || 'in', JSON.stringify(service_options || []),
                parseFloat(base_price) || 0, JSON.stringify(pricing_config || {}), serviceSlug
            ]
        );

        const newService = serviceResult.rows[0];

        // Handle multiple parents
        if (parent_ids && Array.isArray(parent_ids) && parent_ids.length > 0) {
            for (const parentId of parent_ids) {
                await db.query(
                    'INSERT INTO service_relationships (service_id, parent_id) VALUES ($1, $2)',
                    [newService.id, parentId]
                );
            }
        }

        await db.query('COMMIT');

        // Return service with parent_ids
        newService.parent_ids = parent_ids || [];
        res.status(201).json({ success: true, data: newService });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Error creating service:', err);
        res.status(500).json({ success: false, error: 'Failed to create service: ' + err.message });
    }
});

// PUT /api/services/admin/:id
router.put('/admin/:id', authenticate, requireAdmin, async (req, res) => {
    const {
        title, description, image_path, display_order, is_production, parent_ids,
        min_length, max_length, min_width, max_width, min_height, max_height,
        dimensions_unit, service_options, base_price, pricing_config
    } = req.body;

    console.log('UPDATING SERVICE:', req.params.id, 'with parent_ids:', parent_ids);

    try {
        await db.query('BEGIN');

        const result = await db.query(`
            UPDATE services SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                image_path = COALESCE($3, image_path),
                display_order = COALESCE($4, display_order),
                is_production = COALESCE($5, is_production),
                min_length = COALESCE($6, min_length),
                max_length = COALESCE($7, max_length),
                min_width = COALESCE($8, min_width),
                max_width = COALESCE($9, max_width),
                min_height = COALESCE($10, min_height),
                max_height = COALESCE($11, max_height),
                dimensions_unit = COALESCE($12, dimensions_unit),
                service_options = COALESCE($13, service_options),
                base_price = COALESCE($14, base_price),
                pricing_config = COALESCE($15, pricing_config),
                slug = COALESCE($16, slug)
            WHERE id = $17
            RETURNING *
        `, [
            title, description, image_path, display_order, is_production,
            min_length, max_length, min_width, max_width, min_height, max_height,
            dimensions_unit,
            JSON.stringify(service_options),
            parseFloat(base_price) || 0,
            JSON.stringify(pricing_config || {}),
            title ? generateSlug(title) : null,
            req.params.id
        ]);

        if (result.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Service not found' });
        }

        // Update parents
        await db.query('DELETE FROM service_relationships WHERE service_id = $1', [req.params.id]);
        if (parent_ids && Array.isArray(parent_ids)) {
            for (const parentId of parent_ids) {
                await db.query(
                    'INSERT INTO service_relationships (service_id, parent_id) VALUES ($1, $2)',
                    [req.params.id, parentId]
                );
            }
        }

        await db.query('COMMIT');

        const updatedService = result.rows[0];
        updatedService.parent_ids = parent_ids || [];
        res.json({ success: true, data: updatedService });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Error updating service:', err);
        res.status(500).json({ success: false, error: 'Failed to update service: ' + err.message });
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

            // 3. Update thickness-level services in quick_look.thicknesses[n].services (canonical)
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

            // 4. Save back — both quick_look (canonical) and thickness_specs (legacy mirror)
            // Rebuild thickness_specs to mirror quick_look.thicknesses[n].services
            const metalFullRes = await db.query('SELECT thickness_specs FROM metals WHERE id = $1', [ass.id]);
            let thickness_specs = metalFullRes.rows[0]?.thickness_specs || {};
            if (quick_look && Array.isArray(quick_look.thicknesses)) {
                quick_look.thicknesses.forEach(t => {
                    if (!t.value) return;
                    thickness_specs[t.value] = {
                        ...(thickness_specs[t.value] || {}),
                        available_services: (t.services || []).map(id => Number(id))
                    };
                });
            }

            await db.query(
                'UPDATE metals SET services = $1, quick_look = $2, thickness_specs = $3 WHERE id = $4',
                [JSON.stringify(services), JSON.stringify(quick_look), JSON.stringify(thickness_specs), ass.id]
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

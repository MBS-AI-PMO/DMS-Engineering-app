const express = require('express');
const db = require('../db');
const slugify = require('slugify');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── Public Routes ────────────────────────────────────────

// GET /api/metals — List all metals (with optional category filter)
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        let query = `
            SELECT m.*, mc.name as category_name, mc.slug as category_slug
            FROM metals m
            LEFT JOIN metal_categories mc ON m.category_id = mc.id
        `;
        const params = [];

        if (category) {
            query += ' WHERE mc.slug = $1';
            params.push(category);
        }

        query += ' ORDER BY m.display_order, m.id';
        const result = await db.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching metals:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch metals' });
    }
});

// GET /api/metals/:slug — Get single metal by slug
router.get('/:slug', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT m.*, mc.name as category_name, mc.slug as category_slug
            FROM metals m
            LEFT JOIN metal_categories mc ON m.category_id = mc.id
            WHERE m.slug = $1
        `, [req.params.slug]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Metal not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error fetching metal:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch metal' });
    }
});

// GET /api/metals/:slug/services — Get hierarchical services for a metal
router.get('/:slug/services', async (req, res) => {
    try {
        const metalResult = await db.query(`
            SELECT name, services, quick_look
            FROM metals WHERE slug = $1
        `, [req.params.slug]);

        if (metalResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Metal not found' });
        }

        const metal = metalResult.rows[0];
        const metalServiceIds = Array.isArray(metal.services) ? metal.services : [];
        const thicknesses = metal.quick_look?.thicknesses || [];

        // Collect all unique service IDs
        const allIds = new Set(metalServiceIds);
        for (const t of thicknesses) {
            if (Array.isArray(t.services)) {
                t.services.forEach(id => allIds.add(id));
            }
        }

        // Fetch all service objects in one query
        let serviceMap = {};
        if (allIds.size > 0) {
            const svcResult = await db.query(
                'SELECT * FROM services WHERE id = ANY($1) ORDER BY display_order, id',
                [Array.from(allIds)]
            );
            for (const svc of svcResult.rows) {
                serviceMap[svc.id] = svc;
            }
        }

        // Build metal-level services
        const metalLevel = metalServiceIds
            .map(id => serviceMap[id])
            .filter(Boolean);

        // Build thickness-level services
        const thicknessLevel = thicknesses.map(t => ({
            thickness: t.value,
            metric: t.metric,
            services: (Array.isArray(t.services) ? t.services : [])
                .map(id => serviceMap[id])
                .filter(Boolean)
        }));

        res.json({
            success: true,
            data: {
                metalName: metal.name,
                metalLevel,
                thicknessLevel
            }
        });
    } catch (err) {
        console.error('Error fetching metal services:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch metal services' });
    }
});

// ── Admin Routes ─────────────────────────────────────────

// POST /api/admin/metals — Create metal
router.post('/admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, category_id, thickness, description, image_path,
                quick_look, services, specifications, thickness_specs,
                about_section, faqs, custom_fields, display_order } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Name is required' });
        }

        const slug = slugify(name, { lower: true, strict: true });

        // Check slug uniqueness
        const existing = await db.query('SELECT id FROM metals WHERE slug = $1', [slug]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, error: 'A metal with this name already exists' });
        }

        const result = await db.query(`
            INSERT INTO metals (slug, name, category_id, thickness, description, image_path,
                quick_look, services, specifications, thickness_specs,
                about_section, faqs, custom_fields, display_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            RETURNING *
        `, [slug, name, category_id, thickness, description, image_path,
            JSON.stringify(quick_look || {}), JSON.stringify(services || []),
            JSON.stringify(specifications || {}), JSON.stringify(thickness_specs || {}),
            JSON.stringify(about_section || {}), JSON.stringify(faqs || []),
            JSON.stringify(custom_fields || {}), display_order || 0]);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error creating metal:', err);
        res.status(500).json({ success: false, error: 'Failed to create metal' });
    }
});

// POST /api/admin/metals/upload-image — Upload metal image
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const metalUploadDir = path.join(__dirname, '..', 'uploads', 'metals');
if (!fs.existsSync(metalUploadDir)) fs.mkdirSync(metalUploadDir, { recursive: true });

const metalStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, metalUploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `metal-${Date.now()}${ext}`);
    }
});
const metalUpload = multer({ storage: metalStorage });

router.post('/admin/upload-image', authenticate, requireAdmin, metalUpload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image uploaded' });
    }
    const imagePath = `/uploads/metals/${req.file.filename}`;
    res.json({ success: true, data: { image_path: imagePath } });
});

// PUT /api/admin/metals/:slug — Update metal
router.put('/admin/:slug', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, category_id, thickness, description, image_path,
                quick_look, services, specifications, thickness_specs,
                about_section, faqs, custom_fields, display_order } = req.body;

        // Check if exists
        const existing = await db.query('SELECT id FROM metals WHERE slug = $1', [req.params.slug]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Metal not found' });
        }

        let newSlug = req.params.slug;
        if (name) {
            newSlug = slugify(name, { lower: true, strict: true });
            // Check uniqueness if slug changed
            if (newSlug !== req.params.slug) {
                const slugCheck = await db.query('SELECT id FROM metals WHERE slug = $1 AND id != $2', [newSlug, existing.rows[0].id]);
                if (slugCheck.rows.length > 0) {
                    return res.status(409).json({ success: false, error: 'A metal with this name already exists' });
                }
            }
        }

        const result = await db.query(`
            UPDATE metals SET
                slug = COALESCE($1, slug),
                name = COALESCE($2, name),
                category_id = COALESCE($3, category_id),
                thickness = COALESCE($4, thickness),
                description = COALESCE($5, description),
                image_path = COALESCE($6, image_path),
                quick_look = COALESCE($7, quick_look),
                services = COALESCE($8, services),
                specifications = COALESCE($9, specifications),
                thickness_specs = COALESCE($10, thickness_specs),
                about_section = COALESCE($11, about_section),
                faqs = COALESCE($12, faqs),
                custom_fields = COALESCE($13, custom_fields),
                display_order = COALESCE($14, display_order)
            WHERE slug = $15
            RETURNING *
        `, [
            newSlug, name, category_id, thickness, description, image_path,
            quick_look ? JSON.stringify(quick_look) : null,
            services ? JSON.stringify(services) : null,
            specifications ? JSON.stringify(specifications) : null,
            thickness_specs ? JSON.stringify(thickness_specs) : null,
            about_section ? JSON.stringify(about_section) : null,
            faqs ? JSON.stringify(faqs) : null,
            custom_fields ? JSON.stringify(custom_fields) : null,
            display_order, req.params.slug
        ]);

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error updating metal:', err);
        res.status(500).json({ success: false, error: 'Failed to update metal' });
    }
});

// DELETE /api/admin/metals/:slug — Delete metal
router.delete('/admin/:slug', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query('DELETE FROM metals WHERE slug = $1 RETURNING id, name', [req.params.slug]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Metal not found' });
        }
        res.json({ success: true, message: `Metal "${result.rows[0].name}" deleted` });
    } catch (err) {
        console.error('Error deleting metal:', err);
        res.status(500).json({ success: false, error: 'Failed to delete metal' });
    }
});

module.exports = router;

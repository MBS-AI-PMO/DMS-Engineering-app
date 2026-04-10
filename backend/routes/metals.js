const express = require('express');
const db = require('../db');
const slugify = require('slugify');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { optimizeImage } = require('../utils/imageOptimizer');

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
        const identifier = req.params.slug;
        const isId = /^\d+$/.test(identifier);
        const query = `
        SELECT m.*, mc.name as category_name, mc.slug as category_slug
        FROM metals m
        LEFT JOIN metal_categories mc ON m.category_id = mc.id
        WHERE ${isId ? 'm.id = $1' : 'm.slug = $1'}
    `;
        const result = await db.query(query, [identifier]);

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
        const identifier = req.params.slug;
        const isId = /^\d+$/.test(identifier);
        const metalResult = await db.query(`
            SELECT name, services, quick_look
            FROM metals WHERE ${isId ? 'id = $1' : 'slug = $1'}
        `, [identifier]);

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
            about_section, faqs, custom_fields, display_order, pricing_config } = req.body;

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
                about_section, faqs, custom_fields, display_order, pricing_config)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
            RETURNING *
        `, [slug, name, category_id, thickness, description, image_path,
            JSON.stringify(quick_look || {}), JSON.stringify(services || []),
            JSON.stringify(specifications || {}), JSON.stringify(thickness_specs || {}),
            JSON.stringify(about_section || {}), JSON.stringify(faqs || []),
            JSON.stringify(custom_fields || {}), display_order || 0,
            JSON.stringify(pricing_config || {})]);

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
const metalUpload = multer({
    storage: metalStorage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp|avif/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = /image\/(jpeg|png|webp|avif)/.test(file.mimetype);
        if (ext && mime) return cb(null, true);
        cb(new Error('Only images (jpg, png, webp, avif) are allowed'));
    }
});

router.post('/admin/upload-image', authenticate, requireAdmin, metalUpload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image uploaded' });
    }

    // Optimize the uploaded image immediately
    const optimizedFilename = await optimizeImage(req.file.path);
    const imagePath = `/uploads/metals/${optimizedFilename}`;

    res.json({ success: true, data: { image_path: imagePath } });
});

// PUT /api/admin/metals/:slug — Update metal
router.put('/admin/:slug', authenticate, requireAdmin, async (req, res) => {
    try {
        let { name, category_id, thickness, description, image_path,
            quick_look, services, specifications, thickness_specs,
            about_section, faqs, custom_fields, display_order, pricing_config } = req.body;

        // Mirror quick_look.thicknesses[n].services → thickness_specs[value].available_services
        // so both admin views always read/write the same data
        if (quick_look && Array.isArray(quick_look.thicknesses)) {
            thickness_specs = thickness_specs || {};
            quick_look.thicknesses.forEach(t => {
                if (!t.value) return;
                thickness_specs[t.value] = {
                    ...(thickness_specs[t.value] || {}),
                    available_services: (t.services || []).map(id => Number(id))
                };
            });
        }

        const identifier = req.params.slug;
        const isId = /^\d+$/.test(identifier);

        // Check if exists
        const existing = await db.query(`SELECT id, slug FROM metals WHERE ${isId ? 'id = $1' : 'slug = $1'}`, [identifier]);
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
                slug = $1, name = $2, category_id = $3, thickness = $4, description = $5, image_path = $6,
                quick_look = $7, services = $8, specifications = $9, thickness_specs = $10,
                about_section = $11, faqs = $12, custom_fields = $13, display_order = $14,
                pricing_config = $15
            WHERE id = $16
            RETURNING *
        `, [
            newSlug, name, category_id, thickness, description, image_path,
            JSON.stringify(quick_look || {}), JSON.stringify(services || []),
            JSON.stringify(specifications || {}), JSON.stringify(thickness_specs || {}),
            JSON.stringify(about_section || {}), JSON.stringify(faqs || []),
            JSON.stringify(custom_fields || {}), display_order || 0,
            JSON.stringify(pricing_config || {}), existing.rows[0].id
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
        const identifier = req.params.slug;
        const isId = /^\d+$/.test(identifier);
        const result = await db.query(`DELETE FROM metals WHERE ${isId ? 'id = $1' : 'slug = $1'} RETURNING id, name`, [identifier]);
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

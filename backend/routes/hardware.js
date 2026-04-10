const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { optimizeImage } = require('../utils/imageOptimizer');

const router = express.Router();

// Configure multer for hardware images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/hardware');
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

// GET /api/hardware/all — all types with their items embedded (for service detail page)
router.get('/all', async (req, res) => {
    try {
        const typesRes = await db.query(`
            SELECT ht.* FROM hardware_types ht
            WHERE LOWER(ht.name) NOT LIKE '%countersink%'
            ORDER BY ht.id
        `);
        const types = typesRes.rows;

        const enriched = await Promise.all(types.map(async (t) => {
            const itemsRes = await db.query(
                `SELECT * FROM hardware_items WHERE hardware_type_id = $1 ORDER BY id`,
                [t.id]
            );
            return { ...t, items: itemsRes.rows };
        }));

        res.json({ success: true, data: enriched.filter(t => t.items.length > 0) });
    } catch (err) {
        console.error('Error fetching all hardware:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch hardware' });
    }
});

// GET /api/hardware/types — list all 4 types with item count
router.get('/types', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT ht.*,
                   (SELECT COUNT(*) FROM hardware_items hi WHERE hi.hardware_type_id = ht.id) AS item_count
            FROM hardware_types ht
            ORDER BY ht.id
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching hardware types:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch hardware types' });
    }
});

// GET /api/hardware/types/:id/items — all items for a type
router.get('/types/:id/items', async (req, res) => {
    try {
        const typeId = parseInt(req.params.id);
        if (isNaN(typeId)) return res.status(400).json({ success: false, error: 'Invalid type ID' });

        const result = await db.query(
            `SELECT * FROM hardware_items WHERE hardware_type_id = $1 ORDER BY id`,
            [typeId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching hardware items:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch hardware items' });
    }
});

// ── Admin ────────────────────────────────────────────────

// POST /api/hardware/admin/types/:id/image — upload/replace type representative photo
router.post('/admin/types/:id/image', authenticate, requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const typeId = parseInt(req.params.id);
        if (isNaN(typeId)) return res.status(400).json({ success: false, error: 'Invalid type ID' });
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

        const optimizedFilename = await optimizeImage(req.file.path);
        const relativePath = `/uploads/hardware/${optimizedFilename}`;

        await db.query(`UPDATE hardware_types SET image_path = $1 WHERE id = $2`, [relativePath, typeId]);
        res.json({ success: true, data: { path: relativePath } });
    } catch (err) {
        console.error('Error uploading type image:', err);
        res.status(500).json({ success: false, error: 'Failed to upload type image' });
    }
});

// POST /api/hardware/admin/items — create item
router.post('/admin/items', authenticate, requireAdmin, async (req, res) => {
    try {
        const { hardware_type_id, name, size_spec, price, notes, is_active, length, min_edge_distance, tooling_diameter, base_width, shank, major_dia, minor_dia, angle, max_hole_diameter } = req.body;
        if (!hardware_type_id || !name) {
            return res.status(400).json({ success: false, error: 'hardware_type_id and name are required' });
        }

        const result = await db.query(
            `INSERT INTO hardware_items (hardware_type_id, name, size_spec, price, notes, is_active, length, min_edge_distance, tooling_diameter, base_width, shank, major_dia, minor_dia, angle, max_hole_diameter)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             RETURNING *`,
            [
                hardware_type_id, name, size_spec || null, price || 0, notes || null, is_active !== false,
                parseFloat(length) || null, parseFloat(min_edge_distance) || null, parseFloat(tooling_diameter) || null,
                parseFloat(base_width) || null, parseFloat(shank) || null,
                parseFloat(major_dia) || null, parseFloat(minor_dia) || null, parseFloat(angle) || null, parseFloat(max_hole_diameter) || null
            ]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error creating hardware item:', err);
        res.status(500).json({ success: false, error: 'Failed to create hardware item' });
    }
});

// PUT /api/hardware/admin/items/:id — update item
router.put('/admin/items/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const itemId = parseInt(req.params.id);
        if (isNaN(itemId)) return res.status(400).json({ success: false, error: 'Invalid item ID' });

        const { name, size_spec, price, notes, is_active, length, min_edge_distance, tooling_diameter, base_width, shank, major_dia, minor_dia, angle, max_hole_diameter } = req.body;

        const result = await db.query(
            `UPDATE hardware_items
             SET name = $1, size_spec = $2, price = $3, notes = $4, is_active = $5,
                 length = $6, min_edge_distance = $7, tooling_diameter = $8,
                 base_width = $9, shank = $10,
                 major_dia = $11, minor_dia = $12, angle = $13, max_hole_diameter = $14
             WHERE id = $15
             RETURNING *`,
            [
                name, size_spec || null, price || 0, notes || null, is_active !== false,
                parseFloat(length) || null, parseFloat(min_edge_distance) || null, parseFloat(tooling_diameter) || null,
                parseFloat(base_width) || null, parseFloat(shank) || null,
                parseFloat(major_dia) || null, parseFloat(minor_dia) || null, parseFloat(angle) || null, parseFloat(max_hole_diameter) || null,
                itemId
            ]
        );

        if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Item not found' });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error updating hardware item:', err);
        res.status(500).json({ success: false, error: 'Failed to update hardware item' });
    }
});

// DELETE /api/hardware/admin/items/:id — delete item
router.delete('/admin/items/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const itemId = parseInt(req.params.id);
        if (isNaN(itemId)) return res.status(400).json({ success: false, error: 'Invalid item ID' });

        const result = await db.query(`DELETE FROM hardware_items WHERE id = $1`, [itemId]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Item not found' });

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting hardware item:', err);
        res.status(500).json({ success: false, error: 'Failed to delete hardware item' });
    }
});

// POST /api/hardware/admin/items/:id/image — upload/replace item image
router.post('/admin/items/:id/image', authenticate, requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const itemId = parseInt(req.params.id);
        if (isNaN(itemId)) return res.status(400).json({ success: false, error: 'Invalid item ID' });
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

        const optimizedFilename = await optimizeImage(req.file.path);
        const relativePath = `/uploads/hardware/${optimizedFilename}`;

        await db.query(`UPDATE hardware_items SET image_path = $1 WHERE id = $2`, [relativePath, itemId]);
        res.json({ success: true, data: { path: relativePath } });
    } catch (err) {
        console.error('Error uploading item image:', err);
        res.status(500).json({ success: false, error: 'Failed to upload item image' });
    }
});

module.exports = router;

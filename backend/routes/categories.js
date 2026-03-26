const express = require('express');
const db = require('../db');
const slugify = require('slugify');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── Public ───────────────────────────────────────────────

// GET /api/categories — List all metal categories
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT mc.*, COUNT(m.id)::int as metal_count
            FROM metal_categories mc
            LEFT JOIN metals m ON m.category_id = mc.id
            GROUP BY mc.id
            ORDER BY mc.display_order, mc.id
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch categories' });
    }
});

// ── Admin ────────────────────────────────────────────────

// POST /api/admin/categories
router.post('/admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, description, display_order } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

        const slug = slugify(name, { lower: true, strict: true });
        const existing = await db.query('SELECT id FROM metal_categories WHERE slug = $1', [slug]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, error: 'Category already exists' });
        }

        const result = await db.query(
            'INSERT INTO metal_categories (name, slug, description, display_order) VALUES ($1,$2,$3,$4) RETURNING *',
            [name, slug, description, display_order || 0]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error creating category:', err);
        res.status(500).json({ success: false, error: 'Failed to create category' });
    }
});

// PUT /api/admin/categories/:id
router.put('/admin/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, description, display_order } = req.body;
        const slug = name ? slugify(name, { lower: true, strict: true }) : null;

        const result = await db.query(`
            UPDATE metal_categories SET
                name = COALESCE($1, name),
                slug = COALESCE($2, slug),
                description = COALESCE($3, description),
                display_order = COALESCE($4, display_order)
            WHERE id = $5
            RETURNING *
        `, [name, slug, description, display_order, req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error updating category:', err);
        res.status(500).json({ success: false, error: 'Failed to update category' });
    }
});

// DELETE /api/admin/categories/:id
router.delete('/admin/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        // Check for assigned metals
        const metals = await db.query('SELECT COUNT(*)::int as count FROM metals WHERE category_id = $1', [req.params.id]);
        if (metals.rows[0].count > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete: ${metals.rows[0].count} metal(s) are assigned to this category. Reassign them first.`
            });
        }

        const result = await db.query('DELETE FROM metal_categories WHERE id = $1 RETURNING name', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }
        res.json({ success: true, message: `Category "${result.rows[0].name}" deleted` });
    } catch (err) {
        console.error('Error deleting category:', err);
        res.status(500).json({ success: false, error: 'Failed to delete category' });
    }
});

module.exports = router;

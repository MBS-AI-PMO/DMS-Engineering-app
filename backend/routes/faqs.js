const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── Public ───────────────────────────────────────────────

// GET /api/faqs — List all FAQs (with optional category filter)
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        let query = `
            SELECT f.*, fc.name as category_name, fc.slug as category_slug
            FROM faqs f
            LEFT JOIN faq_categories fc ON f.category_id = fc.id
        `;
        const params = [];

        if (category) {
            query += ' WHERE fc.slug = $1';
            params.push(category);
        }

        query += ' ORDER BY fc.display_order, f.display_order, f.id';
        const result = await db.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching FAQs:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch FAQs' });
    }
});

// GET /api/faq-categories — List all FAQ categories
router.get('/categories', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT fc.*, COUNT(f.id)::int as faq_count
            FROM faq_categories fc
            LEFT JOIN faqs f ON f.category_id = fc.id
            GROUP BY fc.id
            ORDER BY fc.display_order, fc.id
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching FAQ categories:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch FAQ categories' });
    }
});

// ── Admin: FAQs ──────────────────────────────────────────

// POST /api/admin/faqs
router.post('/admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const { category_id, question, answer, display_order } = req.body;
        if (!question || !answer) {
            return res.status(400).json({ success: false, error: 'Question and answer are required' });
        }

        const result = await db.query(
            'INSERT INTO faqs (category_id, question, answer, display_order) VALUES ($1,$2,$3,$4) RETURNING *',
            [category_id, question, answer, display_order || 0]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error creating FAQ:', err);
        res.status(500).json({ success: false, error: 'Failed to create FAQ' });
    }
});

// PUT /api/admin/faqs/:id
router.put('/admin/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { category_id, question, answer, display_order } = req.body;

        const result = await db.query(`
            UPDATE faqs SET
                category_id = COALESCE($1, category_id),
                question = COALESCE($2, question),
                answer = COALESCE($3, answer),
                display_order = COALESCE($4, display_order)
            WHERE id = $5
            RETURNING *
        `, [category_id, question, answer, display_order, req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'FAQ not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error updating FAQ:', err);
        res.status(500).json({ success: false, error: 'Failed to update FAQ' });
    }
});

// DELETE /api/admin/faqs/:id
router.delete('/admin/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query('DELETE FROM faqs WHERE id = $1 RETURNING id, question', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'FAQ not found' });
        }
        res.json({ success: true, message: 'FAQ deleted' });
    } catch (err) {
        console.error('Error deleting FAQ:', err);
        res.status(500).json({ success: false, error: 'Failed to delete FAQ' });
    }
});

// ── Admin: FAQ Categories ────────────────────────────────

// POST /api/admin/faq-categories
router.post('/admin/categories', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, description, display_order } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

        const slugify = require('slugify');
        const slug = slugify(name, { lower: true, strict: true });

        const result = await db.query(
            'INSERT INTO faq_categories (name, slug, description, display_order) VALUES ($1,$2,$3,$4) RETURNING *',
            [name, slug, description, display_order || 0]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error creating FAQ category:', err);
        res.status(500).json({ success: false, error: 'Failed to create FAQ category' });
    }
});

// PUT /api/admin/faq-categories/:id
router.put('/admin/categories/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, description, display_order } = req.body;
        const slugify = require('slugify');
        const slug = name ? slugify(name, { lower: true, strict: true }) : null;

        const result = await db.query(`
            UPDATE faq_categories SET
                name = COALESCE($1, name),
                slug = COALESCE($2, slug),
                description = COALESCE($3, description),
                display_order = COALESCE($4, display_order)
            WHERE id = $5
            RETURNING *
        `, [name, slug, description, display_order, req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'FAQ category not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error updating FAQ category:', err);
        res.status(500).json({ success: false, error: 'Failed to update FAQ category' });
    }
});

// DELETE /api/admin/faq-categories/:id
router.delete('/admin/categories/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const faqs = await db.query('SELECT COUNT(*)::int as count FROM faqs WHERE category_id = $1', [req.params.id]);
        if (faqs.rows[0].count > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete: ${faqs.rows[0].count} FAQ(s) are assigned to this category.`
            });
        }

        const result = await db.query('DELETE FROM faq_categories WHERE id = $1 RETURNING name', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'FAQ category not found' });
        }
        res.json({ success: true, message: `FAQ category "${result.rows[0].name}" deleted` });
    } catch (err) {
        console.error('Error deleting FAQ category:', err);
        res.status(500).json({ success: false, error: 'Failed to delete FAQ category' });
    }
});

module.exports = router;

/*
 * Metal categories (Aluminum, Steel, …). Mounted at /api/categories.
 *
 *   GET    /            every category with its metal_count
 *   POST   /admin       create  (admin)
 *   PUT    /admin/:id   update  (admin; fields not sent are kept)
 *   DELETE /admin/:id   delete  (admin; refused while metals use it)
 */
const express = require('express');
const slugify = require('slugify');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, created, HttpError, badRequest, conflict, validate } = require('../helpers');

const router = express.Router();
const admin = [authenticate, requireAdmin];

const makeSlug = (name) => slugify(name, { lower: true, strict: true });
const notFound = () => new HttpError(404, 'Category not found');

// ── Public ───────────────────────────────────────────────

// GET /api/categories — List all metal categories
router.get('/', route('load the categories', async (req, res) => {
    const result = await db.query(`
        SELECT mc.*, COUNT(m.id)::int as metal_count
        FROM metal_categories mc
        LEFT JOIN metals m ON m.category_id = mc.id
        GROUP BY mc.id
        ORDER BY mc.display_order, mc.id
    `);
    ok(res, result.rows);
}));

// ── Admin ────────────────────────────────────────────────

// POST /api/categories/admin
router.post('/admin', admin, route('create the category', async (req, res) => {
    const name = validate.text(req.body.name, 'Name', { required: true, max: 120 });
    const description = validate.text(req.body.description, 'Description', { max: 2000 });
    const displayOrder = validate.integer(req.body.display_order, 'Display order') || 0;

    const slug = makeSlug(name);
    const existing = await db.query('SELECT id FROM metal_categories WHERE slug = $1', [slug]);
    if (existing.rows.length) throw conflict('Category already exists');

    const result = await db.query(
        'INSERT INTO metal_categories (name, slug, description, display_order) VALUES ($1,$2,$3,$4) RETURNING *',
        [name, slug, description, displayOrder]
    );
    created(res, result.rows[0]);
}));

// PUT /api/categories/admin/:id — fields left out keep their value
router.put('/admin/:id', admin, route('update the category', async (req, res) => {
    const id = validate.id(req.params.id, 'Category');
    const name = validate.text(req.body.name, 'Name', { max: 120 });
    const description = req.body.description === undefined ? null : (validate.text(req.body.description, 'Description', { max: 2000 }) ?? '');
    const displayOrder = validate.integer(req.body.display_order, 'Display order');
    const slug = name ? makeSlug(name) : null;

    if (slug) {
        const taken = await db.query('SELECT id FROM metal_categories WHERE slug = $1 AND id != $2', [slug, id]);
        if (taken.rows.length) throw conflict('Category already exists');
    }

    const result = await db.query(`
        UPDATE metal_categories SET
            name = COALESCE($1, name),
            slug = COALESCE($2, slug),
            description = COALESCE($3, description),
            display_order = COALESCE($4, display_order)
        WHERE id = $5
        RETURNING *
    `, [name, slug, description, displayOrder, id]);
    if (!result.rows.length) throw notFound();
    ok(res, result.rows[0]);
}));

// DELETE /api/categories/admin/:id
router.delete('/admin/:id', admin, route('delete the category', async (req, res) => {
    const id = validate.id(req.params.id, 'Category');
    const metals = await db.query('SELECT COUNT(*)::int as count FROM metals WHERE category_id = $1', [id]);
    if (metals.rows[0].count > 0) {
        throw badRequest(`Cannot delete: ${metals.rows[0].count} metal(s) are assigned to this category. Reassign them first.`);
    }
    const result = await db.query('DELETE FROM metal_categories WHERE id = $1 RETURNING name', [id]);
    if (!result.rows.length) throw notFound();
    ok(res, undefined, { message: `Category "${result.rows[0].name}" deleted` });
}));

module.exports = router;

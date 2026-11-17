/*
 * FAQs and their categories. Mounted at /api/faqs.
 *
 *   Public (read by the FAQ page; cached by utils/publicCache)
 *     GET  /                      every FAQ with category_name / category_slug; ?category=<slug> for one topic
 *     GET  /categories            every category with faq_count
 *   Admin
 *     POST /admin                 add an FAQ
 *     PUT  /admin/order           { ids } -> display_order 1..n in that order
 *     PUT  /admin/:id             change an FAQ (fields left out keep their value)
 *     DELETE /admin/:id
 *     POST /admin/categories      add a category (slug from `slug` or the name)
 *     PUT  /admin/categories/order { ids } -> display_order 0..n-1 in that order
 *     PUT  /admin/categories/:id
 *     DELETE /admin/categories/:id  refused while FAQs still use it
 */
const express = require('express');
const slugify = require('slugify');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, created, badRequest, conflict, HttpError, validate: v } = require('../helpers');

const router = express.Router();
const admin = [authenticate, requireAdmin];

const has = (body, key) => Object.prototype.hasOwnProperty.call(body || {}, key);
/* Sent with a value (null / undefined mean "leave as is", as before). */
const given = (body, key) => body[key] !== undefined && body[key] !== null;
const slugOf = (value) => slugify(String(value || ''), { lower: true, strict: true }).slice(0, 120);

/* Runs "UPDATE <table> SET … WHERE id = $n RETURNING *" for the given columns only. */
async function updateColumns(table, id, columns, what) {
    const entries = Object.entries(columns);
    const sets = entries.map(([col], i) => `${col} = $${i + 1}`);
    sets.push('updated_at = NOW()');
    const result = await db.query(
        `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${entries.length + 1} RETURNING *`,
        [...entries.map(([, value]) => value), id],
    );
    if (!result.rowCount) throw new HttpError(404, `${what} not found`);
    return result.rows[0];
}

async function categoryIdOf(value) {
    if (v.blank(value)) return null;
    const categoryId = v.id(value, 'Category');
    const found = await db.query('SELECT 1 FROM faq_categories WHERE id = $1', [categoryId]);
    if (!found.rowCount) throw badRequest('That category no longer exists. Choose another one.');
    return categoryId;
}

const orderIds = (body) => {
    const ids = v.list(body?.ids, 'Order', { max: 2000 }).map(id => v.id(id, 'Id'));
    if (!ids.length) throw badRequest('Nothing to reorder.');
    return ids;
};

const slugTaken = (err, slug) => {
    if (err.code === '23505') throw conflict(`Another category already uses the URL name "${slug}". Pick a different name.`);
    throw err;
};

// ── Public ───────────────────────────────────────────────

router.get('/', route('load the FAQs', async (req, res) => {
    const category = Array.isArray(req.query.category) ? req.query.category[0] : req.query.category;
    const params = [];
    let where = '';
    if (category) {
        where = 'WHERE fc.slug = $1';
        params.push(String(category));
    }
    const result = await db.query(`
        SELECT f.*, fc.name as category_name, fc.slug as category_slug
        FROM faqs f
        LEFT JOIN faq_categories fc ON f.category_id = fc.id
        ${where}
        ORDER BY fc.display_order, f.display_order, f.id
    `, params);
    ok(res, result.rows);
}));

router.get('/categories', route('load the FAQ categories', async (req, res) => {
    const result = await db.query(`
        SELECT fc.*, COUNT(f.id)::int as faq_count
        FROM faq_categories fc
        LEFT JOIN faqs f ON f.category_id = fc.id
        GROUP BY fc.id
        ORDER BY fc.display_order, fc.id
    `);
    ok(res, result.rows);
}));

// ── Admin: FAQs ──────────────────────────────────────────

router.post('/admin', admin, route('add the FAQ', async (req, res) => {
    const body = req.body || {};
    const question = v.text(body.question, 'Question', { required: true, max: 1000 });
    const answer = v.text(body.answer, 'Answer', { required: true, max: 20000 });
    const categoryId = await categoryIdOf(body.category_id);
    const displayOrder = v.integer(body.display_order, 'Position', { min: 0, max: 100000 }) ?? 0;
    const result = await db.query(
        'INSERT INTO faqs (category_id, question, answer, display_order) VALUES ($1,$2,$3,$4) RETURNING *',
        [categoryId, question, answer, displayOrder],
    );
    created(res, result.rows[0]);
}));

router.put('/admin/order', admin, route('save the FAQ order', async (req, res) => {
    const ids = orderIds(req.body);
    const result = await db.query(`
        UPDATE faqs f SET display_order = o.ord, updated_at = NOW()
        FROM unnest($1::int[]) WITH ORDINALITY AS o(id, ord)
        WHERE f.id = o.id
    `, [ids]);
    ok(res, { updated: result.rowCount });
}));

router.put('/admin/:id', admin, route('save the FAQ', async (req, res) => {
    const id = v.id(req.params.id, 'FAQ');
    const body = req.body || {};
    const columns = {};
    if (given(body, 'question')) columns.question = v.text(body.question, 'Question', { required: true, max: 1000 });
    if (given(body, 'answer')) columns.answer = v.text(body.answer, 'Answer', { required: true, max: 20000 });
    if (has(body, 'category_id')) columns.category_id = await categoryIdOf(body.category_id);
    if (!v.blank(body.display_order)) columns.display_order = v.integer(body.display_order, 'Position', { min: 0, max: 100000 });
    ok(res, await updateColumns('faqs', id, columns, 'FAQ'));
}));

router.delete('/admin/:id', admin, route('delete the FAQ', async (req, res) => {
    const id = v.id(req.params.id, 'FAQ');
    const result = await db.query('DELETE FROM faqs WHERE id = $1 RETURNING id, question', [id]);
    if (!result.rowCount) throw new HttpError(404, 'FAQ not found');
    ok(res, undefined, { message: 'FAQ deleted' });
}));

// ── Admin: FAQ categories ────────────────────────────────

router.post('/admin/categories', admin, route('add the FAQ category', async (req, res) => {
    const body = req.body || {};
    const name = v.text(body.name, 'Name', { required: true, max: 120 });
    const slug = slugOf(v.blank(body.slug) ? name : body.slug);
    if (!slug) throw badRequest('The URL name needs at least one letter or number.');
    const description = v.text(body.description, 'Description', { max: 2000 });
    let displayOrder = v.integer(body.display_order, 'Position', { min: 0, max: 100000 });
    if (displayOrder === null) {
        const last = await db.query('SELECT COALESCE(MAX(display_order) + 1, 0)::int AS next FROM faq_categories');
        displayOrder = last.rows[0].next;
    }
    const result = await db.query(
        'INSERT INTO faq_categories (name, slug, description, display_order) VALUES ($1,$2,$3,$4) RETURNING *',
        [name, slug, description, displayOrder],
    ).catch(err => slugTaken(err, slug));
    created(res, result.rows[0]);
}));

router.put('/admin/categories/order', admin, route('save the category order', async (req, res) => {
    const ids = orderIds(req.body);
    const result = await db.query(`
        UPDATE faq_categories c SET display_order = o.ord - 1, updated_at = NOW()
        FROM unnest($1::int[]) WITH ORDINALITY AS o(id, ord)
        WHERE c.id = o.id
    `, [ids]);
    ok(res, { updated: result.rowCount });
}));

router.put('/admin/categories/:id', admin, route('save the FAQ category', async (req, res) => {
    const id = v.id(req.params.id, 'Category');
    const body = req.body || {};
    const columns = {};
    if (given(body, 'name')) columns.name = v.text(body.name, 'Name', { required: true, max: 120 });
    // An explicit URL name wins; otherwise a new name brings a new one.
    const slugSource = !v.blank(body.slug) ? body.slug : columns.name;
    if (slugSource !== undefined) {
        columns.slug = slugOf(slugSource);
        if (!columns.slug) throw badRequest('The URL name needs at least one letter or number.');
    }
    if (has(body, 'description')) columns.description = v.text(body.description, 'Description', { max: 2000 });
    if (!v.blank(body.display_order)) columns.display_order = v.integer(body.display_order, 'Position', { min: 0, max: 100000 });
    const row = await updateColumns('faq_categories', id, columns, 'FAQ category').catch(err => slugTaken(err, columns.slug));
    ok(res, row);
}));

router.delete('/admin/categories/:id', admin, route('delete the FAQ category', async (req, res) => {
    const id = v.id(req.params.id, 'Category');
    const faqs = await db.query('SELECT COUNT(*)::int as count FROM faqs WHERE category_id = $1', [id]);
    if (faqs.rows[0].count > 0) {
        throw badRequest(`Cannot delete: ${faqs.rows[0].count} FAQ(s) are assigned to this category.`, { faq_count: faqs.rows[0].count });
    }
    const result = await db.query('DELETE FROM faq_categories WHERE id = $1 RETURNING name', [id]);
    if (!result.rowCount) throw new HttpError(404, 'FAQ category not found');
    ok(res, undefined, { message: `FAQ category "${result.rows[0].name}" deleted` });
}));

module.exports = router;

/*
 * FAQs and their categories. Mounted at /api/faqs.
 *
 *   Public (read by the FAQ page and the FAQs shown on other pages; cached by utils/publicCache)
 *     GET  /                      every FAQ on the FAQ page (show_on_faq_page) with category_name /
 *                                 category_slug; ?category=<slug> for one topic. Page-only FAQs are left out.
 *     GET  /categories            every category with faq_count (FAQs on the FAQ page)
 *     GET  /placed                every page's placed FAQs at once: { pages: { '/about': [...], '/metal/*': [...] } }
 *                                 (kept in memory, rebuilt after any admin change; the site loads it once)
 *     GET  /for-page?path=/about  the FAQs placed on that page: the exact page first, then its type
 *                                 ('/metal/*' for /metal/<slug>), each in position order, no repeats
 *   Admin
 *     GET  /admin                 every FAQ, page-only ones too, plus `pages`: the page keys it is placed on
 *     POST /admin                 add an FAQ (optional `pages`: page keys to show it on; optional
 *                                 show_on_faq_page, default true; false = only on its pages)
 *     PUT  /admin/order           { ids } -> display_order 1..n in that order
 *     GET  /admin/pages           every page an FAQ can be placed on, with faq_count (see faqs/pages.js)
 *     GET  /admin/page?key=…      the FAQs placed on one page key, in order
 *     PUT  /admin/page            { key, faq_ids } -> exactly these FAQs on that page, in this order
 *     PUT  /admin/:id             change an FAQ (fields left out keep their value; optional `pages`,
 *                                 show_on_faq_page)
 *     PUT  /admin/:id/pages       { pages } -> the pages the FAQ shows on
 *     DELETE /admin/:id           (its placements go with it)
 *     POST /admin/categories      add a category (slug from `slug` or the name)
 *     PUT  /admin/categories/order { ids } -> display_order 0..n-1 in that order
 *     PUT  /admin/categories/:id
 *     DELETE /admin/categories/:id  refused while FAQs still use it
 */
const express = require('express');
const slugify = require('slugify');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, created, badRequest, conflict, HttpError, withTransaction, validate: v } = require('../helpers');
const pages = require('../faqs/pages');
const placements = require('../faqs/placements');

const router = express.Router();
const admin = [authenticate, requireAdmin];

const has = (body, key) => Object.prototype.hasOwnProperty.call(body || {}, key);
/* Sent with a value (null / undefined mean "leave as is", as before). */
const given = (body, key) => body[key] !== undefined && body[key] !== null;
const slugOf = (value) => slugify(String(value || ''), { lower: true, strict: true }).slice(0, 120);

/* Runs "UPDATE <table> SET … WHERE id = $n RETURNING *" for the given columns only. */
async function updateColumns(table, id, columns, what, client = db) {
    const entries = Object.entries(columns);
    const sets = entries.map(([col], i) => `${col} = $${i + 1}`);
    sets.push('updated_at = NOW()');
    const result = await client.query(
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

const MAX_PAGES = 200;
const MAX_PAGE_FAQS = 500;

/* `pages` from a request body (page keys), checked; null when not sent.
 * keep: keys the FAQ already has, accepted even if that page is gone. */
async function pagesOf(body, keep = []) {
    if (!has(body, 'pages') || body.pages === null) return null;
    return pages.checkPageKeys(db, v.list(body.pages, 'Pages', { max: MAX_PAGES }), keep);
}

/* A page key from admin, as sent (wildcards included). */
const pageKeyOf = (value) => v.text(value, 'Page', { required: true, max: pages.MAX_KEY });

/* The public list keeps its shape: the flag only decides what is in it. */
const publicRow = ({ show_on_faq_page: _onFaqPage, ...row }) => row;

const slugTaken = (err, slug) => {
    if (err.code === '23505') throw conflict(`Another category already uses the URL name "${slug}". Pick a different name.`);
    throw err;
};

// ── Public ───────────────────────────────────────────────

router.get('/', route('load the FAQs', async (req, res) => {
    const category = Array.isArray(req.query.category) ? req.query.category[0] : req.query.category;
    const params = [];
    let where = 'WHERE f.show_on_faq_page';
    if (category) {
        where += ' AND fc.slug = $1';
        params.push(String(category));
    }
    const result = await db.query(`
        SELECT f.*, fc.name as category_name, fc.slug as category_slug
        FROM faqs f
        LEFT JOIN faq_categories fc ON f.category_id = fc.id
        ${where}
        ORDER BY fc.display_order, f.display_order, f.id
    `, params);
    ok(res, result.rows.map(publicRow));
}));

router.get('/categories', route('load the FAQ categories', async (req, res) => {
    const result = await db.query(`
        SELECT fc.*, COUNT(f.id)::int as faq_count
        FROM faq_categories fc
        LEFT JOIN faqs f ON f.category_id = fc.id AND f.show_on_faq_page
        GROUP BY fc.id
        ORDER BY fc.display_order, fc.id
    `);
    ok(res, result.rows);
}));

// Every page's placed FAQs, kept in memory: one query after each admin change
// instead of one per page and visitor (the database can be slow to reach).
const PLACED_TTL_MS = 10 * 60 * 1000;
let placedCache = null; // { at, promise }
const loadPlaced = () => {
    if (placedCache && Date.now() - placedCache.at < PLACED_TTL_MS) return placedCache.promise;
    const entry = { at: Date.now(), promise: placements.allPlaced(db) };
    placedCache = entry;
    entry.promise.catch(() => { if (placedCache === entry) placedCache = null; });
    return entry.promise;
};
// Any admin change to FAQs or placements: build it again on the next request.
router.use('/admin', (req, res, next) => {
    if (req.method !== 'GET') res.on('finish', () => { if (res.statusCode < 400) placedCache = null; });
    next();
});
// Ready before the first visitor asks.
setTimeout(() => loadPlaced().catch(() => {}), 2000).unref?.();

router.get('/placed', route('load the page FAQs', async (req, res) => {
    ok(res, { pages: await loadPlaced() });
}));

router.get('/for-page', route('load the FAQs for this page', async (req, res) => {
    const raw = Array.isArray(req.query.path) ? req.query.path[0] : req.query.path;
    const path = pages.normalizePath(raw);
    if (!path) throw badRequest('Send the page address as ?path=/about.');
    ok(res, await placements.forPath(db, path));
}));

// ── Admin: FAQs ──────────────────────────────────────────

router.get('/admin', admin, route('load the FAQs', async (req, res) => {
    const [result, byFaq] = await Promise.all([
        db.query(`
            SELECT f.*, fc.name as category_name, fc.slug as category_slug
            FROM faqs f
            LEFT JOIN faq_categories fc ON f.category_id = fc.id
            ORDER BY fc.display_order, f.display_order, f.id
        `),
        placements.pagesByFaq(db),
    ]);
    ok(res, result.rows.map(row => ({ ...row, pages: byFaq.get(row.id) || [] })));
}));

router.post('/admin', admin, route('add the FAQ', async (req, res) => {
    const body = req.body || {};
    const question = v.text(body.question, 'Question', { required: true, max: 1000 });
    const answer = v.text(body.answer, 'Answer', { required: true, max: 20000 });
    const categoryId = await categoryIdOf(body.category_id);
    const displayOrder = v.integer(body.display_order, 'Position', { min: 0, max: 100000 }) ?? 0;
    const onFaqPage = v.bool(body.show_on_faq_page, true);
    const pageKeys = await pagesOf(body);
    const row = await withTransaction(async (client) => {
        const result = await client.query(
            'INSERT INTO faqs (category_id, question, answer, display_order, show_on_faq_page) VALUES ($1,$2,$3,$4,$5) RETURNING *',
            [categoryId, question, answer, displayOrder, onFaqPage],
        );
        const faq = result.rows[0];
        if (pageKeys) faq.pages = await placements.setFaqPages(client, faq.id, pageKeys);
        return faq;
    });
    created(res, row);
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

// ── Admin: FAQs on other pages ───────────────────────────

router.get('/admin/pages', admin, route('load the pages', async (req, res) => {
    const [list, counts] = await Promise.all([pages.catalogue(db), placements.pageCounts(db)]);
    const known = new Set(list.map(p => p.key));
    // Placements on a page that is gone (a metal renamed or deleted since).
    const gone = [...counts.keys()].filter(key => !known.has(key)).sort()
        .map(key => ({ key, label: key, group: 'other', missing: true }));
    ok(res, [...list, ...gone].map(p => ({ ...p, faq_count: counts.get(p.key) || 0 })));
}));

router.get('/admin/page', admin, route('load the FAQs of this page', async (req, res) => {
    const key = pageKeyOf(Array.isArray(req.query.key) ? req.query.key[0] : req.query.key);
    ok(res, await placements.onPage(db, key));
}));

router.put('/admin/page', admin, route('save the FAQs of this page', async (req, res) => {
    const body = req.body || {};
    const raw = pageKeyOf(body.key);
    const ids = v.list(body.faq_ids, 'FAQs', { max: MAX_PAGE_FAQS }).map(id => v.id(id, 'FAQ'));
    if (new Set(ids).size !== ids.length) throw badRequest('An FAQ is listed twice.');
    const stored = await db.query('SELECT 1 FROM faq_placements WHERE page_key = $1 LIMIT 1', [raw]);
    const [key] = await pages.checkPageKeys(db, [raw], stored.rowCount ? [raw] : []);
    ok(res, await withTransaction(client => placements.setPageFaqs(client, key, ids)));
}));

router.put('/admin/:id/pages', admin, route('save the pages of the FAQ', async (req, res) => {
    const id = v.id(req.params.id, 'FAQ');
    const found = await db.query('SELECT 1 FROM faqs WHERE id = $1', [id]);
    if (!found.rowCount) throw new HttpError(404, 'FAQ not found');
    const keys = await pagesOf({ pages: req.body?.pages ?? [] }, await placements.keysOfFaq(db, id));
    const saved = await withTransaction(client => placements.setFaqPages(client, id, keys));
    ok(res, { id, pages: saved });
}));

router.put('/admin/:id', admin, route('save the FAQ', async (req, res) => {
    const id = v.id(req.params.id, 'FAQ');
    const body = req.body || {};
    const columns = {};
    if (given(body, 'question')) columns.question = v.text(body.question, 'Question', { required: true, max: 1000 });
    if (given(body, 'answer')) columns.answer = v.text(body.answer, 'Answer', { required: true, max: 20000 });
    if (has(body, 'category_id')) columns.category_id = await categoryIdOf(body.category_id);
    if (!v.blank(body.display_order)) columns.display_order = v.integer(body.display_order, 'Position', { min: 0, max: 100000 });
    if (given(body, 'show_on_faq_page')) columns.show_on_faq_page = v.bool(body.show_on_faq_page, true);
    const pageKeys = has(body, 'pages') ? await pagesOf(body, await placements.keysOfFaq(db, id)) : null;
    if (!pageKeys) {
        ok(res, await updateColumns('faqs', id, columns, 'FAQ'));
        return;
    }
    ok(res, await withTransaction(async (client) => {
        const row = await updateColumns('faqs', id, columns, 'FAQ', client);
        row.pages = await placements.setFaqPages(client, id, pageKeys);
        return row;
    }));
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

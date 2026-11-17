/*
 * Metals: the public catalog (list, one metal, its services) and the admin
 * editor's writes. Mounted at /api/metals.
 *
 *   GET    /                    every metal (?category=<slug>, ?view=list for list columns only)
 *   GET    /:slug               one metal, by slug or id
 *   GET    /:slug/services      the services a metal offers, overall and per thickness
 *   POST   /admin               create            (admin)
 *   POST   /admin/upload-image  upload a picture  (admin) -> { image_path }
 *   PUT    /admin/:slug         update, by slug or id (admin)
 *   DELETE /admin/:slug         delete, by slug or id (admin)
 */
const express = require('express');
const slugify = require('slugify');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, created, HttpError, conflict, validate, imageUpload, handleUpload, saveImage } = require('../helpers');

const router = express.Router();
const admin = [authenticate, requireAdmin];

const isId = (identifier) => /^\d+$/.test(identifier);
const byIdentifier = (identifier, alias = '') => `${alias}${isId(identifier) ? 'id' : 'slug'} = $1`;
const notFound = () => new HttpError(404, 'Metal not found');
const makeSlug = (name) => slugify(name, { lower: true, strict: true });

// Columns a list of metals shows (name, picture, family, thickness). Each
// full row also carries specs, FAQs and pricing, about 30 KB per metal.
const METAL_LIST_COLUMNS = 'm.id, m.slug, m.name, m.thickness, m.description, m.image_path, m.category_id, m.display_order';

// ── Public ───────────────────────────────────────────────

// GET /api/metals — List all metals (with optional category filter).
// ?view=list returns only the columns a list needs.
router.get('/', route('load the metals', async (req, res) => {
    const { category } = req.query;
    const columns = req.query.view === 'list' ? METAL_LIST_COLUMNS : 'm.*';
    const params = category ? [category] : [];
    const result = await db.query(`
        SELECT ${columns}, mc.name as category_name, mc.slug as category_slug
        FROM metals m
        LEFT JOIN metal_categories mc ON m.category_id = mc.id
        ${category ? 'WHERE mc.slug = $1' : ''}
        ORDER BY m.display_order, m.id
    `, params);
    ok(res, result.rows);
}));

// GET /api/metals/:slug — one metal, by slug or numeric id
router.get('/:slug', route('load the metal', async (req, res) => {
    const identifier = req.params.slug;
    const result = await db.query(`
        SELECT m.*, mc.name as category_name, mc.slug as category_slug
        FROM metals m
        LEFT JOIN metal_categories mc ON m.category_id = mc.id
        WHERE ${byIdentifier(identifier, 'm.')}
    `, [identifier]);
    if (!result.rows.length) throw notFound();
    ok(res, result.rows[0]);
}));

// GET /api/metals/:slug/services — the services a metal offers: metal-wide
// (metals.services) and per thickness (quick_look.thicknesses[n].services).
router.get('/:slug/services', route('load the metal services', async (req, res) => {
    const identifier = req.params.slug;
    const metalResult = await db.query(`SELECT name, services, quick_look FROM metals WHERE ${byIdentifier(identifier)}`, [identifier]);
    if (!metalResult.rows.length) throw notFound();

    const metal = metalResult.rows[0];
    const metalServiceIds = Array.isArray(metal.services) ? metal.services : [];
    const thicknesses = metal.quick_look?.thicknesses || [];

    const allIds = new Set(metalServiceIds);
    thicknesses.forEach(t => { if (Array.isArray(t.services)) t.services.forEach(id => allIds.add(id)); });

    const serviceMap = {};
    if (allIds.size > 0) {
        const svcResult = await db.query(
            'SELECT * FROM services WHERE id = ANY($1) AND COALESCE(is_active, true) = true ORDER BY display_order, id',
            [Array.from(allIds)]
        );
        svcResult.rows.forEach(svc => { serviceMap[svc.id] = svc; });
    }

    ok(res, {
        metalName: metal.name,
        metalLevel: metalServiceIds.map(id => serviceMap[id]).filter(Boolean),
        thicknessLevel: thicknesses.map(t => ({
            thickness: t.value,
            metric: t.metric,
            services: (Array.isArray(t.services) ? t.services : []).map(id => serviceMap[id]).filter(Boolean),
        })),
    });
}));

// ── Admin ────────────────────────────────────────────────

/* A text column: null when not sent, '' kept as ''. */
const str = (value, label, max) => (value === undefined || value === null ? null : validate.text(value, label, { max }) ?? '');

/* The editable columns, read from a request body. */
function readMetal(body) {
    const name = validate.text(body.name, 'Name', { required: true, max: 200 });
    return {
        name,
        category_id: validate.integer(body.category_id, 'Category', { min: 1 }),
        thickness: str(body.thickness, 'Thickness range', 500),
        description: str(body.description, 'Description', 10000),
        image_path: str(body.image_path, 'Image', 1000),
        quick_look: validate.json(body.quick_look, 'Quick look', { fallback: {} }),
        services: validate.json(body.services, 'Services', { fallback: [] }),
        specifications: validate.json(body.specifications, 'Specifications', { fallback: {} }),
        thickness_specs: validate.json(body.thickness_specs, 'Thickness specs', { fallback: {} }),
        about_section: validate.json(body.about_section, 'About section', { fallback: {} }),
        faqs: validate.json(body.faqs, 'FAQs', { fallback: [] }),
        custom_fields: validate.json(body.custom_fields, 'Custom fields', { fallback: {} }),
        display_order: validate.integer(body.display_order, 'Display order') || 0,
        pricing_config: validate.json(body.pricing_config, 'Pricing config', { fallback: {} }),
    };
}

/* quick_look.thicknesses[n].services is the source of truth; thickness_specs[value].available_services mirrors it. */
function mirrorThicknessServices(quickLook, thicknessSpecs) {
    const specs = thicknessSpecs || {};
    if (quickLook && Array.isArray(quickLook.thicknesses)) {
        quickLook.thicknesses.forEach(t => {
            if (!t.value) return;
            specs[t.value] = { ...(specs[t.value] || {}), available_services: (t.services || []).map(Number) };
        });
    }
    return specs;
}

const COLUMNS = ['name', 'category_id', 'thickness', 'description', 'image_path', 'quick_look', 'services', 'specifications',
    'thickness_specs', 'about_section', 'faqs', 'custom_fields', 'display_order', 'pricing_config'];
const JSON_COLUMNS = new Set(['quick_look', 'services', 'specifications', 'thickness_specs', 'about_section', 'faqs', 'custom_fields', 'pricing_config']);
const valuesOf = (m) => COLUMNS.map(c => (JSON_COLUMNS.has(c) ? JSON.stringify(m[c]) : m[c]));

// POST /api/metals/admin — create
router.post('/admin', admin, route('create the metal', async (req, res) => {
    const metal = readMetal(req.body);
    const slug = makeSlug(metal.name);
    const existing = await db.query('SELECT id FROM metals WHERE slug = $1', [slug]);
    if (existing.rows.length) throw conflict('A metal with this name already exists');

    const placeholders = COLUMNS.map((_, i) => `$${i + 2}`).join(',');
    const result = await db.query(
        `INSERT INTO metals (slug, ${COLUMNS.join(', ')}) VALUES ($1,${placeholders}) RETURNING *`,
        [slug, ...valuesOf(metal)]
    );
    created(res, result.rows[0]);
}));

// POST /api/metals/admin/upload-image — upload a picture (WebP + thumbnail under uploads/metals)
router.post('/admin/upload-image', admin,
    handleUpload(imageUpload({ maxMb: 25, maxFiles: 1 }).single('image'), { maxMb: 25, maxFiles: 1 }),
    route('upload the image', async (req, res) => {
        const img = await saveImage(req.file, { folder: 'metals', maxWidth: 1600, thumbWidth: 480 });
        ok(res, { image_path: img.url });
    }));

// PUT /api/metals/admin/:slug — update (by slug or id); the slug follows the name
router.put('/admin/:slug', admin, route('update the metal', async (req, res) => {
    const identifier = req.params.slug;
    const metal = readMetal(req.body);
    metal.thickness_specs = mirrorThicknessServices(metal.quick_look, metal.thickness_specs);

    const existing = await db.query(`SELECT id, slug FROM metals WHERE ${byIdentifier(identifier)}`, [identifier]);
    if (!existing.rows.length) throw notFound();
    const { id } = existing.rows[0];

    const slug = makeSlug(metal.name);
    if (slug !== identifier) {
        const taken = await db.query('SELECT id FROM metals WHERE slug = $1 AND id != $2', [slug, id]);
        if (taken.rows.length) throw conflict('A metal with this name already exists');
    }

    const sets = COLUMNS.map((c, i) => `${c} = $${i + 2}`).join(', ');
    const result = await db.query(
        `UPDATE metals SET slug = $1, ${sets} WHERE id = $${COLUMNS.length + 2} RETURNING *`,
        [slug, ...valuesOf(metal), id]
    );
    ok(res, result.rows[0]);
}));

// DELETE /api/metals/admin/:slug — delete (by slug or id)
router.delete('/admin/:slug', admin, route('delete the metal', async (req, res) => {
    const identifier = req.params.slug;
    const result = await db.query(`DELETE FROM metals WHERE ${byIdentifier(identifier)} RETURNING id, name`, [identifier]);
    if (!result.rows.length) throw notFound();
    ok(res, undefined, { message: `Metal "${result.rows[0].name}" deleted` });
}));

module.exports = router;

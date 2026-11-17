/*
 * Services (Laser Cutting, Bending, Powder Coating, …). Mounted at /api/services.
 *
 *   GET    /                 every active service with parent_ids (?includeInactive=true for all)
 *   GET    /usage            same, plus metal_count
 *   GET    /:id/metals       metals that offer a service (?view=list for list columns only)
 *   GET    /slug/:slug       one active service with its hero image
 *   POST   /admin/upload     upload a picture (admin) -> { path }
 *   POST   /admin            create (admin)
 *   PUT    /admin/:id        update (admin; most fields not sent are kept)
 *   PUT    /admin/:id/metals which metals / thicknesses offer it (admin)
 *   PATCH  /admin/:id/status show or hide it (admin)
 *   DELETE /admin/:id        delete (admin)
 *
 * Pricing lives in Admin > Costing (routes/costing.js); pricing_config here
 * is only stored and returned as before.
 */
const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
    route, ok, created, HttpError, badRequest, validate, withTransaction, imageUpload, handleUpload, saveImage,
} = require('../helpers');

const router = express.Router();
const admin = [authenticate, requireAdmin];

const generateSlug = (title) => title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const shouldIncludeInactive = (req) => String(req.query.includeInactive || '').toLowerCase() === 'true';
const notFound = () => new HttpError(404, 'Service not found');

const PARENT_IDS = `COALESCE((
    SELECT jsonb_agg(parent_id)
    FROM service_relationships
    WHERE service_id = s.id
), '[]'::jsonb) as parent_ids`;

// Metal rows offering service $1, either for the whole metal or for one of its thicknesses.
const THICKNESS_OFFERS = `EXISTS (
    SELECT 1 FROM jsonb_array_elements(
        CASE WHEN m.quick_look IS NOT NULL AND m.quick_look ? 'thicknesses'
             THEN m.quick_look->'thicknesses'
             ELSE '[]'::jsonb END
    ) t
    WHERE t->'services' @> to_jsonb($1::int)
)`;

// ── Public ───────────────────────────────────────────────

// GET /api/services — List all services with their parent IDs
router.get('/', route('load the services', async (req, res) => {
    const result = await db.query(`
        SELECT s.*, ${PARENT_IDS}
        FROM services s
        WHERE ($1::boolean OR COALESCE(s.is_active, true) = true)
        ORDER BY s.display_order, s.id
    `, [shouldIncludeInactive(req)]);
    ok(res, result.rows);
}));

// GET /api/services/usage — Services with metal usage counts
router.get('/usage', route('load the services', async (req, res) => {
    const result = await db.query(`
        SELECT s.*, ${PARENT_IDS},
            s.pricing_config,
            (SELECT COUNT(*) FROM metals m
             WHERE m.services IS NOT NULL
               AND jsonb_typeof(m.services) = 'array'
               AND m.services::jsonb @> to_jsonb(s.id)
            ) as metal_count
        FROM services s
        WHERE ($1::boolean OR COALESCE(s.is_active, true) = true)
        ORDER BY s.display_order, s.id
    `, [shouldIncludeInactive(req)]);
    ok(res, result.rows);
}));

// GET /api/services/:id/metals — Metals using a specific service (full data for frontend)
router.get('/:id/metals', route('load the metals for this service', async (req, res) => {
    const serviceId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(serviceId)) throw badRequest('Invalid service ID');

    // ?view=list: only what a list of metals shows, not every spec and FAQ.
    const columns = req.query.view === 'list'
        ? 'm.id, m.slug, m.name, m.thickness, m.description, m.image_path, m.category_id, m.display_order'
        : 'm.*';
    const result = await db.query(`
        SELECT ${columns},
            mc.name as category_name,
            mc.slug as category_slug,
            m.services::jsonb @> to_jsonb($1::int) as metal_level,
            ${THICKNESS_OFFERS} as thickness_level
        FROM metals m
        LEFT JOIN metal_categories mc ON m.category_id = mc.id
        WHERE (m.services IS NOT NULL AND jsonb_typeof(m.services::jsonb) = 'array' AND m.services::jsonb @> to_jsonb($1::int))
           OR ${THICKNESS_OFFERS}
        ORDER BY m.display_order, m.name
    `, [serviceId]);
    ok(res, result.rows);
}));

// GET /api/services/slug/:slug — Fetch a single service by its slug
router.get('/slug/:slug', route('load the service', async (req, res) => {
    const result = await db.query(`
        SELECT s.*,
          hs.hero_image,
          ${PARENT_IDS}
        FROM services s
        LEFT JOIN hero_sections hs ON hs.service_id = s.id
        WHERE s.slug = $1 AND COALESCE(s.is_active, true) = true
    `, [req.params.slug]);

    // The public service page reads this 404 shape (success with data: null).
    if (!result.rows.length) return res.status(404).json({ success: true, data: null, message: 'Service not found' });
    ok(res, result.rows[0]);
}));

// ── Admin ────────────────────────────────────────────────

// POST /api/services/admin/upload — Upload service image (WebP + thumbnail under uploads/services)
router.post('/admin/upload', admin,
    handleUpload(imageUpload({ maxMb: 25, maxFiles: 1 }).single('image'), { maxMb: 25, maxFiles: 1 }),
    route('upload the image', async (req, res) => {
        const img = await saveImage(req.file, { folder: 'services', maxWidth: 1600, thumbWidth: 480 });
        ok(res, { path: img.url });
    }));

const parentIdsOf = (value) => (Array.isArray(value) ? value.map(id => validate.id(id, 'Parent service')) : []);

async function setParents(client, serviceId, parentIds) {
    await client.query('DELETE FROM service_relationships WHERE service_id = $1', [serviceId]);
    for (const parentId of parentIds) {
        await client.query('INSERT INTO service_relationships (service_id, parent_id) VALUES ($1, $2)', [serviceId, parentId]);
    }
}

// POST /api/services/admin
router.post('/admin', admin, route('create the service', async (req, res) => {
    const b = req.body;
    const title = validate.text(b.title, 'Title', { required: true, max: 200 });
    const parentIds = parentIdsOf(b.parent_ids);

    const service = await withTransaction(async (client) => {
        const result = await client.query(
            `INSERT INTO services (
                title, description, image_path, display_order, is_production,
                min_length, max_length, min_width, max_width, min_height, max_height,
                dimensions_unit, service_options, base_price, pricing_config, slug, is_active
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
            [
                title, b.description, b.image_path, b.display_order || 0, b.is_production || false,
                b.min_length || 0, b.max_length || 0, b.min_width || 0, b.max_width || 0, b.min_height || 0, b.max_height || 0,
                b.dimensions_unit || 'in', JSON.stringify(b.service_options || []),
                parseFloat(b.base_price) || 0, JSON.stringify(b.pricing_config || {}), generateSlug(title), b.is_active !== false,
            ]
        );
        const row = result.rows[0];
        await setParents(client, row.id, parentIds);
        return row;
    });

    service.parent_ids = b.parent_ids || [];
    created(res, service);
}));

// PUT /api/services/admin/:id
router.put('/admin/:id', admin, route('update the service', async (req, res) => {
    const id = validate.id(req.params.id, 'Service');
    const b = req.body;
    const title = validate.text(b.title, 'Title', { max: 200 });
    const parentIds = parentIdsOf(b.parent_ids);

    const service = await withTransaction(async (client) => {
        const result = await client.query(`
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
                slug = COALESCE($16, slug),
                is_active = COALESCE($17, is_active)
            WHERE id = $18
            RETURNING *
        `, [
            title, b.description, b.image_path, b.display_order, b.is_production,
            b.min_length, b.max_length, b.min_width, b.max_width, b.min_height, b.max_height,
            b.dimensions_unit,
            b.service_options === undefined ? null : JSON.stringify(b.service_options),
            parseFloat(b.base_price) || 0,
            JSON.stringify(b.pricing_config || {}),
            title ? generateSlug(title) : null,
            typeof b.is_active === 'boolean' ? b.is_active : null,
            id,
        ]);
        if (!result.rows.length) throw notFound();
        await setParents(client, id, parentIds);
        return result.rows[0];
    });

    service.parent_ids = b.parent_ids || [];
    ok(res, service);
}));

// PUT /api/services/admin/:id/metals — which metals (and which of their thicknesses) offer this service.
// body: { assignments: [{ id, assigned, thicknesses: [value, …] }] }
router.put('/admin/:id/metals', admin, route('update the metal assignments', async (req, res) => {
    const serviceId = Number.parseInt(req.params.id, 10);
    const { assignments } = req.body;
    if (!assignments || !Array.isArray(assignments)) throw badRequest('Assignments array is required');

    await withTransaction(async (client) => {
        for (const ass of assignments) {
            const metalRes = await client.query('SELECT id, services, quick_look, thickness_specs FROM metals WHERE id = $1', [ass.id]);
            if (!metalRes.rows.length) continue;
            let { services, quick_look: quickLook, thickness_specs: thicknessSpecs } = metalRes.rows[0];

            if (typeof services === 'string') {
                try { services = JSON.parse(services); } catch { services = []; }
            }
            if (!Array.isArray(services)) services = [];

            // Metal-wide
            if (ass.assigned) {
                if (!services.some(sid => Number(sid) === serviceId)) services.push(serviceId);
            } else {
                services = services.filter(sid => Number(sid) !== serviceId);
            }

            // Per thickness: quick_look.thicknesses[n].services is the source of truth …
            if (quickLook && Array.isArray(quickLook.thicknesses)) {
                quickLook.thicknesses = quickLook.thicknesses.map(t => {
                    let tServices = Array.isArray(t.services) ? t.services : [];
                    if (ass.thicknesses && ass.thicknesses.includes(t.value)) {
                        if (!tServices.some(sid => Number(sid) === serviceId)) tServices = [...tServices, serviceId];
                    } else {
                        tServices = tServices.filter(sid => Number(sid) !== serviceId);
                    }
                    return { ...t, services: tServices };
                });
            }

            // … and thickness_specs[value].available_services mirrors it.
            thicknessSpecs = thicknessSpecs || {};
            if (quickLook && Array.isArray(quickLook.thicknesses)) {
                quickLook.thicknesses.forEach(t => {
                    if (!t.value) return;
                    thicknessSpecs[t.value] = { ...(thicknessSpecs[t.value] || {}), available_services: (t.services || []).map(Number) };
                });
            }

            await client.query(
                'UPDATE metals SET services = $1, quick_look = $2, thickness_specs = $3 WHERE id = $4',
                [JSON.stringify(services), JSON.stringify(quickLook), JSON.stringify(thicknessSpecs), ass.id]
            );
        }
    });
    ok(res, undefined, { message: 'Metal assignments updated successfully' });
}));

// PATCH /api/services/admin/:id/status — Toggle active/inactive without deleting service data
router.patch('/admin/:id/status', admin, route('update the service status', async (req, res) => {
    const { is_active: isActive } = req.body;
    if (typeof isActive !== 'boolean') throw badRequest('is_active must be true or false');
    const result = await db.query('UPDATE services SET is_active = $1 WHERE id = $2 RETURNING *', [isActive, validate.id(req.params.id, 'Service')]);
    if (!result.rows.length) throw notFound();
    ok(res, result.rows[0]);
}));

// DELETE /api/services/admin/:id
router.delete('/admin/:id', admin, route('delete the service', async (req, res) => {
    const result = await db.query('DELETE FROM services WHERE id = $1 RETURNING title', [validate.id(req.params.id, 'Service')]);
    if (!result.rows.length) throw notFound();
    ok(res, undefined, { message: `Service "${result.rows[0].title}" deleted` });
}));

module.exports = router;

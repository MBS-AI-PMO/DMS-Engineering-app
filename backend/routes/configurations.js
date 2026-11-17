/*
 * Sizing and metal assignments for CNC machining and sheet cutting, and
 * per-metal size limits / thicknesses. Mounted at /api/configurations.
 *
 * Units: service_configs (CNC / sheet cutting limits) are in mm;
 * metal_configs min/max bounds are in inches; available_thicknesses in mm.
 *
 *   GET /cnc-machining, PUT /cnc-machining      (admin)
 *   GET /sheet-cutting, PUT /sheet-cutting      (admin)
 *   GET /metals, PUT /metals/:metalId           (admin)
 *   GET /pricing/sheet-cutting-metals, /pricing/cnc-config, /pricing/cnc-metals   (public, quote page)
 */
const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, badRequest, validate, withTransaction } = require('../helpers');

const router = express.Router();
const admin = [authenticate, requireAdmin];

/*
 * Recompute metal_configs.is_sheet_cuttable for one metal (or all): a metal
 * is cuttable when its bounds fit inside the sheet cutting limits.
 */
async function recomputeSheetCuttability(metalId = null) {
    const scRes = await db.query(`SELECT min_x, max_x, min_y, max_y FROM service_configs WHERE service_type = 'sheet_cutting'`);
    if (!scRes.rows.length) return;
    const sc = scRes.rows[0];
    const where = metalId ? 'WHERE metal_id = $1' : '';

    // No sheet cutting limits yet: nothing is cuttable.
    if (!sc.max_x || !sc.max_y) {
        await db.query(`UPDATE metal_configs SET is_sheet_cuttable = false ${where}`, metalId ? [metalId] : []);
        return;
    }

    const limits = [sc.max_x, sc.max_y, sc.min_x || 0, sc.min_y || 0];
    await db.query(
        `UPDATE metal_configs
         SET is_sheet_cuttable = (
             max_x IS NOT NULL AND max_y IS NOT NULL AND
             max_x <= $1 AND max_y <= $2 AND
             min_x >= $3 AND min_y >= $4
         )
         ${metalId ? 'WHERE metal_id = $5' : ''}`,
        metalId ? [...limits, metalId] : limits
    );
}

/* Replace the metals assigned to a service_type ('cnc_machining' | 'sheet_cutting'). */
async function setAssignments(client, serviceType, metalIds) {
    await client.query('DELETE FROM service_metal_assignments WHERE service_type = $1', [serviceType]);
    if (!metalIds.length) return;
    const values = metalIds.map((_, i) => `($1, $${i + 2})`).join(',');
    await client.query(
        `INSERT INTO service_metal_assignments (service_type, metal_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [serviceType, ...metalIds]
    );
}

const metalIdsOf = (value) => validate.list(value, 'Metals');

// ── CNC machining ────────────────────────────────────────

// GET /api/configurations/cnc-machining — fetch config + all metals with assigned flag
router.get('/cnc-machining', admin, route('load the CNC config', async (req, res) => {
    const [configRes, metalsRes] = await Promise.all([
        db.query(`SELECT * FROM service_configs WHERE service_type = 'cnc_machining'`),
        db.query(`
            SELECT m.id, m.name, m.slug, m.image_path,
                mc_cat.name as category_name, mc_cat.slug as category_slug,
                EXISTS(
                    SELECT 1 FROM service_metal_assignments sma
                    WHERE sma.service_type = 'cnc_machining' AND sma.metal_id = m.id
                ) AS assigned
            FROM metals m
            LEFT JOIN metal_categories mc_cat ON m.category_id = mc_cat.id
            ORDER BY mc_cat.display_order, m.name
        `),
    ]);
    ok(res, { config: configRes.rows[0] || {}, metals: metalsRes.rows });
}));

// PUT /api/configurations/cnc-machining — save sizing + metal assignments
router.put('/cnc-machining', admin, route('save the CNC config', async (req, res) => {
    const { min_x: minX, max_x: maxX, min_y: minY, max_y: maxY, min_z: minZ, max_z: maxZ } = req.body;
    const metalIds = metalIdsOf(req.body.metal_ids);
    if (parseFloat(maxX) <= parseFloat(minX) || parseFloat(maxY) <= parseFloat(minY) || parseFloat(maxZ) <= parseFloat(minZ)) {
        throw badRequest('Max values must be greater than min values');
    }

    const config = await withTransaction(async (client) => {
        const configRes = await client.query(
            `UPDATE service_configs
             SET min_x=$1, max_x=$2, min_y=$3, max_y=$4, min_z=$5, max_z=$6, updated_at=NOW()
             WHERE service_type = 'cnc_machining'
             RETURNING *`,
            [minX || 0, maxX, minY || 0, maxY, minZ || 0, maxZ]
        );
        await setAssignments(client, 'cnc_machining', metalIds);
        return configRes.rows[0];
    });
    ok(res, config);
}));

// ── Sheet cutting ────────────────────────────────────────

// GET /api/configurations/sheet-cutting — fetch config + metals with cuttability flag
router.get('/sheet-cutting', admin, route('load the sheet cutting config', async (req, res) => {
    const [configRes, metalsRes] = await Promise.all([
        db.query(`SELECT * FROM service_configs WHERE service_type = 'sheet_cutting'`),
        db.query(`
            SELECT m.id, m.name, m.slug, m.image_path,
                mc_cat.name as category_name, mc_cat.slug as category_slug,
                EXISTS(
                    SELECT 1 FROM service_metal_assignments sma
                    WHERE sma.service_type = 'sheet_cutting' AND sma.metal_id = m.id
                ) AS assigned,
                COALESCE(mc.is_sheet_cuttable, false) AS is_sheet_cuttable
            FROM metals m
            LEFT JOIN metal_configs mc ON mc.metal_id = m.id
            LEFT JOIN metal_categories mc_cat ON m.category_id = mc_cat.id
            ORDER BY mc_cat.display_order, m.name
        `),
    ]);
    ok(res, { config: configRes.rows[0] || {}, metals: metalsRes.rows });
}));

// PUT /api/configurations/sheet-cutting — save metal assignments only
router.put('/sheet-cutting', admin, route('save the sheet cutting config', async (req, res) => {
    const metalIds = metalIdsOf(req.body.metal_ids);
    await withTransaction(async (client) => {
        await setAssignments(client, 'sheet_cutting', metalIds);
        // is_sheet_cuttable mirrors the assignment for every configured metal
        await client.query(`
            UPDATE metal_configs SET is_sheet_cuttable = (
                EXISTS(
                    SELECT 1 FROM service_metal_assignments sma
                    WHERE sma.metal_id = metal_configs.metal_id AND sma.service_type = 'sheet_cutting'
                )
            )
        `);
    });
    ok(res);
}));

// ── Per-metal sizing + thicknesses ───────────────────────

// GET /api/configurations/metals — all metals with their metal_config
router.get('/metals', admin, route('load the metal configs', async (req, res) => {
    const result = await db.query(`
        SELECT m.id, m.name, m.slug, m.image_path, m.quick_look,
            mc.min_x, mc.max_x, mc.min_y, mc.max_y, mc.min_z, mc.max_z,
            COALESCE(mc.available_thicknesses, '[]'::jsonb) AS available_thicknesses,
            COALESCE(mc.is_sheet_cuttable, false) AS is_sheet_cuttable,
            mc.id AS config_id
        FROM metals m
        LEFT JOIN metal_configs mc ON mc.metal_id = m.id
        ORDER BY m.name
    `);
    ok(res, result.rows);
}));

// PUT /api/configurations/metals/:metalId — upsert a metal's config, then recompute its cuttability
router.put('/metals/:metalId', admin, route('save the metal config', async (req, res) => {
    const metalId = validate.id(req.params.metalId, 'Metal');
    const { min_x: minX, max_x: maxX, min_y: minY, max_y: maxY, min_z: minZ, max_z: maxZ, available_thicknesses: available } = req.body;
    if (!Array.isArray(available)) throw badRequest('available_thicknesses must be an array');

    // Numbers only, positive, ascending
    const thicknesses = available.map(t => parseFloat(t)).filter(t => !Number.isNaN(t) && t > 0).sort((a, b) => a - b);

    await db.query(`
        INSERT INTO metal_configs (metal_id, min_x, max_x, min_y, max_y, min_z, max_z, available_thicknesses)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (metal_id) DO UPDATE SET
            min_x=$2, max_x=$3, min_y=$4, max_y=$5,
            min_z=$6, max_z=$7,
            available_thicknesses=$8,
            updated_at=NOW()
    `, [metalId, minX || null, maxX || null, minY || null, maxY || null, minZ || null, maxZ || null, JSON.stringify(thicknesses)]);

    await recomputeSheetCuttability(metalId);

    const fresh = await db.query(`
        SELECT mc.*, m.name, m.slug
        FROM metal_configs mc
        JOIN metals m ON m.id = mc.metal_id
        WHERE mc.metal_id = $1
    `, [metalId]);
    ok(res, fresh.rows[0]);
}));

// ── Quote page (public) ──────────────────────────────────

// GET /api/configurations/pricing/sheet-cutting-metals — metals assigned to sheet cutting, with their thicknesses
router.get('/pricing/sheet-cutting-metals', route('load the sheet cutting metals', async (req, res) => {
    const result = await db.query(`
        SELECT m.id, m.name, m.slug, m.image_path,
            COALESCE(mc.available_thicknesses, '[]'::jsonb) AS available_thicknesses,
            COALESCE(mc.is_sheet_cuttable, false) AS is_sheet_cuttable
        FROM metals m
        INNER JOIN service_metal_assignments sma
            ON sma.metal_id = m.id AND sma.service_type = 'sheet_cutting'
        LEFT JOIN metal_configs mc ON mc.metal_id = m.id
        ORDER BY m.name
    `);
    ok(res, result.rows);
}));

// GET /api/configurations/pricing/cnc-config — CNC sizing limits
router.get('/pricing/cnc-config', route('load the CNC config', async (req, res) => {
    const result = await db.query(`SELECT min_x, max_x, min_y, max_y, min_z, max_z FROM service_configs WHERE service_type = 'cnc_machining'`);
    ok(res, result.rows[0] || null);
}));

// GET /api/configurations/pricing/cnc-metals — metals assigned to CNC machining
router.get('/pricing/cnc-metals', route('load the CNC metals', async (req, res) => {
    const result = await db.query(`
        SELECT m.id, m.name, m.slug, m.image_path
        FROM metals m
        INNER JOIN service_metal_assignments sma
            ON sma.metal_id = m.id AND sma.service_type = 'cnc_machining'
        ORDER BY m.name
    `);
    ok(res, result.rows);
}));

module.exports = router;

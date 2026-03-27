const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────────────────────
// HELPER: Recompute is_sheet_cuttable for one metal or all
// Logic: metal fits inside sheet cutting global size limits
// ─────────────────────────────────────────────────────────
async function recomputeSheetCuttability(metalId = null) {
    const scRes = await db.query(
        `SELECT min_x, max_x, min_y, max_y FROM service_configs WHERE service_type = 'sheet_cutting'`
    );
    if (scRes.rows.length === 0) return;
    const sc = scRes.rows[0];

    // If no sheet cutting limits configured yet, nothing is cuttable
    if (!sc.max_x || !sc.max_y) {
        const where = metalId ? `WHERE metal_id = $1` : '';
        const params = metalId ? [metalId] : [];
        await db.query(`UPDATE metal_configs SET is_sheet_cuttable = false ${where}`, params);
        return;
    }

    const whereExtra = metalId ? `AND metal_id = ${parseInt(metalId)}` : '';
    await db.query(
        `UPDATE metal_configs
         SET is_sheet_cuttable = (
             max_x IS NOT NULL AND max_y IS NOT NULL AND
             max_x <= $1 AND max_y <= $2 AND
             min_x >= $3 AND min_y >= $4
         )
         WHERE 1=1 ${whereExtra}`,
        [sc.max_x, sc.max_y, sc.min_x || 0, sc.min_y || 0]
    );
}

// ─────────────────────────────────────────────────────────
// CNC MACHINING CONFIGURATION
// ─────────────────────────────────────────────────────────

// GET /api/configurations/cnc-machining — fetch config + all metals with assigned flag
router.get('/cnc-machining', authenticate, requireAdmin, async (req, res) => {
    try {
        const [configRes, metalsRes] = await Promise.all([
            db.query(`SELECT * FROM service_configs WHERE service_type = 'cnc_machining'`),
            db.query(`
                SELECT m.id, m.name, m.slug, m.image_path,
                    EXISTS(
                        SELECT 1 FROM service_metal_assignments sma
                        WHERE sma.service_type = 'cnc_machining' AND sma.metal_id = m.id
                    ) AS assigned
                FROM metals m
                ORDER BY m.name
            `)
        ]);
        res.json({ success: true, data: { config: configRes.rows[0] || {}, metals: metalsRes.rows } });
    } catch (err) {
        console.error('GET /configurations/cnc-machining error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch CNC config' });
    }
});

// PUT /api/configurations/cnc-machining — save sizing + metal assignments
router.put('/cnc-machining', authenticate, requireAdmin, async (req, res) => {
    try {
        const { min_x, max_x, min_y, max_y, min_z, max_z, metal_ids = [] } = req.body;

        if (parseFloat(max_x) <= parseFloat(min_x) ||
            parseFloat(max_y) <= parseFloat(min_y) ||
            parseFloat(max_z) <= parseFloat(min_z)) {
            return res.status(400).json({ success: false, error: 'Max values must be greater than min values' });
        }

        await db.query('BEGIN');

        const configRes = await db.query(
            `UPDATE service_configs
             SET min_x=$1, max_x=$2, min_y=$3, max_y=$4, min_z=$5, max_z=$6, updated_at=NOW()
             WHERE service_type = 'cnc_machining'
             RETURNING *`,
            [min_x || 0, max_x, min_y || 0, max_y, min_z || 0, max_z]
        );

        await db.query(`DELETE FROM service_metal_assignments WHERE service_type = 'cnc_machining'`);
        if (metal_ids.length > 0) {
            const values = metal_ids.map((_, i) => `('cnc_machining', $${i + 1})`).join(',');
            await db.query(
                `INSERT INTO service_metal_assignments (service_type, metal_id) VALUES ${values} ON CONFLICT DO NOTHING`,
                metal_ids
            );
        }

        await db.query('COMMIT');
        res.json({ success: true, data: configRes.rows[0] });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('PUT /configurations/cnc-machining error:', err);
        res.status(500).json({ success: false, error: 'Failed to save CNC config' });
    }
});

// ─────────────────────────────────────────────────────────
// SHEET CUTTING CONFIGURATION
// ─────────────────────────────────────────────────────────

// GET /api/configurations/sheet-cutting — fetch config + metals with cuttability flag
router.get('/sheet-cutting', authenticate, requireAdmin, async (req, res) => {
    try {
        const [configRes, metalsRes] = await Promise.all([
            db.query(`SELECT * FROM service_configs WHERE service_type = 'sheet_cutting'`),
            db.query(`
                SELECT m.id, m.name, m.slug, m.image_path,
                    EXISTS(
                        SELECT 1 FROM service_metal_assignments sma
                        WHERE sma.service_type = 'sheet_cutting' AND sma.metal_id = m.id
                    ) AS assigned,
                    COALESCE(mc.is_sheet_cuttable, false) AS is_sheet_cuttable
                FROM metals m
                LEFT JOIN metal_configs mc ON mc.metal_id = m.id
                ORDER BY m.name
            `)
        ]);
        res.json({ success: true, data: { config: configRes.rows[0] || {}, metals: metalsRes.rows } });
    } catch (err) {
        console.error('GET /configurations/sheet-cutting error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch Sheet Cutting config' });
    }
});

// PUT /api/configurations/sheet-cutting — save sizing + assignments → triggers recompute
router.put('/sheet-cutting', authenticate, requireAdmin, async (req, res) => {
    try {
        const { min_x, max_x, min_y, max_y, metal_ids = [] } = req.body;

        if (parseFloat(max_x) <= parseFloat(min_x) || parseFloat(max_y) <= parseFloat(min_y)) {
            return res.status(400).json({ success: false, error: 'Max values must be greater than min values' });
        }

        await db.query('BEGIN');

        await db.query(
            `UPDATE service_configs
             SET min_x=$1, max_x=$2, min_y=$3, max_y=$4, min_z=NULL, max_z=NULL, updated_at=NOW()
             WHERE service_type = 'sheet_cutting'`,
            [min_x || 0, max_x, min_y || 0, max_y]
        );

        await db.query(`DELETE FROM service_metal_assignments WHERE service_type = 'sheet_cutting'`);
        if (metal_ids.length > 0) {
            const values = metal_ids.map((_, i) => `('sheet_cutting', $${i + 1})`).join(',');
            await db.query(
                `INSERT INTO service_metal_assignments (service_type, metal_id) VALUES ${values} ON CONFLICT DO NOTHING`,
                metal_ids
            );
        }

        await db.query('COMMIT');

        // Recompute sheet-cuttability for ALL metals after SC config changes
        await recomputeSheetCuttability();

        const configRes = await db.query(`SELECT * FROM service_configs WHERE service_type = 'sheet_cutting'`);
        res.json({ success: true, data: configRes.rows[0] });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('PUT /configurations/sheet-cutting error:', err);
        res.status(500).json({ success: false, error: 'Failed to save Sheet Cutting config' });
    }
});

// ─────────────────────────────────────────────────────────
// METALS CONFIGURATION (per-metal sizing + thicknesses)
// ─────────────────────────────────────────────────────────

// GET /api/configurations/metals — all metals with their metal_config
router.get('/metals', authenticate, requireAdmin, async (req, res) => {
    try {
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
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('GET /configurations/metals error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch metal configs' });
    }
});

// PUT /api/configurations/metals/:metalId — upsert metal config → recomputes cuttability
router.put('/metals/:metalId', authenticate, requireAdmin, async (req, res) => {
    try {
        const { metalId } = req.params;
        const { min_x, max_x, min_y, max_y, min_z, max_z, available_thicknesses } = req.body;

        if (!Array.isArray(available_thicknesses)) {
            return res.status(400).json({ success: false, error: 'available_thicknesses must be an array' });
        }

        // Sanitize thicknesses: numbers only, positive, sorted ascending
        const thicknesses = available_thicknesses
            .map(t => parseFloat(t))
            .filter(t => !isNaN(t) && t > 0)
            .sort((a, b) => a - b);

        await db.query(`
            INSERT INTO metal_configs (metal_id, min_x, max_x, min_y, max_y, min_z, max_z, available_thicknesses)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (metal_id) DO UPDATE SET
                min_x=$2, max_x=$3, min_y=$4, max_y=$5,
                min_z=$6, max_z=$7,
                available_thicknesses=$8,
                updated_at=NOW()
        `, [metalId, min_x || null, max_x || null, min_y || null, max_y || null,
            min_z || null, max_z || null, JSON.stringify(thicknesses)]);

        // Recompute sheet-cuttability for this specific metal
        await recomputeSheetCuttability(parseInt(metalId));

        const fresh = await db.query(`
            SELECT mc.*, m.name, m.slug
            FROM metal_configs mc
            JOIN metals m ON m.id = mc.metal_id
            WHERE mc.metal_id = $1
        `, [metalId]);

        res.json({ success: true, data: fresh.rows[0] });
    } catch (err) {
        console.error('PUT /configurations/metals/:metalId error:', err);
        res.status(500).json({ success: false, error: 'Failed to save metal config' });
    }
});

// ─────────────────────────────────────────────────────────
// PRICING FLOW ENDPOINTS (public — no auth required)
// ─────────────────────────────────────────────────────────

// GET /api/configurations/pricing/sheet-cutting-metals
// Returns metals assigned to sheet cutting with their configured thicknesses
router.get('/pricing/sheet-cutting-metals', async (req, res) => {
    try {
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
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('GET /configurations/pricing/sheet-cutting-metals error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch sheet cutting metals' });
    }
});

// GET /api/configurations/pricing/cnc-metals
// Returns metals assigned to CNC machining
router.get('/pricing/cnc-metals', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT m.id, m.name, m.slug, m.image_path
            FROM metals m
            INNER JOIN service_metal_assignments sma
                ON sma.metal_id = m.id AND sma.service_type = 'cnc_machining'
            ORDER BY m.name
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('GET /configurations/pricing/cnc-metals error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch CNC metals' });
    }
});

module.exports = router;

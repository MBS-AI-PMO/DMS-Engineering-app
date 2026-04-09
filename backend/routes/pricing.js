const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ── Admin Routes ─────────────────────────────────────────

/**
 * GET /api/admin/pricing/metadata
 * Returns metals (with their available thicknesses) and services.
 */
router.get('/admin/metadata', authenticate, requireAdmin, async (req, res) => {
    try {
        const [metalsRes, servicesRes] = await Promise.all([
            db.query(`
                SELECT m.id, m.name, m.slug, m.image_path, m.services AS assigned_services,
                       m.quick_look, m.pricing_config
                FROM metals m
                ORDER BY m.name
            `),
            db.query(`SELECT id, title, description, is_production FROM services ORDER BY display_order, id`)
        ]);

        res.json({
            success: true,
            data: {
                metals: metalsRes.rows,
                services: servicesRes.rows
            }
        });
    } catch (err) {
        console.error('Error fetching pricing metadata:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch metadata' });
    }
});

/**
 * GET /api/admin/pricing/:metalId/:serviceId
 * Returns existing pricing rules for a specific metal/service.
 */
router.get('/admin/rules/:metalId/:serviceId', authenticate, requireAdmin, async (req, res) => {
    const { metalId, serviceId } = req.params;
    try {
        const result = await db.query(
            'SELECT * FROM pricing_rules WHERE metal_id = $1 AND service_id = $2',
            [metalId, serviceId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching pricing rules:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch pricing rules' });
    }
});

/**
 * POST /api/admin/pricing/upsert
 * Batch saves/updates pricing rules for a metal/service combination.
 */
router.post('/admin/upsert', authenticate, requireAdmin, async (req, res) => {
    const { metal_id, service_id, rules } = req.body;

    if (!metal_id || !service_id || !Array.isArray(rules)) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        await db.query('BEGIN');

        for (const rule of rules) {
            const { thickness_value, price_per_inch_height, price_per_inch_length, price_per_inch_thickness, base_price } = rule;

            await db.query(`
                INSERT INTO pricing_rules (metal_id, service_id, thickness_value, price_per_inch_height, price_per_inch_length, price_per_inch_thickness, base_price, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (metal_id, service_id, thickness_value)
                DO UPDATE SET
                    price_per_inch_height = EXCLUDED.price_per_inch_height,
                    price_per_inch_length = EXCLUDED.price_per_inch_length,
                    price_per_inch_thickness = EXCLUDED.price_per_inch_thickness,
                    base_price = EXCLUDED.base_price,
                    updated_at = NOW()
            `, [metal_id, service_id, thickness_value, price_per_inch_height || 0, price_per_inch_length || 0, price_per_inch_thickness || 0, base_price || 0]);
        }

        await db.query('COMMIT');
        res.json({ success: true, message: 'Pricing rules updated successfully' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Error upserting pricing rules:', err);
        res.status(500).json({ success: false, error: 'Failed to update pricing rules' });
    }
});

// ── Quantity Discount Admin Routes ─────────────────────────
/**
 * GET /api/admin/pricing/discounts
 */
router.get('/admin/discounts', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM quantity_discounts ORDER BY (quantities->>0)::int ASC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching quantity discounts:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch discounts' });
    }
});

/**
 * POST /api/admin/pricing/discounts/upsert
 */
router.post('/admin/discounts/upsert', authenticate, requireAdmin, async (req, res) => {
    const { id, quantities, discount_percent, is_active } = req.body;

    if (!quantities || !Array.isArray(quantities) || quantities.length === 0 || discount_percent == null) {
        return res.status(400).json({ success: false, error: 'Missing required fields (quantities array and discount_percent)' });
    }

    try {
        const minQty = quantities.length > 0 ? Math.min(...quantities.map(q => parseInt(q))) : 0;

        if (id) {
            await db.query(`
                UPDATE quantity_discounts
                SET quantities = $1, min_quantity = $2, discount_percent = $3, is_active = $4, updated_at = NOW()
                WHERE id = $5
            `, [JSON.stringify(quantities), minQty, discount_percent, is_active !== false, id]);
        } else {
            await db.query(`
                INSERT INTO quantity_discounts (quantities, min_quantity, discount_percent, is_active)
                VALUES ($1, $2, $3, $4)
            `, [JSON.stringify(quantities), minQty, discount_percent, is_active !== false]);
        }
        res.json({ success: true, message: 'Discount tier saved successfully' });
    } catch (err) {
        console.error('Error upserting discount tier:', err);
        res.status(500).json({ success: false, error: 'Failed to save discount tier' });
    }
});

/**
 * DELETE /api/admin/pricing/discounts/:id
 */
router.delete('/admin/discounts/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM quantity_discounts WHERE id = $1', [id]);
        res.json({ success: true, message: 'Discount tier deleted successfully' });
    } catch (err) {
        console.error('Error deleting discount tier:', err);
        res.status(500).json({ success: false, error: 'Failed to delete discount tier' });
    }
});

// ── Laser Cut Rates Admin CRUD ────────────────────────────

/**
 * GET /api/admin/pricing/laser-rates
 */
router.get('/admin/laser-rates', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM laser_cut_rates ORDER BY material_family, thickness ASC'
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching laser rates:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch laser rates' });
    }
});

/**
 * POST /api/admin/pricing/laser-rates
 */
router.post('/admin/laser-rates', authenticate, requireAdmin, async (req, res) => {
    const { material_family, thickness, cut_rate, pierce_time } = req.body;
    if (!thickness || !cut_rate || pierce_time == null) {
        return res.status(400).json({ success: false, error: 'thickness, cut_rate, and pierce_time are required' });
    }
    try {
        const result = await db.query(
            `INSERT INTO laser_cut_rates (material_family, thickness, cut_rate, pierce_time)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [material_family || 'generic', parseFloat(thickness), parseFloat(cut_rate), parseFloat(pierce_time)]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error creating laser rate:', err);
        res.status(500).json({ success: false, error: 'Failed to create laser rate' });
    }
});

/**
 * PUT /api/admin/pricing/laser-rates/:id
 */
router.put('/admin/laser-rates/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { material_family, thickness, cut_rate, pierce_time } = req.body;
    try {
        const result = await db.query(
            `UPDATE laser_cut_rates
             SET material_family = $1, thickness = $2, cut_rate = $3, pierce_time = $4, updated_at = NOW()
             WHERE id = $5 RETURNING *`,
            [material_family || 'generic', parseFloat(thickness), parseFloat(cut_rate), parseFloat(pierce_time), id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Rate not found' });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error updating laser rate:', err);
        res.status(500).json({ success: false, error: 'Failed to update laser rate' });
    }
});

/**
 * DELETE /api/admin/pricing/laser-rates/:id
 */
router.delete('/admin/laser-rates/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM laser_cut_rates WHERE id = $1', [id]);
        res.json({ success: true, message: 'Laser rate deleted' });
    } catch (err) {
        console.error('Error deleting laser rate:', err);
        res.status(500).json({ success: false, error: 'Failed to delete laser rate' });
    }
});

// ── Sheet Cost Rates Admin CRUD ───────────────────────────

/**
 * GET /api/admin/pricing/sheet-cost-rates
 */
router.get('/admin/sheet-cost-rates', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM sheet_cost_rates ORDER BY family, min_thick ASC'
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching sheet cost rates:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch sheet cost rates' });
    }
});

/**
 * POST /api/admin/pricing/sheet-cost-rates
 */
router.post('/admin/sheet-cost-rates', authenticate, requireAdmin, async (req, res) => {
    const { family, min_thick, max_thick, ga, sheet_cost_4x8 } = req.body;
    if (!family || min_thick == null || max_thick == null || sheet_cost_4x8 == null) {
        return res.status(400).json({ success: false, error: 'family, min_thick, max_thick, and sheet_cost_4x8 are required' });
    }
    try {
        const result = await db.query(
            `INSERT INTO sheet_cost_rates (family, min_thick, max_thick, ga, sheet_cost_4x8)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [family, parseFloat(min_thick), parseFloat(max_thick), ga ? parseInt(ga) : null, parseFloat(sheet_cost_4x8)]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error creating sheet cost rate:', err);
        res.status(500).json({ success: false, error: 'Failed to create sheet cost rate' });
    }
});

/**
 * PUT /api/admin/pricing/sheet-cost-rates/:id
 */
router.put('/admin/sheet-cost-rates/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { family, min_thick, max_thick, ga, sheet_cost_4x8 } = req.body;
    try {
        const result = await db.query(
            `UPDATE sheet_cost_rates
             SET family = $1, min_thick = $2, max_thick = $3, ga = $4, sheet_cost_4x8 = $5, updated_at = NOW()
             WHERE id = $6 RETURNING *`,
            [family, parseFloat(min_thick), parseFloat(max_thick), ga ? parseInt(ga) : null, parseFloat(sheet_cost_4x8), id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Rate not found' });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error updating sheet cost rate:', err);
        res.status(500).json({ success: false, error: 'Failed to update sheet cost rate' });
    }
});

/**
 * DELETE /api/admin/pricing/sheet-cost-rates/:id
 */
router.delete('/admin/sheet-cost-rates/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM sheet_cost_rates WHERE id = $1', [id]);
        res.json({ success: true, message: 'Sheet cost rate deleted' });
    } catch (err) {
        console.error('Error deleting sheet cost rate:', err);
        res.status(500).json({ success: false, error: 'Failed to delete sheet cost rate' });
    }
});

// ── Public Discount Tiers (no auth required) ────────────────
router.get('/discounts', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM quantity_discounts WHERE is_active = true ORDER BY (quantities->>0)::int ASC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching public discounts:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch discounts' });
    }
});

// ── Public Calculation Route ────────────────────────────

/**
 * POST /api/pricing/calculate
 *
 * Pricing engine based on CSV formulas:
 *
 * MATERIAL COST  — Sheet nesting formula (sheet metal material.csv)
 *   material_cost = sheet_cost_4x8 / parts_per_sheet
 *   parts_per_sheet = floor(usable_L / buffered_L) × floor(usable_W / buffered_W)
 *   Sheet = 96×48 in (4×8). Buffers: edge=0.125, part=0.0625, kerf=0.01
 *
 * LASER CUTTING  — Time-based formula (laser.csv)
 *   runtime_h = (perimeter_mm / cut_rate_mm_s / 3600) + (pierce_count × pierce_time_s / 3600)
 *   setup_hrs = 0.3 (default), 0.25 if thickness > 0.25 in
 *   cost_per_unit = (hourly_rate × setup_hrs / qty) + (hourly_rate × runtime_h)
 *
 * BENDING        — Categorised per-bend rates (bending.csv)
 *   cost_per_unit = (setup_fee / qty) + sum_of_bend_rates
 *
 * POWDER COATING — Batch-based oven utilisation (powder coating.csv)
 *   Scenario 1: floor(ovenW / (partW+6)) × floor(ovenL / (thickness+24))
 *   Scenario 2: floor(ovenL / (partW+6)) × floor(ovenW / (thickness+24))
 *   parts_per_batch = max(s1, s2)
 *   cost_per_unit = (setup_charge + num_batches × batch_cost) / qty
 *
 * GENERAL MARKUP — percentage from site_settings (general markup.csv)
 */
router.post('/calculate', async (req, res) => {
    const {
        metal_id,
        service_id,
        thickness_value,
        length_in,
        height_in,
        quantity = 1,
        additional_services = []
    } = req.body;

    if (!metal_id && !service_id) {
        return res.status(400).json({ success: false, error: 'Select either a material or a production method to see pricing.' });
    }

    try {
        const qty = parseInt(quantity) || 1;

        // 1. Fetch Metal (with category/family for sheet cost lookup) and Primary Service
        const [metalRes, serviceRes] = await Promise.all([
            metal_id
                ? db.query(`
                    SELECT m.*, mc.name AS material_family
                    FROM metals m
                    LEFT JOIN metal_categories mc ON m.category_id = mc.id
                    WHERE m.id = $1
                  `, [metal_id])
                : Promise.resolve({ rows: [] }),
            service_id
                ? db.query('SELECT * FROM services WHERE id = $1', [service_id])
                : Promise.resolve({ rows: [] })
        ]);

        const metal = metalRes.rows[0] || null;
        const mainService = serviceRes.rows[0] || null;

        // ── MATERIAL COST (Sheet Nesting Formula) ─────────────────────────────
        // Source: sheet metal material.csv
        // Cost = sheet_cost_4x8 / parts_per_sheet (per unit)
        // Lookup: sheet_cost_rates WHERE family matches AND min_thick < thickness AND max_thick >= thickness
        let material_cost = 0;

        const EDGE_BUFFER = 0.125;   // inches – distance from sheet edge to parts
        const PART_BUFFER = 0.0625;  // inches – gap between parts
        const KERF_WIDTH = 0.01;    // inches – laser kerf
        const SHEET_L = 96;      // inches – 8 ft (long side of 4×8 sheet)
        const SHEET_W = 48;      // inches – 4 ft (short side of 4×8 sheet)

        if (metal && thickness_value && parseFloat(length_in) > 0 && parseFloat(height_in) > 0) {
            const thickNum = parseFloat(thickness_value);
            const family = metal.material_family || 'generic';

            const sheetRes = await db.query(
                `SELECT sheet_cost_4x8 FROM sheet_cost_rates
                 WHERE family = $1 AND min_thick < $2 AND max_thick >= $3
                 ORDER BY min_thick ASC LIMIT 1`,
                [family, thickNum - 0.001, thickNum]
            );

            if (sheetRes.rows.length > 0) {
                const sheetCost = parseFloat(sheetRes.rows[0].sheet_cost_4x8);
                const pL = parseFloat(length_in);
                const pW = parseFloat(height_in);

                // Buffered part footprint
                const buffL = pL + PART_BUFFER + KERF_WIDTH;
                const buffW = pW + PART_BUFFER + KERF_WIDTH;

                // Usable sheet dimensions (subtract edge buffers, add one part_buffer back
                // because the last part doesn't need a trailing gap)
                const usableL = SHEET_L - 2 * EDGE_BUFFER + PART_BUFFER;
                const usableW = SHEET_W - 2 * EDGE_BUFFER + PART_BUFFER;

                const pps = Math.floor(usableL / buffL) * Math.floor(usableW / buffW);
                if (pps > 0) {
                    material_cost = sheetCost / pps;
                }
            }
        }

        // ── MAIN SERVICE COST ──────────────────────────────────────────────────
        let main_service_cost = 0;
        let laser_warning = false;
        const techData = req.body.technical_data || {};

        if (mainService) {
            const config = mainService.pricing_config || {};
            const isLaser = mainService.title.toLowerCase().includes('laser');
            const isBending = mainService.title.toLowerCase().includes('bending');
            const isCNC = parseInt(mainService.id) === 2;

            // ── LASER CUTTING (laser.csv) ─────────────────────────────────────
            // runtime_h = (perimeter_mm / cut_rate_mm_s / 3600) + (pierces × pierce_time_s / 3600)
            // setup_hrs = 0.3 default; 0.25 if thickness > 0.25 in  (from CSV conditional)
            // cost/unit = (hourly_rate × setup_hrs / qty) + (hourly_rate × runtime_h)
            if (isLaser && techData.totalPerimeter && thickness_value) {
                const thickNum = parseFloat(thickness_value);
                const family = metal?.material_family || 'generic';
                const hourly_rate = parseFloat(config.hourly_rate) || 100;

                // Range lookup: first row where thickness >= part thickness.
                // Prefers exact family match; falls back to 'generic'.
                const laserRes = await db.query(
                    `SELECT cut_rate, pierce_time FROM laser_cut_rates
                     WHERE (material_family = $1 OR material_family = 'generic')
                       AND thickness >= $2
                     ORDER BY CASE WHEN material_family = $1 THEN 0 ELSE 1 END,
                              thickness ASC
                     LIMIT 1`,
                    [family, thickNum]
                );

                const rule = laserRes.rows[0];
                if (rule && parseFloat(rule.cut_rate) > 0) {
                    const cut_rate = parseFloat(rule.cut_rate);   // mm/s
                    const pierce_time = parseFloat(rule.pierce_time) || 0; // s

                    // Setup time: 0.3 h thin material, 0.25 h thick material (CSV formula)
                    const setup_hrs = thickNum > 0.25 ? 0.25 : 0.3;

                    const perimeter_mm = parseFloat(techData.totalPerimeter) || 0;
                    const pierces = parseInt(techData.pierceCount) || 1;

                    // runtime per part (hours)
                    const runtime_h = (perimeter_mm / cut_rate / 3600) + (pierces * pierce_time / 3600);

                    // Amortise one-time setup across qty; add per-part labour
                    main_service_cost = (hourly_rate * setup_hrs / qty) + (hourly_rate * runtime_h);

                    // Thickness warning (CSV: set_operation_name WARNING if > 0.376)
                    if (thickNum > 0.376) laser_warning = true;
                }
            }

            // ── BENDING (bending.csv) ─────────────────────────────────────────
            // cost/unit = (setup_fee / qty) + sum_of_categorised_bend_rates
            // Bend categories (by length vs thresholds): small / med / large
            if (main_service_cost === 0 && isBending && techData.bends && Array.isArray(techData.bends)) {
                const setup_fee = parseFloat(config.setup_fee) || 0;
                const med_thresh = parseFloat(config.med_bend_threshold) || 200;
                const large_thresh = parseFloat(config.large_bend_threshold) || 500;
                const small_rate = parseFloat(config.small_bend_rate) || 15;
                const med_rate = parseFloat(config.med_bend_rate) || 15;
                const large_rate = parseFloat(config.large_bend_rate) || 20;

                let bend_cost_per_unit = 0;
                techData.bends.forEach(bend => {
                    const len = parseFloat(bend.length) || 0;
                    if (len >= large_thresh) bend_cost_per_unit += large_rate;
                    else if (len >= med_thresh) bend_cost_per_unit += med_rate;
                    else bend_cost_per_unit += small_rate;
                });

                // One-time setup amortised over qty
                main_service_cost = (setup_fee / qty) + bend_cost_per_unit;
            }

            // ── CNC MACHINING (dimension-based fallback) ──────────────────────
            if (main_service_cost === 0 && isCNC) {
                const base = parseFloat(config.base_setup) || 25;
                const w_cost = (parseFloat(height_in) || 0) * (parseFloat(config.price_per_width) || 0);
                const l_cost = (parseFloat(length_in) || 0) * (parseFloat(config.price_per_length) || 0);
                const t_cost = (parseFloat(thickness_value) || 0) * (parseFloat(config.price_per_thickness) || 0);
                main_service_cost = base + w_cost + l_cost + t_cost;
            }

            // ── GENERIC SERVICE FALLBACK ──────────────────────────────────────
            if (main_service_cost === 0) {
                main_service_cost = parseFloat(mainService.base_price) || 0;
            }
        }

        // ── ADDITIONAL SERVICES COST ──────────────────────────────────────────
        let additional_cost = 0;
        const service_breakdown = [];

        if (Array.isArray(additional_services) && additional_services.length > 0) {
            for (const sReq of additional_services) {
                const sId = typeof sReq === 'object' ? sReq.id : sReq;
                const optId = typeof sReq === 'object' ? sReq.option_id : null;

                const sRes = await db.query('SELECT * FROM services WHERE id = $1', [sId]);
                if (sRes.rows.length === 0) continue;
                const s = sRes.rows[0];

                let sPrice = parseFloat(s.base_price) || 0;
                let sName = s.title;

                const sTitleLower = s.title.toLowerCase();
                const isPowder = sTitleLower.includes('powder') || sTitleLower.includes('coating');

                // ── POWDER COATING (powder coating.csv) ──────────────────────
                // Two orientations tried; use the one that fits more parts per batch.
                // Hanging dimension uses part THICKNESS + 24" (rack clearance), NOT length.
                // cost/unit = (setup_charge + num_batches × batch_cost) / qty
                if (isPowder && s.pricing_config) {
                    const cfg = s.pricing_config;
                    const ovenW = parseFloat(cfg.oven_width) || 90;
                    const ovenL = parseFloat(cfg.oven_length) || 160;
                    const batchCost = parseFloat(cfg.batch_cost) || 150;
                    const setupCharge = (parseFloat(cfg.setup_time) || 15) * (parseFloat(cfg.shop_rate) || 38) / 60;

                    const pW = (parseFloat(height_in) || 10) + 6;       // part width + 6" gap
                    const pThick = (parseFloat(thickness_value) || 0.1) + 24; // thickness + 24" rack clearance

                    // Scenario 1: part width along oven width, parts hang along oven length
                    const s1 = Math.floor(ovenW / pW) * Math.floor(ovenL / pThick);
                    // Scenario 2: part width along oven length, parts hang along oven width
                    const s2 = Math.floor(ovenL / pW) * Math.floor(ovenW / pThick);

                    const perBatch = Math.max(1, s1, s2);
                    const numBatches = Math.ceil(qty / perBatch);

                    sPrice = (setupCharge + numBatches * batchCost) / qty;
                }

                // Option/colour mapping
                if (optId !== null && s.service_options && Array.isArray(s.service_options)) {
                    const opt = s.service_options.find((o, idx) => o.id === optId || o.index === optId || idx === optId || o.name === optId);
                    if (opt) {
                        sName = `${s.title} - ${opt.name || opt.color}`;
                        // For Powder Coating, the enging covers the cost. 
                        // For others (Anodizing, etc.), they might have a fixed price surcharge.
                        if (!isPowder) {
                            sPrice += parseFloat(opt.price || 0);
                        }
                    }
                }

                additional_cost += sPrice;
                service_breakdown.push({ name: sName, price: sPrice });
            }
        }

        let unit_total = material_cost + main_service_cost + additional_cost;

        // ── GLOBAL MARKUP (general markup.csv) ───────────────────────────────
        // Simple percentage applied to all pricing — configured in Contact/Settings admin.
        const markupRes = await db.query("SELECT value FROM site_settings WHERE key = 'general_markup'");
        const markupPercent = markupRes.rows.length > 0 ? parseFloat(markupRes.rows[0].value) : 10;
        unit_total = unit_total * (1 + markupPercent / 100);

        // ── QUANTITY DISCOUNTS ────────────────────────────────────────────────
        let discount_percent = 0;
        let applied_tier = null;

        const discountRes = await db.query(`
            SELECT * FROM quantity_discounts
            WHERE is_active = true
            ORDER BY (quantities->>0)::int DESC
        `);

        if (discountRes.rows.length > 0) {
            const matchedTier = discountRes.rows.find(tier => {
                const triggers = Array.isArray(tier.quantities) ? tier.quantities : [];
                return triggers.some(q => parseInt(qty) >= parseInt(q));
            });
            if (matchedTier) {
                discount_percent = parseFloat(matchedTier.discount_percent);
                applied_tier = matchedTier;
            }
        }

        const unit_discount_amount = unit_total * (discount_percent / 100);
        const final_unit_price = Math.max(0, unit_total - unit_discount_amount);
        const final_total = final_unit_price * qty;

        res.json({
            success: true,
            total_price: final_total,
            breakdown: {
                material_cost,
                production_cost: main_service_cost,
                additional_services_cost: additional_cost,
                service_breakdown,
                unit_total,
                final_unit_price,
                discount_percent,
                discount_amount: unit_discount_amount * qty,
                applied_tier,
                warnings: laser_warning
                    ? ['Part thickness exceeds 0.376 in. Please verify laser cutting capability.']
                    : []
            }
        });

    } catch (err) {
        console.error('Error calculating price:', err);
        res.status(500).json({ success: false, error: 'Calculation failed' });
    }
});

module.exports = router;

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
 * Returns all quantity-based discount tiers.
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
 * Creates or updates a discount tier.
 */
router.post('/admin/discounts/upsert', authenticate, requireAdmin, async (req, res) => {
    const { id, quantities, discount_percent, is_active } = req.body;

    if (!quantities || !Array.isArray(quantities) || quantities.length === 0 || discount_percent == null) {
        return res.status(400).json({ success: false, error: 'Missing required fields (quantities array and discount_percent)' });
    }

    try {
        const minQty = quantities.length > 0 ? Math.min(...quantities.map(q => parseInt(q))) : 0;

        if (id) {
            // Update
            await db.query(`
                UPDATE quantity_discounts 
                SET quantities = $1, min_quantity = $2, discount_percent = $3, is_active = $4, updated_at = NOW()
                WHERE id = $5
            `, [JSON.stringify(quantities), minQty, discount_percent, is_active !== false, id]);
        } else {
            // Insert
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
 * Removes a discount tier.
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

// ── Public Discount Tiers (no auth required) ────────────────
/**
 * GET /api/pricing/discounts
 * Returns active quantity-based discount tiers for the public pricing page.
 */
router.get('/discounts', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM quantity_discounts WHERE is_active = true ORDER BY (quantities->>0)::int ASC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching public discounts:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch discounts' });
    }
});

// ── Public Calculation Routes ────────────────────────────

/**
 * POST /api/pricing/calculate
 * Calculates the price for a specific configuration using the decoupled model.
 */
router.post('/calculate', async (req, res) => {
    const {
        metal_id,
        service_id,
        thickness_value,
        length_in,
        height_in,
        quantity = 1,
        additional_services = [] // Array of service objects or IDs
    } = req.body;

    // Allow partial calculations for real-time UI updates
    if (!metal_id && !service_id) {
        return res.status(400).json({ success: false, error: 'Select either a material or a production method to see pricing.' });
    }

    try {
        // 1. Fetch Metal and Primary Service Data
        const [metalRes, serviceRes] = await Promise.all([
            metal_id ? db.query('SELECT * FROM metals WHERE id = $1', [metal_id]) : Promise.resolve({ rows: [] }),
            service_id ? db.query('SELECT * FROM services WHERE id = $1', [service_id]) : Promise.resolve({ rows: [] })
        ]);

        const metal = metalRes.rows[0] || null;
        const mainService = serviceRes.rows[0] || null;

        // ── MATERIAL COST ─────────────────────────────────────
        const isCNC = mainService ? parseInt(mainService.id) === 2 : false;
        let material_cost = 0;

        let price_per_length = 0, price_per_width = 0;
        if (metal && thickness_value) {
            const entry = (metal.pricing_config || {})[thickness_value];
            if (entry && typeof entry === 'object') {
                price_per_length = parseFloat(entry.price_per_length) || 0;
                price_per_width = parseFloat(entry.price_per_width) || 0;
                material_cost = (parseFloat(length_in) || 0) * price_per_length + (parseFloat(height_in) || 0) * price_per_width;
            } else if (entry) {
                // Legacy flat price-per-sqin format
                const sqin = parseFloat(entry) || 0;
                material_cost = (parseFloat(length_in) || 0) * (parseFloat(height_in) || 0) * sqin;
            }
        }

        // ── MAIN SERVICE COST ──────────────────────────────────
        let main_service_cost = 0;

        if (mainService) {
            if (isCNC) {
                const config = mainService.pricing_config || {};
                const base = parseFloat(config.base_setup) || 25;
                const w_cost = (parseFloat(height_in) || 0) * (parseFloat(config.price_per_width) || 0);
                const l_cost = (parseFloat(length_in) || 0) * (parseFloat(config.price_per_length) || 0);
                const t_cost = (parseFloat(thickness_value) || 0) * (parseFloat(config.price_per_thickness) || 0);
                main_service_cost = base + w_cost + l_cost + t_cost;
            } else {
                // Check per-metal/thickness pricing rules first (e.g., Laser Cutting rates vary by material)
                if (metal_id && thickness_value) {
                    const ruleRes = await db.query(
                        'SELECT * FROM pricing_rules WHERE metal_id = $1 AND service_id = $2 AND thickness_value = $3',
                        [metal_id, service_id, thickness_value]
                    );
                    if (ruleRes.rows.length > 0) {
                        const rule = ruleRes.rows[0];
                        main_service_cost = parseFloat(rule.base_price) || 0;
                        main_service_cost += (parseFloat(length_in) || 0) * (parseFloat(rule.price_per_inch_length) || 0);
                        main_service_cost += (parseFloat(height_in) || 0) * (parseFloat(rule.price_per_inch_height) || 0);
                        main_service_cost += (parseFloat(thickness_value) || 0) * (parseFloat(rule.price_per_inch_thickness) || 0);
                    }
                }
                // Fall back to the service's flat base_price if no rule found
                if (main_service_cost === 0) {
                    main_service_cost = parseFloat(mainService.base_price) || 0;
                }
            }
        }

        // ── ADDITIONAL SERVICES COST ──────────────────────────
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

                // If an option (color) is selected, find its specific price
                if (optId !== null && s.service_options && Array.isArray(s.service_options)) {
                    const opt = s.service_options.find(o => o.id === optId || o.index === optId);
                    if (opt) {
                        sPrice += parseFloat(opt.base_price || opt.price) || 0;
                        sName = `${s.title} - ${opt.name || opt.color}`;
                    }
                }

                additional_cost += sPrice;
                service_breakdown.push({ name: sName, price: sPrice });
            }
        }

        const unit_total = material_cost + main_service_cost + additional_cost;

        // ── DISCOUNTS ─────────────────────────────────────────
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
                return triggers.some(q => parseInt(quantity) >= parseInt(q));
            });

            if (matchedTier) {
                discount_percent = parseFloat(matchedTier.discount_percent);
                applied_tier = matchedTier;
            }
        }

        const unit_discount_amount = unit_total * (discount_percent / 100);
        const final_unit_price = Math.max(0, unit_total - unit_discount_amount);
        const final_total = final_unit_price * (parseInt(quantity) || 1);

        res.json({
            success: true,
            total_price: final_total,
            breakdown: {
                material_cost,
                material_formula: { price_per_length, price_per_width },
                production_cost: main_service_cost,
                additional_services_cost: additional_cost,
                unit_total,
                final_unit_price,
                discount_percent,
                discount_amount: unit_discount_amount * quantity,
                applied_tier
            }
        });
    } catch (err) {
        console.error('Error calculating price:', err);
        res.status(500).json({ success: false, error: 'Calculation failed' });
    }
});

module.exports = router;

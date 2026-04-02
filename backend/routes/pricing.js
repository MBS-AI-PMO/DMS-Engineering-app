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

    if (!metal_id || !service_id) {
        return res.status(400).json({ success: false, error: 'Missing calculation parameters' });
    }

    try {
        // 1. Fetch Metal and Primary Service Data
        const [metalRes, serviceRes] = await Promise.all([
            db.query('SELECT * FROM metals WHERE id = $1', [metal_id]),
            db.query('SELECT * FROM services WHERE id = $1', [service_id])
        ]);

        if (metalRes.rows.length === 0 || serviceRes.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Metal or Service not found' });
        }

        const metal = metalRes.rows[0];
        const mainService = serviceRes.rows[0];

        // ── MATERIAL COST ─────────────────────────────────────
        const isCNC = parseInt(mainService.id) === 2;
        let material_cost = 0;

        if (!isCNC) {
            // Pricing config is { "thickness_val": price_per_sqin }
            const metalPricing = metal.pricing_config || {};
            const material_sqin_price = parseFloat(metalPricing[thickness_value]) || 0;
            const area = (parseFloat(length_in) || 0) * (parseFloat(height_in) || 0);
            material_cost = area * material_sqin_price;
        }

        // ── MAIN SERVICE COST ──────────────────────────────────
        let main_service_cost = 0;

        if (isCNC) {
            const config = mainService.pricing_config || {};
            const base = parseFloat(config.base_setup) || 25;
            const w_cost = (parseFloat(height_in) || 0) * (parseFloat(config.price_per_width) || 0);
            const l_cost = (parseFloat(length_in) || 0) * (parseFloat(config.price_per_length) || 0);
            const t_cost = (parseFloat(thickness_value) || 0) * (parseFloat(config.price_per_thickness) || 0);
            main_service_cost = base + w_cost + l_cost + t_cost;
        } else {
            // Standard service (e.g., Laser Cutting)
            main_service_cost = parseFloat(mainService.base_price) || 0;
        }

        // ── ADDITIONAL SERVICES COST ──────────────────────────
        let additional_cost = 0;
        if (Array.isArray(additional_services) && additional_services.length > 0) {
            const addSvcIds = additional_services.map(s => typeof s === 'object' ? s.id : s);
            const addSvcsRes = await db.query('SELECT * FROM services WHERE id = ANY($1)', [addSvcIds]);

            for (const s of addSvcsRes.rows) {
                // For now, simple base price sum
                // (Tapping or other complex logic can be added here)
                additional_cost += parseFloat(s.base_price) || 0;
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
                production_cost: main_service_cost,
                additional_cost,
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

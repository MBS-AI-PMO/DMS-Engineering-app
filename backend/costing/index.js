const db = require('../db');
const { computeQuote } = require('./engine/computeQuote');
const { loadConfig, bumpConfigVersion } = require('./config/loadConfig');
const { normalizeRequest, CostingInputError } = require('./input/normalize');
const { round2 } = require('./engine/util');

/*
 * Pricing with the shop's costing (the Zamyr method, see engine/). Used by
 * POST /api/pricing/calculate and by order placement and PayPal, so a price
 * is always worked out on the server from the part and the admin's setup.
 */

const ENGINE_VERSION = 'zamyr-1';

/* The /calculate response the quote page already reads. Rows are shown
 * after markups so they add up to the total; costs and markup percentages
 * stay on the server. */
function toResponseBody(result) {
    if (result.status === 'incomplete') {
        return {
            success: false,
            incomplete: true,
            reasons: result.reasons.map(r => ({ code: r.code, message: r.message })),
            error: 'Finish choosing the method, material and thickness to see the price.',
            engine: ENGINE_VERSION,
        };
    }
    if (result.status !== 'priced') {
        return {
            success: false,
            quote_required: true,
            reasons: result.reasons.map(r => ({ code: r.code, message: r.message })),
            warnings: result.warnings,
            error: 'An instant price isn\'t available for this part. Please request a quote.',
            engine: ENGINE_VERSION,
        };
    }
    const qty = result.qty;
    const t = result.totals;
    const materialOps = result.operations.filter(o => o.bucket === 'material');
    const otherOps = result.operations.filter(o => o.bucket !== 'material');
    const materialAfter = round2(materialOps.reduce((s, o) => s + o.priceAfterMarkups, 0));
    const rows = [
        ...otherOps.map(o => ({ name: o.label, price: o.priceAfterMarkups, pricing_mode: 'fixed_total', price_with_markup: o.priceAfterMarkups })),
        ...result.addOns.map(a => ({ name: a.name, price: a.totalCost, pricing_mode: 'fixed_total', price_with_markup: a.totalCost })),
    ];
    return {
        success: true,
        quote_required: false,
        engine: ENGINE_VERSION,
        config_version: result.configVersion,
        total_price: t.finalTotal,
        lead_days: result.leadDays || 0,
        breakdown: {
            material_cost: qty > 0 ? materialAfter / qty : materialAfter,
            material_total_cost: materialAfter,
            material_total_with_markup: materialAfter,
            service_breakdown: rows,
            unit_total: t.unitPrice,
            subtotal_before_discount: t.subtotal,
            final_unit_price: t.finalUnitPrice,
            discount_percent: t.discountPercent,
            discount_amount: t.discountAmount,
            discounts_enabled: Boolean(result.discountsEnabled),
            applied_tier: result.appliedDiscountTier ? { id: result.appliedDiscountTier.id, discount_percent: result.appliedDiscountTier.discount_percent } : null,
            warnings: result.warnings,
        },
    };
}

/* Prices a /calculate request body. Returns { status, body, result, input }.
 * requireMeasured: price only from the server's own measurement of the
 * file named in body.file_ref (orders and PayPal). */
async function priceQuote(body = {}, { client = db, requireMeasured = false } = {}) {
    if (!body.metal_id && !body.service_id) {
        return { status: 400, body: { success: false, error: 'Select either a material or a production method to see pricing.' } };
    }
    try {
        const config = await loadConfig(client);
        const input = await normalizeRequest(body, config, client, { requireMeasured });
        const result = computeQuote(input, config);
        result.warnings = Array.from(new Set([...input.warnings, ...result.warnings]));
        result.discountsEnabled = config.discounts.enabled;
        return { status: 200, body: toResponseBody(result), result, input };
    } catch (err) {
        if (err instanceof CostingInputError) return { status: err.status, body: { success: false, error: err.message } };
        console.error('[Costing] Price calculation failed:', err);
        return { status: 500, body: { success: false, error: 'Calculation failed' } };
    }
}

module.exports = { priceQuote, toResponseBody, bumpConfigVersion, ENGINE_VERSION };

const crypto = require('crypto');
const { pricingInputForItem, snapshotInput } = require('./input/fromCart');
const { round2 } = require('./engine/util');

/*
 * Prices a whole cart on the server for order placement and PayPal, with
 * whichever pricing is live (priceForSite from routes/pricing.js).
 *
 * Returns
 *   lines: [{ index, fileName, quantity, unitPrice, lineTotal, snapshot }]
 *   quoteRequired: [{ index, fileName, reasons }]   lines with no instant price
 *   changed: [{ index, fileName, unitPrice, lineTotal }] lines whose price differs from the cart's
 *   total: sum of line totals
 *   hash: fingerprint of exactly what was priced (to tie a PayPal payment to its order)
 */
async function priceCart(items, priceForSite) {
    const lines = [];
    const quoteRequired = [];
    const changed = [];
    const inputs = [];

    for (const [index, item] of (Array.isArray(items) ? items : []).entries()) {
        const fileName = item?.fileName || `Part ${index + 1}`;
        const input = pricingInputForItem(item);
        if (!input) {
            quoteRequired.push({ index, fileName, reasons: [{ code: 'NOT_PRICEABLE', message: 'This part needs to be set up again on the quote page.' }] });
            continue;
        }
        inputs.push(input);
        const out = await priceForSite(input, { requireMeasured: true });
        if (out.body?.quote_required) {
            quoteRequired.push({ index, fileName, reasons: out.body.reasons || [] });
            continue;
        }
        if (!out.body?.success) {
            const err = new Error(`${fileName}: ${out.body?.error || 'could not be priced.'}`);
            err.statusCode = out.status >= 500 ? 500 : 400;
            throw err;
        }
        const quantity = input.quantity;
        const lineTotal = round2(out.body.total_price);
        const unitPrice = Number(out.body.breakdown?.final_unit_price) || round2(lineTotal / quantity);
        const clientUnit = Number(item.unitPrice ?? item.pricing?.total);
        if (!Number.isFinite(clientUnit) || Math.abs(clientUnit - unitPrice) > 0.009) {
            changed.push({ index, cartId: item.cartId ?? null, fileName, quantity, unitPrice, lineTotal });
        }
        lines.push({
            index,
            fileName,
            quantity,
            unitPrice,
            lineTotal,
            snapshot: {
                engine: out.engine,
                config_version: out.body.config_version || null,
                priced_at: new Date().toISOString(),
                input: snapshotInput(input),
                totals: out.result?.totals || { finalTotal: lineTotal, finalUnitPrice: unitPrice },
                operations: out.result?.operations?.map(o => ({ name: o.name, bucket: o.bucket, totalCost: o.totalCost, details: o.details })) || null,
                markups: out.result?.markups || null,
            },
        });
    }

    const hash = crypto.createHash('sha256').update(JSON.stringify(inputs.map(snapshotInput))).digest('hex');
    const total = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
    return { lines, quoteRequired, changed, total, hash };
}

/* The same fingerprint as priceCart's, without pricing anything. */
function cartHash(items) {
    const inputs = (Array.isArray(items) ? items : []).map(pricingInputForItem).filter(Boolean);
    return crypto.createHash('sha256').update(JSON.stringify(inputs.map(snapshotInput))).digest('hex');
}

module.exports = { priceCart, cartHash };

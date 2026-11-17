const { toNumber, round2, asArray } = require('./util');

/*
 * Markups and margins, applied the way Zamyr applies its pricing items
 * (quoteRoutingService.js 4988-5299 and 5474-5583):
 *  - material / inside / outside / purchased markups first, each on its own
 *    cost bucket;
 *  - then overhead, then general, both on the total cost BEFORE markups, so
 *    markups never stack on each other;
 *  - each markup is rounded to the cent on its own.
 * Markup = base × p/100.  Margin = base / (1 − p/100) − base.
 */

const PRIMARY_BASES = ['material', 'inside', 'outside', 'purchased'];

const tierOf = (base) => (base === 'overhead' ? 'overhead' : base === 'general' ? 'general' : 'primary');

function markupMoney(calcType, percent, baseCost) {
    if (!(baseCost > 0) || !Number.isFinite(percent) || percent === 0) return 0;
    if (String(calcType || '').toLowerCase().includes('margin')) {
        return percent >= 100 ? 0 : baseCost / (1 - percent / 100) - baseCost;
    }
    return baseCost * (percent / 100);
}

/* costs: { materialCost, insideCost, outsideCost, purchasedCost, totalEstimatedCost } */
function applyMarkups(markups, costs) {
    const baseFor = (base) => {
        if (base === 'material') return costs.materialCost;
        if (base === 'inside') return costs.insideCost;
        if (base === 'outside') return costs.outsideCost;
        if (base === 'purchased') return costs.purchasedCost;
        return costs.totalEstimatedCost;
    };
    const rows = new Array(markups.length);
    let pricingCost = 0;
    ['primary', 'overhead', 'general'].forEach((tier) => {
        asArray(markups).forEach((markup, index) => {
            if (tierOf(markup.base) !== tier) return;
            const baseCost = baseFor(markup.base);
            const percent = toNumber(markup.percent, 0);
            const totalCost = round2(Math.max(0, markupMoney(markup.calc_type, percent, baseCost)));
            rows[index] = { id: markup.id, name: markup.name, base: markup.base, calcType: markup.calc_type, percent, baseCost, totalCost };
            pricingCost += totalCost;
        });
    });
    return { rows: rows.filter(Boolean), pricingCost };
}

/* Each operation's share of the markups, so a line can be shown after
 * markups and its rows add up: a bucket markup is spread over the
 * operations in that bucket by cost; overhead and general over all of
 * them. Shares are rounded, and the rounding left over goes to the largest
 * operation so the rows sum to the markup total exactly. */
function attributeMarkups(operations, markupRows) {
    const ops = operations.map(op => ({ ...op, markupCost: 0 }));
    for (const row of markupRows) {
        if (!(row.totalCost > 0)) continue;
        const inBase = ops.filter(op => (PRIMARY_BASES.includes(row.base) ? op.bucket === row.base : true) && op.totalCost > 0);
        const baseTotal = inBase.reduce((sum, op) => sum + op.totalCost, 0);
        if (!(baseTotal > 0)) continue;
        let given = 0;
        inBase.forEach(op => {
            const share = round2(row.totalCost * (op.totalCost / baseTotal));
            op.markupCost = round2(op.markupCost + share);
            given = round2(given + share);
        });
        const drift = round2(row.totalCost - given);
        if (drift !== 0) {
            const largest = inBase.reduce((a, b) => (b.totalCost > a.totalCost ? b : a));
            largest.markupCost = round2(largest.markupCost + drift);
        }
    }
    return ops.map(op => ({ ...op, priceAfterMarkups: round2(op.totalCost + op.markupCost) }));
}

module.exports = { applyMarkups, attributeMarkups, markupMoney, PRIMARY_BASES };

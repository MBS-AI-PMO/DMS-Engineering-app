/*
 * Every thickness the quote page offers for a metal should have a sheet price
 * on the default sheet, or parts in it can only "request a quote". This finds
 * the offered metal + thickness pairs with no priced Sheet costs row and adds
 * an empty row for each (tied to that metal, price left blank) so the shop
 * only has to type the price in Admin > Costing > Sheet costs.
 *
 * Rows are per metal on purpose: a generic "Aluminum .187" row would also
 * catch 7075 at .190 (within the 0.003 in tolerance) at the 5052 price.
 *
 * Safe to run again: a pair that already has a row of its own is skipped.
 * Used by the seed and by scripts/costing_add_missing_sheet_rows.js.
 */
const { findSheetCost } = require('../engine/lookup');

const NEEDS_PRICE_SOURCE = 'needs_price';
const SAME_THICKNESS_IN = 0.0005;

const parseJson = (value, fallback) => {
    if (value && typeof value === 'object') return value;
    try { return JSON.parse(value || ''); } catch { return fallback; }
};

/* The thickness as the quote page lists it: .375", 1.000", 3 mm */
const thicknessLabel = (t) => {
    if (t.gauge) return String(t.gauge);
    const value = String(t.value).trim().replace(/["”\s]+$/, '').replace(/^0\./, '.');
    return t.metric === 'mm' ? `${value} mm` : `${value}"`;
};

async function findMissingSheetRows(client) {
    // One after another: this runs on a single transaction client.
    const metals = await client.query(`SELECT m.id, m.name, m.quick_look, m.costing_family, mc.name AS category
                                       FROM metals m LEFT JOIN metal_categories mc ON mc.id = m.category_id ORDER BY m.id`);
    const sizes = await client.query('SELECT id, name, is_default, is_active FROM costing_sheet_sizes ORDER BY sort_order, id');
    const costs = await client.query('SELECT * FROM costing_sheet_costs ORDER BY sort_order, id');
    const prices = await client.query('SELECT sheet_cost_id, sheet_size_id, cost FROM costing_sheet_cost_prices');
    const defaultSize = sizes.rows.find(s => s.is_default && s.is_active !== false);
    if (!defaultSize) return { defaultSize: null, missing: [] };

    const pricesByRow = {};
    for (const p of prices.rows) (pricesByRow[p.sheet_cost_id] ||= {})[p.sheet_size_id] = Number(p.cost);
    const rows = costs.rows.map(r => ({ ...r, prices: pricesByRow[r.id] || {} }));

    const missing = [];
    for (const m of metals.rows) {
        const family = m.costing_family || m.category || '';
        if (!family) continue;
        const thicknesses = parseJson(m.quick_look, {})?.thicknesses || [];
        const seen = new Set();
        for (const t of thicknesses) {
            const raw = parseFloat(t?.value);
            if (!(raw > 0)) continue;
            const inches = Number((t.metric === 'mm' ? raw / 25.4 : raw).toFixed(5));
            if (seen.has(inches)) continue;
            seen.add(inches);

            const match = findSheetCost(rows, { metal: { id: m.id, name: m.name, family }, thicknessIn: inches, sheetSizeId: defaultSize.id });
            if (match && match.sheetCost > 0) continue;
            const hasOwnRow = rows.some(r => Number(r.metal_id) === Number(m.id)
                && Math.abs(Number(r.thickness_in) - inches) <= SAME_THICKNESS_IN);
            if (hasOwnRow) continue;
            missing.push({
                metalId: m.id,
                metalName: m.name,
                family,
                thicknessIn: inches,
                label: thicknessLabel(t),
                why: match ? `matches ${match.row.family} ${match.row.ga || ''} at $0`.replace(/\s+/g, ' ') : 'no row',
            });
        }
    }
    return { defaultSize, missing };
}

async function addMissingSheetCostRows(client) {
    const { defaultSize, missing } = await findMissingSheetRows(client);
    if (!missing.length) return { defaultSize, added: [] };
    const maxSort = Number((await client.query('SELECT COALESCE(MAX(sort_order), 0) AS m FROM costing_sheet_costs')).rows[0].m);
    const note = `Offered on the quote page but no ${defaultSize.name} price yet: parts at this thickness ask for a quote until a price is entered.`;
    for (const [i, row] of missing.entries()) {
        await client.query(
            `INSERT INTO costing_sheet_costs (family, metal_id, ga, thickness_in, sort_order, source, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [row.family, row.metalId, row.label, row.thicknessIn, maxSort + 1 + i, NEEDS_PRICE_SOURCE, note]
        );
    }
    return { defaultSize, added: missing };
}

module.exports = { findMissingSheetRows, addMissingSheetCostRows, NEEDS_PRICE_SOURCE };

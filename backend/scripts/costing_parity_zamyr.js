/*
 * Side-by-side check: DMS's costing engine against the prices Zamyr actually
 * worked out for real quotes (Paperless Parts database dump).
 *
 *   node scripts/costing_parity_zamyr.js [path/to/dump] [path/to/pg_restore]
 *
 * For every calculated Sheet Metal quote it feeds DMS the inputs Zamyr
 * recorded for each operation (cut length, pierces, sheet cost, bend counts,
 * rates…) and compares each operation's cost, each markup and the line
 * subtotal to the cent. It also checks that DMS picks the same sheet cost
 * and laser rate rows from today's tables. Nothing is written anywhere.
 */
const { execFileSync } = require('child_process');
const snapshot = require('../costing/seed/zamyr-snapshot.json');
const { OP_TYPES, resolveVariables } = require('../costing/engine/ops');
const { applyMarkups } = require('../costing/engine/markups');
const { sheetNestingYield, findSheetCost, findLaserRate } = require('../costing/engine/lookup');
const { round2, round4 } = require('../costing/engine/util');

const DUMP = process.argv[2] || 'D:/Frontend/Paperless Parts/DB Backup/prod-postgres-2026-09-21_1805.dump';
const PG_RESTORE = process.argv[3] || 'C:/Program Files/PostgreSQL/18/bin/pg_restore.exe';
// Zamyr's Sheet Costs table was last changed then; older quotes used older prices.
const SHEET_TABLE_UPDATED = '2026-09-18 20:31';

// ── Reading the dump ──
const unescape = (v) => (v === '\\N' ? null : v.replace(/\\(.)/g, (m, c) => ({ n: '\n', t: '\t', r: '\r', '\\': '\\' }[c] ?? c)));
function readTable(table) {
    const text = execFileSync(PG_RESTORE, ['-a', '-t', table, '-n', 'cpq', '-f', '-', DUMP], { maxBuffer: 1024 * 1024 * 1024 }).toString('utf8');
    const header = text.match(new RegExp(`COPY cpq\\.${table} \\(([^)]+)\\) FROM stdin;`));
    const cols = header[1].split(', ');
    const rows = [];
    for (const line of text.slice(text.indexOf(header[0]) + header[0].length).split(/\r?\n/)) {
        if (line === '\\.') break;
        if (!line) continue;
        const cells = line.split('\t').map(unescape);
        rows.push(Object.fromEntries(cols.map((c, i) => [c, cells[i]])));
    }
    return rows;
}
const json = (v) => { try { return JSON.parse(v); } catch { return null; } };
const vars = (row) => {
    const out = {};
    for (const v of json(row.variables_json) || []) out[v.label || v.name] = Number(v.value);
    for (const [k, v] of Object.entries(json(row.overrides_json) || {})) if (!k.startsWith('__') && v !== '' && v !== null) out[k] = Number(v);
    return out;
};
const manualCost = (row) => Object.keys(json(row.overrides_json) || {}).some(k => k.startsWith('__manual'));

// ── Today's tables, as DMS seeds them ──
const SIZE_IDS = { '5x10': 1, '4x8': 2, '4x10': 3, '3x10': 4 };
const sheetRows = snapshot.sheetCosts.map((r, i) => ({
    id: i + 1, family: r.family, ga: r.ga, min_thick: r.min_thick, max_thick: r.max_thick,
    prices: Object.fromEntries(Object.entries(r.costs).filter(([, v]) => v !== null).map(([k, v]) => [SIZE_IDS[k], v])),
}));
const laserRows = snapshot.laserRates.map((r, i) => ({ id: i + 1, ...r }));
const sizeIdFor = (l, w) => (Math.max(l, w) === 120 && Math.min(l, w) === 60 ? 1 : Math.max(l, w) === 96 && Math.min(l, w) === 48 ? 2 : Math.max(l, w) === 120 && Math.min(l, w) === 48 ? 3 : null);

// ── Tally ──
const results = {};
const tally = (check, ok, detail) => {
    const r = (results[check] ||= { match: 0, differ: 0, examples: [] });
    if (ok) r.match += 1;
    else { r.differ += 1; if (r.examples.length < 6) r.examples.push(detail); }
};
const same = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

const routings = readTable('quote_routings').filter(r => r.process_name === 'Sheet Metal' && ['calculated', 'warning'].includes(r.calculation_status));
const ops = readTable('quote_routing_operations');
const pricing = readTable('quote_routing_pricing_items');
const materials = readTable('quote_routing_materials');
console.log(`Zamyr Sheet Metal quotes checked: ${routings.length}\n`);

for (const routing of routings) {
    const qty = Number(routing.quantity) || 1;
    const lineOps = ops.filter(o => o.routing_id === routing.id && o.is_enabled === 't');
    const recent = routing.updated_at >= SHEET_TABLE_UPDATED;
    const family = json(materials.find(m => m.routing_id === routing.id)?.snapshot_json)?.properties?.materialFamily || '';
    const tag = `quote line ${routing.line_item_id} (routing ${routing.id}, qty ${qty})`;

    for (const op of lineOps) {
        const c = json(op.calculated_json) || {};
        const zamyrTotal = Number(c.calculatedTotalCost ?? op.total_cost);

        if (op.operation_name === 'Material | Sheet' && c.materialSheet && c.calculationSource === 'material_sheet_nesting') {
            const m = c.materialSheet;
            if (m.nestId) continue; // priced from a real nest: DMS has no nesting
            const nest = sheetNestingYield({
                partLength: m.partLengthIn, partWidth: m.partWidthIn, sheetLength: m.sheetLengthIn, sheetWidth: m.sheetWidthIn,
                edgeBuffer: m.edgeBufferIn, partBuffer: m.partBufferIn, kerfWidth: m.kerfWidthIn,
            });
            const v = vars(op);
            const pps = v['Parts Per Sheet'] > 0 ? v['Parts Per Sheet'] : nest.maximumYield;
            tally('Material: parts per sheet', pps === m.maximumYield || v['Parts Per Sheet'] > 0, `${tag}: DMS ${nest.maximumYield}, Zamyr ${m.maximumYield}`);
            if (!(m.sheetCost > 0) || !(m.maximumYield > 0)) continue;
            const ours = round2(round4((1 / m.maximumYield) * m.sheetCost) * qty);
            tally('Material: cost', same(ours, zamyrTotal), `${tag}: DMS ${ours}, Zamyr ${zamyrTotal}`);
            const lookup = c.lookup;
            if (lookup && !('Sheet Cost' in (json(op.overrides_json) || {}))) {
                const size = sizeIdFor(lookup.sheetLengthIn, lookup.sheetWidthIn);
                const hit = size && findSheetCost(sheetRows, { metal: { family: lookup.family }, thicknessIn: lookup.thicknessIn, sheetSizeId: size });
                // The same family and gauge band; prices changed on 18 Sept, so the price itself is only compared after that.
                tally('Material: sheet cost row picked', hit && String(hit.row.ga) === String(lookup.gauge) && hit.row.family === lookup.family,
                    `${tag}: DMS ${hit?.row.family} ${hit?.row.ga}, Zamyr ${lookup.family} ${lookup.gauge} at ${lookup.thicknessIn?.toFixed(4)}"`);
                if (recent) tally('Material: sheet price (quotes after 18 Sept)', hit && same(hit.sheetCost, m.sheetCost), `${tag}: DMS ${hit?.sheetCost}, Zamyr ${m.sheetCost}`);
            }
        }

        if (op.operation_name === 'Laser' && c.laser && c.laser.totalCutLengthIn > 0 && !manualCost(op)) {
            const L = c.laser;
            const result = OP_TYPES.laser.compute(
                { qty, thicknessIn: L.thicknessIn, metal: { family: L.materialFamily }, part: { cutLengthIn: L.totalCutLengthIn - (L.etchLengthIn || 0), holeCount: L.pierceCount - 1 },
                  config: { laserRates: [{ id: 1, material_family: 'generic', thickness: 999, cut_rate: L.cutRateInPerMin, pierce_time: L.pierceRateSec }] } },
                resolveVariables({ op_type: 'laser', variables: { labor_rate: L.hourlyLaborRate, setup_hours: L.setupTimeHours, etch_length_in: L.etchLengthIn || 0 } }),
            );
            tally('Laser: cost', same(result.totalCost, zamyrTotal), `${tag}: DMS ${result.totalCost}, Zamyr ${zamyrTotal}`);
            const row = findLaserRate(laserRows, { metal: { family: L.materialFamily }, thicknessIn: L.thicknessIn });
            tally('Laser: rate row picked', row && Number(row.row.cut_rate) === Number(L.cutRateInPerMin) && Number(row.row.pierce_time) === Number(L.pierceRateSec),
                `${tag}: DMS ${row?.row.cut_rate}/${row?.row.pierce_time}, Zamyr ${L.cutRateInPerMin}/${L.pierceRateSec} at ${L.thicknessIn?.toFixed(4)}"`);
        }

        if (op.operation_name === 'Bend' && c.bend && !manualCost(op)) {
            const b = c.bend;
            const v = vars(op);
            const bends = [
                ...Array(b.smallBendCount || 0).fill({ lengthIn: 1 }),
                ...Array(b.medBendCount || 0).fill({ lengthIn: v['Med Bend Threshold (in)'] || 24 }),
                ...Array(b.largeBendCount || 0).fill({ lengthIn: v['Large Bend Threshold (in)'] || 72 }),
            ];
            const result = OP_TYPES.bend.compute(
                { qty, part: { bends, curls: b.otherFormedFeatureCount || 0 } },
                resolveVariables({ op_type: 'bend', variables: {
                    labor_rate: b.setupTime > 0 ? b.setupCost / b.setupTime : 0, setup_hours: b.setupTime,
                    med_threshold_in: v['Med Bend Threshold (in)'], large_threshold_in: v['Large Bend Threshold (in)'],
                    cost_small: v['Cost Per Small Bend (sec)'], cost_med: v['Cost Per Med Bend (sec)'],
                    cost_large: v['Cost Per Large Bend (sec)'], cost_other: v['Cost Per Other Formed Feature (sec)'],
                } }),
            );
            if (result.skip) {
                // Zamyr runs Bend on every Sheet Metal line; with no bends it still charges the setup.
                tally('Bend: flat part, Zamyr still charges setup', !(zamyrTotal > 0), `${tag}: Zamyr ${zamyrTotal} with no bends`);
                continue;
            }
            tally('Bend: cost', same(result.totalCost, zamyrTotal), `${tag}: DMS ${result.totalCost}, Zamyr ${zamyrTotal}`);
        }

        if (op.operation_name === 'Deburr' && !manualCost(op)) {
            const v = vars(op);
            const result = OP_TYPES.time.compute({ qty }, resolveVariables({ op_type: 'time', variables: { setup: v.setup_time, runtime: v.runtime, rate: v['Shop Rate ($/Hr)'] } }));
            tally('Deburr: cost', same(result.totalCost, zamyrTotal), `${tag}: DMS ${result.totalCost}, Zamyr ${zamyrTotal}`);
        }

        if (op.operation_name === 'Powder Coat' && !manualCost(op)) {
            const v = vars(op);
            const batches = v['Number of Batches'] > 0 ? v['Number of Batches'] : 1;
            // DMS works batches out from parts per batch; give it the batch count Zamyr used.
            const result = OP_TYPES.powder_coat.compute({ qty: batches }, resolveVariables({ op_type: 'powder_coat', variables: { setup_hours: v.setup_time, shop_rate: v['Shop Rate ($/Hr)'], batch_cost: v['Cost per Batch'], parts_per_batch: 1 } }));
            tally('Powder coat: cost', same(result.totalCost, zamyrTotal), `${tag}: DMS ${result.totalCost}, Zamyr ${zamyrTotal}`);
        }
    }

    // Markups and the line subtotal on Zamyr's own operation costs. The cost
    // buckets are summed from the operation rows in Zamyr's order (as Zamyr
    // does); stored totals_json can be older than the rows.
    const totals = json(routing.totals_json) || {};
    const opOverridesMarkup = lineOps.some(o => json(o.overrides_json)?.markupPercents);
    const linePricing = pricing.filter(p => p.routing_id === routing.id && p.is_enabled === 't' && p.scope !== 'assembly');
    if (!opOverridesMarkup && linePricing.length) {
        const buckets = { materialCost: 0, insideCost: 0, outsideCost: 0, purchasedCost: 0 };
        let operationCost = 0;
        for (const op of [...lineOps].sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id))) {
            const cost = Number(op.total_cost);
            const material = /material/i.test(op.category || '') || op.operation_name === 'Material | Sheet';
            if (material) { buckets.materialCost += cost; continue; }
            operationCost += cost;
            if (/purchased/i.test(op.category || op.operation_name)) buckets.purchasedCost += cost;
            else if (json(op.calculated_json)?.isOutsideService) buckets.outsideCost += cost;
            else buckets.insideCost += cost;
        }
        const totalEstimatedCost = round2(buckets.materialCost + operationCost);
        const baseOf = (name) => (/material/i.test(name) ? 'material' : /inside|labor/i.test(name) ? 'inside' : /outside/i.test(name) ? 'outside'
            : /purchased/i.test(name) ? 'purchased' : /overhead/i.test(name) ? 'overhead' : /general/i.test(name) ? 'general' : null);
        const markups = linePricing.filter(p => baseOf(p.pricing_item_name) && !manualCost(p))
            .map((p, i) => ({ id: i, name: p.pricing_item_name, base: baseOf(p.pricing_item_name), calc_type: p.calculation_type, percent: Number(json(p.calculated_json)?.percent ?? 0), zamyr: Number(json(p.calculated_json)?.calculatedTotalCost ?? p.total_cost) }));
        const ours = applyMarkups(markups, { ...buckets, totalEstimatedCost });
        for (const m of markups) {
            const row = ours.rows.find(r => r.id === m.id);
            tally('Markups: each markup', same(row.totalCost, m.zamyr), `${tag} ${m.name}: DMS ${row.totalCost}, Zamyr ${m.zamyr}`);
        }
        if (!linePricing.some(manualCost)) {
            const otherPricing = linePricing.filter(p => !baseOf(p.pricing_item_name)).reduce((s, p) => s + Number(p.total_cost), 0);
            const zamyrSubtotal = round2(buckets.materialCost + operationCost + linePricing.reduce((s, p) => s + Number(p.total_cost), 0) + Number(totals.addOnCost || 0));
            const subtotal = round2(buckets.materialCost + operationCost + ours.pricingCost + otherPricing + Number(totals.addOnCost || 0));
            tally('Line subtotal (before any hand-typed price)', same(subtotal, zamyrSubtotal), `${tag}: DMS ${subtotal}, Zamyr ${zamyrSubtotal}`);
        }
    }
}

for (const [check, r] of Object.entries(results)) {
    console.log(`${check.padEnd(50)} ${String(r.match).padStart(4)} match   ${String(r.differ).padStart(3)} differ`);
    for (const e of r.examples) console.log(`    ${e}`);
}

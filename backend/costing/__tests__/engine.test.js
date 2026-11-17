/*
 * Golden tests: the DMS costing engine must give the same numbers as Zamyr
 * (quoteRoutingService.js) for the same inputs, to the cent.
 *   node --test costing/__tests__/
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const snapshot = require('../seed/zamyr-snapshot.json');
const { sheetNestingYield, findSheetCost, findLaserRate } = require('../engine/lookup');
const { OP_TYPES, resolveVariables } = require('../engine/ops');
const { applyMarkups } = require('../engine/markups');
const { computeQuote } = require('../engine/computeQuote');

// The snapshot's sheet sizes with ids, and its rows priced per size id.
const SIZE_IDS = { '5x10': 1, '4x8': 2, '4x10': 3, '3x10': 4 };
const sheetSizes = [
    { id: 1, name: '5 x 10 Sheet', length_in: 120, width_in: 60, is_default: true },
    { id: 2, name: '4 x 8 Sheet', length_in: 96, width_in: 48 },
];
const sheetCosts = snapshot.sheetCosts.map((row, i) => ({
    id: i + 1,
    family: row.family,
    ga: row.ga,
    min_thick: row.min_thick,
    max_thick: row.max_thick,
    prices: Object.fromEntries(Object.entries(row.costs).filter(([, v]) => v !== null).map(([size, v]) => [SIZE_IDS[size], v])),
}));
const laserRates = snapshot.laserRates.map((r, i) => ({ id: i + 1, ...r }));

const op = (id, op_type, variables = {}, extra = {}) => ({ id, key: `op${id}`, name: extra.name || op_type, op_type, bucket: extra.bucket || OP_TYPES[op_type].defaultBucket, variables, sort_order: id, is_active: true });

function baseConfig(overrides = {}) {
    const operations = [
        op(1, 'material_sheet', {}, { name: 'Material | Sheet' }),
        op(2, 'laser', { labor_rate: 120, setup_hours: 0.0833 }, { name: 'Laser' }),
        op(3, 'time', { setup: 0.0833, setup_unit: 'hours', runtime: 0, runtime_unit: 'hours', rate: 18 }, { name: 'Deburr' }),
        op(4, 'bend', { labor_rate: 35, setup_hours: 0.0833 }, { name: 'Bend' }),
        op(5, 'powder_coat', {}, { name: 'Powder Coat' }),
        op(6, 'hardware_insert', {}, { name: 'Hardware insert' }),
        op(7, 'hardware_parts', {}, { name: 'Hardware parts' }),
    ];
    const markups = [
        { id: 1, name: 'Material Markup', calc_type: 'Markup', base: 'material', percent: 30, sort_order: 1 },
        { id: 2, name: 'Inside Labor Markup', calc_type: 'Markup', base: 'inside', percent: 30, sort_order: 2 },
        { id: 3, name: 'Outside Service Markup', calc_type: 'Markup', base: 'outside', percent: 30, sort_order: 3 },
        { id: 4, name: 'Purchased Component Markup', calc_type: 'Markup', base: 'purchased', percent: 30, sort_order: 4 },
        { id: 5, name: 'Overhead Markup', calc_type: 'Markup', base: 'overhead', percent: 10, sort_order: 5 },
        { id: 6, name: 'General Markup', calc_type: 'Markup', base: 'general', percent: 10, sort_order: 6 },
    ];
    return {
        version: 'test',
        servicesById: new Map([
            [1, { id: 1, title: 'Laser Cutting', is_production: true, base_price: 0 }],
            [9, { id: 9, title: 'Deburring', is_production: false, base_price: 0 }],
            [3, { id: 3, title: 'Bending', is_production: false, base_price: 0 }],
            [11, { id: 11, title: 'Powder Coating', is_production: false, base_price: 0 }],
            [6, { id: 6, title: 'Hardware', is_production: false, base_price: 0 }],
            [8, { id: 8, title: 'Anodizing', is_production: false, base_price: 80 }],
        ]),
        operations,
        serviceOperations: { 1: [1, 2], 9: [3], 3: [4], 11: [5], 6: [6, 7] },
        serviceMarkups: { 1: [1, 2, 3, 4, 5, 6] },
        serviceAddOns: {},
        markups,
        addOns: [],
        sheetSizes,
        defaultSheetSize: sheetSizes[0],
        sheetCosts,
        laserRates,
        discounts: { enabled: false, tiers: [] },
        ...overrides,
    };
}

const aluminum = { id: 10, name: '5052 H32 Aluminum', family: 'Aluminum', bendingAllowed: true };

test('parts per sheet: 20x10 in on 120x60', () => {
    const plain = sheetNestingYield({ partLength: 20, partWidth: 10, sheetLength: 120, sheetWidth: 60, edgeBuffer: 0, partBuffer: 0, kerfWidth: 0 });
    assert.equal(plain.maximumYield, 36);
    const buffered = sheetNestingYield({ partLength: 20, partWidth: 10, sheetLength: 120, sheetWidth: 60, edgeBuffer: 0.15, partBuffer: 0.15, kerfWidth: 0.005 });
    assert.equal(buffered.straightYield, 25);
    assert.equal(buffered.rotatedYield, 22);
    assert.equal(buffered.maximumYield, 25);
});

test('material: $900 sheet, 25 per sheet, qty 10 = $360.00', () => {
    const config = baseConfig({ sheetCosts: [{ id: 1, family: 'Aluminum', min_thick: 0.23, max_thick: 0.26, prices: { 1: 900 } }] });
    const r = OP_TYPES.material_sheet.compute(
        { qty: 10, thicknessIn: 0.25, metal: aluminum, part: { lengthIn: 20, widthIn: 10 }, config },
        resolveVariables(config.operations[0]),
    );
    assert.equal(r.details.unitMaterialCost, 36);
    assert.equal(r.totalCost, 360);
});

test('laser: 72.566 in cut, 4 holes, rate 25, 0.5 s pierce, qty 10 = $35.41', () => {
    const config = baseConfig({ laserRates: [{ id: 1, material_family: 'generic', thickness: 0.5, cut_rate: 25, pierce_time: 0.5 }] });
    for (const setup of [1 / 12, 0.0833]) {
        const r = OP_TYPES.laser.compute(
            { qty: 10, thicknessIn: 0.25, metal: aluminum, part: { cutLengthIn: 72.566, holeCount: 4 }, config },
            resolveVariables(op(2, 'laser', { labor_rate: 120, setup_hours: setup })),
        );
        assert.equal(r.details.pierceCount, 5);
        assert.equal(r.totalCost, 35.41);
    }
});

test('bend: one small, one medium, one large, qty 5 = $75.42', () => {
    const r = OP_TYPES.bend.compute(
        { qty: 5, part: { bends: [{ lengthIn: 10 }, { lengthIn: 30 }, { lengthIn: 80 }] } },
        resolveVariables(op(4, 'bend', { labor_rate: 35, setup_hours: 0.0833 })),
    );
    assert.deepEqual([r.details.smallBendCount, r.details.medBendCount, r.details.largeBendCount], [1, 1, 1]);
    assert.equal(r.totalCost, 75.42);
});

test('bend: a hem counts as 2 formed features by default', () => {
    const r = OP_TYPES.bend.compute({ qty: 1, part: { bends: [], hems: 1 } }, resolveVariables(op(4, 'bend', { labor_rate: 0 })));
    assert.equal(r.details.otherFormedFeatureCount, 2);
    assert.equal(r.totalCost, 16);
});

test('deburr $1.50; powder $94.50 and $264.50 with batches; 4 inserts qty 10 = $8.33', () => {
    const deburr = OP_TYPES.time.compute({ qty: 10 }, resolveVariables(op(3, 'time', { setup: 0.0833, runtime: 0, rate: 18 })));
    assert.equal(deburr.totalCost, 1.5);
    assert.equal(OP_TYPES.powder_coat.compute({ qty: 10 }, resolveVariables(op(5, 'powder_coat'))).totalCost, 94.5);
    assert.equal(OP_TYPES.powder_coat.compute({ qty: 25 }, resolveVariables(op(5, 'powder_coat', { parts_per_batch: 10 }))).totalCost, 264.5);
    const inserts = OP_TYPES.hardware_insert.compute(
        { qty: 10, selections: { hardware: [{}, {}, {}, {}] } },
        resolveVariables(op(6, 'hardware_insert')),
    );
    assert.equal(inserts.totalCost, 8.33);
});

test('markups do not stack: 360 / 100 / 32 -> subtotal $738.00; 30% margin on 360 = $154.29', () => {
    const markups = baseConfig().markups;
    const r = applyMarkups(markups, { materialCost: 360, insideCost: 100, outsideCost: 0, purchasedCost: 32, totalEstimatedCost: 492 });
    assert.deepEqual(r.rows.map(x => x.totalCost), [108, 30, 0, 9.6, 49.2, 49.2]);
    assert.equal(Math.round((492 + r.pricingCost) * 100) / 100, 738);
    const margin = applyMarkups([{ id: 1, calc_type: 'Margin', base: 'material', percent: 30 }], { materialCost: 360 });
    assert.equal(margin.rows[0].totalCost, 154.29);
});

test('full line: Al 0.063, 10x5 in, 2 holes, qty 10, laser + deburr = $41.21 (inside markup rounds to 4.27)', () => {
    const r = computeQuote({
        qty: 10,
        thicknessIn: 0.063,
        metal: aluminum,
        part: { lengthIn: 10, widthIn: 5, cutLengthIn: 33.1416, holeCount: 2 },
        mainServiceId: 1,
        services: [{ serviceId: 9 }],
    }, baseConfig());
    assert.equal(r.status, 'priced');
    const byName = Object.fromEntries(r.operations.map(o => [o.name, o]));
    assert.equal(byName['Material | Sheet'].details.partsPerSheet, 121);
    assert.equal(byName['Material | Sheet'].totalCost, 13.22);
    assert.equal(byName['Laser'].totalCost, 12.75);
    assert.equal(byName['Deburr'].totalCost, 1.5);
    assert.deepEqual(r.markups.filter(m => m.totalCost).map(m => m.totalCost), [3.97, 4.27, 2.75, 2.75]);
    assert.equal(r.totals.subtotal, 41.21);
    assert.equal(r.totals.unitPrice, 4.12);
    // Rows after markups add up to the subtotal.
    const rows = r.operations.reduce((s, o) => s + o.priceAfterMarkups, 0);
    assert.equal(Math.round(rows * 100) / 100, 41.21);
});

test('sheet cost lookups against the Zamyr rows', () => {
    const at = (family, t) => findSheetCost(sheetCosts, { metal: { family }, thicknessIn: t, sheetSizeId: 1 });
    assert.equal(at('Aluminum', 0.25).sheetCost, 651);
    // 18 ga ($0) and ".05" ($210) both match 0.050; the priced row wins the tie.
    assert.equal(at('Aluminum', 0.05).sheetCost, 210);
    // 10 ga aluminium is $0 in every size: the line goes to "request a quote".
    assert.equal(at('Aluminum', 0.134).sheetCost, 0);
    // Copper is only priced in 3x10, so there is no 5x10 row.
    assert.equal(at('Copper C110', 0.06), null);
    // 0.0935 is within tolerance of two 12 ga rows; the earlier row (Zamyr 1522) wins.
    assert.equal(at('Carbon Steel', 0.0935).sheetCost, 160);
});

test('laser rate: 0.075 in uses the 0.1 in row, 0.6 in the 99 row', () => {
    assert.equal(findLaserRate(laserRates, { metal: aluminum, thicknessIn: 0.075 }).row.thickness, 0.1);
    assert.equal(findLaserRate(laserRates, { metal: aluminum, thicknessIn: 0.6 }).row.thickness, 99);
});

test('request a quote: oversize part, $0 sheet, no material', () => {
    const big = computeQuote({ qty: 1, thicknessIn: 0.063, metal: aluminum, part: { lengthIn: 130, widthIn: 70, cutLengthIn: 400, holeCount: 0 }, mainServiceId: 1 }, baseConfig());
    assert.equal(big.status, 'quote_required');
    assert.ok(big.reasons.some(r => r.code === 'PART_EXCEEDS_SHEET'));

    const zero = computeQuote({ qty: 1, thicknessIn: 0.134, metal: aluminum, part: { lengthIn: 10, widthIn: 5, cutLengthIn: 30, holeCount: 0 }, mainServiceId: 1 }, baseConfig());
    assert.equal(zero.status, 'quote_required');
    assert.ok(zero.reasons.some(r => r.code === 'SHEET_COST_ZERO'));

    const noMetal = computeQuote({ qty: 1, thicknessIn: 0.063, metal: null, part: { lengthIn: 10, widthIn: 5, cutLengthIn: 30 }, mainServiceId: 1 }, baseConfig());
    assert.ok(noMetal.reasons.some(r => r.code === 'NO_METAL'));
});

test('a service with no linked operation is charged its catalog price per part', () => {
    const r = computeQuote({
        qty: 4, thicknessIn: 0.063, metal: aluminum,
        part: { lengthIn: 10, widthIn: 5, cutLengthIn: 33.1416, holeCount: 2 },
        mainServiceId: 1, services: [{ serviceId: 8, option: { name: 'Black', price: 5 } }],
    }, baseConfig());
    const anodize = r.operations.find(o => o.name === 'Anodizing');
    assert.equal(anodize.totalCost, 340); // (80 + 5) x 4
});

const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, fail, conflict, one, withTransaction, validate, HttpError } = require('../helpers');
const { OP_TYPES } = require('../costing/engine/ops');
const { measurementForUpload } = require('../costing/measure');
const { bumpConfigVersion, readSetting } = require('../costing/config/loadConfig');
const costing = require('../costing');

/*
 * Admin > Costing: the shop's costing set-up (sheet sizes, sheet costs,
 * laser rates, operations, markups, add-ons, which services use which).
 * Every price on the site comes from it. Every write runs in one
 * transaction and then bumps the costing version, so the next price uses
 * the change.
 *
 * Mounted at /api/costing; everything here is admin only.
 */

const router = express.Router();
router.use(authenticate, requireAdmin);

const BUCKETS = ['material', 'inside', 'outside', 'purchased'];
const MARKUP_BASES = ['material', 'inside', 'outside', 'purchased', 'overhead', 'general'];

// ── Reading input ──
// Costing values: blank text is null; a blank number is 0 unless allowNull.
const str = (value, label, { required = false, max = 120 } = {}) => validate.text(value, label, { required, max });
const num = (value, label, { min = 0, max = 1e9, required = false, allowNull = false } = {}) => {
    const n = validate.number(value, label, { required, min, max });
    return n === null ? (allowNull ? null : 0) : n;
};
const order = (value) => num(value, 'Order', { min: -100000, max: 100000 });
const active = (value) => validate.bool(value, true);
const optionalId = (value, label) => (value ? validate.id(value, label) : null);

/* An operation's values, checked against its type's fields. */
function cleanVariables(opType, raw = {}) {
    const type = OP_TYPES[opType] || fail('Unknown operation type.');
    const values = {};
    for (const field of type.fields) {
        const v = raw[field.key];
        if (field.unit === 'select') {
            values[field.key] = field.options.includes(v) ? v : field.default;
        } else {
            values[field.key] = v === undefined || v === '' || v === null ? field.default : num(v, field.label, { min: field.min ?? 0 });
        }
    }
    return values;
}

// ── Writing ──
class DryRun extends Error {
    constructor(value) {
        super('dry run');
        this.value = value;
    }
}

/* Postgres key errors as a 409 the admin can read. */
function asConflict(err) {
    if (err.code === '23505') return conflict('That already exists.');
    if (err.code === '23503') return conflict('It is still in use elsewhere.');
    return err;
}

/* Runs work(client) in one transaction, then bumps the costing version.
 * dryRun rolls the work back (nothing saved, version untouched). */
async function applyChange(work, { dryRun = false } = {}) {
    let result;
    try {
        result = await withTransaction(async (client) => {
            const value = await work(client);
            if (dryRun) throw new DryRun(value);
            return value;
        });
    } catch (err) {
        if (err instanceof DryRun) return err.value;
        throw asConflict(err);
    }
    await bumpConfigVersion(db);
    return result;
}

/* A route that changes costing data and answers { success, data }. */
const change = (label, work) => route(label, async (req, res) => {
    const result = await applyChange(client => work(req, client));
    ok(res, result ?? null);
});

const idOf = (req) => validate.id(req.params.id);

// ── Everything for the admin page in one call ──
router.get('/admin/config', route('load the costing set-up', async (req, res) => {
    const [ops, sizes, costs, prices, laser, markups, addOns, services, so, sm, sa, metals, seededFrom] = await Promise.all([
        db.query('SELECT * FROM costing_operations ORDER BY sort_order, id'),
        db.query('SELECT * FROM costing_sheet_sizes ORDER BY sort_order, id'),
        db.query(`SELECT c.*, m.name AS metal_name FROM costing_sheet_costs c LEFT JOIN metals m ON m.id = c.metal_id ORDER BY c.sort_order, c.id`),
        db.query('SELECT * FROM costing_sheet_cost_prices'),
        db.query('SELECT * FROM laser_cut_rates ORDER BY sort_order, thickness, id'),
        db.query('SELECT * FROM costing_markups ORDER BY sort_order, id'),
        db.query('SELECT * FROM costing_add_ons ORDER BY sort_order, id'),
        db.query('SELECT id, title, is_production, is_active FROM services ORDER BY is_production DESC, id'),
        db.query('SELECT * FROM costing_service_operations'),
        db.query('SELECT * FROM costing_service_markups'),
        db.query('SELECT * FROM costing_service_add_ons'),
        db.query(`SELECT m.id, m.name, m.costing_family, mc.name AS category FROM metals m LEFT JOIN metal_categories mc ON mc.id = m.category_id ORDER BY m.name`),
        readSetting(db, 'costing_seeded_from'),
    ]);
    const pricesByRow = {};
    prices.rows.forEach(p => { (pricesByRow[p.sheet_cost_id] ||= {})[p.sheet_size_id] = Number(p.cost); });
    const group = (rows, k, v) => rows.reduce((acc, r) => { (acc[r[k]] ||= []).push(r[v]); return acc; }, {});
    ok(res, {
        seededFrom: seededFrom || null,
        operationTypes: Object.fromEntries(Object.entries(OP_TYPES).map(([key, t]) => [key, { label: t.label, defaultBucket: t.defaultBucket, fields: t.fields }])),
        operations: ops.rows,
        sheetSizes: sizes.rows,
        sheetCosts: costs.rows.map(r => ({ ...r, prices: pricesByRow[r.id] || {} })),
        laserRates: laser.rows,
        markups: markups.rows,
        addOns: addOns.rows,
        services: services.rows,
        links: {
            operations: group(so.rows, 'service_id', 'operation_id'),
            markups: group(sm.rows, 'service_id', 'markup_id'),
            addOns: group(sa.rows, 'service_id', 'add_on_id'),
        },
        metals: metals.rows,
    });
}));

// ── Operations ──
const operationFields = (body, opType) => ({
    name: str(body.name, 'Name', { required: true }),
    customer_label: str(body.customer_label, 'Label shown to customers'),
    bucket: BUCKETS.includes(body.bucket) ? body.bucket : (OP_TYPES[opType]?.defaultBucket || 'inside'),
    variables: cleanVariables(opType, body.variables || {}),
    sort_order: order(body.sort_order),
    is_active: active(body.is_active),
});

router.post('/admin/operations', change('add the operation', async (req, client) => {
    const body = req.body || {};
    const opType = OP_TYPES[body.op_type] ? body.op_type : fail('Choose an operation type.');
    const f = operationFields(body, opType);
    const key = `${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'operation'}-${Date.now().toString(36)}`;
    const r = await client.query(
        `INSERT INTO costing_operations (key, name, customer_label, op_type, bucket, variables, sort_order, is_active, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'admin') RETURNING *`,
        [key, f.name, f.customer_label, opType, f.bucket, JSON.stringify(f.variables), f.sort_order, f.is_active]
    );
    return r.rows[0];
}));

router.put('/admin/operations/:id', change('save the operation', async (req, client) => {
    const id = idOf(req);
    const current = one(await client.query('SELECT op_type FROM costing_operations WHERE id = $1', [id]), 'Operation');
    const f = operationFields(req.body || {}, current.op_type);
    const r = await client.query(
        `UPDATE costing_operations SET name=$1, customer_label=$2, bucket=$3, variables=$4, sort_order=$5, is_active=$6, updated_at=NOW()
         WHERE id=$7 RETURNING *`,
        [f.name, f.customer_label, f.bucket, JSON.stringify(f.variables), f.sort_order, f.is_active, id]
    );
    return r.rows[0];
}));

router.delete('/admin/operations/:id', change('delete the operation', async (req, client) => {
    one(await client.query('DELETE FROM costing_operations WHERE id = $1 RETURNING id', [idOf(req)]), 'Operation');
}));

// ── Sheet sizes ──
const sizeFields = (body) => ({
    name: str(body.name, 'Name', { required: true, max: 80 }),
    length_in: num(body.length_in, 'Length', { min: 0.01, max: 1000, required: true }),
    width_in: num(body.width_in, 'Width', { min: 0.01, max: 1000, required: true }),
    is_active: active(body.is_active),
    sort_order: order(body.sort_order),
});

router.post('/admin/sheet-sizes', change('add the sheet size', async (req, client) => {
    const f = sizeFields(req.body || {});
    const r = await client.query('INSERT INTO costing_sheet_sizes (name, length_in, width_in, is_active, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *', [f.name, f.length_in, f.width_in, f.is_active, f.sort_order]);
    return r.rows[0];
}));

router.put('/admin/sheet-sizes/:id', change('save the sheet size', async (req, client) => {
    const id = idOf(req);
    const f = sizeFields(req.body || {});
    const current = one(await client.query('SELECT is_default FROM costing_sheet_sizes WHERE id = $1', [id]), 'Sheet size');
    if (current.is_default && !f.is_active) fail('The default sheet size cannot be switched off. Make another size the default first.');
    const r = await client.query('UPDATE costing_sheet_sizes SET name=$1, length_in=$2, width_in=$3, is_active=$4, sort_order=$5, updated_at=NOW() WHERE id=$6 RETURNING *', [f.name, f.length_in, f.width_in, f.is_active, f.sort_order, id]);
    return r.rows[0];
}));

router.put('/admin/sheet-sizes/:id/default', change('change the default sheet', async (req, client) => {
    const id = idOf(req);
    const size = one(await client.query('SELECT id, is_active FROM costing_sheet_sizes WHERE id = $1', [id]), 'Sheet size');
    if (!size.is_active) fail('Switch the sheet size on before making it the default.');
    await client.query('UPDATE costing_sheet_sizes SET is_default = false WHERE is_default');
    await client.query('UPDATE costing_sheet_sizes SET is_default = true, updated_at = NOW() WHERE id = $1', [id]);
}));

router.delete('/admin/sheet-sizes/:id', change('delete the sheet size', async (req, client) => {
    const id = idOf(req);
    const size = one(await client.query('SELECT is_default FROM costing_sheet_sizes WHERE id = $1', [id]), 'Sheet size');
    if (size.is_default) fail('The default sheet size cannot be deleted. Make another size the default first.');
    await client.query('DELETE FROM costing_sheet_sizes WHERE id = $1', [id]);
}));

// ── Sheet costs ──
/* A sheet cost row from the request: its column values (in SHEET_COST_COLUMNS
 * order) and its prices as [sizeId, cost]. Throws a 400 before anything is written. */
const SHEET_COST_COLUMNS = 'family, metal_id, ga, thickness_in, min_thick, max_thick, sort_order, notes';
function sheetCostFields(body) {
    const family = str(body.family, 'Family', { required: true });
    const ga = str(body.ga, 'Gauge', { max: 40 });
    const name = `${family} ${ga || ''}`;
    const thickness_in = num(body.thickness_in, 'Thickness', { min: 0, max: 50, allowNull: true });
    const min_thick = num(body.min_thick, 'Min thickness', { min: 0, max: 50, allowNull: true });
    const max_thick = num(body.max_thick, 'Max thickness', { min: 0, max: 50, allowNull: true });
    if (!(thickness_in > 0) && !(min_thick > 0) && !(max_thick > 0)) fail(`${name}: give a thickness or a min/max band.`);
    if (min_thick > 0 && max_thick > 0 && min_thick > max_thick) fail(`${name}: min thickness is above max.`);
    const metal_id = optionalId(body.metal_id, 'Metal');
    const sort_order = num(body.sort_order, 'Order', { min: -100000, max: 1000000 });
    const prices = Object.entries(body.prices || {})
        .filter(([, cost]) => !(cost === null || cost === undefined || cost === '')) // blank = not stocked in that size
        .map(([sizeId, cost]) => [validate.id(sizeId, 'Sheet size'), num(cost, `${name} sheet price`, { min: 0, max: 1e7 })]);
    const values = [family, metal_id, ga, thickness_in, min_thick, max_thick, sort_order, str(body.notes, 'Notes', { max: 500 })];
    return { values, prices };
}

/* Rows of values as one multi-row VALUES list: { sql: "($1,$2),($3,$4)", params }. */
function valuesList(rows, extra = '') {
    const params = [];
    const tuples = rows.map(row => `(${row.map(v => { params.push(v); return `$${params.length}`; }).join(',')}${extra})`);
    return { sql: tuples.join(','), params };
}

/* Prices as [sheetCostId, sizeId, cost], a thousand per statement (the
 * database is remote, so one statement per price is slow). */
async function insertPrices(client, triples) {
    for (let i = 0; i < triples.length; i += 1000) {
        const { sql, params } = valuesList(triples.slice(i, i + 1000));
        await client.query(`INSERT INTO costing_sheet_cost_prices (sheet_cost_id, sheet_size_id, cost) VALUES ${sql}`, params);
    }
}

async function saveSheetCostRow(client, body, id = null) {
    const { values, prices } = sheetCostFields(body);
    const r = id
        ? await client.query('UPDATE costing_sheet_costs SET family=$1, metal_id=$2, ga=$3, thickness_in=$4, min_thick=$5, max_thick=$6, sort_order=$7, notes=$8, updated_at=NOW() WHERE id=$9 RETURNING *', [...values, id])
        : await client.query(`INSERT INTO costing_sheet_costs (${SHEET_COST_COLUMNS}, source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'admin') RETURNING *`, values);
    const row = one(r, 'Sheet cost row');
    if (id) await client.query('DELETE FROM costing_sheet_cost_prices WHERE sheet_cost_id = $1', [row.id]);
    await insertPrices(client, prices.map(([sizeId, cost]) => [row.id, sizeId, cost]));
    return row;
}

router.post('/admin/sheet-costs', change('add the sheet cost', (req, client) => saveSheetCostRow(client, req.body || {})));
router.put('/admin/sheet-costs/:id', change('save the sheet cost', (req, client) => saveSheetCostRow(client, req.body || {}, idOf(req))));
router.delete('/admin/sheet-costs/:id', change('delete the sheet cost', async (req, client) => {
    one(await client.query('DELETE FROM costing_sheet_costs WHERE id = $1 RETURNING id', [idOf(req)]), 'Sheet cost row');
}));

/* Replace every sheet cost row with an uploaded list (CSV parsed in the
 * browser). dryRun checks it and reports without saving. Every row is
 * checked first (a problem names its line in the CSV); then all rows go in
 * with one statement and their prices with another. */
router.post('/admin/sheet-costs/import', route('import the sheet costs', async (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : fail('No rows to import.');
    if (!rows.length) fail('The file has no rows.');
    if (rows.length > 2000) fail('Too many rows (max 2000).');
    const dryRun = Boolean(req.body?.dryRun);
    const parsed = rows.map((row, i) => {
        try {
            return sheetCostFields({ ...row, sort_order: i });
        } catch (err) {
            if (err instanceof HttpError) throw new HttpError(err.status, `Row ${i + 2}: ${err.message}`);
            throw err;
        }
    });
    const count = await applyChange(async (client) => {
        await client.query('DELETE FROM costing_sheet_costs');
        const { sql, params } = valuesList(parsed.map(p => p.values), ",'admin'");
        const inserted = await client.query(`INSERT INTO costing_sheet_costs (${SHEET_COST_COLUMNS}, source) VALUES ${sql} RETURNING id, sort_order`, params);
        const idByOrder = new Map(inserted.rows.map(r => [Number(r.sort_order), r.id]));
        await insertPrices(client, parsed.flatMap((p, i) => p.prices.map(([sizeId, cost]) => [idByOrder.get(i), sizeId, cost])));
        return rows.length;
    }, { dryRun });
    ok(res, dryRun ? { dryRun: true, rows: count } : { rows: count });
}));

// ── Laser cut rates ──
const laserFields = (body) => ({
    material_family: str(body.material_family, 'Family', { max: 100 }) || 'generic',
    metal_id: optionalId(body.metal_id, 'Metal'),
    thickness: num(body.thickness, 'Up to thickness', { min: 0.0001, max: 1000, required: true }),
    cut_rate: num(body.cut_rate, 'Cut rate', { min: 0.0001, max: 100000, required: true }),
    pierce_time: num(body.pierce_time, 'Pierce time', { min: 0, max: 3600, required: true }),
    sort_order: order(body.sort_order),
});
router.post('/admin/laser-rates', change('add the laser rate', async (req, client) => {
    const f = laserFields(req.body || {});
    return (await client.query('INSERT INTO laser_cut_rates (material_family, metal_id, thickness, cut_rate, pierce_time, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [f.material_family, f.metal_id, f.thickness, f.cut_rate, f.pierce_time, f.sort_order])).rows[0];
}));
router.put('/admin/laser-rates/:id', change('save the laser rate', async (req, client) => {
    const f = laserFields(req.body || {});
    return one(await client.query('UPDATE laser_cut_rates SET material_family=$1, metal_id=$2, thickness=$3, cut_rate=$4, pierce_time=$5, sort_order=$6, updated_at=NOW() WHERE id=$7 RETURNING *', [f.material_family, f.metal_id, f.thickness, f.cut_rate, f.pierce_time, f.sort_order, idOf(req)]), 'Laser rate');
}));
router.delete('/admin/laser-rates/:id', change('delete the laser rate', async (req, client) => {
    one(await client.query('DELETE FROM laser_cut_rates WHERE id = $1 RETURNING id', [idOf(req)]), 'Laser rate');
}));

// ── Markups ──
const markupFields = (body) => {
    const calc_type = body.calc_type === 'margin' ? 'margin' : 'markup';
    return {
        name: str(body.name, 'Name', { required: true }),
        calc_type,
        base: MARKUP_BASES.includes(body.base) ? body.base : fail('Choose what the markup applies to.'),
        percent: num(body.percent, 'Percent', { min: 0, max: calc_type === 'margin' ? 99.9 : 999 }),
        sort_order: order(body.sort_order),
        is_active: active(body.is_active),
    };
};
router.post('/admin/markups', change('add the markup', async (req, client) => {
    const f = markupFields(req.body || {});
    return (await client.query('INSERT INTO costing_markups (name, calc_type, base, percent, sort_order, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [f.name, f.calc_type, f.base, f.percent, f.sort_order, f.is_active])).rows[0];
}));
router.put('/admin/markups/:id', change('save the markup', async (req, client) => {
    const f = markupFields(req.body || {});
    return one(await client.query('UPDATE costing_markups SET name=$1, calc_type=$2, base=$3, percent=$4, sort_order=$5, is_active=$6, updated_at=NOW() WHERE id=$7 RETURNING *', [f.name, f.calc_type, f.base, f.percent, f.sort_order, f.is_active, idOf(req)]), 'Markup');
}));
router.delete('/admin/markups/:id', change('delete the markup', async (req, client) => {
    one(await client.query('DELETE FROM costing_markups WHERE id = $1 RETURNING id', [idOf(req)]), 'Markup');
}));

// ── Add-ons ──
const addOnFields = (body) => ({
    name: str(body.name, 'Name', { required: true }),
    amount: num(body.amount, 'Amount', { min: 0, max: 1e7 }),
    apply_mode: body.apply_mode === 'always' ? 'always' : 'optional',
    sort_order: order(body.sort_order),
    is_active: active(body.is_active),
});
router.post('/admin/add-ons', change('add the add-on', async (req, client) => {
    const f = addOnFields(req.body || {});
    return (await client.query('INSERT INTO costing_add_ons (name, amount, apply_mode, sort_order, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING *', [f.name, f.amount, f.apply_mode, f.sort_order, f.is_active])).rows[0];
}));
router.put('/admin/add-ons/:id', change('save the add-on', async (req, client) => {
    const f = addOnFields(req.body || {});
    return one(await client.query('UPDATE costing_add_ons SET name=$1, amount=$2, apply_mode=$3, sort_order=$4, is_active=$5, updated_at=NOW() WHERE id=$6 RETURNING *', [f.name, f.amount, f.apply_mode, f.sort_order, f.is_active, idOf(req)]), 'Add-on');
}));
router.delete('/admin/add-ons/:id', change('delete the add-on', async (req, client) => {
    one(await client.query('DELETE FROM costing_add_ons WHERE id = $1 RETURNING id', [idOf(req)]), 'Add-on');
}));

// ── What each service uses ──
const LINK_TABLES = [
    ['costing_service_operations', 'operation_id', 'operations'],
    ['costing_service_markups', 'markup_id', 'markups'],
    ['costing_service_add_ons', 'add_on_id', 'addOns'],
];
router.put('/admin/services/:id/links', change('save the service links', async (req, client) => {
    const serviceId = idOf(req);
    one(await client.query('SELECT id FROM services WHERE id = $1', [serviceId]), 'Service');
    const ids = (list) => [...new Set((Array.isArray(list) ? list : []).map(Number).filter(Number.isInteger))];
    for (const [table, column, key] of LINK_TABLES) {
        await client.query(`DELETE FROM ${table} WHERE service_id = $1`, [serviceId]);
        for (const id of ids(req.body?.[key])) await client.query(`INSERT INTO ${table} (service_id, ${column}) VALUES ($1, $2)`, [serviceId, id]);
    }
}));

// ── Metal family override (which rows a metal prices from) ──
router.put('/admin/metals/:id/family', change('save the metal family', async (req, client) => {
    const family = str(req.body?.costing_family, 'Family');
    return one(await client.query('UPDATE metals SET costing_family = $1 WHERE id = $2 RETURNING id, name, costing_family', [family, idOf(req)]), 'Metal');
}));

// ── Try a price with the full working shown (admin only) ──
// With file_ref (an upload from POST /api/upload-asset) the server measures
// the file itself, as it does for orders: its flat size, cut length, holes
// and bends replace the typed ones. A STEP file goes through the CAD
// service, which can take a minute or two the first time. `measured` says
// what the file gave.
router.post('/admin/preview', route('price the part', async (req, res) => {
    const body = req.body || {};
    const fromFile = Boolean(body.file_ref);
    const out = await costing.priceQuote(body, { requireMeasured: fromFile });
    if (!out.result) return res.status(out.status).json(out.body);
    let measured;
    if (fromFile) {
        const part = out.input?.part || {};
        const stored = out.input?.measuredBy === 'server' ? await measurementForUpload(body.file_ref).catch(() => null) : null;
        measured = out.input?.measuredBy === 'server' ? {
            kind: stored?.kind || null,
            lengthIn: part.lengthIn,
            widthIn: part.widthIn,
            cutLengthIn: part.cutLengthIn,
            pierces: part.holeCount,          // one per hole, as the shop counts them
            laserPierces: part.holeCount + 1, // the laser also pierces once for the outline
            bends: (part.bends || []).length,
            hems: part.hems || 0,
            thicknessIn: stored?.thicknessMm > 0 ? stored.thicknessMm / 25.4 : null,
        } : null;
    }
    ok(res, { response: out.body, result: out.result, input: out.input, ...(fromFile ? { measured } : {}) });
}));

module.exports = router;

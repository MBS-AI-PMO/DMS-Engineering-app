/*
 * Reads the shop's costing setup out of a Zamyr database dump and writes it
 * to backend/costing/seed/zamyr-snapshot.json, which seed_costing_from_zamyr.js
 * loads into DMS. The dump is only read (pg_restore prints to stdout).
 *
 *   node scripts/extract_zamyr_costing_snapshot.js [path/to/dump] [path/to/pg_restore]
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DUMP = process.argv[2] || 'D:/Frontend/Paperless Parts/DB Backup/prod-postgres-2026-09-21_1805.dump';
const PG_RESTORE = process.argv[3] || 'C:/Program Files/PostgreSQL/18/bin/pg_restore.exe';
const OUT = path.join(__dirname, '..', 'costing', 'seed', 'zamyr-snapshot.json');

// COPY text format: tab-separated, \N for null, backslash escapes.
function unescapeCopy(value) {
    if (value === '\\N') return null;
    return value.replace(/\\(.)/g, (m, ch) => ({ n: '\n', t: '\t', r: '\r', '\\': '\\' }[ch] ?? ch));
}

function readTable(table) {
    const text = execFileSync(PG_RESTORE, ['-a', '-t', table, '-n', 'cpq', '-f', '-', DUMP], { maxBuffer: 1024 * 1024 * 512 }).toString('utf8');
    const header = text.match(new RegExp(`COPY cpq\\.${table} \\(([^)]+)\\) FROM stdin;`));
    if (!header) return [];
    const columns = header[1].split(', ');
    const body = text.slice(text.indexOf(header[0]) + header[0].length).split(/\r?\n/);
    const rows = [];
    for (const line of body) {
        if (line === '\\.') break;
        if (!line) continue;
        const cells = line.split('\t').map(unescapeCopy);
        rows.push(Object.fromEntries(columns.map((c, i) => [c, cells[i]])));
    }
    return rows;
}

const json = (value) => { try { return JSON.parse(value); } catch { return null; } };
const num = (value) => (value === null || value === undefined || String(value).trim() === '' ? null : Number(value));

const tables = readTable('custom_tables');
const tableRows = readTable('custom_table_rows');
const byName = (name) => tables.find(t => t.name.toLowerCase().replace(/[^a-z]/g, '') === name);
const sheetTable = byName('sheetcosts');
const laserTable = byName('lasercutrates') || byName('laserrates');

const rowsOf = (table) => tableRows
    .filter(r => table && String(r.table_id) === String(table.id))
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map(r => ({ zamyrRowId: Number(r.id), ...json(r.row_json) }));

const sheetCosts = rowsOf(sheetTable).map(r => ({
    zamyrRowId: r.zamyrRowId,
    family: r.family || '',
    ga: r.ga || '',
    min_thick: num(r.min_thick),
    max_thick: num(r.max_thick),
    costs: {
        '4x8': num(r.sheet_cost_4x8),
        '5x10': num(r.sheet_cost_5x10),
        '4x10': num(r.Sheet_cost_4x10 ?? r.sheet_cost_4x10),
        '3x10': num(r.Sheet_cost_3x10 ?? r.sheet_cost_3x10),
    },
}));

const laserRates = rowsOf(laserTable).map(r => ({
    zamyrRowId: r.zamyrRowId,
    material_family: r.material_family || r.family || 'generic',
    thickness: num(r.thickness ?? r.thickness_in),
    cut_rate: num(r.cut_rate ?? r.cut_rate_in_per_min),
    pierce_time: num(r.pierce_time ?? r.pierce_rate_sec),
}));

const sheetSizes = readTable('nesting_sheet_sizes').map(s => ({
    name: s.name,
    length_in: num(s.sheet_length_in),
    width_in: num(s.sheet_width_in),
    is_default: s.is_default === 't',
    is_active: s.active === 't',
}));

// Markup percents: the stored value of the "%"-style variable, else the formula default.
const pricingItems = readTable('pricing_items').filter(p => p.scope === 'operation').map(p => {
    const config = json(p.config) || {};
    const variable = (config.variables || []).find(v => /%|percent|markup|margin|rate/i.test(v.label || ''));
    const formulaDefault = String(config.formulaText || '').match(/var\(\s*['"][^'"]*['"]\s*,\s*([0-9.]+)/);
    return {
        name: p.name,
        calc_type: p.calculation_type,
        category: p.category,
        percent: variable ? num(variable.value) : (formulaDefault ? Number(formulaDefault[1]) : null),
    };
});

const addOns = readTable('add_ons').map(a => {
    const config = json(a.config) || {};
    const variable = (config.variables || [])[0];
    return { name: a.name, required: a.required_at_checkout === 't', amount: variable ? num(variable.value) : 0 };
});

const operations = readTable('operations');
const variables = readTable('operation_variables');
const operationValues = Object.fromEntries(operations.map(op => [op.name, {
    outside: op.is_outside_service === 't',
    category: op.category,
    variables: Object.fromEntries(variables.filter(v => String(v.operation_id) === String(op.id)).map(v => [v.name, v.value])),
}]));

const processes = readTable('processes').map(p => {
    const config = json(p.config) || {};
    return { name: p.name, operations: config.operations || [], pricingItems: config.pricingItems || [], addOns: config.addOns || [] };
});

const snapshot = {
    source: path.basename(DUMP),
    extractedAt: new Date().toISOString(),
    sheetSizes,
    sheetCosts,
    laserRates,
    pricingItems,
    addOns,
    operations: operationValues,
    processes,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Wrote ${OUT}`);
console.log(`  sheet sizes ${sheetSizes.length}, sheet cost rows ${sheetCosts.length}, laser rows ${laserRates.length}, markups ${pricingItems.length}, add-ons ${addOns.length}, operations ${operations.length}`);

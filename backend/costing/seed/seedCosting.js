/*
 * Loads the shop's costing (from Zamyr, see zamyr-snapshot.json) into DMS:
 * sheet sizes, sheet costs, laser rates, operations, markups, add-ons and
 * which services use them. Replaces whatever costing data is there.
 *
 * Run inside a transaction: by scripts/seed_costing_from_zamyr.js, and by
 * the server on start when the costing tables are empty (server.js).
 * Returns a short report of what was loaded.
 */
const snapshot = require('./zamyr-snapshot.json');
const { addMissingSheetCostRows } = require('./missingSheetRows');

const SIZE_KEYS = { '5x10': [120, 60], '4x8': [96, 48], '4x10': [120, 48], '3x10': [120, 36] };
const sizeKeyFor = (l, w) => Object.entries(SIZE_KEYS).find(([, [a, b]]) => (a === l && b === w) || (a === w && b === l))?.[0];

const zamyrVar = (opName, label, fallback) => {
    const value = snapshot.operations?.[opName]?.variables?.[label];
    const n = Number(value);
    return value === undefined || value === null || value === '' || !Number.isFinite(n) ? fallback : n;
};
const zamyrPercent = (name, fallback) => {
    const item = snapshot.pricingItems.find(p => p.name === name);
    return item && Number.isFinite(Number(item.percent)) ? Number(item.percent) : fallback;
};

async function seedCosting(client) {
    const report = [];
    await client.query(`
        DELETE FROM costing_service_operations; DELETE FROM costing_service_markups; DELETE FROM costing_service_add_ons;
        DELETE FROM costing_sheet_cost_prices; DELETE FROM costing_sheet_costs; DELETE FROM costing_sheet_sizes;
        DELETE FROM costing_operations; DELETE FROM costing_markups; DELETE FROM costing_add_ons;
    `);

    // ── Sheet sizes ──
    const sizeIds = {};
    const sizes = snapshot.sheetSizes.map(s => ({ ...s, key: sizeKeyFor(s.length_in, s.width_in) }));
    if (!sizes.some(s => s.key === '3x10')) sizes.push({ name: '3 x 10 Sheet', length_in: 120, width_in: 36, is_default: false, is_active: false, key: '3x10' });
    for (const [i, s] of sizes.entries()) {
        const res = await client.query(
            'INSERT INTO costing_sheet_sizes (name, length_in, width_in, is_default, is_active, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
            [s.name, s.length_in, s.width_in, s.is_default, s.is_active, i]
        );
        if (s.key) sizeIds[s.key] = res.rows[0].id;
    }
    report.push(`Sheet sizes: ${sizes.map(s => `${s.name}${s.is_default ? ' (default)' : ''}${s.is_active ? '' : ' (inactive)'}`).join(', ')}`);

    // ── Sheet costs, in Zamyr's row order (ties go to the earlier row) ──
    let priceCount = 0;
    for (const [i, row] of snapshot.sheetCosts.entries()) {
        const res = await client.query(
            `INSERT INTO costing_sheet_costs (family, ga, min_thick, max_thick, sort_order, source, source_row_id)
             VALUES ($1,$2,$3,$4,$5,'zamyr',$6) RETURNING id`,
            [row.family, row.ga || null, row.min_thick, row.max_thick, i, row.zamyrRowId]
        );
        for (const [key, cost] of Object.entries(row.costs)) {
            if (cost === null || cost === undefined || !sizeIds[key]) continue;
            await client.query('INSERT INTO costing_sheet_cost_prices (sheet_cost_id, sheet_size_id, cost) VALUES ($1,$2,$3)', [res.rows[0].id, sizeIds[key], cost]);
            priceCount += 1;
        }
    }
    report.push(`Sheet costs: ${snapshot.sheetCosts.length} rows, ${priceCount} prices`);
    const zeroRows = snapshot.sheetCosts.filter(r => r.costs['5x10'] === 0);
    if (zeroRows.length) report.push(`  $0 on the default 5x10 sheet (these go to "request a quote"): ${zeroRows.map(r => `${r.family} ${r.ga}`).join(', ')}`);

    // ── Laser cut rates (same table the old pricing reads) ──
    await client.query('DELETE FROM laser_cut_rates');
    for (const [i, r] of snapshot.laserRates.entries()) {
        await client.query(
            'INSERT INTO laser_cut_rates (material_family, thickness, cut_rate, pierce_time, sort_order) VALUES ($1,$2,$3,$4,$5)',
            [r.material_family || 'generic', r.thickness, r.cut_rate, r.pierce_time, i]
        );
    }
    report.push(`Laser cut rates: ${snapshot.laserRates.length} rows`);

    // ── Operations ──
    const cncConfig = (await client.query("SELECT pricing_config FROM services WHERE title ILIKE '%cnc%' ORDER BY id LIMIT 1")).rows[0]?.pricing_config || {};
    const cncUnit = (u) => (/^min/i.test(u || '') ? 'minutes' : /^sec/i.test(u || '') ? 'seconds' : 'hours');
    const cncOp = (part, label, sort) => ({
        key: `cnc-${part}`, name: `CNC ${part}`, customer_label: label, op_type: 'time', bucket: 'inside', sort,
        variables: {
            setup: Number(cncConfig[`cnc_${part}_setup`]) || 0,
            setup_unit: cncUnit(cncConfig[`cnc_${part}_setup_unit`]),
            runtime: Number(cncConfig[`cnc_${part}_runtime`]) || 0,
            runtime_unit: cncUnit(cncConfig[`cnc_${part}_runtime_unit`]),
            rate: Number(cncConfig[`cnc_${part}_rate`]) || 0,
        },
    });
    const operations = [
        { key: 'material-sheet', name: 'Material | Sheet', customer_label: 'Material', op_type: 'material_sheet', bucket: 'material', sort: 10,
          variables: { edge_buffer_in: zamyrVar('Material | Sheet', 'Edge Buffer (in)', 0.15), part_buffer_in: zamyrVar('Material | Sheet', 'Part Buffer (in)', 0.15), kerf_in: zamyrVar('Material | Sheet', 'Kerf Width (in)', 0.005), thickness_tolerance_in: 0.003 } },
        { key: 'laser', name: 'Laser', customer_label: 'Laser cutting', op_type: 'laser', bucket: 'inside', sort: 20,
          variables: { labor_rate: zamyrVar('Laser', 'Labor Rate', 120), setup_hours: zamyrVar('Laser', 'setup_time', 0.0833), etch_length_in: 0, daily_capacity_hours: 0 } },
        { key: 'bend', name: 'Bend', customer_label: 'Bending', op_type: 'bend', bucket: 'inside', sort: 30,
          variables: {
              labor_rate: zamyrVar('Bend', 'Labor Rate ($/hr)', 35), setup_hours: zamyrVar('Bend', 'setup_time', 0.0833),
              med_threshold_in: zamyrVar('Bend', 'Med Bend Threshold (in)', 24), large_threshold_in: zamyrVar('Bend', 'Large Bend Threshold (in)', 72),
              cost_small: zamyrVar('Bend', 'Cost Per Small Bend (sec)', 1.5), cost_med: zamyrVar('Bend', 'Cost Per Med Bend (sec)', 5),
              cost_large: zamyrVar('Bend', 'Cost Per Large Bend (sec)', 8), cost_other: zamyrVar('Bend', 'Cost Per Other Formed Feature (sec)', 8),
              features_per_hem: 2, time_per_bend_sec: zamyrVar('Bend', 'Time Per Bend (secons)', 15), daily_capacity_hours: 0,
          } },
        { key: 'deburr', name: 'Deburr', customer_label: 'Deburring', op_type: 'time', bucket: 'inside', sort: 25,
          variables: { setup: zamyrVar('Deburr', 'setup_time', 0.0833), setup_unit: 'hours', runtime: zamyrVar('Deburr', 'runtime', 0), runtime_unit: 'hours', rate: zamyrVar('Deburr', 'Shop Rate ($/Hr)', 18) } },
        { key: 'hardware-insert', name: 'Hardware insert', customer_label: 'Hardware insertion', op_type: 'hardware_insert', bucket: 'inside', sort: 50,
          variables: { rate: zamyrVar('Hardware insert (construction)', 'Hourly Rate', 25), seconds_per_insert: zamyrVar('Hardware insert (construction)', 'Time Per Insert (s)', 30), setup_hours: zamyrVar('Hardware insert (construction)', 'setup_time', 0) } },
        { key: 'hardware-parts', name: 'Hardware parts', customer_label: 'Hardware', op_type: 'hardware_parts', bucket: 'purchased', sort: 51, variables: {} },
        { key: 'tapping', name: 'Tapping', customer_label: 'Tapping', op_type: 'per_hole', bucket: 'inside', sort: 60, variables: { source: 'taps' } },
        { key: 'countersinking', name: 'Countersinking', customer_label: 'Countersinking', op_type: 'per_hole', bucket: 'inside', sort: 61, variables: { source: 'countersinks' } },
        { key: 'powder-coat', name: 'Powder Coat', customer_label: 'Powder coating', op_type: 'powder_coat', bucket: 'inside', sort: 70,
          variables: { setup_hours: zamyrVar('Powder Coat', 'setup_time', 0.25), shop_rate: zamyrVar('Powder Coat', 'Shop Rate ($/Hr)', 38), batch_cost: zamyrVar('Powder Coat', 'Cost per Batch', 85), parts_per_batch: 0 } },
        { key: 'anodize', name: 'Anodize', customer_label: 'Anodizing', op_type: 'service_price', bucket: snapshot.operations?.Anodize?.outside ? 'outside' : 'inside', sort: 80, variables: { mode: 'per_line' } },
        cncOp('saw', 'CNC sawing', 100), cncOp('lathe', 'CNC turning', 110), cncOp('mill', 'CNC milling', 120),
        cncOp('deburr', 'CNC deburring', 130), cncOp('inspect', 'Inspection', 140),
    ];
    const opIds = {};
    for (const op of operations) {
        const res = await client.query(
            `INSERT INTO costing_operations (key, name, customer_label, op_type, bucket, variables, sort_order, source)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'zamyr') RETURNING id`,
            [op.key, op.name, op.customer_label, op.op_type, op.bucket, JSON.stringify(op.variables), op.sort]
        );
        opIds[op.key] = res.rows[0].id;
    }
    report.push(`Operations: ${operations.map(o => o.name).join(', ')}`);

    // ── Markups ──
    const markups = [
        { key: 'material', name: 'Material Markup', base: 'material', percent: zamyrPercent('Material Markup', 30) },
        { key: 'inside', name: 'Inside Labor Markup', base: 'inside', percent: zamyrPercent('Inside Labor Markup', 30) },
        { key: 'outside', name: 'Outside Service Markup', base: 'outside', percent: zamyrPercent('Outside Service Markup', 30) },
        { key: 'purchased', name: 'Purchased Component Markup', base: 'purchased', percent: zamyrPercent('Purchased Component Markup', 30) },
        { key: 'overhead', name: 'Overhead Markup', base: 'overhead', percent: zamyrPercent('Overhead Markup', 10) },
        { key: 'general', name: 'General Markup', base: 'general', percent: zamyrPercent('General Markup', 10) },
    ];
    const markupIds = {};
    for (const [i, m] of markups.entries()) {
        const res = await client.query('INSERT INTO costing_markups (name, calc_type, base, percent, sort_order) VALUES ($1,\'markup\',$2,$3,$4) RETURNING id', [m.name, m.base, m.percent, i]);
        markupIds[m.key] = res.rows[0].id;
    }
    report.push(`Markups: ${markups.map(m => `${m.name} ${m.percent}%`).join(', ')}`);

    // ── Add-ons ──
    const addOnIds = {};
    for (const [i, a] of snapshot.addOns.entries()) {
        const res = await client.query('INSERT INTO costing_add_ons (name, amount, apply_mode, sort_order) VALUES ($1,$2,$3,$4) RETURNING id', [a.name, a.amount || 0, a.required ? 'always' : 'optional', i]);
        addOnIds[a.name] = res.rows[0].id;
    }

    // ── Which services use what ──
    const services = (await client.query('SELECT id, title FROM services ORDER BY id')).rows;
    const find = (word) => services.find(s => s.title.toLowerCase().includes(word));
    const link = async (service, opKeys, markupKeys = [], addOnNames = []) => {
        if (!service) return;
        for (const k of opKeys) await client.query('INSERT INTO costing_service_operations VALUES ($1,$2)', [service.id, opIds[k]]);
        for (const k of markupKeys) await client.query('INSERT INTO costing_service_markups VALUES ($1,$2)', [service.id, markupIds[k]]);
        for (const n of addOnNames) if (addOnIds[n]) await client.query('INSERT INTO costing_service_add_ons VALUES ($1,$2)', [service.id, addOnIds[n]]);
        report.push(`  ${service.title} (#${service.id}): ${opKeys.join(', ')}${markupKeys.length ? ` | markups: ${markupKeys.join(', ')}` : ''}${addOnNames.length ? ` | add-ons: ${addOnNames.join(', ')}` : ''}`);
    };
    report.push('Service links:');
    // Zamyr's Sheet Metal process uses every markup; its CNC process skips overhead and general.
    await link(find('laser'), ['material-sheet', 'laser'], ['material', 'inside', 'outside', 'purchased', 'overhead', 'general']);
    await link(find('cnc'), ['material-sheet', 'cnc-saw', 'cnc-lathe', 'cnc-mill', 'cnc-deburr', 'cnc-inspect'], ['material', 'inside', 'outside', 'purchased'], snapshot.addOns.map(a => a.name));
    await link(find('bend'), ['bend']);
    await link(find('deburr'), ['deburr']);
    await link(find('powder'), ['powder-coat']);
    await link(find('anodiz'), ['anodize']);
    await link(find('tap'), ['tapping']);
    await link(find('countersink'), ['countersinking']);
    await link(find('hardware'), ['hardware-insert', 'hardware-parts']);
    if (!find('bend')) report.push('  WARNING: no Bending service found. Create it in Admin > Services and link the "Bend" operation to it.');

    // ── Steel metals price from Zamyr's "Carbon Steel" rows ──
    const steel = await client.query(
        `UPDATE metals m SET costing_family = 'Carbon Steel'
         FROM metal_categories mc
         WHERE mc.id = m.category_id AND mc.name ILIKE 'steel' AND m.costing_family IS NULL
         RETURNING m.name`
    );
    if (steel.rows.length) report.push(`Priced as Carbon Steel: ${steel.rows.map(r => r.name).join(', ')}`);

    // Offered thicknesses with no sheet price: empty rows for the shop to fill.
    const { added } = await addMissingSheetCostRows(client);
    if (added.length) report.push(`Sheet costs still needing a price (empty rows added): ${added.map(a => `${a.metalName} ${a.label}`).join(', ')}`);

    const version = String(Date.now());
    await client.query(
        `INSERT INTO site_settings (key, value) VALUES ('costing_config_version', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(version)]
    );
    await client.query(
        `INSERT INTO site_settings (key, value) VALUES ('costing_seeded_from', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(snapshot.source)]
    );
    return report;
}

module.exports = { seedCosting };

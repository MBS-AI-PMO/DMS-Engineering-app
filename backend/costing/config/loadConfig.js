/*
 * Reads everything the costing engine needs from the database. Cached, and
 * re-read as soon as anything in Admin > Costing changes: every admin write
 * bumps site_settings.costing_config_version, which is checked per request.
 */

const CACHE_MAX_AGE_MS = 5 * 60 * 1000;
let cache = null;

const parseSetting = (value) => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
};

async function readSetting(db, key) {
    const res = await db.query('SELECT value FROM site_settings WHERE key = $1', [key]);
    return res.rows.length ? parseSetting(res.rows[0].value) : undefined;
}

async function currentVersion(db) {
    const value = await readSetting(db, 'costing_config_version');
    return value === undefined || value === null ? '0' : String(value);
}

/* Bump after any change to costing data so every server sees it at once. */
async function bumpConfigVersion(db) {
    const version = String(Date.now());
    await db.query(
        `INSERT INTO site_settings (key, value) VALUES ('costing_config_version', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(version)]
    );
    cache = null;
    return version;
}

const groupIds = (rows, key, valueKey) => {
    const map = {};
    for (const row of rows) (map[row[key]] ||= []).push(Number(row[valueKey]));
    return map;
};

async function loadConfigFresh(db, version) {
    const [
        services, operations, serviceOps, serviceMarkups, serviceAddOns,
        markups, addOns, sheetSizes, sheetCosts, sheetPrices, laserRates,
        discountTiers, discountsEnabled,
    ] = await Promise.all([
        db.query(`SELECT id, title, is_production, base_price, service_options, dimensions_unit,
                         min_length, max_length, min_width, max_width, min_height, max_height
                  FROM services WHERE COALESCE(is_active, true) = true`),
        db.query('SELECT * FROM costing_operations ORDER BY sort_order, id'),
        db.query('SELECT service_id, operation_id FROM costing_service_operations'),
        db.query('SELECT service_id, markup_id FROM costing_service_markups'),
        db.query('SELECT service_id, add_on_id FROM costing_service_add_ons'),
        db.query('SELECT * FROM costing_markups ORDER BY sort_order, id'),
        db.query('SELECT * FROM costing_add_ons ORDER BY sort_order, id'),
        db.query('SELECT * FROM costing_sheet_sizes ORDER BY sort_order, id'),
        db.query('SELECT * FROM costing_sheet_costs ORDER BY sort_order, id'),
        db.query('SELECT sheet_cost_id, sheet_size_id, cost FROM costing_sheet_cost_prices'),
        db.query('SELECT * FROM laser_cut_rates ORDER BY sort_order, thickness, id'),
        db.query('SELECT * FROM quantity_discounts WHERE is_active = true').catch(() => ({ rows: [] })),
        readSetting(db, 'discounts_enabled'),
    ]);

    const activeSizes = sheetSizes.rows.filter(s => s.is_active !== false);
    const pricesByRow = {};
    for (const p of sheetPrices.rows) (pricesByRow[p.sheet_cost_id] ||= {})[p.sheet_size_id] = Number(p.cost);

    return {
        version,
        servicesById: new Map(services.rows.map(s => [Number(s.id), s])),
        operations: operations.rows,
        serviceOperations: groupIds(serviceOps.rows, 'service_id', 'operation_id'),
        serviceMarkups: groupIds(serviceMarkups.rows, 'service_id', 'markup_id'),
        serviceAddOns: groupIds(serviceAddOns.rows, 'service_id', 'add_on_id'),
        markups: markups.rows,
        addOns: addOns.rows,
        sheetSizes: sheetSizes.rows,
        defaultSheetSize: activeSizes.find(s => s.is_default) || null,
        sheetCosts: sheetCosts.rows.map(r => ({ ...r, prices: pricesByRow[r.id] || {} })),
        laserRates: laserRates.rows,
        discounts: {
            enabled: discountsEnabled === true || discountsEnabled === 'true',
            tiers: discountTiers.rows,
        },
    };
}

async function loadConfig(db) {
    const version = await currentVersion(db);
    if (cache && cache.version === version && Date.now() - cache.at < CACHE_MAX_AGE_MS) return cache.config;
    const config = await loadConfigFresh(db, version);
    cache = { version, at: Date.now(), config };
    return config;
}

module.exports = { loadConfig, bumpConfigVersion, readSetting };

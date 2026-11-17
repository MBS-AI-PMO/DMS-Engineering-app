/*
 * Adds an empty Sheet costs row for every metal + thickness the quote page
 * offers that has no price on the default sheet, so the shop can fill the
 * prices in Admin > Costing > Sheet costs. Safe to run again.
 *
 *   node scripts/costing_add_missing_sheet_rows.js [--dry-run]
 */
const db = require('../db');
const { ensureCostingSchema } = require('../costing/schema');
const { findMissingSheetRows, addMissingSheetCostRows } = require('../costing/seed/missingSheetRows');
const { bumpConfigVersion } = require('../costing/config/loadConfig');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    const client = await db.pool.connect();
    try {
        await ensureCostingSchema(client);
        if (DRY_RUN) {
            const { defaultSize, missing } = await findMissingSheetRows(client);
            if (!defaultSize) { console.log('No default sheet size is set.'); return; }
            console.log(`${missing.length} offered metal/thickness pairs have no ${defaultSize.name} price:`);
            missing.forEach(m => console.log(`  ${m.metalName.padEnd(26)} ${m.label.padEnd(8)} (${m.family}; ${m.why})`));
            return;
        }
        await client.query('BEGIN');
        const { defaultSize, added } = await addMissingSheetCostRows(client);
        if (added.length) await bumpConfigVersion(client);
        await client.query('COMMIT');
        if (!defaultSize) { console.log('No default sheet size is set.'); return; }
        console.log(added.length
            ? `Added ${added.length} empty rows to fill in Admin > Costing > Sheet costs:\n${added.map(a => `  ${a.metalName} ${a.label}`).join('\n')}`
            : 'Every offered thickness already has a sheet price or a row waiting for one.');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Nothing was changed:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await db.pool.end();
    }
}

main();

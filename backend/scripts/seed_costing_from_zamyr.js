/*
 * Loads the shop's costing (from Zamyr, see costing/seed/zamyr-snapshot.json)
 * into DMS: sheet sizes, sheet costs, laser rates, operations, markups,
 * add-ons and which services use them. One transaction; refuses to run over
 * existing costing data unless --force.
 *
 *   node scripts/seed_costing_from_zamyr.js [--force]
 *
 * The server also does this by itself on start when the costing tables are
 * empty, so this is only needed to reload Zamyr's values over edited ones.
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { ensureCostingSchema } = require('../costing/schema');
const { seedCosting } = require('../costing/seed/seedCosting');

const FORCE = process.argv.includes('--force');

function csv(rows) {
    if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const cell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n') + '\n';
}

async function main() {
    const client = await db.pool.connect();
    try {
        await ensureCostingSchema(client);
        const existing = await client.query('SELECT count(*)::int AS n FROM costing_operations');
        if (existing.rows[0].n > 0 && !FORCE) {
            console.log('Costing data already exists. Re-run with --force to replace it.');
            return;
        }

        // Keep a copy of the pre-costing sheet cost table, if it is still there.
        const old = await client.query('SELECT * FROM sheet_cost_rates ORDER BY family, min_thick').catch(() => ({ rows: [] }));
        if (old.rows.length) {
            const dir = path.join(__dirname, '..', 'costing', 'seed', 'backup');
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, `sheet_cost_rates-${new Date().toISOString().slice(0, 10)}.csv`);
            fs.writeFileSync(file, csv(old.rows));
            console.log(`Backed up ${old.rows.length} old sheet cost rows to ${path.relative(process.cwd(), file)}`);
        }

        await client.query('BEGIN');
        const report = await seedCosting(client);
        await client.query('COMMIT');
        console.log(report.join('\n'));
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Seeding failed, nothing was changed:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await db.pool.end();
    }
}

main();

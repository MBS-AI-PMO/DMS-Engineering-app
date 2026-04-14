const { Pool } = require('pg');
const pool = new Pool({
    user: 'dms_user',
    host: '18.117.111.36',
    database: 'DMS_DB',
    password: 'dms@!221714',
    port: 5432,
});

async function findTables() {
    try {
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('--- FOUND TABLES ---');
        console.log(res.rows.map(r => r.table_name).join(', '));

        // Check if there's a settings table or something similar
        const tables = res.rows.map(r => r.table_name.toLowerCase());

        if (tables.includes('settings')) {
            console.log('\n--- SETTINGS DATA ---');
            const settings = await pool.query('SELECT * FROM settings');
            console.table(settings.rows);
        }

        if (tables.includes('sheet_cost_rates')) {
            console.log('\n--- SHEET COST RATES (Aluminum ~9.5mm) ---');
            const costs = await pool.query('SELECT * FROM sheet_cost_rates');
            console.table(costs.rows.filter(r => r.min_thickness <= 10 && r.max_thickness >= 9));
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

findTables();

const { Pool } = require('pg');
const pool = new Pool({
    user: 'dms_user',
    host: '18.117.111.36',
    database: 'DMS_DB',
    password: 'dms@!221714',
    port: 5432,
});

async function verify() {
    try {
        console.log('--- Price Verification Data ---');

        // 1. General Markup
        const resMarkup = await pool.query("SELECT * FROM site_settings WHERE key = 'general_markup'");
        console.log('Markup Setting:', resMarkup.rows[0]);

        // 2. Sheet Cost Rates for Aluminum around .375"
        const resSheet = await pool.query(
            "SELECT * FROM sheet_cost_rates WHERE family ILIKE '%Aluminum%' AND min_thick <= 0.38 AND max_thick >= 0.37"
        );
        console.log('Sheet Rates for Aluminum:');
        console.table(resSheet.rows);

        // 3. Laser Cut Rates for Aluminum around .375"
        const resLaser = await pool.query(
            "SELECT * FROM laser_cut_rates WHERE material_family ILIKE '%Aluminum%' AND thickness >= 0.37 AND thickness <= 0.38"
        );
        console.log('Laser Rates for Aluminum:');
        console.table(resLaser.rows);

        // 4. Powder Coating Service
        const resServices = await pool.query(
            "SELECT * FROM services WHERE name ILIKE '%Powder%'"
        );
        console.log('Powder Coating Service:');
        console.table(resServices.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

verify();

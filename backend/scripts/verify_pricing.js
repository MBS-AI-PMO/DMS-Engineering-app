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
        console.log('--- Database Verification ---');

        // 1. Check General Markup
        const markupRes = await pool.query("SELECT value FROM settings WHERE key = 'general_markup'");
        const markup = parseFloat(markupRes.rows[0]?.value || 10);
        console.log(`General Markup: ${markup}%`);

        // 2. Identify Category for Aluminum
        const catRes = await pool.query("SELECT id, name FROM metal_categories WHERE name ILIKE '%Aluminum%'");
        if (catRes.rows.length === 0) {
            console.log('Aluminum category not found');
            return;
        }
        const catId = catRes.rows[0].id;
        console.log(`Category ID for ${catRes.rows[0].name}: ${catId}`);

        // 3. Check Sheet Cost Rate for 9.52mm (.375")
        const costRes = await pool.query(
            "SELECT * FROM sheet_cost_rates WHERE category_id = $1 AND min_thickness <= 9.52 AND max_thickness >= 9.52",
            [catId]
        );
        console.log('Material Cost Rate:', costRes.rows[0]);

        // 4. Check Laser Cut Rate
        const laserRes = await pool.query(
            "SELECT * FROM laser_cut_rates WHERE category_id = $1 AND min_thickness <= 9.52 AND max_thickness >= 9.52",
            [catId]
        );
        console.log('Laser Rates:', laserRes.rows[0]);

        // 5. Check Powder Coating Rate
        // Note: Powder coating is often in services or as a multiplier. 
        // In the screenshot it's $159.50.
        // Let's check service rates.
        const serviceRes = await pool.query("SELECT * FROM services WHERE name ILIKE '%Powder%'");
        console.log('Powder Coating Service:', serviceRes.rows[0]);

    } catch (err) {
        console.error('Error during verification:', err);
    } finally {
        await pool.end();
    }
}

verify();

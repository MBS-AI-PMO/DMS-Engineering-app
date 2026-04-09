const { Pool } = require('pg');
const pool = new Pool({
    user: 'dms_user',
    host: '3.133.86.166',
    database: 'DMS_DB',
    password: 'dms@!221714',
    port: 5432,
});

async function discoverAndFetch() {
    try {
        console.log('--- DB SCHEMA DISCOVERY ---');
        const resSettings = await pool.query("SELECT * FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings'");
        console.log('site_settings columns:', resSettings.rows.map(r => r.column_name).join(', '));

        const resSheet = await pool.query("SELECT * FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sheet_cost_rates'");
        console.log('sheet_cost_rates columns:', resSheet.rows.map(r => r.column_name).join(', '));

        const resLaser = await pool.query("SELECT * FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'laser_cut_rates'");
        console.log('laser_cut_rates columns:', resLaser.rows.map(r => r.column_name).join(', '));

        const resServices = await pool.query("SELECT * FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services'");
        console.log('services columns:', resServices.rows.map(r => r.column_name).join(', '));

        console.log('\n--- FETCHING PRICING DATA ---');
        
        // 1. Markup
        const markup = await pool.query("SELECT * FROM site_settings WHERE key = 'general_markup'");
        console.log('General Markup:', markup.rows[0]);

        // 2. Sheet Cost (Aluminum .375" / 9.52mm)
        // Note: Check both mm and inch columns if they exist
        const sheetRates = await pool.query("SELECT * FROM sheet_cost_rates WHERE family ILIKE '%Aluminum%'");
        console.log('Aluminum Sheet Rates:');
        console.table(sheetRates.rows);

        // 3. Laser Rates (Aluminum .375")
        const laserRates = await pool.query("SELECT * FROM laser_cut_rates WHERE material_family ILIKE '%Aluminum%'");
        console.log('Aluminum Laser Rates:');
        console.table(laserRates.rows);

        // 4. Powder Coating (Gloss Red)
        const powderServices = await pool.query("SELECT * FROM services WHERE title ILIKE '%Powder%' OR description ILIKE '%Powder%'");
        console.log('Powder Coating Service:');
        console.table(powderServices.rows);

    } catch (err) {
        console.error('Error during discovery:', err.message);
    } finally {
        await pool.end();
    }
}

discoverAndFetch();

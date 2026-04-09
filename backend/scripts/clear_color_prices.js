const { Pool } = require('pg');
const pool = new Pool({
    user: 'dms_user',
    host: '3.133.86.166',
    database: 'DMS_DB',
    password: 'dms@!221714',
    port: 5432,
});

async function clearColorPrices() {
    try {
        console.log('--- Clearing Color Pricing Premiums ---');
        const res = await pool.query('SELECT id, title, service_options FROM services WHERE service_options IS NOT NULL');

        for (const row of res.rows) {
            let options = row.service_options;
            if (Array.isArray(options)) {
                console.log(`Processing service: ${row.title} (ID: ${row.id})`);
                const newOptions = options.map(opt => ({
                    ...opt,
                    price: 0,
                    base_price: 0
                }));
                await pool.query('UPDATE services SET service_options = $1 WHERE id = $2', [JSON.stringify(newOptions), row.id]);
            }
        }
        console.log('--- Success: All color/option prices set to $0 ---');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

clearColorPrices();

const db = require('../db');

async function migrate() {
    try {
        console.log('Creating quantity_discounts table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS quantity_discounts (
                id SERIAL PRIMARY KEY,
                min_quantity INTEGER NOT NULL UNIQUE,
                discount_percent DECIMAL(5,2) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Table created successfully.');

        // No default tiers will be added; the user will configure them manually.
        const { rows } = await db.query('SELECT COUNT(*) FROM quantity_discounts');
        console.log(`Table ready. Current count: ${rows[0].count}`);

        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();

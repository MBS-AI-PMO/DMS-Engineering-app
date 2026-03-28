const db = require('../db');

const up = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS pricing_rules (
                id SERIAL PRIMARY KEY,
                metal_id INTEGER REFERENCES metals(id) ON DELETE CASCADE,
                service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
                thickness_value VARCHAR(50) NOT NULL,
                price_per_inch_height NUMERIC(10, 2) DEFAULT 0,
                price_per_inch_length NUMERIC(10, 2) DEFAULT 0,
                base_price NUMERIC(10, 2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(metal_id, service_id, thickness_value)
            );
        `);
        console.log('Table "pricing_rules" created successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error creating table:', err);
        process.exit(1);
    }
};

up();

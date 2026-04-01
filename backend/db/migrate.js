const db = require('../db');

const migrate = async () => {
    console.log('--- Starting Database Migration (Orders & Items) ---');

    const createOrdersTable = `
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            email VARCHAR(255) NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            address TEXT NOT NULL,
            city VARCHAR(100) NOT NULL,
            zip_code VARCHAR(20) NOT NULL,
            total_price DECIMAL(15, 2) NOT NULL,
            payment_method VARCHAR(50) DEFAULT 'COD',
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const createOrderItemsTable = `
        CREATE TABLE IF NOT EXISTS order_items (
            id SERIAL PRIMARY KEY,
            order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
            file_name VARCHAR(255) NOT NULL,
            original_file_path TEXT NOT NULL,
            configured_file_path TEXT,
            configuration_json JSONB NOT NULL,
            quantity INTEGER DEFAULT 1,
            unit_price DECIMAL(15, 2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        await db.query(createOrdersTable);
        console.log('[X] Orders table initialized');

        await db.query(createOrderItemsTable);
        console.log('[X] Order Items table initialized');

        // Check and Add configured_file_path if it somehow missed the previous run
        await db.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='configured_file_path') THEN
                    ALTER TABLE order_items ADD COLUMN configured_file_path TEXT;
                END IF;
            END $$;
        `);
        console.log('[X] Configured file path column verified');

        console.log('--- Migration Completed Successfully ---');
        process.exit(0);
    } catch (err) {
        console.error('Migration Failed:', err);
        process.exit(1);
    }
};

migrate();

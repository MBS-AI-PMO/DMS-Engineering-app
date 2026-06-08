const db = require('../db');

async function migrate() {
    console.log('Running migrations...');
    
    try {
        // Users table
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(255),
                role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('  ✓ users table');

        // Customer profile columns (v2)
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`);
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;`);
        console.log('  ✓ users phone/address columns');

        // Metal categories table
        await db.query(`
            CREATE TABLE IF NOT EXISTS metal_categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                display_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('  ✓ metal_categories table');

        // Metals table
        await db.query(`
            CREATE TABLE IF NOT EXISTS metals (
                id SERIAL PRIMARY KEY,
                slug VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                category_id INT REFERENCES metal_categories(id) ON DELETE SET NULL,
                thickness VARCHAR(255),
                description TEXT,
                image_path VARCHAR(500),
                quick_look JSONB DEFAULT '{}',
                services JSONB DEFAULT '[]',
                specifications JSONB DEFAULT '{}',
                thickness_specs JSONB DEFAULT '{}',
                about_section JSONB DEFAULT '{}',
                faqs JSONB DEFAULT '[]',
                custom_fields JSONB DEFAULT '{}',
                display_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('  ✓ metals table');

        // FAQ categories table
        await db.query(`
            CREATE TABLE IF NOT EXISTS faq_categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                display_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('  ✓ faq_categories table');

        // FAQs table
        await db.query(`
            CREATE TABLE IF NOT EXISTS faqs (
                id SERIAL PRIMARY KEY,
                category_id INT REFERENCES faq_categories(id) ON DELETE SET NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                display_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('  ✓ faqs table');

        // Services table
        await db.query(`
            CREATE TABLE IF NOT EXISTS services (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                image_path VARCHAR(500),
                display_order INT DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
        console.log('  ✓ services table');

        // Hero sections table for service detail pages
await db.query(`
    CREATE TABLE IF NOT EXISTS hero_sections (
        id SERIAL PRIMARY KEY,
        service_id INTEGER UNIQUE NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        hero_image JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );
`);
console.log('  ✓ hero_sections table');

        // Email config table
        await db.query(`
            CREATE TABLE IF NOT EXISTS email_config (
                id SERIAL PRIMARY KEY,
                smtp_host VARCHAR(255) NOT NULL,
                smtp_port INT DEFAULT 587,
                email VARCHAR(255) NOT NULL,
                password_encrypted TEXT NOT NULL,
                encryption_type VARCHAR(10) DEFAULT 'TLS' CHECK (encryption_type IN ('TLS', 'SSL', 'NONE')),
                sender_name VARCHAR(255) DEFAULT 'DMS Engineering',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('  ✓ email_config table');

        // Newsletter subscribers table
        await db.query(`
            CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
                subscribed_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('  ✓ newsletter_subscribers table');

        // Service configurations (CNC Machining & Sheet Cutting global sizing limits)
        await db.query(`
            CREATE TABLE IF NOT EXISTS service_configs (
                id SERIAL PRIMARY KEY,
                service_type VARCHAR(50) UNIQUE NOT NULL
                    CHECK (service_type IN ('cnc_machining', 'sheet_cutting')),
                min_x NUMERIC(12,4) DEFAULT 0,
                max_x NUMERIC(12,4),
                min_y NUMERIC(12,4) DEFAULT 0,
                max_y NUMERIC(12,4),
                min_z NUMERIC(12,4) DEFAULT 0,
                max_z NUMERIC(12,4),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`INSERT INTO service_configs (service_type) VALUES ('cnc_machining') ON CONFLICT DO NOTHING;`);
        await db.query(`INSERT INTO service_configs (service_type) VALUES ('sheet_cutting') ON CONFLICT DO NOTHING;`);
        console.log('  ✓ service_configs table');

        // Per-metal sizing and available thicknesses configuration
        await db.query(`
            CREATE TABLE IF NOT EXISTS metal_configs (
                id SERIAL PRIMARY KEY,
                metal_id INTEGER UNIQUE NOT NULL REFERENCES metals(id) ON DELETE CASCADE,
                min_x NUMERIC(12,4),
                max_x NUMERIC(12,4),
                min_y NUMERIC(12,4),
                max_y NUMERIC(12,4),
                min_z NUMERIC(12,4),
                max_z NUMERIC(12,4),
                available_thicknesses JSONB DEFAULT '[]',
                is_sheet_cuttable BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('  ✓ metal_configs table');

        // Service-to-metal assignments (which metals are offered per service)
        await db.query(`
            CREATE TABLE IF NOT EXISTS service_metal_assignments (
                id SERIAL PRIMARY KEY,
                service_type VARCHAR(50) NOT NULL
                    CHECK (service_type IN ('cnc_machining', 'sheet_cutting')),
                metal_id INTEGER NOT NULL REFERENCES metals(id) ON DELETE CASCADE,
                UNIQUE(service_type, metal_id)
            );
        `);
        console.log('  ✓ service_metal_assignments table');

        // Orders table
        await db.query(`
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
        `);
        console.log('  ✓ orders table');

        // Order Items table
        await db.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
                file_name VARCHAR(255) NOT NULL,
                original_file_path TEXT NOT NULL,
                configured_file_path TEXT,
                flat_file_path TEXT,
                configuration_json JSONB NOT NULL,
                quantity INTEGER DEFAULT 1,
                unit_price DECIMAL(15, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('  ✓ order_items table');
        // Updated_at trigger function
        await db.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);

        // Apply triggers
        const tablesWithUpdatedAt = [
    'users',
    'metals',
    'metal_categories',
    'faq_categories',
    'faqs',
    'email_config',
    'service_configs',
    'metal_configs',
    'orders',
    'hero_sections'
];
        for (const table of tablesWithUpdatedAt) {
            await db.query(`
                DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
                CREATE TRIGGER update_${table}_updated_at
                    BEFORE UPDATE ON ${table}
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
            `);
        }
        console.log('  ✓ updated_at triggers');

        console.log('\\n✅ All migrations completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        await db.pool.end();
    }
}

migrate();

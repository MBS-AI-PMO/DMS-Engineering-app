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
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('  ✓ services table');

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
        const tablesWithUpdatedAt = ['users', 'metals', 'metal_categories', 'faq_categories', 'faqs', 'email_config'];
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

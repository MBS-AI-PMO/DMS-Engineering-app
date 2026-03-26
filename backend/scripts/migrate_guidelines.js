const db = require('../db');

async function migrate() {
    console.log('Adding service_guidelines table...');
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS service_guidelines (
                id SERIAL PRIMARY KEY,
                service_id INT REFERENCES services(id) ON DELETE CASCADE UNIQUE,
                title VARCHAR(255) NOT NULL,
                content TEXT,
                requirements JSONB DEFAULT '[]',
                tables JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- Ensure update_updated_at_column function exists
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';

            DROP TRIGGER IF EXISTS update_service_guidelines_updated_at ON service_guidelines;
            CREATE TRIGGER update_service_guidelines_updated_at
                BEFORE UPDATE ON service_guidelines
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        `);
        console.log('✅ service_guidelines table and trigger created');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        process.exit();
    }
}

migrate();

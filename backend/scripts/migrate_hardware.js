const db = require('../db');

async function migrate() {
    console.log('Running hardware insertion migration...');
    try {
        // 1. Create hardware_types table
        await db.query(`
            CREATE TABLE IF NOT EXISTS hardware_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                slug VARCHAR(100) UNIQUE NOT NULL,
                image_path VARCHAR(500)
            );
        `);
        console.log('  ✓ hardware_types table created');

        // 2. Create hardware_items table
        await db.query(`
            CREATE TABLE IF NOT EXISTS hardware_items (
                id SERIAL PRIMARY KEY,
                hardware_type_id INTEGER NOT NULL REFERENCES hardware_types(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                size_spec VARCHAR(100),
                price NUMERIC(10,4) NOT NULL DEFAULT 0,
                image_path VARCHAR(500),
                notes TEXT,
                is_active BOOLEAN NOT NULL DEFAULT true
            );
        `);
        console.log('  ✓ hardware_items table created');

        // 3. Seed hardware types
        await db.query(`
            INSERT INTO hardware_types (name, slug) VALUES
                ('Flush Stud',     'flush-stud'),
                ('Flush Standoff', 'flush-standoff'),
                ('Nut',            'nut'),
                ('Flush Nut',      'flush-nut')
            ON CONFLICT (slug) DO NOTHING;
        `);
        console.log('  ✓ Seeded 4 hardware types');

        console.log('\n✅ Hardware migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await db.pool.end();
    }
}

migrate();

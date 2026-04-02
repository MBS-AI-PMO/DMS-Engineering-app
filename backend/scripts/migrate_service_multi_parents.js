const db = require('../db');

async function migrate() {
    console.log('Running multi-parent service migration...');
    try {
        // 1. Create service_relationships table
        await db.query(`
            CREATE TABLE IF NOT EXISTS service_relationships (
                id SERIAL PRIMARY KEY,
                service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                parent_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                UNIQUE(service_id, parent_id)
            );
        `);
        console.log('  ✓ service_relationships table created');

        // 2. Migrate existing parent_id data if it exists in services table
        const checkColumn = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='services' AND column_name='parent_id';
        `);

        if (checkColumn.rows.length > 0) {
            console.log('  Found parent_id column, migrating data...');
            const result = await db.query(`
                INSERT INTO service_relationships (service_id, parent_id)
                SELECT id, parent_id FROM services 
                WHERE parent_id IS NOT NULL
                ON CONFLICT DO NOTHING
                RETURNING id;
            `);
            console.log(`  ✓ Migrated ${result.rowCount} existing parent_id relationships to service_relationships`);
        } else {
            console.log('  parent_id column not found in services table, skipping data migration.');
        }

        console.log('\n✅ Multi-parent migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await db.pool.end();
    }
}

migrate();

const db = require('../db');

async function migrate() {
    console.log('--- Database Migration: Multi-Quantity Discounts ---');
    try {
        // 1. Add 'quantities' JSONB column if it doesn't exist
        const checkResult = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'quantity_discounts' AND column_name = 'quantities'
        `);

        if (checkResult.rows.length === 0) {
            console.log('Adding column "quantities" to "quantity_discounts" table...');
            await db.query('ALTER TABLE quantity_discounts ADD COLUMN quantities JSONB DEFAULT \'[]\'::jsonb');
            console.log('Successfully added column "quantities".');
        }

        // 2. Migrate existing 'min_quantity' data to 'quantities' array
        console.log('Migrating existing min_quantity values...');
        await db.query(`
            UPDATE quantity_discounts 
            SET quantities = jsonb_build_array(min_quantity)
            WHERE quantities = '[]'::jsonb OR quantities IS NULL
        `);
        console.log('Migration complete.');

        // 3. (Optional) Fix some 0-dimension metals for better demo
        console.log('Fixing sample dimensions for Metal ID 2 (5052 H32 ALUMINUM)...');
        await db.query(`
            INSERT INTO metal_configs (metal_id, available_thicknesses)
            VALUES (2, '[1.6, 2, 3.2, 4.8, 6.35]')
            ON CONFLICT (metal_id) DO UPDATE SET available_thicknesses = EXCLUDED.available_thicknesses;
        `);

        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();

const db = require('../db');

async function migrate() {
    console.log('--- Database Migration: Adding base_price to services ---');
    try {
        // Check if the column already exists to avoid errors
        const checkResult = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'services' AND column_name = 'base_price'
        `);

        if (checkResult.rows.length > 0) {
            console.log('Column "base_price" already exists in "services" table.');
        } else {
            console.log('Adding column "base_price" to "services" table...');
            await db.query('ALTER TABLE services ADD COLUMN base_price DECIMAL(10,2) DEFAULT 0.00');
            console.log('Successfully added column "base_price".');
        }

        // Set a default value for existing Anodizing service if it exists (for smoother transition)
        console.log('Setting initial default for Anodizing service if found...');
        await db.query(`
            UPDATE services 
            SET base_price = 15.00 
            WHERE title ILIKE '%anodiz%' AND base_price = 0.00
        `);
        console.log('Migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();

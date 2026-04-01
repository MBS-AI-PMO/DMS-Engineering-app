const db = require('../db');

async function migrate() {
  try {
    console.log('Starting migration: Adding flat_file_path to order_items...');
    await db.query(`
      ALTER TABLE order_items 
      ADD COLUMN IF NOT EXISTS flat_file_path TEXT;
    `);
    console.log('Migration complete: flat_file_path added successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();

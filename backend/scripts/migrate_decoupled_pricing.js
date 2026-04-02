const db = require('../db');

async function migrate() {
  console.log('--- DECOUPLED PRICING MIGRATION ---');

  try {
    // 1. Add pricing_config columns if they don't exist
    console.log('1. Checking table columns...');
    
    // Add to services
    await db.query(`
      ALTER TABLE services 
      ADD COLUMN IF NOT EXISTS pricing_config JSONB DEFAULT '{}'::jsonb
    `);
    
    // Add to metals
    await db.query(`
      ALTER TABLE metals 
      ADD COLUMN IF NOT EXISTS pricing_config JSONB DEFAULT '{}'::jsonb
    `);
    
    console.log('✓ Columns added successfully.');

    // 2. Migrate CNC Pricing (Service ID 2)
    console.log('2. Migrating CNC pricing parameters...');
    const cncRules = await db.query(`
      SELECT * FROM pricing_rules 
      WHERE service_id = 2 AND thickness_value = 'variable'
      LIMIT 1
    `);

    if (cncRules.rows.length > 0) {
      const r = cncRules.rows[0];
      const config = {
        base_setup: parseFloat(r.base_price) || 0,
        price_per_width: parseFloat(r.price_per_inch_height) || 0,
        price_per_length: parseFloat(r.price_per_inch_length) || 0,
        price_per_thickness: parseFloat(r.price_per_inch_thickness) || 0
      };
      
      await db.query(`UPDATE services SET pricing_config = $1 WHERE id = 2`, [JSON.stringify(config)]);
      console.log('✓ CNC parameters migrated.');
    } else {
      console.log('ℹ No CNC rules found to migrate.');
    }

    // 3. Migrate Metal Material Pricing
    console.log('3. Migrating metal material pricing (seeded from production services)...');
    
    // We'll take the 'base_price' or 'price_per_inch' from the first production service found for each metal/thickness
    const metalRules = await db.query(`
      SELECT pr.metal_id, pr.thickness_value, pr.base_price, pr.price_per_inch_height
      FROM pricing_rules pr
      JOIN services s ON pr.service_id = s.id
      WHERE s.is_production = true AND pr.thickness_value != 'variable'
    `);

    const metalConfigs = {}; // { metalId: { thickness: price } }

    metalRules.rows.forEach(r => {
        if (!metalConfigs[r.metal_id]) metalConfigs[r.metal_id] = {};
        // We use base_price as the unit price for this thickness
        metalConfigs[r.metal_id][r.thickness_value] = parseFloat(r.base_price) || 0;
    });

    for (const [metalId, config] of Object.entries(metalConfigs)) {
        await db.query(`UPDATE metals SET pricing_config = $1 WHERE id = $2`, [JSON.stringify(config), metalId]);
    }
    
    console.log(`✓ Migrated ${Object.keys(metalConfigs).length} metal pricing tables.`);

    console.log('--- MIGRATION COMPLETED ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();

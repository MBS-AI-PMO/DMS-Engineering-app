const db = require('../db');

/**
 * Migration: Technical Pricing Fields
 * Adds cut_rate and pierce_time to pricing_rules
 * and initializes pricing_config for core services.
 */
async function up() {
    console.log('Starting Technical Pricing migration...');
    try {
        // 1. Add technical columns to pricing_rules
        await db.query(`ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS cut_rate NUMERIC(12,4) DEFAULT 0;`);
        await db.query(`ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS pierce_time NUMERIC(12,4) DEFAULT 0;`);
        console.log('  ✓ Added cut_rate and pierce_time to pricing_rules');

        // 2. Ensure services have a pricing_config object
        // We will initialize it for Laser, Bending, and Powder Coating if it's null
        
        // Laser Cutting
        await db.query(`
            UPDATE services 
            SET pricing_config = jsonb_build_object(
                'hourly_rate', 100,
                'setup_fee', 30,
                'is_technical', true
            )
            WHERE title ILIKE '%laser%' AND (pricing_config IS NULL OR pricing_config = '{}'::jsonb);
        `);

        // Bending
        await db.query(`
            UPDATE services 
            SET pricing_config = jsonb_build_object(
                'hourly_rate', 38,
                'setup_fee', 15,
                'med_bend_threshold', 200,
                'large_bend_threshold', 500,
                'small_bend_rate', 15,
                'med_bend_rate', 15,
                'large_bend_rate', 20
            )
            WHERE title ILIKE '%bending%' AND (pricing_config IS NULL OR pricing_config = '{}'::jsonb);
        `);

        // Powder Coating
        await db.query(`
            UPDATE services 
            SET pricing_config = jsonb_build_object(
                'batch_cost', 150,
                'setup_time', 15,
                'shop_rate', 38,
                'oven_width', 90,
                'oven_length', 160
            )
            WHERE (title ILIKE '%powder%' OR title ILIKE '%finish%') AND (pricing_config IS NULL OR pricing_config = '{}'::jsonb);
        `);

        console.log('  ✓ Initialized pricing_config for core services');

        // 3. Seed technical rates for "Generic" fallback
        // We look for any rules that belong to laser cutting and map the CSV data
        // Note: This is an approximation based on the CSV provided.
        const technicalRates = [
            { thick: '0.0001', speed: 140, pierce: 1 },
            { thick: '0.06', speed: 140, pierce: 0.2 },
            { thick: '0.1', speed: 110, pierce: 0.2 },
            { thick: '0.12', speed: 90, pierce: 0.4 },
            { thick: '0.25', speed: 20, pierce: 1 },
            { thick: '0.5', speed: 4, pierce: 7 },
            { thick: '99', speed: 59, pierce: 1.5 }
        ];

        for (const rate of technicalRates) {
            await db.query(`
                UPDATE pricing_rules 
                SET cut_rate = $1, pierce_time = $2
                WHERE thickness_value = $3;
            `, [rate.speed, rate.pierce, rate.thick]);
        }
        console.log('  ✓ Seeded initial technical rates from CSV');

        console.log('✅ Technical Pricing migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

up();

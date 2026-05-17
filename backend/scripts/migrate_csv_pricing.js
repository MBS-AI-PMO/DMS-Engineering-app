const db = require('../db');

/**
 * Migration: CSV Formula-Based Pricing
 * Creates laser_cut_rates and sheet_cost_rates tables.
 * Laser rates are seeded from the CSV data provided.
 * Sheet cost rates are left empty for admin population via the UI.
 */
async function up() {
    console.log('Starting CSV Formula Pricing migration...');
    try {
        // 1. Create laser_cut_rates table
        await db.query(`
            CREATE TABLE IF NOT EXISTS laser_cut_rates (
                id SERIAL PRIMARY KEY,
                material_family VARCHAR(100) NOT NULL DEFAULT 'generic',
                thickness NUMERIC(10,6) NOT NULL,
                cut_rate NUMERIC(12,4) NOT NULL,
                pierce_time NUMERIC(12,4) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('  ✓ Created laser_cut_rates table');

        // 2. Seed laser_cut_rates with generic data from CSV
        // Lookup: find row where thickness >= part_thickness (ordered ASC)
        // These are max-thickness thresholds: e.g., 0.06 means "for parts up to 0.06 in"
        const laserRates = [
            { family: 'generic', thickness: 0.0001, cut_rate: 140, pierce_time: 1    },
            { family: 'generic', thickness: 0.06,   cut_rate: 140, pierce_time: 0.2  },
            { family: 'generic', thickness: 0.1,    cut_rate: 110, pierce_time: 0.2  },
            { family: 'generic', thickness: 0.12,   cut_rate: 90,  pierce_time: 0.4  },
            { family: 'generic', thickness: 0.25,   cut_rate: 20,  pierce_time: 1    },
            { family: 'generic', thickness: 0.5,    cut_rate: 4,   pierce_time: 7    },
            { family: 'generic', thickness: 99,     cut_rate: 59,  pierce_time: 1.5  },
        ];

        for (const r of laserRates) {
            await db.query(`
                INSERT INTO laser_cut_rates (material_family, thickness, cut_rate, pierce_time)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
            `, [r.family, r.thickness, r.cut_rate, r.pierce_time]);
        }
        console.log('  ✓ Seeded 7 generic laser cut rate rows');

        // 3. Create sheet_cost_rates table
        // Admin populates this via the Sheet Costs admin page.
        // Lookup: family = metal's category + min_thick < thickness AND max_thick >= thickness
        await db.query(`
            CREATE TABLE IF NOT EXISTS sheet_cost_rates (
                id SERIAL PRIMARY KEY,
                family VARCHAR(100) NOT NULL,
                min_thick NUMERIC(10,6) NOT NULL,
                max_thick NUMERIC(10,6) NOT NULL,
                ga INTEGER,
                sheet_cost_4x8 NUMERIC(10,4) NOT NULL,
                nest_sheet_cost_4x8 NUMERIC(10,4),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.query(`ALTER TABLE sheet_cost_rates DROP COLUMN IF EXISTS sheet_cost_5x10;`);
        await db.query(`ALTER TABLE sheet_cost_rates ADD COLUMN IF NOT EXISTS nest_sheet_cost_4x8 NUMERIC(10,4);`);
        console.log('  ✓ Created sheet_cost_rates table (empty — populate via admin UI)');

        console.log('✅ CSV Formula Pricing migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

up();

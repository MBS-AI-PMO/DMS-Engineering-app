const db = require('../db');

/**
 * Seed placeholder sheet cost rates for all metal categories.
 *
 * Costs are approximate US supplier prices per 4×8 sheet (96"×48") as of 2024.
 * They are PLACEHOLDERS only — replace with your actual supplier quotes
 * via the Sheet Costs admin page once you have real data.
 *
 * Lookup rule: family = metal's category name (exact match)
 *              min_thick < part_thickness AND max_thick >= part_thickness
 *
 * Run: node backend/scripts/seed_sheet_costs.js
 */

// ── Placeholder costs per family ───────────────────────────────────────────────
// Each row: { ga, min, max, cost }
// GA is informational only (label). min/max are the thickness range in inches.
const COSTS = {
    'Aluminum': [
        { ga: 22, min: 0.000, max: 0.028, cost: 18.00  },  // ~0.025"
        { ga: 20, min: 0.028, max: 0.036, cost: 22.00  },  // ~0.032"
        { ga: 18, min: 0.036, max: 0.045, cost: 28.00  },  // ~0.040"
        { ga: 16, min: 0.045, max: 0.057, cost: 34.00  },  // ~0.051"
        { ga: 14, min: 0.057, max: 0.075, cost: 42.00  },  // ~0.064"
        { ga: 12, min: 0.075, max: 0.093, cost: 52.00  },  // ~0.081"
        { ga: 10, min: 0.093, max: 0.120, cost: 65.00  },  // ~0.102"
        { ga:  7, min: 0.120, max: 0.200, cost: 85.00  },  // ~0.125–0.190"
        { ga: null, min: 0.200, max: 99,  cost: 125.00 },  // plate
    ],
    'Steel': [
        { ga: 22, min: 0.000, max: 0.033, cost: 25.00  },  // ~0.030"
        { ga: 20, min: 0.033, max: 0.040, cost: 30.00  },  // ~0.036"
        { ga: 18, min: 0.040, max: 0.052, cost: 38.00  },  // ~0.048"
        { ga: 16, min: 0.052, max: 0.068, cost: 45.00  },  // ~0.060"
        { ga: 14, min: 0.068, max: 0.090, cost: 55.00  },  // ~0.075"
        { ga: 11, min: 0.090, max: 0.130, cost: 68.00  },  // ~0.120"
        { ga:  7, min: 0.130, max: 0.190, cost: 85.00  },  // ~0.179"
        { ga: null, min: 0.190, max: 0.260, cost: 108.00 },
        { ga: null, min: 0.260, max: 99,   cost: 148.00 },
    ],
    'Stainless Steel': [
        { ga: 22, min: 0.000, max: 0.033, cost: 55.00  },
        { ga: 20, min: 0.033, max: 0.040, cost: 65.00  },
        { ga: 18, min: 0.040, max: 0.052, cost: 80.00  },
        { ga: 16, min: 0.052, max: 0.068, cost: 95.00  },
        { ga: 14, min: 0.068, max: 0.090, cost: 115.00 },
        { ga: 11, min: 0.090, max: 0.130, cost: 140.00 },
        { ga:  7, min: 0.130, max: 0.190, cost: 170.00 },
        { ga: null, min: 0.190, max: 0.260, cost: 215.00 },
        { ga: null, min: 0.260, max: 99,   cost: 285.00 },
    ],
    'Brass': [
        { ga: 22, min: 0.000, max: 0.033, cost: 60.00  },
        { ga: 20, min: 0.033, max: 0.045, cost: 72.00  },
        { ga: 18, min: 0.045, max: 0.060, cost: 88.00  },
        { ga: 16, min: 0.060, max: 0.090, cost: 110.00 },
        { ga: 12, min: 0.090, max: 0.130, cost: 138.00 },
        { ga: null, min: 0.130, max: 0.190, cost: 172.00 },
        { ga: null, min: 0.190, max: 99,   cost: 225.00 },
    ],
    'Copper': [
        { ga: 22, min: 0.000, max: 0.033, cost: 70.00  },
        { ga: 20, min: 0.033, max: 0.045, cost: 85.00  },
        { ga: 18, min: 0.045, max: 0.060, cost: 105.00 },
        { ga: 16, min: 0.060, max: 0.090, cost: 130.00 },
        { ga: 12, min: 0.090, max: 0.130, cost: 162.00 },
        { ga: null, min: 0.130, max: 0.190, cost: 202.00 },
        { ga: null, min: 0.190, max: 99,   cost: 265.00 },
    ],
    'Titanium': [
        { ga: 22, min: 0.000, max: 0.033, cost: 120.00 },
        { ga: 20, min: 0.033, max: 0.045, cost: 148.00 },
        { ga: 18, min: 0.045, max: 0.060, cost: 178.00 },
        { ga: 16, min: 0.060, max: 0.090, cost: 218.00 },
        { ga: 12, min: 0.090, max: 0.130, cost: 268.00 },
        { ga: null, min: 0.130, max: 0.190, cost: 328.00 },
        { ga: null, min: 0.190, max: 99,   cost: 425.00 },
    ],
};

// Fallback for any unexpected category (uses Steel costs)
const FALLBACK_FAMILY = 'Steel';

async function seed() {
    console.log('Seeding placeholder sheet cost rates...\n');

    try {
        // Only seed categories that actually have metals
        const catRes = await db.query(`
            SELECT DISTINCT mc.id, mc.name
            FROM metal_categories mc
            INNER JOIN metals m ON m.category_id = mc.id
            ORDER BY mc.name
        `);
        const categories = catRes.rows;

        if (categories.length === 0) {
            console.log('No metal categories found. Run seed_metals.js first.');
            process.exit(1);
        }

        console.log(`Found ${categories.length} categories: ${categories.map(c => c.name).join(', ')}\n`);

        let inserted = 0;
        let skipped  = 0;

        for (const cat of categories) {
            const rows = COSTS[cat.name] || COSTS[FALLBACK_FAMILY];

            // Check how many rows already exist for this family
            const existing = await db.query(
                'SELECT COUNT(*) FROM sheet_cost_rates WHERE family = $1',
                [cat.name]
            );
            const alreadyHas = parseInt(existing.rows[0].count);

            if (alreadyHas > 0) {
                console.log(`  ${cat.name}: ${alreadyHas} row(s) already exist — skipping`);
                skipped += rows.length;
                continue;
            }

            console.log(`  ${cat.name}:`);
            for (const row of rows) {
                await db.query(
                    `INSERT INTO sheet_cost_rates (family, min_thick, max_thick, ga, sheet_cost_4x8)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [cat.name, row.min, row.max, row.ga, row.cost]
                );
                const gaLabel = row.ga != null ? `GA${String(row.ga).padStart(2)}` : '   --';
                console.log(`    ✓ ${gaLabel}  ${String(row.min).padEnd(6)}" → ${String(row.max).padEnd(6)}"  $${row.cost.toFixed(2)}`);
                inserted++;
            }
        }

        console.log(`\n✅ Done! ${inserted} rows inserted, ${skipped} skipped (already had data).`);
        console.log('\n⚠️  These are PLACEHOLDER costs for testing only.');
        console.log('   Replace with real supplier quotes via Admin → Sheet Costs.\n');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

seed();

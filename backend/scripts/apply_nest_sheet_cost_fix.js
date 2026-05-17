const db = require('../db');

async function main() {
    await db.query(`
        ALTER TABLE sheet_cost_rates
        ADD COLUMN IF NOT EXISTS nest_sheet_cost_4x8 NUMERIC(10,4)
    `);

    await db.query(`
        UPDATE sheet_cost_rates
        SET sheet_cost_4x8 = $1,
            nest_sheet_cost_4x8 = $2,
            min_thick = $3,
            max_thick = $4,
            thickness = $5,
            updated_at = NOW()
        WHERE family = $6
          AND ga = $7
    `, [220, 260, 0.096, 0.110, 0.103, 'Aluminum', 12]);

    await db.query(`
        INSERT INTO sheet_cost_rates (family, ga, sheet_cost_4x8, min_thick, max_thick, thickness)
        SELECT $1::varchar, $2::integer, $3::numeric, $4::numeric, $5::numeric, $6::numeric
        WHERE NOT EXISTS (
            SELECT 1
            FROM sheet_cost_rates
            WHERE family = $1::varchar AND ga = $2::integer
        )
    `, ['Aluminum', 13, 220, 0.086, 0.095, 0.0905]);

    await db.query(`
        UPDATE sheet_cost_rates
        SET sheet_cost_4x8 = $1,
            nest_sheet_cost_4x8 = NULL,
            min_thick = $2,
            max_thick = $3,
            thickness = $4,
            updated_at = NOW()
        WHERE family = $5
          AND ga = $6
    `, [220, 0.086, 0.095, 0.0905, 'Aluminum', 13]);

    const result = await db.query(`
        SELECT family, ga, sheet_cost_4x8, nest_sheet_cost_4x8, min_thick, max_thick
        FROM sheet_cost_rates
        WHERE family = $1 AND ga IN ($2, $3)
        ORDER BY min_thick
    `, ['Aluminum', 12, 13]);

    console.log(JSON.stringify(result.rows, null, 2));
}

main()
    .catch((err) => {
        console.error(err.message);
        process.exitCode = 1;
    })
    .finally(() => db.pool.end());

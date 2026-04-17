const db = require('../db');

const GAUGE_DEFS = [
    { ga: 6, span: 0.04, factor: 1.18 },
    { ga: 5, span: 0.05, factor: 1.37 },
    { ga: 4, span: 0.06, factor: 1.58 },
    { ga: 3, span: 0.07, factor: 1.82 },
    { ga: 2, span: 0.08, factor: 2.10 },
    { ga: 1, span: 0.10, factor: 2.40 },
];

async function backfillLowGauges() {
    const familiesRes = await db.query('SELECT DISTINCT family FROM sheet_cost_rates ORDER BY family');
    let insertedRows = 0;

    for (const familyRow of familiesRes.rows) {
        const family = familyRow.family;

        const rowsRes = await db.query(
            'SELECT ga, min_thick, max_thick, sheet_cost_4x8 FROM sheet_cost_rates WHERE family = $1 ORDER BY max_thick ASC',
            [family]
        );
        const rows = rowsRes.rows;
        if (rows.length === 0) continue;

        const numericRows = rows.filter((r) => r.ga !== null).map((r) => ({
            ga: Number(r.ga),
            min: Number(r.min_thick),
            max: Number(r.max_thick),
            cost: Number(r.sheet_cost_4x8),
        }));

        if (numericRows.length === 0) continue;

        const existingGaugeSet = new Set(numericRows.map((r) => r.ga));

        let baseline = numericRows.find((r) => r.ga === 7);
        if (!baseline) {
            baseline = [...numericRows].sort((a, b) => a.ga - b.ga)[0];
        }

        let currentMin = baseline.max;
        const baselineCost = baseline.cost;

        for (const def of GAUGE_DEFS) {
            if (existingGaugeSet.has(def.ga)) {
                const existing = numericRows.find((r) => r.ga === def.ga);
                if (existing) {
                    currentMin = Math.max(currentMin, existing.max);
                }
                continue;
            }

            const nextMax = Number((currentMin + def.span).toFixed(6));
            const nextCost = Number((baselineCost * def.factor).toFixed(2));

            await db.query(
                `INSERT INTO sheet_cost_rates (family, min_thick, max_thick, ga, sheet_cost_4x8)
                 VALUES ($1, $2, $3, $4, $5)`,
                [family, currentMin, nextMax, def.ga, nextCost]
            );

            insertedRows += 1;
            currentMin = nextMax;
        }

        const hasPlateRow = rows.some((r) => r.ga === null && Number(r.max_thick) > currentMin + 0.000001);
        if (!hasPlateRow) {
            const plateCost = Number((baselineCost * 2.8).toFixed(2));
            await db.query(
                `INSERT INTO sheet_cost_rates (family, min_thick, max_thick, ga, sheet_cost_4x8)
                 VALUES ($1, $2, $3, $4, $5)`,
                [family, currentMin, 99, null, plateCost]
            );
            insertedRows += 1;
        }
    }

    console.log(`Inserted ${insertedRows} row(s).`);

    const verifyRes = await db.query(
        `SELECT family, ga, min_thick, max_thick, sheet_cost_4x8
         FROM sheet_cost_rates
         ORDER BY family, COALESCE(max_thick, min_thick) ASC`
    );
    console.log(JSON.stringify(verifyRes.rows, null, 2));
}

backfillLowGauges()
    .then(async () => {
        await db.pool.end();
        process.exit(0);
    })
    .catch(async (err) => {
        console.error('Backfill failed:', err.message);
        console.error(err.stack);
        await db.pool.end();
        process.exit(1);
    });

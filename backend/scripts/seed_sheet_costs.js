const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
});

const rawData = `
Aluminum	10	0	0.13	0.137
Aluminum	11	283	0.117	0.125
Aluminum	12	220	0.096	0.11
Aluminum	14	180	0.072	0.085
Aluminum	11	283	0.117	0.125
Aluminum	12	220	0.096	0.11
Aluminum	14	180	0.072	0.085
Aluminum	16	115	0.058	0.065
Aluminum	250	650	0.25	0.25
Aluminum	18	0	0.043	0.053
Carbon Steel	500	650	0.45	0.55
Carbon Steel	10	160	0.13	0.137
Carbon Steel	11	120	0.117	0.125
Carbon Steel	12	95	0.096	0.11
Carbon Steel	14	86	0.072	0.085
Carbon Steel	16	72	0.058	0.065
Carbon Steel	18	55	0.043	0.053
Stainless Steel	10	160	0.13	0.137
Stainless Steel	11	600	0.117	0.125
Stainless Steel	12	560	0.096	0.11
Stainless Steel	14	440	0.072	0.085
Stainless Steel	16	250	0.058	0.065
Stainless Steel	18	180	0.043	0.053
Steel	500	650	0.45	0.55
Steel	10	160	0.13	0.137
Steel	11	120	0.117	0.125
Steel	12	95	0.096	0.11
Steel	14	86	0.072	0.085
Steel	16	72	0.058	0.065
Steel	18	55	0.043	0.053
`;

async function seed() {
    try {
        console.log('Seeding sheet cost rates...');

        await pool.query('DELETE FROM sheet_cost_rates');
        console.log('Cleared existing sheet costs.');

        // Split by lines and filter out empty
        const lines = rawData.trim().split('\n');

        for (const line of lines) {
            const [family, ga, cost4x8, min, max] = line.split('\t');
            if (!family) continue;

            const thickness = (parseFloat(min) + parseFloat(max)) / 2;

            await pool.query(
                `INSERT INTO sheet_cost_rates (family, ga, sheet_cost_4x8, min_thick, max_thick, thickness)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    family,
                    parseInt(ga) || null,
                    parseFloat(cost4x8) || 0,
                    parseFloat(min) || 0,
                    parseFloat(max) || 0,
                    thickness
                ]
            );
            console.log(`Inserted: ${family} ${ga}ga (${min}"-${max}")`);
        }
        console.log('Seed complete!');
    } catch (err) {
        console.error('Seed failed:', err);
    } finally {
        await pool.end();
    }
}

seed();

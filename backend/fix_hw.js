require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'dmscnc',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
});

async function run() {
  const res = await pool.query('SELECT id, name FROM hardware_items WHERE hardware_type_id IN (1,2)');
  for (const row of res.rows) {
    let dia = 0.156; // M4 default
    if (row.name.includes('M5')) dia = 0.200;
    else if (row.name.includes('M6') || row.name.includes('1/4')) dia = 0.250;
    else if (row.name.includes('M3') || row.name.includes('4-40')) dia = 0.120;
    else if (row.name.includes('10-32') || row.name.includes('8-32')) dia = 0.190;

    await pool.query('UPDATE hardware_items SET tooling_diameter = $1 WHERE id = $2', [dia, row.id]);
  }
  console.log('Fixed DB sizes!');
  process.exit(0);
}
run();

const db = require('d:/Frontend/DMS/backend/db');
async function check() {
    try {
        const cols = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'hardware_items'");
        console.log('COLUMNS:', JSON.stringify(cols.rows.map(r => r.column_name)));
        const types = await db.query('SELECT * FROM hardware_types');
        console.log('TYPES:', JSON.stringify(types.rows));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();

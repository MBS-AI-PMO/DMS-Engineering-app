const db = require('../db');
async function check() {
    try {
        const res = await db.query("SELECT id, name, email, role, phone, address, created_at FROM users ORDER BY id");
        console.log('--- USERS TABLE ---');
        res.rows.forEach(row => {
            console.log(`[${row.id}] ${row.role} | ${row.email} | name: ${row.name} | phone: ${row.phone} | address: ${row.address}`);
        });

        // Check columns exist
        const cols = await db.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'users' AND column_name IN ('phone', 'address')
        `);
        console.log('\n--- phone/address columns ---');
        cols.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
    } catch (err) {
        console.error(err);
    } finally {
        await db.pool.end();
    }
}
check();

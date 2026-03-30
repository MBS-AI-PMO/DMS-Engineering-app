const db = require('./db');

async function checkSchema() {
    try {
        const tablesRes = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        const tables = tablesRes.rows.map(r => r.table_name);
        console.log('Tables:', tables.join(', '));

        // Specifically check for metal_configs
        if (tables.includes('metal_configs')) {
            const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'metal_configs'");
            console.log('metal_configs columns:', columns.rows.map(r => r.column_name).join(', '));
        } else {
            console.log('metal_configs table NOT FOUND!');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();

const db = require('./db');
const fs = require('fs');

async function checkSchema() {
    let output = '';
    const log = (msg) => {
        console.log(msg);
        output += msg + '\n';
    };

    try {
        log('--- Services Table ---');
        const services = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'services' ORDER BY ordinal_position");
        services.rows.forEach(c => log(`${c.column_name}: ${c.data_type}`));

        log('\n--- Metals Table ---');
        const metals = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'metals' ORDER BY ordinal_position");
        metals.rows.forEach(c => log(`${c.column_name}: ${c.data_type}`));

    } catch (err) {
        log('Error checking schema: ' + err.message);
    } finally {
        fs.writeFileSync('schema_info.txt', output);
        await db.pool.end();
    }
}

checkSchema();

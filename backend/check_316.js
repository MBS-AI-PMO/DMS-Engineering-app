const db = require('./db');

async function check316() {
    try {
        const result = await db.query("SELECT name, about_section, faqs FROM metals WHERE name LIKE '%316%'");
        console.log('Result:', JSON.stringify(result.rows[0], null, 2));
    } catch (err) {
        console.error(err.message);
    } finally {
        await db.pool.end();
    }
}

check316();

const db = require('./db');

async function checkMetal() {
    try {
        const result = await db.query("SELECT name, services, quick_look FROM metals LIMIT 1");
        console.log(JSON.stringify(result.rows[0], null, 2));
    } catch (err) {
        console.error(err.message);
    } finally {
        await db.pool.end();
    }
}

checkMetal();

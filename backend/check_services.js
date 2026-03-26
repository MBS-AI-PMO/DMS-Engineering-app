const db = require('./db');

async function checkServices() {
    try {
        const result = await db.query('SELECT * FROM services');
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkServices();

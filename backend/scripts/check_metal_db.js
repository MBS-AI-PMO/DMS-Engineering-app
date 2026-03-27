const db = require('../db');
async function check() {
    try {
        const res = await db.query("SELECT id, name, about_section, image_path FROM metals WHERE name = 'HOT ROLLED (A36)'");
        if (res.rows.length > 0) {
            console.log('--- METAL INFO ---');
            console.log('ID:', res.rows[0].id);
            console.log('Name:', res.rows[0].name);
            console.log('Image Path:', res.rows[0].image_path);
            console.log('--- ABOUT SECTION ---');
            console.log(JSON.stringify(res.rows[0].about_section, null, 2));
        } else {
            console.log('Metal "HOT ROLLED (A36)" not found');
        }
    } catch (err) {
        console.error(err);
    } finally {
        await db.pool.end();
    }
}
check();

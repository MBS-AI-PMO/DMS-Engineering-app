const path = require('path');
const db = require(path.join(__dirname, '..', 'backend', 'db'));

async function run() {
    try {
        const check = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'slug'");
        if (check.rows.length === 0) {
            await db.query('ALTER TABLE services ADD COLUMN slug VARCHAR(255) UNIQUE');
            console.log('Column slug added');
        } else {
            console.log('Column slug already exists');
        }

        const res = await db.query('SELECT id, title FROM services WHERE slug IS NULL');
        for (const row of res.rows) {
            const slug = row.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            await db.query('UPDATE services SET slug = $1 WHERE id = $2', [slug, row.id]);
            console.log(`Updated "${row.title}" to slug: ${slug}`);
        }
        console.log('Migration complete');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

run();

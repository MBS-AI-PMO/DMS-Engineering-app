const db = require('../db');

async function setHeroImage() {
    const heroImagePath = process.argv[2] || '/assets/hero-home.avif';

    try {
        await db.query(
            `
            INSERT INTO site_settings (key, value)
            VALUES ($1, $2)
            ON CONFLICT (key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
            `,
            ['hero_image', JSON.stringify(heroImagePath)]
        );

        console.log(`Hero image setting updated: ${heroImagePath}`);
    } catch (err) {
        console.error('Failed to update hero image setting:', err);
        process.exitCode = 1;
    } finally {
        await db.pool.end();
    }
}

setHeroImage();

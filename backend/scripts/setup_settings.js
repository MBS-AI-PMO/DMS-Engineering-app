const db = require('../db');

async function setupSettings() {
    try {
        console.log('--- Setting up site_settings table ---');

        // Create table
        await db.query(`
            CREATE TABLE IF NOT EXISTS site_settings (
                key VARCHAR(50) PRIMARY KEY,
                value JSONB DEFAULT '{}',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ Table site_settings ensured');

        // Initial footer contact data
        const footerContact = {
            address: '1234 Metal St, Precision City',
            email: 'info@dms-metals.com',
            phone: '+1 (555) 000-0000'
        };

        // Initial social links
        const socialLinks = [
            { platform: 'linkedin', url: 'https://linkedin.com', enabled: true },
            { platform: 'facebook', url: 'https://facebook.com', enabled: true },
            { platform: 'instagram', url: 'https://instagram.com', enabled: true }
        ];

        const heroImage = '/assets/hero-home.avif';

        // Insert / Update defaults
        await db.query(`
            INSERT INTO site_settings (key, value)
            VALUES ($1, $2), ($3, $4), ($5, $6)
            ON CONFLICT (key) DO NOTHING
        `, [
            'footer_contact', JSON.stringify(footerContact),
            'social_links', JSON.stringify(socialLinks),
            'hero_image', JSON.stringify(heroImage)
        ]);

        console.log('✓ Default settings initialized');

    } catch (err) {
        console.error('Error setting up settings:', err);
    } finally {
        await db.pool.end();
    }
}

setupSettings();

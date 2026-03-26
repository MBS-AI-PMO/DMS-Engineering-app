const bcrypt = require('bcryptjs');
const db = require('../db');

async function createAdmin() {
    const email = process.argv[2] || 'admin@dmsengineering.com';
    const password = process.argv[3] || 'admin123';
    const name = process.argv[4] || 'Admin';

    console.log(`Creating admin user: ${email}`);

    try {
        // Check if already exists
        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            console.log('⚠️  Admin user already exists. Updating password...');
            const hash = await bcrypt.hash(password, 12);
            await db.query('UPDATE users SET password_hash = $1, role = $2 WHERE email = $3', [hash, 'admin', email.toLowerCase()]);
            console.log('✅ Admin password updated.');
        } else {
            const hash = await bcrypt.hash(password, 12);
            await db.query(
                'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)',
                [email.toLowerCase(), hash, name, 'admin']
            );
            console.log('✅ Admin user created successfully.');
        }

        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        console.log(`   Role: admin`);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        await db.pool.end();
    }
}

createAdmin();

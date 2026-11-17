const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { notifyWelcome } = require('../emails');
const { route, ok, created, HttpError, badRequest, conflict, validate } = require('../helpers');

const router = express.Router();

// POST /api/users/register — Public registration
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, terms } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
        }
        if (!terms) {
            return res.status(400).json({ success: false, error: 'You must accept the Terms and Conditions' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
        }

        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, error: 'An account with this email already exists' });
        }

        const password_hash = await bcrypt.hash(password, 12);
        const result = await db.query(
            `INSERT INTO users (name, email, password_hash, role)
             VALUES ($1, $2, $3, 'user')
             RETURNING id, email, name, role, created_at`,
            [name.trim(), email.toLowerCase(), password_hash]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
        notifyWelcome(result.rows[0]);
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
    }
});

// GET /api/users/customers — Admin: list all customer (role=user) accounts
router.get('/customers', authenticate, requireAdmin, route('load the customers', async (req, res) => {
    const result = await db.query(
        `SELECT id, name, email, phone, address, created_at
         FROM users WHERE role = 'user'
         ORDER BY created_at DESC`
    );
    ok(res, result.rows);
}));

// GET /api/users/profile — Get own full profile
router.get('/profile', authenticate, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name, email, phone, address, role, created_at FROM users WHERE id = $1`,
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error fetching profile:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch profile' });
    }
});

// PUT /api/users/profile — Update own profile (name, phone, address)
router.put('/profile', authenticate, async (req, res) => {
    try {
        const { name, phone, address } = req.body;

        const result = await db.query(
            `UPDATE users
             SET name = COALESCE(NULLIF($1, ''), name),
                 phone = $2,
                 address = $3
             WHERE id = $4
             RETURNING id, name, email, phone, address, role`,
            [name || null, phone || null, address || null, req.user.id]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
});

// PUT /api/users/password — Change own password
router.put('/password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Current and new passwords are required' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
        }

        const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!valid) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }

        const password_hash = await bcrypt.hash(newPassword, 12);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, req.user.id]);

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('Error updating password:', err);
        res.status(500).json({ success: false, error: 'Failed to update password' });
    }
});

// ── Admin accounts (Admin > Admins) ─────────────────────────────────────
// Only role = 'admin' rows are listed, changed or deleted here.

const ADMIN_COLUMNS = 'id, email, name, role, created_at, updated_at';
const MIN_ADMIN_PASSWORD = 6;
const adminNotFound = () => new HttpError(404, 'Admin not found');

function adminPassword(value) {
    if (typeof value !== 'string') throw badRequest('Password must be text.');
    if (value.length < MIN_ADMIN_PASSWORD) throw badRequest(`Password must be at least ${MIN_ADMIN_PASSWORD} characters`);
    return value;
}

async function assertEmailFree(email, exceptId = null) {
    const dup = exceptId
        ? await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, exceptId])
        : await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (dup.rows.length) throw conflict('Email already in use');
}

// GET /api/users/admin — List all admin users
router.get('/admin', authenticate, requireAdmin, route('load the admins', async (req, res) => {
    const result = await db.query(`SELECT ${ADMIN_COLUMNS} FROM users WHERE role = 'admin' ORDER BY created_at`);
    ok(res, result.rows);
}));

// POST /api/users/admin — Create admin user
router.post('/admin', authenticate, requireAdmin, route('create the admin', async (req, res) => {
    const { name, email, password } = req.body || {};
    if (validate.blank(email) || validate.blank(password)) throw badRequest('Email and password are required');
    const address = validate.email(email, 'Email', { required: true });
    const plain = adminPassword(password);
    const displayName = validate.text(name, 'Name', { max: 120 }) || '';

    await assertEmailFree(address);
    const password_hash = await bcrypt.hash(plain, 10);
    const result = await db.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'admin')
         RETURNING id, email, name, role, created_at`,
        [displayName, address, password_hash]
    );
    created(res, result.rows[0]);
}));

// PUT /api/users/admin/:id — Update admin user (a blank password keeps the current one)
router.put('/admin/:id', authenticate, requireAdmin, route('update the admin', async (req, res) => {
    const id = validate.id(req.params.id, 'Admin');
    const { name, email, password } = req.body || {};

    const existing = await db.query("SELECT id FROM users WHERE id = $1 AND role = 'admin'", [id]);
    if (!existing.rows.length) throw adminNotFound();

    // A field left out (undefined/null) stays as it is (COALESCE below).
    const nextName = name === undefined || name === null ? null : (validate.text(name, 'Name', { max: 120 }) || '');
    const nextEmail = email === undefined || email === null ? null : validate.email(email, 'Email', { required: true });
    if (nextEmail) await assertEmailFree(nextEmail, id);

    const sets = ['name = COALESCE($1, name)', 'email = COALESCE($2, email)'];
    const params = [nextName, nextEmail];
    if (typeof password === 'string' && password.length > 0) {
        params.push(await bcrypt.hash(adminPassword(password), 10));
        sets.push(`password_hash = $${params.length}`);
    }
    params.push(id);
    const result = await db.query(
        `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${ADMIN_COLUMNS}`,
        params
    );
    ok(res, result.rows[0]);
}));

// DELETE /api/users/admin/:id — Delete admin user (not yourself, not the last one)
router.delete('/admin/:id', authenticate, requireAdmin, route('delete the admin', async (req, res) => {
    const id = validate.id(req.params.id, 'Admin');
    if (Number(req.user.id) === id) throw badRequest('You cannot delete your own account');

    const count = await db.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
    if (count.rows[0].count <= 1) throw badRequest('Cannot delete the last admin account');

    const result = await db.query("DELETE FROM users WHERE id = $1 AND role = 'admin' RETURNING email", [id]);
    if (!result.rows.length) throw adminNotFound();
    ok(res, undefined, { message: `Admin "${result.rows[0].email}" deleted` });
}));

module.exports = router;

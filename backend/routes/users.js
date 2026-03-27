const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

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
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
    }
});

// GET /api/users/customers — Admin: list all customer (role=user) accounts
router.get('/customers', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name, email, phone, address, created_at
             FROM users WHERE role = 'user'
             ORDER BY created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching customers:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch customers' });
    }
});

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

// GET /api/users/admin — List all admin users
router.get('/admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, email, name, role, created_at, updated_at
             FROM users WHERE role = 'admin'
             ORDER BY created_at`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching admins:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch admins' });
    }
});

// POST /api/users/admin — Create admin user
router.post('/admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
        }

        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, error: 'Email already in use' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const result = await db.query(
            `INSERT INTO users (name, email, password_hash, role)
             VALUES ($1, $2, $3, 'admin')
             RETURNING id, email, name, role, created_at`,
            [name || '', email.toLowerCase(), password_hash]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error creating admin:', err);
        res.status(500).json({ success: false, error: 'Failed to create admin' });
    }
});

// PUT /api/users/admin/:id — Update admin user
router.put('/admin/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const id = req.params.id;

        const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Admin not found' });
        }

        if (email) {
            const dup = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase(), id]);
            if (dup.rows.length > 0) {
                return res.status(409).json({ success: false, error: 'Email already in use' });
            }
        }

        let query, params;
        if (password && password.length > 0) {
            if (password.length < 6) {
                return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
            }
            const password_hash = await bcrypt.hash(password, 10);
            query = `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), password_hash = $3
                     WHERE id = $4 RETURNING id, email, name, role, created_at, updated_at`;
            params = [name, email?.toLowerCase(), password_hash, id];
        } else {
            query = `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email)
                     WHERE id = $3 RETURNING id, email, name, role, created_at, updated_at`;
            params = [name, email?.toLowerCase(), id];
        }

        const result = await db.query(query, params);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error updating admin:', err);
        res.status(500).json({ success: false, error: 'Failed to update admin' });
    }
});

// DELETE /api/users/admin/:id — Delete admin user
router.delete('/admin/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (req.user.id === id) {
            return res.status(400).json({ success: false, error: 'You cannot delete your own account' });
        }

        const count = await db.query("SELECT COUNT(*)::int as count FROM users WHERE role = 'admin'");
        if (count.rows[0].count <= 1) {
            return res.status(400).json({ success: false, error: 'Cannot delete the last admin account' });
        }

        const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING email', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Admin not found' });
        }
        res.json({ success: true, message: `Admin "${result.rows[0].email}" deleted` });
    } catch (err) {
        console.error('Error deleting admin:', err);
        res.status(500).json({ success: false, error: 'Failed to delete admin' });
    }
});

module.exports = router;

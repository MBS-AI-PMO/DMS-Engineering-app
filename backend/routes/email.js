const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { encrypt, getEmailConfig, testConnection, sendEmail } = require('../utils/email');

const router = express.Router();

// GET /api/email/config — Get current email config (password masked)
router.get('/config', authenticate, requireAdmin, async (req, res) => {
    try {
        const config = await getEmailConfig();
        if (!config) {
            return res.json({ success: true, data: null });
        }
        // Mask password
        const { password_encrypted, password_decrypted, ...safe } = config;
        res.json({ success: true, data: { ...safe, password_masked: '••••••••' } });
    } catch (err) {
        console.error('Error fetching email config:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch email config: ' + err.message });
    }
});

// POST /api/email/config — Upsert email config
router.post('/config', authenticate, requireAdmin, async (req, res) => {
    try {
        const { smtp_host, smtp_port, email, password, encryption_type, sender_name } = req.body;
        if (!smtp_host || !email) {
            return res.status(400).json({ success: false, error: 'SMTP host and email are required' });
        }

        const existing = await db.query('SELECT id FROM email_config LIMIT 1');

        if (existing.rows.length > 0) {
            // Update existing — only update password if provided
            const id = existing.rows[0].id;
            if (password) {
                const password_encrypted = encrypt(password);
                await db.query(
                    `UPDATE email_config SET smtp_host=$1, smtp_port=$2, email=$3, password_encrypted=$4, encryption_type=$5, sender_name=$6 WHERE id=$7`,
                    [smtp_host, smtp_port || 587, email, password_encrypted, encryption_type || 'TLS', sender_name || 'DMS Engineering', id]
                );
            } else {
                await db.query(
                    `UPDATE email_config SET smtp_host=$1, smtp_port=$2, email=$3, encryption_type=$4, sender_name=$5 WHERE id=$6`,
                    [smtp_host, smtp_port || 587, email, encryption_type || 'TLS', sender_name || 'DMS Engineering', id]
                );
            }
        } else {
            // Insert new — password required
            if (!password) {
                return res.status(400).json({ success: false, error: 'Password is required for initial setup' });
            }
            const password_encrypted = encrypt(password);
            await db.query(
                `INSERT INTO email_config (smtp_host, smtp_port, email, password_encrypted, encryption_type, sender_name)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [smtp_host, smtp_port || 587, email, password_encrypted, encryption_type || 'TLS', sender_name || 'DMS Engineering']
            );
        }

        res.json({ success: true, message: 'Email configuration saved' });
    } catch (err) {
        console.error('Error saving email config:', err);
        res.status(500).json({ success: false, error: 'Failed to save email config: ' + err.message });
    }
});

// POST /api/email/test — Test email connection
router.post('/test', authenticate, requireAdmin, async (req, res) => {
    try {
        await testConnection();
        res.json({ success: true, message: 'Connection successful! Email credentials are valid.' });
    } catch (err) {
        console.error('Email test failed:', err);
        res.status(400).json({ success: false, error: 'Connection failed: ' + err.message });
    }
});

// POST /api/email/test-send — Send an actual test email
router.post('/test-send', authenticate, requireAdmin, async (req, res) => {
    try {
        const config = await getEmailConfig();
        if (!config) {
            return res.status(400).json({ success: false, error: 'Email not configured. Set up SMTP first.' });
        }

        await sendEmail({
            to: config.email,
            subject: 'DMS Engineering - Test Email',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333;">Test Email from DMS Engineering</h2>
                    <p>This is a test email sent from the DMS admin panel.</p>
                    <p>If you received this, your email configuration is working correctly.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #888; font-size: 12px;">Sent at ${new Date().toISOString()}</p>
                </div>
            `,
        });

        res.json({ success: true, message: `Test email sent to ${config.email}` });
    } catch (err) {
        console.error('Test email send failed:', err);
        res.status(400).json({ success: false, error: err.message });
    }
});

// DELETE /api/email/config — Remove email config
router.delete('/config', authenticate, requireAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM email_config');
        res.json({ success: true, message: 'Email configuration removed' });
    } catch (err) {
        console.error('Error deleting email config:', err);
        res.status(500).json({ success: false, error: 'Failed to delete email config' });
    }
});

module.exports = router;

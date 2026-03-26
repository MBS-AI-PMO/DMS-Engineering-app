const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

const router = express.Router();

// POST /api/newsletter/subscribe — Public
router.post('/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'Valid email is required' });
        }

        // Upsert subscriber
        await db.query(
            `INSERT INTO newsletter_subscribers (email, status)
             VALUES ($1, 'active')
             ON CONFLICT (email) DO UPDATE SET status = 'active'`,
            [email.toLowerCase().trim()]
        );

        // Try to send welcome email (don't fail if email not configured)
        try {
            await sendEmail({
                to: email,
                subject: 'Welcome to DMS Engineering Newsletter!',
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;">
                        <h1 style="color:#0f172a;font-size:24px;">Welcome to DMS Engineering!</h1>
                        <p style="color:#475569;font-size:16px;line-height:1.6;">
                            Thank you for subscribing to our newsletter. You'll receive updates about our latest
                            services, materials, and industry insights.
                        </p>
                        <p style="color:#475569;font-size:16px;line-height:1.6;">
                            Stay tuned for exciting updates!
                        </p>
                        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
                        <p style="color:#94a3b8;font-size:12px;">DMS Engineering</p>
                    </div>
                `,
            });
        } catch (emailErr) {
            console.log('Welcome email not sent (email may not be configured):', emailErr.message);
        }

        res.json({ success: true, message: 'Successfully subscribed!' });
    } catch (err) {
        console.error('Error subscribing:', err);
        res.status(500).json({ success: false, error: 'Failed to subscribe' });
    }
});

// GET /api/newsletter/subscribers — Admin only
router.get('/subscribers', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC'
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching subscribers:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch subscribers' });
    }
});

// DELETE /api/newsletter/subscribers/:id — Admin only
router.delete('/subscribers/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM newsletter_subscribers WHERE id = $1 RETURNING email',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Subscriber not found' });
        }
        res.json({ success: true, message: `Subscriber "${result.rows[0].email}" removed` });
    } catch (err) {
        console.error('Error deleting subscriber:', err);
        res.status(500).json({ success: false, error: 'Failed to delete subscriber' });
    }
});

module.exports = router;

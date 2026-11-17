const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { notifyNewsletterWelcome } = require('../emails');
const { EMAIL_RE } = require('../emails/brand');
const { route, ok, HttpError, validate } = require('../helpers');

const router = express.Router();

// POST /api/newsletter/subscribe — Public
router.post('/subscribe', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!EMAIL_RE.test(email) || email.length > 200) {
            return res.status(400).json({ success: false, error: 'Valid email is required' });
        }

        // Upsert subscriber, noting whether they were already on the list.
        const result = await db.query(
            `WITH previous AS (SELECT status FROM newsletter_subscribers WHERE email = $1)
             INSERT INTO newsletter_subscribers (email, status)
             VALUES ($1, 'active')
             ON CONFLICT (email) DO UPDATE SET status = 'active'
             RETURNING (SELECT status FROM previous) AS previous_status`,
            [email]
        );

        res.json({ success: true, message: 'Successfully subscribed!' });

        // A welcome for new (or returning) subscribers only, so the form
        // cannot be used to send the same address email after email.
        if (result.rows[0]?.previous_status !== 'active') notifyNewsletterWelcome(email);
    } catch (err) {
        console.error('Error subscribing:', err);
        res.status(500).json({ success: false, error: 'Failed to subscribe' });
    }
});

// ── Admin > Subscribers ─────────────────────────────────────────────────

// GET /api/newsletter/subscribers — Admin only
router.get('/subscribers', authenticate, requireAdmin, route('load the subscribers', async (req, res) => {
    const result = await db.query('SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC');
    ok(res, result.rows);
}));

// DELETE /api/newsletter/subscribers/:id — Admin only
router.delete('/subscribers/:id', authenticate, requireAdmin, route('remove the subscriber', async (req, res) => {
    const id = validate.id(req.params.id, 'Subscriber');
    const result = await db.query('DELETE FROM newsletter_subscribers WHERE id = $1 RETURNING email', [id]);
    if (!result.rows.length) throw new HttpError(404, 'Subscriber not found');
    ok(res, undefined, { message: `Subscriber "${result.rows[0].email}" removed` });
}));

module.exports = router;

const express = require('express');
const db = require('../db');
const { sendEmail } = require('../utils/email');

const router = express.Router();

/*
 * POST /api/contact — Public.
 * Sends a website message to the inbox set in Admin > Contact ("Send website
 * messages to", site_settings.contact_form_recipients), else to the public
 * contact email (footer_contact.email), with reply-to set to the sender.
 *
 * Guards, since anyone can call it:
 * - a hidden "website" field people never fill; bots that fill it get a
 *   quiet success and nothing is sent;
 * - length caps on every field, a real-looking email, a message of at
 *   least 10 characters, no line breaks in name/email (header safety);
 * - every value HTML-escaped in the email body;
 * - at most 5 messages per sender per 15 minutes, and 60 per hour across
 *   the site (behind a proxy many people can share one address, so the
 *   site-wide cap is what bounds abuse).
 */

const WINDOW_MS = 15 * 60 * 1000;
const PER_SENDER = 5;
const SITE_WINDOW_MS = 60 * 60 * 1000;
const SITE_PER_HOUR = 60;

const recentBySender = new Map();
let recentSiteWide = [];

const senderKey = (req) => {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || req.ip || 'unknown';
};

const allowSend = (key) => {
    const now = Date.now();
    recentSiteWide = recentSiteWide.filter(t => now - t < SITE_WINDOW_MS);
    if (recentSiteWide.length >= SITE_PER_HOUR) return false;

    const mine = (recentBySender.get(key) || []).filter(t => now - t < WINDOW_MS);
    if (mine.length >= PER_SENDER) {
        recentBySender.set(key, mine);
        return false;
    }
    mine.push(now);
    recentBySender.set(key, mine);
    recentSiteWide.push(now);

    // Keep the map small.
    if (recentBySender.size > 5000) {
        for (const [k, times] of recentBySender) {
            if (!times.some(t => now - t < WINDOW_MS)) recentBySender.delete(k);
        }
    }
    return true;
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const clip = (value, max) => String(value ?? '').trim().slice(0, max);
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
const TOPICS = ['Quote question', 'Order help', 'Material or service question', 'File or design help', 'Something else'];

router.post('/', async (req, res) => {
    try {
        const body = req.body || {};

        if (clip(body.website, 200)) {
            return res.json({ success: true });
        }

        const name = clip(body.name, 120);
        const email = clip(body.email, 200).toLowerCase();
        const company = clip(body.company, 160);
        const topic = TOPICS.includes(clip(body.subject, 80)) ? clip(body.subject, 80) : 'General';
        const message = clip(body.message, 5000);

        if (!name || /[\r\n]/.test(name) || /[\r\n]/.test(email) || !EMAIL_RE.test(email) || message.length < 10) {
            return res.status(400).json({
                success: false,
                error: 'Please add your name, a valid email and a message of at least 10 characters.',
            });
        }

        if (!allowSend(senderKey(req))) {
            return res.status(429).json({ success: false, error: 'Too many messages. Please try again a little later.' });
        }

        const result = await db.query(
            "SELECT key, value FROM site_settings WHERE key IN ('contact_form_recipients', 'footer_contact')"
        );
        const stored = {};
        result.rows.forEach(r => {
            let value = r.value;
            if (typeof value === 'string' && r.key === 'footer_contact') {
                try { value = JSON.parse(value); } catch { value = null; }
            }
            stored[r.key] = value;
        });
        const inbox = String(stored.contact_form_recipients || '')
            .split(/[,;\s]+/).map(s => s.trim()).filter(e => EMAIL_RE.test(e)).slice(0, 5);
        const publicEmail = String(stored.footer_contact?.email || '').trim();
        const to = inbox.length ? inbox.join(', ') : (EMAIL_RE.test(publicEmail) ? publicEmail : null);
        if (!to) {
            return res.status(503).json({ success: false, error: 'Messages cannot be sent right now. Please email or call us instead.' });
        }

        const row = (label, value) => (value
            ? `<tr><td style="padding:6px 16px 6px 0;color:#5b5f68;vertical-align:top;white-space:nowrap;">${label}</td><td style="padding:6px 0;color:#0b0c0f;">${escapeHtml(value)}</td></tr>`
            : '');
        const html = `
            <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
                <h1 style="margin:0 0 16px;color:#0b0c0f;font-size:20px;">New message from the website</h1>
                <table style="border-collapse:collapse;font-size:14px;">
                    ${row('Name', name)}
                    ${row('Email', email)}
                    ${row('Company', company)}
                    ${row('Topic', topic)}
                </table>
                <div style="margin-top:16px;padding:16px;border:1px solid #e3e4e8;border-radius:8px;color:#0b0c0f;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>
                <p style="margin-top:16px;color:#8b8f98;font-size:12px;">Reply to this email to answer ${escapeHtml(name)} directly.</p>
            </div>
        `;

        await sendEmail({
            to,
            subject: `Website message: ${topic} from ${name}`.slice(0, 200),
            html,
            replyTo: { name: name.replace(/["\\]/g, ''), address: email },
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[Contact] Message not sent:', err.message);
        res.status(502).json({ success: false, error: 'Your message could not be sent. Please email or call us instead.' });
    }
});

module.exports = router;

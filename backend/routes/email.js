const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, badRequest, HttpError, validate } = require('../helpers');
const { encrypt, getEmailConfig, testConnection } = require('../utils/email');
const { TEMPLATES, renderTemplate, sendTemplate, getBrand } = require('../emails');

/*
 * Admin > Email Config: the SMTP account every site email is sent from, a
 * connection test, a test email, and previews of each email the site sends.
 * Mounted at /api/email; everything here is admin only.
 */

const router = express.Router();
router.use(authenticate, requireAdmin);

const ENCRYPTION_TYPES = ['TLS', 'SSL', 'NONE'];
const DEFAULT_SENDER = 'Dynamic Manufacturing Solutions';
const NOT_CONFIGURED = 'Email not configured. Set up SMTP first.';

/* Gmail shows app passwords as "abcd efgh ijkl mnop"; the spaces are not part of it. */
const GMAIL_APP_PASSWORD = /^[a-z]{4}( [a-z]{4}){3}$/i;
const cleanPassword = (password, host) => {
    const p = String(password || '');
    return /gmail\.com$/i.test(host) && GMAIL_APP_PASSWORD.test(p.trim()) ? p.replace(/\s+/g, '') : p;
};

async function requireConfig() {
    const config = await getEmailConfig();
    if (!config) throw badRequest(NOT_CONFIGURED);
    return config;
}

/* A template that has a sample (every one the site sends), or a 404. */
const templateOf = (key) => {
    const template = Object.prototype.hasOwnProperty.call(TEMPLATES, key) ? TEMPLATES[key] : null;
    if (!template?.sample) throw new HttpError(404, 'No such email template');
    return template;
};

// GET /api/email/config — the current config (password never sent)
router.get('/config', route('load the email settings', async (req, res) => {
    const config = await getEmailConfig();
    if (!config) return ok(res, null);
    const safe = { ...config };
    delete safe.password_encrypted;
    delete safe.password_decrypted;
    // password_unreadable: the page asks for the password again instead of failing to load.
    ok(res, { ...safe, password_masked: config.password_unreadable ? '' : '••••••••' });
}));

// POST /api/email/config — save it (a blank password keeps the saved one)
router.post('/config', route('save the email settings', async (req, res) => {
    const body = req.body || {};
    if (validate.blank(body.smtp_host) || validate.blank(body.email)) throw badRequest('SMTP host and email are required');
    const smtp_host = validate.text(body.smtp_host, 'SMTP host', { required: true, max: 255 });
    const email = validate.text(body.email, 'Email', { required: true, max: 255 });
    const smtp_port = validate.integer(body.smtp_port || 587, 'SMTP port', { min: 1, max: 65535 });
    const encryption_type = ENCRYPTION_TYPES.includes(body.encryption_type) ? body.encryption_type : 'TLS';
    const sender_name = validate.text(body.sender_name, 'Sender name', { max: 255 }) || DEFAULT_SENDER;
    const password = cleanPassword(body.password, smtp_host);

    const existing = await db.query('SELECT id FROM email_config ORDER BY id LIMIT 1');
    if (existing.rows.length) {
        const id = existing.rows[0].id;
        // A blank password keeps the saved one, unless that one can no longer be read.
        if (!password && (await getEmailConfig())?.password_unreadable) {
            throw badRequest("Enter the email password again: the saved one can't be read with this server's encryption key.");
        }
        if (password) {
            await db.query(
                'UPDATE email_config SET smtp_host=$1, smtp_port=$2, email=$3, password_encrypted=$4, encryption_type=$5, sender_name=$6, updated_at=NOW() WHERE id=$7',
                [smtp_host, smtp_port, email, encrypt(password), encryption_type, sender_name, id]
            );
        } else {
            await db.query(
                'UPDATE email_config SET smtp_host=$1, smtp_port=$2, email=$3, encryption_type=$4, sender_name=$5, updated_at=NOW() WHERE id=$6',
                [smtp_host, smtp_port, email, encryption_type, sender_name, id]
            );
        }
    } else {
        if (!password) throw badRequest('Password is required for initial setup');
        await db.query(
            `INSERT INTO email_config (smtp_host, smtp_port, email, password_encrypted, encryption_type, sender_name)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [smtp_host, smtp_port, email, encrypt(password), encryption_type, sender_name]
        );
    }
    ok(res, undefined, { message: 'Email configuration saved' });
}));

// DELETE /api/email/config — remove it (site emails stop)
router.delete('/config', route('remove the email settings', async (req, res) => {
    await db.query('DELETE FROM email_config');
    ok(res, undefined, { message: 'Email configuration removed' });
}));

// POST /api/email/test — log in to the mail server (sends nothing)
router.post('/test', route('test the email connection', async (req, res) => {
    try {
        await testConnection();
    } catch (err) {
        console.error('Email test failed:', err.message);
        throw badRequest(`Connection failed: ${err.message}`);
    }
    ok(res, undefined, { message: 'Connection successful! Email credentials are valid.' });
}));

/* Sends one email to the sending account; a mail problem is a 400 with its reason. */
async function sendToSelf(templateKey, data, config) {
    try {
        await sendTemplate(templateKey, data, { to: config.email });
    } catch (err) {
        console.error(`Email "${templateKey}" send failed:`, err.message);
        throw badRequest(err.message);
    }
}

// POST /api/email/test-send — send a test email to the sending account
router.post('/test-send', route('send the test email', async (req, res) => {
    const config = await requireConfig();
    await sendToSelf('test', { config }, config);
    ok(res, undefined, { message: `Test email sent to ${config.email}` });
}));

// GET /api/email/status — the last order email sent and the last that failed
router.get('/status', route('load the email status', async (req, res) => {
    const pick = (status) => db.query(
        `SELECT order_id, created_at, email_to, email_subject, email_error FROM order_events
         WHERE kind = 'email' AND email_status = $1 ORDER BY created_at DESC LIMIT 1`,
        [status]
    );
    let sent;
    let failed;
    try {
        [sent, failed] = await Promise.all([pick('sent'), pick('failed')]);
    } catch (err) {
        if (err.code === '42P01') return ok(res, { lastSent: null, lastFailed: null, failedSinceSent: 0 }); // no order log yet
        throw err;
    }
    const view = (row) => (row ? { orderId: row.order_id, at: row.created_at, to: row.email_to, subject: row.email_subject, error: row.email_error || null } : null);
    const lastSent = view(sent.rows[0]);
    const lastFailed = view(failed.rows[0]);
    const since = await db.query(
        `SELECT count(*)::int AS n FROM order_events WHERE kind = 'email' AND email_status = 'failed' AND created_at > COALESCE($1, '-infinity'::timestamp)`,
        [sent.rows[0]?.created_at || null]
    );
    // Failures newer than the last sent email only matter if the account still
    // fails now (they stay in the log after the password is fixed): ask the
    // mail server. accountWorks: true | false | null (no account / no answer).
    let failing = Boolean(lastFailed && (!lastSent || new Date(lastFailed.at) > new Date(lastSent.at)));
    let accountWorks = null;
    let accountError = null;
    if (failing) {
        const check = await checkAccount();
        accountWorks = check.ok;
        accountError = check.error;
        if (accountWorks) failing = false;
    }
    ok(res, { lastSent, lastFailed, failedSinceSent: since.rows[0].n, failing, accountWorks, accountError });
}));

/* Logs in to the mail server (sends nothing). Remembered for 5 minutes per saved account. */
let lastCheck = { key: null, at: 0, ok: null, error: null };
async function checkAccount() {
    const row = (await db.query('SELECT updated_at FROM email_config ORDER BY id DESC LIMIT 1')).rows[0];
    if (!row) return { ok: null, error: null };
    const key = new Date(row.updated_at).toISOString();
    if (lastCheck.key === key && Date.now() - lastCheck.at < 5 * 60 * 1000) return lastCheck;
    let timer;
    try {
        await Promise.race([
            testConnection(),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 12000); }),
        ]);
        lastCheck = { key, at: Date.now(), ok: true, error: null };
    } catch (err) {
        // No answer in time says nothing about the password: don't remember it.
        if (err.message === 'timeout') return { ok: null, error: null };
        lastCheck = { key, at: Date.now(), ok: false, error: err.message };
    } finally {
        clearTimeout(timer);
    }
    return lastCheck;
}

// ── Templates: what the site sends, previewed with sample data ──

// GET /api/email/templates — the emails the site sends
router.get('/templates', route('load the email list', (req, res) => {
    const data = Object.entries(TEMPLATES)
        .filter(([, t]) => t.sample)
        .map(([key, t]) => ({ key, label: t.label, audience: t.audience }));
    ok(res, data);
}));

// GET /api/email/preview/:template — one template rendered with sample data
router.get('/preview/:template', route('render this email', async (req, res) => {
    const template = templateOf(req.params.template);
    const brand = await getBrand();
    const { subject, html } = renderTemplate(req.params.template, template.sample(), brand, { preview: true });
    ok(res, { subject, html, from: brand.name, to: template.audience });
}));

// POST /api/email/send-sample — one template, with sample data, to the sending account
router.post('/send-sample', route('send the sample email', async (req, res) => {
    const key = String(req.body?.template || '');
    const template = templateOf(key);
    const config = await requireConfig();
    await sendToSelf(key, template.sample(), config);
    ok(res, undefined, { message: `Sample "${template.label}" sent to ${config.email}` });
}));

module.exports = router;

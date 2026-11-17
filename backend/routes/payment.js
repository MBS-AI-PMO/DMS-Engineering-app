const express = require('express');
const https = require('https');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { priceForSite } = require('./pricing');
const { priceCart } = require('../costing/checkout');
const { route, ok, fail, badRequest, validate, withTransaction, writeSetting } = require('../helpers');

const router = express.Router();

// ── Helpers ────────────────────────────────────────────────────────────────

function getSettingValue(rows, key, fallback = null) {
    const row = rows.find(r => r.key === key);
    if (!row) return fallback;
    try {
        const v = row.value;
        // value is stored as JSON string
        if (typeof v === 'string') return JSON.parse(v);
        return v;
    } catch {
        return row.value;
    }
}

async function getPaypalSettings() {
    const result = await db.query(
        `SELECT key, value FROM site_settings WHERE key LIKE 'payment_%'`
    );
    const rows = result.rows;
    return {
        cod_enabled: getSettingValue(rows, 'payment_cod_enabled', true),
        paypal_enabled: getSettingValue(rows, 'payment_paypal_enabled', false),
        paypal_mode: getSettingValue(rows, 'payment_paypal_mode', 'sandbox'),
        sandbox_client_id: getSettingValue(rows, 'payment_paypal_sandbox_client_id', ''),
        sandbox_secret: getSettingValue(rows, 'payment_paypal_sandbox_secret', ''),
        live_client_id: getSettingValue(rows, 'payment_paypal_live_client_id', ''),
        live_secret: getSettingValue(rows, 'payment_paypal_live_secret', ''),
    };
}

function paypalRequest(hostname, path, method, body, clientId, secret) {
    return new Promise((resolve, reject) => {
        const credentials = Buffer.from(`${clientId}:${secret}`).toString('base64');
        const bodyStr = body ? JSON.stringify(body) : null;

        const options = {
            hostname,
            path,
            method,
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': method === 'POST' && path.includes('oauth2')
                    ? 'application/x-www-form-urlencoded'
                    : 'application/json',
                ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (bodyStr) req.write(method === 'POST' && path.includes('oauth2') ? 'grant_type=client_credentials' : bodyStr);
        req.end();
    });
}

async function getPaypalAccessToken(mode, clientId, secret) {
    const hostname = mode === 'live' ? 'api-m.paypal.com' : 'api-m.sandbox.paypal.com';
    const result = await paypalRequest(hostname, '/v1/oauth2/token', 'POST', null, clientId, secret);
    if (result.status !== 200 || !result.body.access_token) {
        throw new Error(result.body.error_description || 'Invalid PayPal credentials');
    }
    return { token: result.body.access_token, hostname };
}

function paypalAuthRequest(hostname, path, method, body, accessToken) {
    return new Promise((resolve, reject) => {
        const bodyStr = body ? JSON.stringify(body) : null;
        const options = {
            hostname,
            path,
            method,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

// ── Routes ─────────────────────────────────────────────────────────────────

// GET /api/payment/config — Public (checkout needs enabled methods + client IDs, never secrets)
router.get('/config', route('load the payment settings', async (req, res) => {
    const s = await getPaypalSettings();
    const mode = s.paypal_mode;
    const clientId = mode === 'live' ? s.live_client_id : s.sandbox_client_id;
    ok(res, {
        cod_enabled: s.cod_enabled,
        paypal_enabled: s.paypal_enabled,
        paypal_mode: mode,
        paypal_client_id: clientId || '',
    });
}));

// ── Admin > Payment methods ──
// Every payment setting (secrets included) and where each is stored.
const PAYMENT_SETTING_KEYS = {
    cod_enabled: 'payment_cod_enabled',
    paypal_enabled: 'payment_paypal_enabled',
    paypal_mode: 'payment_paypal_mode',
    sandbox_client_id: 'payment_paypal_sandbox_client_id',
    sandbox_secret: 'payment_paypal_sandbox_secret',
    live_client_id: 'payment_paypal_live_client_id',
    live_secret: 'payment_paypal_live_secret',
};
const PAYPAL_MODES = ['sandbox', 'live'];
const credential = (value, label) => validate.text(value, label, { max: 300 }) || '';

// GET /api/payment/admin/settings — Admin only: the whole payment set-up
router.get('/admin/settings', authenticate, requireAdmin, route('load the payment settings', async (req, res) => {
    ok(res, await getPaypalSettings());
}));

// PUT /api/payment/admin/settings — Admin only: save it in one go.
// At least one method stays on; PayPal needs the keys of the mode it runs in.
router.put('/admin/settings', authenticate, requireAdmin, route('save the payment settings', async (req, res) => {
    const body = req.body || {};
    const next = {
        cod_enabled: validate.bool(body.cod_enabled, false),
        paypal_enabled: validate.bool(body.paypal_enabled, false),
        paypal_mode: validate.oneOf(body.paypal_mode, PAYPAL_MODES, 'PayPal mode'),
        sandbox_client_id: credential(body.sandbox_client_id, 'Sandbox client ID'),
        sandbox_secret: credential(body.sandbox_secret, 'Sandbox secret'),
        live_client_id: credential(body.live_client_id, 'Live client ID'),
        live_secret: credential(body.live_secret, 'Live secret'),
    };
    if (!next.cod_enabled && !next.paypal_enabled) fail('Keep at least one payment method on, or customers cannot check out.');
    if (next.paypal_enabled && !(next[`${next.paypal_mode}_client_id`] && next[`${next.paypal_mode}_secret`])) {
        fail(`Enter the ${next.paypal_mode} client ID and secret before turning PayPal on.`);
    }
    await withTransaction(async (client) => {
        for (const [field, settingKey] of Object.entries(PAYMENT_SETTING_KEYS)) await writeSetting(settingKey, next[field], client);
    });
    ok(res, await getPaypalSettings());
}));

// POST /api/payment/test-paypal — Admin only: validate PayPal credentials
router.post('/test-paypal', authenticate, requireAdmin, route('test the PayPal keys', async (req, res) => {
    const { mode, client_id, secret } = req.body || {};
    if (!client_id || !secret) throw badRequest('Client ID and Secret are required');
    if (!PAYPAL_MODES.includes(mode)) throw badRequest('Mode must be sandbox or live');
    try {
        await getPaypalAccessToken(mode, client_id, secret);
    } catch (err) {
        console.error('PayPal key test failed:', err.message);
        throw badRequest(err.message || 'PayPal credentials are invalid');
    }
    ok(res, undefined, { message: `PayPal ${mode} credentials are valid` });
}));

// POST /api/payment/paypal/create-order — Authenticated users
// Body: { items } (the cart). The amount is the server's price for those
// items; the priced cart is kept with the PayPal order id so the order that
// follows uses exactly what was paid.
router.post('/paypal/create-order', authenticate, async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    const currency = 'USD';

    if (!items || !items.length) {
        return res.status(400).json({ success: false, error: 'Your cart is empty. Please refresh the page and try again.' });
    }

    let priced;
    try {
        priced = await priceCart(items, priceForSite);
    } catch (err) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({ success: false, error: statusCode >= 500 ? 'Failed to price your cart' : err.message });
    }
    if (priced.quoteRequired.length) {
        return res.status(409).json({ success: false, code: 'QUOTE_REQUIRED', error: 'Some parts need a quote before they can be ordered.', items: priced.quoteRequired });
    }
    if (priced.changed.length) {
        return res.status(409).json({ success: false, code: 'PRICE_CHANGED', error: 'Some prices have changed. Please review your cart.', items: priced.changed, total: priced.total });
    }
    const amount = priced.total;
    if (!(amount > 0)) {
        return res.status(400).json({ success: false, error: 'Your cart total is $0.' });
    }

    try {
        const s = await getPaypalSettings();
        if (!s.paypal_enabled) {
            return res.status(400).json({ success: false, error: 'PayPal is not enabled' });
        }

        const clientId = s.paypal_mode === 'live' ? s.live_client_id : s.sandbox_client_id;
        const secret = s.paypal_mode === 'live' ? s.live_secret : s.sandbox_secret;

        if (!clientId || !secret) {
            return res.status(500).json({ success: false, error: 'PayPal credentials not configured' });
        }

        const { token, hostname } = await getPaypalAccessToken(s.paypal_mode, clientId, secret);

        const orderBody = {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: currency,
                    value: parseFloat(amount).toFixed(2),
                },
            }],
        };

        const result = await paypalAuthRequest(hostname, '/v2/checkout/orders', 'POST', orderBody, token);

        if (result.status !== 201) {
            throw new Error(result.body.message || 'Failed to create PayPal order');
        }

        await db.query(
            `INSERT INTO payment_checkout_sessions (provider, provider_order_id, user_id, items_hash, priced_lines, amount, currency)
             VALUES ('paypal', $1, $2, $3, $4, $5, $6)`,
            [result.body.id, req.user?.id || null, priced.hash, JSON.stringify(priced.lines), amount, currency]
        );

        res.json({ success: true, orderID: result.body.id, amount });
    } catch (err) {
        console.error('PayPal create-order error:', err);
        res.status(500).json({ success: false, error: err.message || 'Failed to create PayPal order' });
    }
});

// POST /api/payment/paypal/capture-order — Authenticated users
router.post('/paypal/capture-order', authenticate, async (req, res) => {
    const { orderID } = req.body;

    if (!orderID) {
        return res.status(400).json({ success: false, error: 'orderID is required' });
    }

    try {
        // Only a payment this site created, for this account, and only once.
        const found = await db.query('SELECT * FROM payment_checkout_sessions WHERE provider_order_id = $1', [String(orderID)]);
        const session = found.rows[0];
        if (!session) {
            return res.status(400).json({ success: false, error: 'This payment was not started here. Please try again.' });
        }
        if (session.user_id && Number(session.user_id) !== Number(req.user?.id)) {
            return res.status(403).json({ success: false, error: 'This payment belongs to another account.' });
        }
        if (session.status !== 'created') {
            return res.status(409).json({ success: false, error: 'This payment has already been completed.' });
        }

        const s = await getPaypalSettings();
        const clientId = s.paypal_mode === 'live' ? s.live_client_id : s.sandbox_client_id;
        const secret = s.paypal_mode === 'live' ? s.live_secret : s.sandbox_secret;

        const { token, hostname } = await getPaypalAccessToken(s.paypal_mode, clientId, secret);
        const result = await paypalAuthRequest(hostname, `/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`, 'POST', {}, token);

        if (result.status !== 201 && result.status !== 200) {
            throw new Error(result.body.message || 'Failed to capture PayPal order');
        }

        const capture = result.body.purchase_units?.[0]?.payments?.captures?.[0];
        const captured = Number(capture?.amount?.value);
        if (!capture?.id || !Number.isFinite(captured) || Math.abs(captured - Number(session.amount)) > 0.005) {
            console.error(`[PayPal] Captured ${capture?.amount?.value} for session ${session.id}, expected ${session.amount}`);
            return res.status(400).json({ success: false, error: 'The amount paid does not match the order. Please contact us.' });
        }
        await db.query(
            "UPDATE payment_checkout_sessions SET status = 'captured', provider_capture_id = $1, updated_at = NOW() WHERE id = $2",
            [capture.id, session.id]
        );
        res.json({
            success: true,
            paymentId: capture?.id || orderID,
            status: capture?.status || result.body.status,
        });
    } catch (err) {
        console.error('PayPal capture-order error:', err);
        res.status(500).json({ success: false, error: err.message || 'Failed to capture PayPal order' });
    }
});

module.exports = router;

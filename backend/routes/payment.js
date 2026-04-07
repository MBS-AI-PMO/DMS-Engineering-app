const express = require('express');
const https = require('https');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

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
router.get('/config', async (req, res) => {
    try {
        const s = await getPaypalSettings();
        const mode = s.paypal_mode;
        const clientId = mode === 'live' ? s.live_client_id : s.sandbox_client_id;

        res.json({
            success: true,
            data: {
                cod_enabled: s.cod_enabled,
                paypal_enabled: s.paypal_enabled,
                paypal_mode: mode,
                paypal_client_id: clientId || '',
            },
        });
    } catch (err) {
        console.error('Error fetching payment config:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch payment config' });
    }
});

// POST /api/payment/test-paypal — Admin only: validate PayPal credentials
router.post('/test-paypal', authenticate, requireAdmin, async (req, res) => {
    const { mode, client_id, secret } = req.body;

    if (!client_id || !secret) {
        return res.status(400).json({ success: false, error: 'Client ID and Secret are required' });
    }
    if (!['sandbox', 'live'].includes(mode)) {
        return res.status(400).json({ success: false, error: 'Mode must be sandbox or live' });
    }

    try {
        await getPaypalAccessToken(mode, client_id, secret);
        res.json({ success: true, message: `PayPal ${mode} credentials are valid` });
    } catch (err) {
        console.error('PayPal key test failed:', err);
        res.status(400).json({ success: false, error: err.message || 'PayPal credentials are invalid' });
    }
});

// POST /api/payment/paypal/create-order — Authenticated users
router.post('/paypal/create-order', authenticate, async (req, res) => {
    const { amount, currency = 'USD' } = req.body;

    if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ success: false, error: 'Valid amount is required' });
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

        res.json({ success: true, orderID: result.body.id });
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
        const s = await getPaypalSettings();
        const clientId = s.paypal_mode === 'live' ? s.live_client_id : s.sandbox_client_id;
        const secret = s.paypal_mode === 'live' ? s.live_secret : s.sandbox_secret;

        const { token, hostname } = await getPaypalAccessToken(s.paypal_mode, clientId, secret);
        const result = await paypalAuthRequest(hostname, `/v2/checkout/orders/${orderID}/capture`, 'POST', {}, token);

        if (result.status !== 201 && result.status !== 200) {
            throw new Error(result.body.message || 'Failed to capture PayPal order');
        }

        const capture = result.body.purchase_units?.[0]?.payments?.captures?.[0];
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

/*
 * Quote requests from customers: parts the site could not price instantly.
 * Mounted at /api/quote-requests.
 *
 *   POST /        public (signed-in customers are linked to the request)
 *   GET  /mine    the signed-in customer's own requests (My orders)
 *
 * Guards on the public POST, since anyone can call it: a hidden "website"
 * field people never fill (bots that fill it get a quiet success and
 * nothing is saved); length caps on every field; the file must be one the
 * site stored (temp_uploads/ or uploads/orders/); at most 5 requests per
 * sender per 15 minutes and 60 per hour across the site.
 */
const express = require('express');
const db = require('../db');
const { authenticate, optionalUser: authOptionalUser } = require('../middleware/auth');
const { route, ok, created, HttpError, withTransaction, validate } = require('../helpers');
const {
    SOURCES, reference, cleanConfiguration, cleanReasons, cleanPricingInput, sourceFile, displayName,
    storeQuoteFile, removeQuoteFiles, addEvent, customerView, notifyNewRequest,
} = require('../quotes/service');
const { createRateLimit, senderKey } = require('../quotes/rateLimit');

const router = express.Router();

// At most 5 requests per sender per 15 minutes, 60 an hour across the site.
const limit = createRateLimit({ perSender: 5, windowMs: 15 * 60 * 1000, siteMax: 60, siteWindowMs: 60 * 60 * 1000 });
const TOO_MANY = 'You have sent several quote requests in a short time. Please wait a few minutes and try again, or contact us directly.';

// A signed-in customer, if the request carries a valid token.
const optionalUser = (req) => authOptionalUser(req);

const singleLine = (value, label, opts) => {
    const s = validate.text(value, label, opts);
    if (s && /[\r\n]/.test(s)) throw new HttpError(400, `${label} must be on one line.`);
    return s;
};

// ── Create ──────────────────────────────────────────────────────────────

router.post('/', route('send the quote request', async (req, res) => {
    const body = req.body || {};
    if (validate.text(body.website, 'Website', { max: 500 })) return created(res, { id: null, reference: null, status: 'new' });

    const key = senderKey(req);
    if (!limit.allows(key)) throw new HttpError(429, TOO_MANY);

    const name = singleLine(body.name, 'Your name', { required: true, max: 120 });
    const email = validate.email(body.email, 'Email', { required: true });
    const phone = singleLine(body.phone, 'Phone', { max: 50 });
    const company = singleLine(body.company, 'Company', { max: 160 });
    const message = validate.text(body.message, 'Notes', { max: 5000 });
    const quantity = validate.integer(body.quantity, 'Quantity', { required: true, min: 1, max: 1000000 });
    const src = sourceFile(body.file_ref);
    const fileName = singleLine(body.file_name, 'File name', { max: 255 }) || displayName(src);
    const configuration = cleanConfiguration(body.configuration);
    const pricingInput = cleanPricingInput(body.pricing_input);
    const reasons = cleanReasons(body.reasons);
    const source = SOURCES.includes(body.source) ? body.source : null;
    const user = optionalUser(req);

    let quoteId = null;
    try {
        const row = await withTransaction(async (client) => {
            const inserted = await client.query(
                `INSERT INTO quote_requests (user_id, name, email, phone, company, message, quantity, file_name, source,
                                             configuration_json, pricing_input, reasons)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
                [user?.id || null, name, email, phone, company, message, quantity, fileName, source,
                    JSON.stringify(configuration), pricingInput ? JSON.stringify(pricingInput) : null, JSON.stringify(reasons)]
            );
            quoteId = inserted.rows[0].id;
            const file = await storeQuoteFile(quoteId, src, fileName);
            const updated = await client.query(
                'UPDATE quote_requests SET file_path = $1, file_size = $2 WHERE id = $3 RETURNING *',
                [file.path, file.size, quoteId]
            );
            await addEvent(quoteId, {
                kind: 'created',
                title: `Request sent from the ${source === 'cart' ? 'cart' : 'quote page'}`,
                actor: email,
            }, client);
            return updated.rows[0];
        });
        limit.record(key);
        notifyNewRequest(row.id);
        created(res, { id: row.id, reference: reference(row.id), status: row.status, email: row.email });
    } catch (err) {
        if (quoteId) await removeQuoteFiles(quoteId);
        throw err;
    }
}));

// ── The customer's own requests ─────────────────────────────────────────

router.get('/mine', authenticate, route('load your quote requests', async (req, res) => {
    // Requests made while signed in, and ones sent as a guest with the same email.
    const result = await db.query(
        `SELECT * FROM quote_requests
         WHERE user_id = $1 OR (user_id IS NULL AND LOWER(email) = LOWER($2))
         ORDER BY created_at DESC
         LIMIT 200`,
        [req.user.id, req.user.email || '']
    );
    ok(res, result.rows.map(customerView));
}));

module.exports = router;

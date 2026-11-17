/*
 * Admin > Quotes: quote requests for parts the site could not price
 * instantly. Mounted at /api/admin/quotes.
 *
 *   GET    /                    list, with counts by status
 *   GET    /:id                 one request: customer, part, file, activity
 *   PUT    /:id/status          { status, note? }
 *   POST   /:id/reply           { unit_price, quantity, lead_time, message, notify } -> "quote-reply" email, status quoted
 *   POST   /:id/notes           { text }   internal note
 *   DELETE /:id/notes/:eventId
 *   DELETE /:id                 the request and its file
 *   GET    /:id/file            the customer's file, as a download
 */
const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, one, notFound, badRequest, resolveUpload, validate } = require('../helpers');
const {
    STATUS_LABELS, reference, round2, parseJson, fileInfo, listView, answerOf, addEvent, emailReply, removeQuoteFiles,
} = require('../quotes/service');

const router = express.Router();
router.use(authenticate, requireAdmin);

const actorOf = (req) => req.user?.email || null;
const STATUSES = Object.keys(STATUS_LABELS);

async function requireQuote(id, client = db) {
    return one(await client.query('SELECT * FROM quote_requests WHERE id = $1', [id]), 'Quote request');
}

/* Everything the request page shows. */
async function detailView(row) {
    const [events, account, file] = await Promise.all([
        db.query('SELECT * FROM quote_request_events WHERE quote_request_id = $1 ORDER BY created_at DESC, id DESC', [row.id]),
        row.user_id
            ? db.query(`SELECT u.id, u.name, u.email, u.phone, u.created_at,
                               (SELECT count(*)::int FROM orders WHERE user_id = u.id) AS order_count,
                               (SELECT count(*)::int FROM quote_requests WHERE user_id = u.id) AS quote_count
                        FROM users u WHERE u.id = $1`, [row.user_id])
            : Promise.resolve({ rows: [] }),
        fileInfo(row),
    ]);
    return {
        quote: {
            ...listView(row),
            message: row.message,
            configuration: parseJson(row.configuration_json, {}) || {},
            pricing_input: parseJson(row.pricing_input, null),
            reply_message: row.reply_message,
            answer: answerOf(row),
        },
        file,
        account: account.rows[0] || null,
        events: events.rows,
        statuses: STATUS_LABELS,
    };
}

// ── List ────────────────────────────────────────────────────────────────

router.get('/', route('load the quote requests', async (req, res) => {
    const rows = await db.query(`
        SELECT q.*, u.name AS account_name
        FROM quote_requests q
        LEFT JOIN users u ON u.id = q.user_id
        ORDER BY q.created_at DESC`);
    const counts = Object.fromEntries(STATUSES.map(s => [s, 0]));
    rows.rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    ok(res, rows.rows.map(listView), { counts: { all: rows.rowCount, ...counts }, statuses: STATUS_LABELS });
}));

// ── One request ─────────────────────────────────────────────────────────

router.get('/:id', route('load the quote request', async (req, res) => {
    const row = await requireQuote(validate.id(req.params.id, 'Quote request'));
    ok(res, await detailView(row));
}));

router.put('/:id/status', route('change the status', async (req, res) => {
    const id = validate.id(req.params.id, 'Quote request');
    const status = validate.oneOf(req.body?.status, STATUSES, 'Status');
    const note = validate.text(req.body?.note, 'Note', { max: 4000 });
    const before = await requireQuote(id);
    if (before.status === status && !note) return ok(res, { status, changed: false });
    if (before.status !== status) {
        await db.query('UPDATE quote_requests SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
    }
    await addEvent(id, {
        kind: 'status',
        title: before.status === status ? `Note (still ${STATUS_LABELS[status]})` : `Status changed to ${STATUS_LABELS[status]}`,
        body: note,
        status_from: before.status,
        status_to: status,
        actor: actorOf(req),
    });
    ok(res, { status, changed: before.status !== status });
}));

router.post('/:id/reply', route('send the quote', async (req, res) => {
    const id = validate.id(req.params.id, 'Quote request');
    const before = await requireQuote(id);
    const body = req.body || {};
    const unitPrice = validate.number(body.unit_price, 'Price per part', { required: true, min: 0.01, max: 10000000 });
    const quantity = validate.integer(body.quantity, 'Quantity', { min: 1, max: 1000000 }) || before.quantity;
    const leadTime = validate.text(body.lead_time, 'Lead time', { max: 120 });
    const message = validate.text(body.message, 'Message', { max: 8000 });
    const notify = validate.bool(body.notify, true);
    if (/[\r\n]/.test(leadTime || '')) throw badRequest('Lead time must be on one line.');

    const unit = round2(unitPrice);
    const total = round2(unit * quantity);
    const updated = await db.query(
        `UPDATE quote_requests
         SET quoted_unit_price = $1, quoted_quantity = $2, quoted_total = $3, lead_time = $4, reply_message = $5,
             quoted_at = NOW(), status = 'quoted', updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [unit, quantity, total, leadTime, message, id]
    );
    const money = (n) => `$${Number(n).toFixed(2)}`;
    await addEvent(id, {
        kind: 'reply',
        title: `Quoted ${money(unit)} each × ${quantity} = ${money(total)}${leadTime ? `, ${leadTime}` : ''}`,
        body: message,
        status_from: before.status,
        status_to: 'quoted',
        actor: actorOf(req),
    });
    const email = notify ? await emailReply(id, { actor: actorOf(req) }) : { status: 'skipped' };
    ok(res, { ...(await detailView(updated.rows[0])), email });
}));

// ── Internal notes ──────────────────────────────────────────────────────

router.post('/:id/notes', route('save the note', async (req, res) => {
    const id = validate.id(req.params.id, 'Quote request');
    await requireQuote(id);
    const text = validate.text(req.body?.text, 'Note', { required: true, max: 4000 });
    ok(res, await addEvent(id, { kind: 'note', title: 'Internal note', body: text, actor: actorOf(req) }));
}));

router.delete('/:id/notes/:eventId', route('delete the note', async (req, res) => {
    const id = validate.id(req.params.id, 'Quote request');
    const eventId = validate.id(req.params.eventId, 'Note');
    const r = await db.query("DELETE FROM quote_request_events WHERE id = $1 AND quote_request_id = $2 AND kind = 'note' RETURNING id", [eventId, id]);
    if (!r.rowCount) throw notFound('Note');
    ok(res);
}));

// ── Delete ──────────────────────────────────────────────────────────────

router.delete('/:id', route('delete the quote request', async (req, res) => {
    const id = validate.id(req.params.id, 'Quote request');
    const r = await db.query('DELETE FROM quote_requests WHERE id = $1 RETURNING id', [id]);
    if (!r.rowCount) throw notFound('Quote request');
    await removeQuoteFiles(id);
    ok(res, { id, reference: reference(id) });
}));

// ── The customer's file ─────────────────────────────────────────────────

router.get('/:id/file', route('download the file', async (req, res) => {
    const row = await requireQuote(validate.id(req.params.id, 'Quote request'));
    const abs = resolveUpload(row.file_path);
    const info = abs ? await fileInfo(row) : null;
    if (!info?.exists) throw notFound('File');
    res.setHeader('Cache-Control', 'no-store');
    res.download(abs, row.file_name || info.name, (err) => {
        if (err && !res.headersSent) res.status(500).json({ success: false, error: 'Could not send the file.' });
    });
}));

module.exports = router;

/*
 * Order actions shared by the admin order page and the older status route:
 * changing status (with the customer email and the activity log), sending
 * logged emails, and what a customer may see of shipments and photos.
 */
const db = require('../db');
const { HttpError } = require('../helpers/http');
const { sendOrderEmail, STATUSES_TO_ANNOUNCE } = require('../emails');
const { carrierLabel, carrierByKey, trackingUrlFor, dayString } = require('./carriers');

const STATUS_LABELS = {
    pending: 'Pending review',
    processing: 'In production',
    shipping: 'Shipped',
    completed: 'Completed',
    rejected: 'Rejected',
};

// An HttpError, so the shared route() wrapper answers it as a 4xx too.
class OrderInputError extends HttpError {
    constructor(message, status = 400) {
        super(status, message);
    }
}

async function addEvent(orderId, ev, client = db) {
    const res = await client.query(
        `INSERT INTO order_events (order_id, kind, title, body, status_from, status_to, email_to, email_subject,
                                   email_status, email_error, customer_visible, actor_email)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [orderId, ev.kind, String(ev.title).slice(0, 300), ev.body || null, ev.status_from || null, ev.status_to || null,
            ev.email_to || null, ev.email_subject || null, ev.email_status || null, ev.email_error || null,
            Boolean(ev.customer_visible), ev.actor || null]
    );
    return res.rows[0];
}

const wait = (ms, value) => new Promise(resolve => { setTimeout(() => resolve(value), ms); });

/* Sends an order email and records it in the activity log. Waits up to
 * waitMs for the mail server so the admin sees "sent" or the reason it
 * failed; a slower server finishes in the background and the log row is
 * updated then. Never throws for a mail problem. */
async function emailAndLog(orderId, templateName, data, { actor, title, body = null, attachments = [], waitMs = 15000 } = {}) {
    let prepared;
    try {
        prepared = await sendOrderEmail(orderId, templateName, data, { attachments });
    } catch (err) {
        const event = await addEvent(orderId, { kind: 'email', title, body, email_status: 'failed', email_error: err.message, actor });
        return { status: 'failed', error: err.message, event };
    }
    const event = await addEvent(orderId, {
        kind: 'email', title, body, email_to: prepared.to, email_subject: prepared.subject, email_status: 'sending', actor,
    });
    const settled = prepared.sending.then(() => ({ status: 'sent' }), err => ({ status: 'failed', error: err.message }));
    settled
        .then(r => db.query('UPDATE order_events SET email_status = $1, email_error = $2 WHERE id = $3', [r.status, r.error || null, event.id]))
        .catch(err => console.error(`[Orders] could not record email result for order #${orderId}: ${err.message}`));
    const result = await Promise.race([settled, wait(waitMs, { status: 'sending' })]);
    return { ...result, to: prepared.to, subject: prepared.subject };
}

/* status: one of STATUS_LABELS. note: a message to the customer, shown in
 * the email and on their order page. notify: email the customer (only the
 * steps customers hear about; "pending" never sends). */
async function changeStatus(orderId, { status, notify = true, note = '', actor = null }) {
    if (!STATUS_LABELS[status]) throw new OrderInputError(`Unknown status "${status}".`);
    const cleanNote = String(note || '').trim().slice(0, 4000);
    const before = await db.query('SELECT status FROM orders WHERE id = $1', [orderId]);
    if (!before.rows.length) throw new OrderInputError('Order not found.', 404);
    const from = before.rows[0].status;
    if (from === status && !cleanNote && !notify) return { changed: false, status, email: { status: 'skipped' } };

    if (from !== status) await db.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [status, orderId]);
    await addEvent(orderId, {
        kind: 'status',
        title: from === status ? `Update sent (still ${STATUS_LABELS[status]})` : `Status changed to ${STATUS_LABELS[status]}`,
        body: cleanNote || null,
        status_from: from,
        status_to: status,
        customer_visible: true,
        actor,
    });

    let email = { status: 'skipped' };
    if (notify && STATUSES_TO_ANNOUNCE.has(status)) {
        email = await emailAndLog(orderId, `order-${status}`, { note: cleanNote }, { actor, title: `Emailed the customer: ${STATUS_LABELS[status]}` });
    }
    return { changed: from !== status, status, email };
}

const shipmentView = (s) => {
    const carrier = carrierByKey(s.carrier);
    return {
        ...s,
        shipped_at: dayString(s.shipped_at),
        carrier_label: carrierLabel(s),
        tracking_link: s.tracking_url || trackingUrlFor(s.carrier, s.tracking_number) || null,
        no_tracking: Boolean(carrier?.noTracking),
    };
};

const fileUrl = (relPath) => (relPath ? `/${String(relPath).replace(/\\/g, '/').replace(/^\/+/, '')}` : null);

const photoView = (p) => ({ ...p, url: fileUrl(p.file_path), thumb_url: fileUrl(p.thumb_path || p.file_path) });

/* What the customer's own order page shows besides the parts. */
async function customerExtras(orderId) {
    const [shipments, photos, updates] = await Promise.all([
        db.query('SELECT * FROM order_shipments WHERE order_id = $1 ORDER BY shipped_at NULLS LAST, id', [orderId]),
        db.query('SELECT id, order_item_id, file_path, thumb_path, caption, width, height, created_at FROM order_photos WHERE order_id = $1 AND customer_visible ORDER BY id', [orderId]),
        db.query(`SELECT id, kind, title, body, status_to, created_at FROM order_events
                  WHERE order_id = $1 AND customer_visible ORDER BY created_at, id`, [orderId]),
    ]).catch(() => [{ rows: [] }, { rows: [] }, { rows: [] }]);
    return {
        shipments: shipments.rows.map(s => {
            const v = shipmentView(s);
            return { id: v.id, carrier: v.carrier_label, service: v.service, tracking_number: v.tracking_number, tracking_link: v.tracking_link, shipped_at: v.shipped_at, no_tracking: v.no_tracking };
        }),
        photos: photos.rows.map(photoView),
        updates: updates.rows,
    };
}

module.exports = {
    STATUS_LABELS,
    OrderInputError,
    addEvent,
    emailAndLog,
    changeStatus,
    shipmentView,
    photoView,
    fileUrl,
    customerExtras,
};

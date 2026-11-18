/*
 * What anyone with an order's number and email (or its signed link) may see
 * on the public tracking page (/track-order). Only what the customer
 * already knows or the shop chose to share with them: status and its dates,
 * shipments, the parts (name, quantity, material, services), the shop's
 * customer-visible updates and photos, the payment method and whether it
 * is paid. Never prices, costs, quote snapshots, internal notes, who on the
 * staff did what, file paths, or the address and phone on the order.
 *
 *   findForLookup(number, email)  the order when that email is on it, else null
 *   findById(id)                  the order (for the signed link / owner checks)
 *   ownsOrder(user, order)        a signed-in customer's own order (same rule as My orders)
 *   trackingView(order)           the page's data
 */
const db = require('../db');
const { customerExtras } = require('./service');
const { parseConfig, partSpecs } = require('./parts');

const ORDER_COLUMNS = 'o.id, o.user_id, o.email, o.status, o.payment_method, o.payment_id, o.created_at, o.updated_at';

/* The email on the order, or the email of the account that placed it, both
 * compared trimmed and in lower case. One query either way, so a wrong
 * number and a wrong email take the same path. */
async function findForLookup(orderId, email) {
    const r = await db.query(
        `SELECT ${ORDER_COLUMNS}
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         WHERE o.id = $1 AND (LOWER(TRIM(o.email)) = $2 OR LOWER(TRIM(u.email)) = $2)`,
        [orderId, String(email).trim().toLowerCase()]
    );
    return r.rows[0] || null;
}

async function findById(orderId) {
    const r = await db.query(`SELECT ${ORDER_COLUMNS} FROM orders o WHERE o.id = $1`, [orderId]);
    return r.rows[0] || null;
}

const sameEmail = (a, b) => Boolean(a) && Boolean(b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/* Placed while signed in to this account, or as a guest with its email (like GET /orders/my-orders). */
const ownsOrder = (user, order) => Boolean(user && order) && (
    (order.user_id !== null && order.user_id !== undefined && Number(order.user_id) === Number(user.id))
    || ((order.user_id === null || order.user_id === undefined) && sameEmail(order.email, user.email))
);

// The four steps, and which order statuses mean each one was reached.
const STEPS = [
    { key: 'placed', statuses: ['pending'] },
    { key: 'production', statuses: ['processing'] },
    { key: 'shipped', statuses: ['shipping', 'shipped'] },
    { key: 'delivered', statuses: ['completed', 'delivered'] },
];
// Statuses that stop the order: shown as "placed", then this.
const STOPS = { rejected: 'attention', cancelled: 'cancelled' };

const stepIndexOf = (status) => STEPS.findIndex(s => s.statuses.includes(status));

/* When the order last reached each status, from the customer-visible log. */
function reachedAt(updates) {
    const at = new Map();
    for (const u of updates) {
        if (u.kind === 'status' && u.status_to) at.set(u.status_to, u.created_at); // oldest first, so the last one wins
    }
    return at;
}

function progress(order, updates) {
    const at = reachedAt(updates);
    const dateOf = (statuses) => statuses.map(s => at.get(s)).filter(Boolean).pop() || null;
    const stop = STOPS[order.status];
    if (stop) {
        return {
            stage: stop,
            steps: [
                { key: 'placed', state: 'done', at: order.created_at },
                { key: stop, state: 'stopped', at: at.get(order.status) || order.updated_at || null },
            ],
        };
    }
    const current = Math.max(0, stepIndexOf(order.status));
    return {
        stage: STEPS[current].key,
        steps: STEPS.map((step, i) => ({
            key: step.key,
            state: i < current || (i === current && i === STEPS.length - 1) ? 'done' : i === current ? 'current' : 'todo',
            at: i === 0 ? order.created_at : i <= current ? dateOf(step.statuses) : null,
        })),
    };
}

/* "jordan@example.com" -> "j•••n@example.com": enough to recognise, not to read. */
function maskEmail(email) {
    const [local, domain] = String(email || '').trim().split('@');
    if (!local || !domain) return '';
    const shown = local.length > 2 ? `${local[0]}•••${local[local.length - 1]}` : `${local[0]}•••`;
    return `${shown}@${domain}`;
}

/* Method, and paid (true), due on delivery (false) or not stated (null). */
function paymentView(order) {
    const method = String(order.payment_method || 'COD').toUpperCase();
    if (method === 'PAYPAL') return { method, paid: order.payment_id ? true : null };
    if (method === 'COD') return { method, paid: order.status === 'completed' ? null : false };
    return { method, paid: null };
}

// Only the configuration fields partSpecs reads; the whole one carries the
// part's drawing and hole data (often 100 KB+ per part).
const SPEC_FIELDS = ['selectedThickness', 'selectedThicknessDisplay', 'productionService', 'additionalServices', 'selectedFinishColors', 'bendCount'];
const SPEC_JSON = `jsonb_build_object('metal', jsonb_build_object('name', configuration_json::jsonb -> 'metal' -> 'name'), ${SPEC_FIELDS.map(f => `'${f}', configuration_json::jsonb -> '${f}'`).join(', ')})`;

async function trackingView(order) {
    // The parts, then the shared extras (a few connections, not a burst of them).
    const itemsRes = await db.query(
        `SELECT id, file_name, quantity, ${SPEC_JSON} AS specs FROM order_items WHERE order_id = $1 ORDER BY id`,
        [order.id]
    );
    const extras = await customerExtras(order.id);
    const parts = itemsRes.rows.map(item => {
        const { material, thickness, services } = partSpecs(parseConfig(item.specs));
        return { id: item.id, name: item.file_name || 'Part', quantity: Number(item.quantity) || 1, material, thickness, services };
    });
    const { stage, steps } = progress(order, extras.updates);
    return {
        number: order.id,
        status: order.status,
        stage,
        steps,
        placedAt: order.created_at,
        updatedAt: order.updated_at || order.created_at,
        email: maskEmail(order.email),
        payment: paymentView(order),
        parts,
        partCount: parts.reduce((sum, p) => sum + p.quantity, 0),
        shipments: extras.shipments.map(s => ({
            id: s.id,
            carrier: s.carrier,
            service: s.service || null,
            tracking_number: s.tracking_number || null,
            tracking_link: /^https?:\/\//i.test(String(s.tracking_link || '')) ? s.tracking_link : null,
            shipped_at: s.shipped_at,
            no_tracking: s.no_tracking,
        })),
        // Newest first; the page words status changes itself.
        updates: [...extras.updates].reverse().map(u => ({
            id: u.id, kind: u.kind, title: u.title, body: u.body || null, status_to: u.status_to || null, created_at: u.created_at,
        })),
        photos: extras.photos.map(p => ({ id: p.id, url: p.url, thumb_url: p.thumb_url, caption: p.caption || null, width: p.width, height: p.height })),
    };
}

module.exports = { findForLookup, findById, ownsOrder, trackingView, maskEmail };

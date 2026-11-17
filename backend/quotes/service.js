/*
 * Quote requests: parts the site could not price instantly. Shared by the
 * public route (routes/quoteRequests.js) and Admin > Quotes
 * (routes/adminQuotes.js): reading and cleaning what the customer sent,
 * keeping a copy of their file, the activity log, and the emails (each one
 * logged as sent or failed; a mail problem never fails a request).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const { badRequest } = require('../helpers/http');
const validate = require('../helpers/validate');
const { UPLOADS_DIR, toRelative, publicUrl, resolveUpload } = require('../helpers/files');
const { resolveUpload: resolveCadUpload } = require('../costing/measure');
const { sendTemplate, renderTemplate, getBrand } = require('../emails');
const { toEmailQuote } = require('../emails/templates');

const STATUS_LABELS = {
    new: 'New',
    quoted: 'Quoted',
    accepted: 'Accepted',
    declined: 'Declined',
    closed: 'Closed',
};
// How the customer sees each status (My orders).
const CUSTOMER_LABELS = {
    new: 'Being reviewed',
    quoted: 'Quote ready',
    accepted: 'Accepted',
    declined: 'Declined',
    closed: 'Closed',
};
const SOURCES = ['quote-page', 'cart'];
const QUOTES_DIR = path.join(UPLOADS_DIR, 'quotes');
const MAX_PRICING_INPUT_BYTES = 3 * 1024 * 1024;

const reference = (id) => `Q-${id}`;
const round2 = (n) => Math.round(Number(n) * 100) / 100;

const parseJson = (value, fallback) => {
    if (value === null || value === undefined) return fallback;
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return fallback; }
};

// ── Reading what the customer sent ──────────────────────────────────────

const short = (value, max = 160) => {
    if (value === null || value === undefined || typeof value === 'object') return null;
    const s = String(value).replace(/\s+/g, ' ').trim().slice(0, max);
    return s || null;
};
const finite = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};
const counted = (list) => (Array.isArray(list) ? list : []).slice(0, 50)
    .map(x => ({ name: short(x?.name, 120) || 'Unnamed', count: Math.max(1, Math.min(9999, Number.parseInt(x?.count, 10) || 1)) }));
const size = (s) => {
    if (!s || typeof s !== 'object') return null;
    const out = { l: finite(s.l), w: finite(s.w), t: finite(s.t) };
    return out.l || out.w || out.t ? out : null;
};

/* What the customer chose, as a small known shape (never a raw blob). */
function cleanConfiguration(raw) {
    const c = validate.json(raw, 'Part details', { fallback: {} }) || {};
    if (typeof c !== 'object' || Array.isArray(c)) throw badRequest('Part details are not valid.');
    return {
        process: short(c.process),
        process_id: finite(c.process_id),
        material: short(c.material),
        material_id: finite(c.material_id),
        thickness: short(c.thickness, 60),
        finishes: (Array.isArray(c.finishes) ? c.finishes : []).slice(0, 20).map(f => ({
            title: short(f?.title, 120),
            color: short(f?.color, 80),
            swatch: /^#[0-9a-f]{3,8}$/i.test(String(f?.swatch || '')) ? f.swatch : null,
        })).filter(f => f.title),
        taps: counted(c.taps),
        countersinks: counted(c.countersinks),
        hardware: counted(c.hardware),
        bends: finite(c.bends),
        holes: finite(c.holes),
        size_in: size(c.size_in),
        size_mm: size(c.size_mm),
        size_source: short(c.size_source, 60),
    };
}

function cleanReasons(raw) {
    return validate.list(raw, 'Reasons', { max: 20 })
        .map(r => ({ code: short(r?.code, 60) || 'OTHER', message: short(r?.message, 400) }))
        .filter(r => r.message);
}

/* The pricing request as the quote page sent it, so the shop can re-run it.
 * Very large outlines are dropped rather than refusing the request. */
function cleanPricingInput(raw) {
    const input = validate.json(raw, 'Pricing details', { fallback: null });
    if (input === null) return null;
    if (typeof input !== 'object' || Array.isArray(input)) throw badRequest('Pricing details are not valid.');
    if (JSON.stringify(input).length <= MAX_PRICING_INPUT_BYTES) return input;
    const trimmed = { ...input, technical_data: { ...(input.technical_data || {}), cutEdges: [] } };
    return JSON.stringify(trimmed).length <= MAX_PRICING_INPUT_BYTES ? trimmed : null;
}

/* The uploaded file the request is about (temp_uploads/ or uploads/orders/
 * only, the same rule pricing uses), or a 400 the customer can act on. */
function sourceFile(fileRef) {
    const ref = validate.text(fileRef, 'File', { required: true, max: 600 });
    const abs = resolveCadUpload(ref);
    if (!abs) throw badRequest('We could not find your uploaded file. Upload the part again on the quote page, then send the request.');
    return abs;
}

// "1794913980775_bracket.STEP" (a stored name) -> "bracket.STEP".
const displayName = (abs) => path.basename(abs).replace(/^\d{10,}_/, '');

const safeStem = (name) => String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')
    .slice(0, 80) || 'part';

/* Copies the customer's file to uploads/quotes/<id>/. The name starts with a
 * random token: the folder is served like the order files, so the link must
 * not be guessable. */
async function storeQuoteFile(quoteId, srcAbs, fileName) {
    const dir = path.join(QUOTES_DIR, String(quoteId));
    await fs.promises.mkdir(dir, { recursive: true });
    const ext = path.extname(srcAbs).toLowerCase();
    const dest = path.join(dir, `${crypto.randomBytes(6).toString('hex')}_${safeStem(fileName)}${ext}`);
    await fs.promises.copyFile(srcAbs, dest);
    const stat = await fs.promises.stat(dest);
    return { path: toRelative(dest), size: stat.size };
}

async function removeQuoteFiles(quoteId) {
    const dir = path.join(QUOTES_DIR, String(Number.parseInt(quoteId, 10)));
    if (!dir.startsWith(QUOTES_DIR + path.sep)) return;
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
}

// ── Views ───────────────────────────────────────────────────────────────

async function fileInfo(row) {
    if (!row.file_path) return null;
    const abs = resolveUpload(row.file_path);
    const stat = abs ? await fs.promises.stat(abs).catch(() => null) : null;
    return {
        name: row.file_name || path.basename(row.file_path),
        path: row.file_path,
        url: publicUrl(row.file_path),
        ext: path.extname(row.file_path).slice(1).toUpperCase(),
        size: stat ? stat.size : (row.file_size ? Number(row.file_size) : null),
        exists: Boolean(stat),
    };
}

const money = (v) => (v === null || v === undefined ? null : Number(v));

const answerOf = (row) => (row.quoted_at ? {
    unit_price: money(row.quoted_unit_price),
    quantity: row.quoted_quantity ?? row.quantity,
    total: money(row.quoted_total),
    lead_time: row.lead_time,
    message: row.reply_message,
    quoted_at: row.quoted_at,
} : null);

/* A row of the admin list. */
function listView(row) {
    const cfg = parseJson(row.configuration_json, {}) || {};
    return {
        id: row.id,
        reference: reference(row.id),
        status: row.status,
        user_id: row.user_id,
        account_name: row.account_name || null,
        name: row.name,
        email: row.email,
        phone: row.phone,
        company: row.company,
        quantity: row.quantity,
        file_name: row.file_name,
        source: row.source,
        material: cfg.material || null,
        thickness: cfg.thickness || null,
        process: cfg.process || null,
        reasons: parseJson(row.reasons, []) || [],
        quoted_unit_price: money(row.quoted_unit_price),
        quoted_quantity: row.quoted_quantity,
        quoted_total: money(row.quoted_total),
        lead_time: row.lead_time,
        quoted_at: row.quoted_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

/* What the customer sees of their own request (My orders). */
function customerView(row) {
    const cfg = parseJson(row.configuration_json, {}) || {};
    return {
        id: row.id,
        reference: reference(row.id),
        status: row.status,
        status_label: CUSTOMER_LABELS[row.status] || row.status,
        file_name: row.file_name,
        quantity: row.quantity,
        material: cfg.material || null,
        thickness: cfg.thickness || null,
        process: cfg.process || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        answer: answerOf(row),
    };
}

// ── Activity log and emails ─────────────────────────────────────────────

async function addEvent(quoteId, ev, client = db) {
    const res = await client.query(
        `INSERT INTO quote_request_events (quote_request_id, kind, title, body, status_from, status_to, email_to, email_subject,
                                           email_status, email_error, actor_email)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [quoteId, ev.kind, String(ev.title).slice(0, 300), ev.body || null, ev.status_from || null, ev.status_to || null,
            ev.email_to || null, ev.email_subject || null, ev.email_status || null, ev.email_error || null, ev.actor || null]
    );
    return res.rows[0];
}

const wait = (ms, value) => new Promise(resolve => { setTimeout(() => resolve(value), ms); });
const EMAIL_OK = validate.EMAIL_RE;

/* Sends one email about a request and records it in the activity log.
 * Waits up to waitMs for the mail server so the admin sees "sent" or why it
 * failed; a slower server finishes in the background and the log row is
 * updated then. Never throws for a mail problem. */
async function emailAndLog(quoteId, templateName, data, { to, replyTo, brand, actor = null, title, body = null, waitMs = 15000 } = {}) {
    const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
    const toText = recipients.join(', ') || null;
    let prepared;
    try {
        if (!recipients.length) throw new Error('No address to send to. Set the staff inbox under Admin › Contact.');
        const bad = recipients.find(r => !EMAIL_OK.test(String(r)));
        if (bad) throw new Error(`"${bad}" is not a valid email address`);
        const resolvedBrand = brand || await getBrand();
        const { subject } = renderTemplate(templateName, data, resolvedBrand);
        prepared = { subject, sending: sendTemplate(templateName, data, { to: recipients, replyTo, brand: resolvedBrand }) };
    } catch (err) {
        const event = await addEvent(quoteId, { kind: 'email', title, body, email_to: toText, email_status: 'failed', email_error: err.message, actor });
        return { status: 'failed', error: err.message, to: toText, event };
    }
    const event = await addEvent(quoteId, {
        kind: 'email', title, body, email_to: toText, email_subject: prepared.subject, email_status: 'sending', actor,
    });
    const settled = prepared.sending.then(() => ({ status: 'sent' }), err => ({ status: 'failed', error: err.message }));
    settled
        .then(r => db.query('UPDATE quote_request_events SET email_status = $1, email_error = $2 WHERE id = $3', [r.status, r.error || null, event.id]))
        .then(() => settled)
        .then(r => { if (r.status === 'failed') console.error(`[Quotes] ${reference(quoteId)} "${templateName}" not sent: ${r.error}`); })
        .catch(err => console.error(`[Quotes] could not record the email result for ${reference(quoteId)}: ${err.message}`));
    const result = await Promise.race([settled, wait(waitMs, { status: 'sending' })]);
    return { ...result, to: toText, subject: prepared.subject };
}

async function loadRequest(quoteId) {
    const res = await db.query('SELECT * FROM quote_requests WHERE id = $1', [quoteId]);
    return res.rows[0] || null;
}

// Customer emails: replies go to the public contact address when there is one.
const companyReplyTo = (brand) => brand.contactEmail || undefined;
const cleanName = (name) => String(name || '').replace(/["\\\r\n]/g, '').trim();

/* A new request: confirmation to the customer and an alert to staff, sent
 * in the background and logged on the request. */
function notifyNewRequest(quoteId) {
    setImmediate(() => {
        (async () => {
            const [row, brand] = await Promise.all([loadRequest(quoteId), getBrand()]);
            if (!row) return;
            const request = toEmailQuote(row);
            await Promise.all([
                emailAndLog(quoteId, 'quote-received', { request }, {
                    to: row.email, replyTo: companyReplyTo(brand), brand, waitMs: 0,
                    title: 'Emailed the customer: request received',
                }),
                emailAndLog(quoteId, 'quote-alert', { request }, {
                    to: brand.staffInbox, replyTo: { name: cleanName(row.name), address: row.email }, brand, waitMs: 0,
                    title: 'Alerted the shop: new quote request',
                }),
            ]);
        })().catch(err => console.error(`[Quotes] ${reference(quoteId)} emails not sent: ${err.message}`));
    });
}

/* The shop's answer, emailed to the customer (waits for the mail server
 * like the order emails, so the admin sees the result). */
async function emailReply(quoteId, { actor } = {}) {
    const [row, brand] = await Promise.all([loadRequest(quoteId), getBrand()]);
    const request = toEmailQuote(row);
    return emailAndLog(quoteId, 'quote-reply', { request }, {
        to: row.email, replyTo: companyReplyTo(brand), brand, actor,
        title: 'Emailed the customer: the quote',
    });
}

module.exports = {
    STATUS_LABELS,
    CUSTOMER_LABELS,
    SOURCES,
    reference,
    round2,
    parseJson,
    cleanConfiguration,
    cleanReasons,
    cleanPricingInput,
    sourceFile,
    displayName,
    storeQuoteFile,
    removeQuoteFiles,
    fileInfo,
    listView,
    customerView,
    answerOf,
    addEvent,
    emailAndLog,
    loadRequest,
    notifyNewRequest,
    emailReply,
};

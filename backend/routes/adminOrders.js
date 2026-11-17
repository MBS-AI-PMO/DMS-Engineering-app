/*
 * Admin > Orders: the order list and the full order page.
 * Mounted at /api/admin/orders. Trash, restore and permanent delete stay on
 * /api/orders (routes/orders.js).
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { CARRIERS, carrierByKey, trackingUrlFor, carrierLabel } = require('../orders/carriers');
const {
    STATUS_LABELS, OrderInputError, addEvent, emailAndLog, changeStatus, shipmentView, photoView, fileUrl,
} = require('../orders/service');
const { streamZip } = require('../orders/zip');

const router = express.Router();
router.use(authenticate, requireAdmin);

const BACKEND_DIR = path.join(__dirname, '..');
const PHOTO_DIR = path.join(BACKEND_DIR, 'uploads', 'orders', 'photos');
const MAX_EMAIL_PHOTOS = 6;

const actorOf = (req) => req.user?.email || null;

/* Wraps a handler: bad input -> 400/404 with its message, the rest -> 500. */
const handle = (label, fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof OrderInputError) return res.status(err.status).json({ success: false, error: err.message });
        console.error(`[Admin orders] ${label}`, err);
        res.status(500).json({ success: false, error: `Could not ${label}. Please try again.` });
    }
};

const orderIdOf = (req) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new OrderInputError('Unknown order.', 404);
    return id;
};

async function requireOrder(id) {
    const res = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (!res.rows.length) throw new OrderInputError('Order not found.', 404);
    return res.rows[0];
}

const text = (value, max) => String(value ?? '').trim().slice(0, max);

// ── List ────────────────────────────────────────────────────────────────

router.get('/', handle('load the orders', async (req, res) => {
    const view = req.query.view === 'trash' ? 'soft_deleted' : 'active';
    const [rows, counts] = await Promise.all([
        db.query(`
            SELECT o.id, o.user_id, o.email, o.full_name, o.phone, o.city, o.zip_code, o.total_price, o.payment_method,
                   o.payment_id, o.status, o.created_at, o.updated_at, o.is_deleted_by_user,
                   u.name AS account_name,
                   COALESCE(i.item_count, 0) AS item_count, COALESCE(i.part_count, 0) AS part_count,
                   i.file_names, i.materials,
                   COALESCE(s.shipment_count, 0) AS shipment_count, s.last_shipment,
                   COALESCE(p.photo_count, 0) AS photo_count
            FROM orders o
            LEFT JOIN users u ON u.id = o.user_id
            LEFT JOIN LATERAL (
                SELECT count(*)::int AS item_count, COALESCE(sum(quantity), 0)::int AS part_count,
                       array_agg(file_name ORDER BY id) AS file_names,
                       array_remove(array_agg(DISTINCT configuration_json->'metal'->>'name'), NULL) AS materials
                FROM order_items WHERE order_id = o.id
            ) i ON true
            LEFT JOIN LATERAL (
                SELECT count(*)::int AS shipment_count,
                       (array_agg(json_build_object('carrier', carrier, 'carrier_name', carrier_name,
                                                    'tracking_number', tracking_number, 'tracking_url', tracking_url)
                                  ORDER BY id DESC))[1] AS last_shipment
                FROM order_shipments WHERE order_id = o.id
            ) s ON true
            LEFT JOIN LATERAL (SELECT count(*)::int AS photo_count FROM order_photos WHERE order_id = o.id) p ON true
            WHERE o.admin_deletion_status = $1
            ORDER BY o.created_at DESC`, [view]),
        db.query(`SELECT admin_deletion_status AS view, count(*)::int AS n FROM orders
                  WHERE admin_deletion_status IN ('active', 'soft_deleted') GROUP BY admin_deletion_status`),
    ]);
    const data = rows.rows.map(o => ({
        ...o,
        last_shipment: o.last_shipment ? {
            carrier: carrierLabel(o.last_shipment),
            tracking_number: o.last_shipment.tracking_number,
            tracking_link: o.last_shipment.tracking_url || trackingUrlFor(o.last_shipment.carrier, o.last_shipment.tracking_number),
        } : null,
    }));
    const count = (v) => counts.rows.find(r => r.view === v)?.n || 0;
    res.json({ success: true, data, counts: { active: count('active'), trash: count('soft_deleted') }, statuses: STATUS_LABELS });
}));

// ── Detail ──────────────────────────────────────────────────────────────

// The saved configuration keeps a full copy of the metal (FAQs, page text);
// the order page needs only what describes the part.
const METAL_KEYS = ['id', 'name', 'slug', 'color', 'category_id', 'image_path'];
function slimConfig(raw) {
    let cfg = raw;
    if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch { cfg = {}; } }
    cfg = cfg && typeof cfg === 'object' ? { ...cfg } : {};
    if (cfg.metal && typeof cfg.metal === 'object') {
        cfg.metal = Object.fromEntries(METAL_KEYS.filter(k => cfg.metal[k] !== undefined).map(k => [k, cfg.metal[k]]));
    }
    if (cfg.productionService && typeof cfg.productionService === 'object') {
        const { id, title, slug } = cfg.productionService;
        cfg.productionService = { id, title, slug };
    }
    if (Array.isArray(cfg.additionalServices)) {
        cfg.additionalServices = cfg.additionalServices.map(s => (s && typeof s === 'object' ? { id: s.id, title: s.title, slug: s.slug } : s));
    }
    return cfg;
}

async function fileInfo(kind, label, relPath) {
    if (!relPath) return null;
    const abs = path.resolve(BACKEND_DIR, relPath);
    if (!abs.startsWith(path.resolve(BACKEND_DIR, 'uploads'))) return null;
    const stat = await fs.promises.stat(abs).catch(() => null);
    return {
        kind,
        label,
        path: relPath,
        url: fileUrl(relPath),
        name: path.basename(relPath),
        ext: path.extname(relPath).slice(1).toUpperCase(),
        size: stat ? stat.size : null,
        exists: Boolean(stat),
        modified: stat ? stat.mtime : null,
    };
}

router.get('/:id', handle('load the order', async (req, res) => {
    const id = orderIdOf(req);
    const order = await requireOrder(id);
    const [items, shipments, photos, events, account] = await Promise.all([
        db.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [id]),
        db.query('SELECT * FROM order_shipments WHERE order_id = $1 ORDER BY shipped_at NULLS LAST, id', [id]),
        db.query('SELECT * FROM order_photos WHERE order_id = $1 ORDER BY id', [id]),
        db.query('SELECT * FROM order_events WHERE order_id = $1 ORDER BY created_at DESC, id DESC', [id]),
        order.user_id
            ? db.query(`SELECT u.id, u.name, u.email, u.phone, u.address, u.created_at,
                               (SELECT count(*)::int FROM orders WHERE user_id = u.id) AS order_count,
                               (SELECT COALESCE(sum(total_price), 0) FROM orders WHERE user_id = u.id AND status <> 'rejected') AS lifetime_total
                        FROM users u WHERE u.id = $1`, [order.user_id])
            : Promise.resolve({ rows: [] }),
    ]);

    const itemViews = await Promise.all(items.rows.map(async (item) => {
        const files = (await Promise.all([
            fileInfo('original', "Customer's file", item.original_file_path),
            fileInfo('configured', 'Manufacturing model', item.configured_file_path),
            fileInfo('flat', 'Flat pattern', item.flat_file_path),
        ])).filter(Boolean);
        const { configuration_json: cfg, ...rest } = item;
        return { ...rest, configuration: slimConfig(cfg), files };
    }));

    res.json({
        success: true,
        data: {
            order,
            account: account.rows[0] || null,
            items: itemViews,
            shipments: shipments.rows.map(shipmentView),
            photos: photos.rows.map(photoView),
            events: events.rows,
            carriers: CARRIERS.map(({ key, name, freight, noTracking, url }) => ({ key, name, freight: Boolean(freight), noTracking: Boolean(noTracking), autoLink: Boolean(url) })),
            statuses: STATUS_LABELS,
        },
    });
}));

// ── Status and emails ───────────────────────────────────────────────────

router.put('/:id/status', handle('change the status', async (req, res) => {
    const id = orderIdOf(req);
    const result = await changeStatus(id, {
        status: req.body?.status,
        notify: req.body?.notify !== false,
        note: req.body?.note,
        actor: actorOf(req),
    });
    res.json({ success: true, data: result });
}));

router.post('/:id/email', handle('email the customer', async (req, res) => {
    const id = orderIdOf(req);
    await requireOrder(id);
    const subject = text(req.body?.subject, 200);
    const message = text(req.body?.message, 8000);
    if (!subject) throw new OrderInputError('Add a subject.');
    if (!message) throw new OrderInputError('Write a message.');

    const photoIds = (Array.isArray(req.body?.photoIds) ? req.body.photoIds : [])
        .map(n => Number.parseInt(n, 10)).filter(Number.isInteger).slice(0, MAX_EMAIL_PHOTOS);
    const photoRows = photoIds.length
        ? (await db.query('SELECT * FROM order_photos WHERE order_id = $1 AND id = ANY($2::int[]) ORDER BY id', [id, photoIds])).rows
        : [];
    const attachments = [];
    const photos = [];
    for (const p of photoRows) {
        const abs = path.resolve(BACKEND_DIR, p.file_path);
        if (!abs.startsWith(PHOTO_DIR) || !fs.existsSync(abs)) continue;
        const cid = `order-photo-${p.id}@dms`;
        attachments.push({ filename: `photo-${p.id}.jpg`, path: abs, cid, contentType: 'image/jpeg', contentDisposition: 'inline' });
        photos.push({ cid, caption: p.caption || '' });
    }

    const email = await emailAndLog(id, 'order-message', { subject, message, photos }, {
        actor: actorOf(req),
        attachments,
        title: `Emailed the customer: ${subject}`,
        body: message + (photos.length ? `\n\n(${photos.length} photo${photos.length > 1 ? 's' : ''} attached)` : ''),
    });
    res.json({ success: true, data: { email } });
}));

// ── Internal notes ──────────────────────────────────────────────────────

router.post('/:id/notes', handle('save the note', async (req, res) => {
    const id = orderIdOf(req);
    await requireOrder(id);
    const body = text(req.body?.text, 4000);
    if (!body) throw new OrderInputError('Write a note first.');
    const event = await addEvent(id, { kind: 'note', title: 'Internal note', body, actor: actorOf(req) });
    res.json({ success: true, data: event });
}));

router.delete('/:id/notes/:eventId', handle('delete the note', async (req, res) => {
    const id = orderIdOf(req);
    const r = await db.query("DELETE FROM order_events WHERE id = $1 AND order_id = $2 AND kind = 'note' RETURNING id", [req.params.eventId, id]);
    if (!r.rowCount) throw new OrderInputError('Note not found.', 404);
    res.json({ success: true });
}));

// ── Shipments and tracking ──────────────────────────────────────────────

function shipmentInput(body) {
    const carrier = carrierByKey(text(body.carrier, 40));
    if (!carrier) throw new OrderInputError('Choose a carrier.');
    const carrierName = text(body.carrier_name, 120);
    if (carrier.key === 'other' && !carrierName) throw new OrderInputError('Type the name of the carrier.');
    const trackingNumber = text(body.tracking_number, 120).replace(/\s+/g, carrier.freight ? ' ' : '');
    if (!carrier.noTracking && !trackingNumber) throw new OrderInputError(`Add the ${carrier.freight ? 'PRO / tracking' : 'tracking'} number.`);
    let trackingUrl = text(body.tracking_url, 1000) || null;
    if (trackingUrl && !/^https?:\/\/\S+$/i.test(trackingUrl)) throw new OrderInputError('The tracking link must start with http:// or https://');
    if (!trackingUrl) trackingUrl = null; // built from the carrier when shown
    let shippedAt = text(body.shipped_at, 20) || null;
    if (shippedAt && !/^\d{4}-\d{2}-\d{2}$/.test(shippedAt)) throw new OrderInputError('Ship date must be a date.');
    const packages = body.packages === '' || body.packages === undefined || body.packages === null ? null : Number.parseInt(body.packages, 10);
    if (packages !== null && (!Number.isInteger(packages) || packages < 1 || packages > 999)) throw new OrderInputError('Packages must be a whole number from 1 to 999.');
    return {
        carrier: carrier.key,
        carrier_name: carrier.key === 'other' ? carrierName : null,
        service: text(body.service, 120) || null,
        tracking_number: trackingNumber || null,
        tracking_url: trackingUrl,
        shipped_at: shippedAt,
        packages,
        notes: text(body.notes, 2000) || null,
    };
}

const shipmentTitle = (s) => `${carrierLabel(s)}${s.tracking_number ? ` ${s.tracking_number}` : ''}`;

router.post('/:id/shipments', handle('add the shipment', async (req, res) => {
    const id = orderIdOf(req);
    const order = await requireOrder(id);
    const input = shipmentInput(req.body || {});
    const r = await db.query(
        `INSERT INTO order_shipments (order_id, carrier, carrier_name, service, tracking_number, tracking_url, shipped_at, packages, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [id, input.carrier, input.carrier_name, input.service, input.tracking_number, input.tracking_url, input.shipped_at, input.packages, input.notes]
    );
    const shipment = r.rows[0];
    await addEvent(id, { kind: 'shipment', title: `Shipment added: ${shipmentTitle(shipment)}`, body: input.notes, customer_visible: true, actor: actorOf(req) });

    // Marking it shipped sends the "shipped" email, which lists the tracking.
    const notify = req.body?.notify !== false;
    let result = { status: order.status, email: { status: 'skipped' } };
    if (req.body?.mark_shipped !== false && !['shipping', 'completed'].includes(order.status)) {
        result = await changeStatus(id, { status: 'shipping', notify, actor: actorOf(req) });
    } else if (notify) {
        result.email = await emailAndLog(id, 'order-shipping', {}, { actor: actorOf(req), title: 'Emailed the customer: tracking details' });
    }
    res.json({ success: true, data: { shipment: shipmentView(shipment), status: result.status, email: result.email } });
}));

router.put('/:id/shipments/:sid', handle('save the shipment', async (req, res) => {
    const id = orderIdOf(req);
    const input = shipmentInput(req.body || {});
    const r = await db.query(
        `UPDATE order_shipments SET carrier=$1, carrier_name=$2, service=$3, tracking_number=$4, tracking_url=$5,
                shipped_at=$6, packages=$7, notes=$8, updated_at=NOW()
         WHERE id=$9 AND order_id=$10 RETURNING *`,
        [input.carrier, input.carrier_name, input.service, input.tracking_number, input.tracking_url, input.shipped_at, input.packages, input.notes, req.params.sid, id]
    );
    if (!r.rowCount) throw new OrderInputError('Shipment not found.', 404);
    await addEvent(id, { kind: 'shipment', title: `Shipment updated: ${shipmentTitle(r.rows[0])}`, actor: actorOf(req) });
    res.json({ success: true, data: shipmentView(r.rows[0]) });
}));

router.delete('/:id/shipments/:sid', handle('remove the shipment', async (req, res) => {
    const id = orderIdOf(req);
    const r = await db.query('DELETE FROM order_shipments WHERE id = $1 AND order_id = $2 RETURNING *', [req.params.sid, id]);
    if (!r.rowCount) throw new OrderInputError('Shipment not found.', 404);
    await addEvent(id, { kind: 'shipment', title: `Shipment removed: ${shipmentTitle(r.rows[0])}`, actor: actorOf(req) });
    res.json({ success: true });
}));

// ── Photos ──────────────────────────────────────────────────────────────

const photoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024, files: 12 },
    fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

router.post('/:id/photos', (req, res, next) => {
    photoUpload.array('photos', 12)(req, res, (err) => {
        if (!err) return next();
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'Each photo must be under 25 MB.'
            : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Upload at most 12 photos at a time.'
                : 'Upload failed.';
        res.status(400).json({ success: false, error: message });
    });
}, handle('add the photos', async (req, res) => {
    const id = orderIdOf(req);
    await requireOrder(id);
    const files = req.files || [];
    if (!files.length) throw new OrderInputError('Choose one or more photos (JPG, PNG, WebP or HEIC).');

    let itemId = req.body?.order_item_id ? Number.parseInt(req.body.order_item_id, 10) : null;
    if (itemId) {
        const ok = await db.query('SELECT 1 FROM order_items WHERE id = $1 AND order_id = $2', [itemId, id]);
        if (!ok.rowCount) itemId = null;
    }
    const visible = req.body?.customer_visible !== 'false';
    const caption = text(req.body?.caption, 300) || null;

    const dir = path.join(PHOTO_DIR, String(id));
    await fs.promises.mkdir(dir, { recursive: true });
    const added = [];
    const failed = [];
    for (const file of files) {
        const stem = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const fullAbs = path.join(dir, `${stem}.jpg`);
        const thumbAbs = path.join(dir, `${stem}-thumb.webp`);
        try {
            // Phone photos: turn upright (EXIF), cap at 2400 px, drop metadata (GPS).
            const info = await sharp(file.buffer, { failOn: 'none' }).rotate()
                .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85, mozjpeg: true })
                .toFile(fullAbs);
            await sharp(fullAbs).resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(thumbAbs);
            const rel = (abs) => path.relative(BACKEND_DIR, abs).replace(/\\/g, '/');
            const r = await db.query(
                `INSERT INTO order_photos (order_id, order_item_id, file_path, thumb_path, original_name, caption, width, height, size_bytes, customer_visible, actor_email)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
                [id, itemId, rel(fullAbs), rel(thumbAbs), text(file.originalname, 255), caption, info.width, info.height, info.size, visible, actorOf(req)]
            );
            added.push(photoView(r.rows[0]));
        } catch (err) {
            await fs.promises.rm(fullAbs, { force: true });
            await fs.promises.rm(thumbAbs, { force: true });
            failed.push({ name: file.originalname, error: /unsupported image format|heif/i.test(err.message) ? 'This image format could not be read. Save it as JPG or PNG.' : 'Could not read this image.' });
        }
    }
    if (added.length) {
        await addEvent(id, {
            kind: 'photo',
            title: `Added ${added.length} photo${added.length > 1 ? 's' : ''}${visible ? ' (customer can see)' : ' (staff only)'}`,
            customer_visible: false,
            actor: actorOf(req),
        });
    }
    res.json({ success: true, data: { added, failed } });
}));

router.put('/:id/photos/:pid', handle('save the photo', async (req, res) => {
    const id = orderIdOf(req);
    const sets = [];
    const values = [];
    if (req.body?.caption !== undefined) { values.push(text(req.body.caption, 300) || null); sets.push(`caption = $${values.length}`); }
    if (req.body?.customer_visible !== undefined) { values.push(Boolean(req.body.customer_visible)); sets.push(`customer_visible = $${values.length}`); }
    if (req.body?.order_item_id !== undefined) {
        const itemId = req.body.order_item_id ? Number.parseInt(req.body.order_item_id, 10) : null;
        if (itemId) {
            const ok = await db.query('SELECT 1 FROM order_items WHERE id = $1 AND order_id = $2', [itemId, id]);
            if (!ok.rowCount) throw new OrderInputError('That part is not in this order.');
        }
        values.push(itemId); sets.push(`order_item_id = $${values.length}`);
    }
    if (!sets.length) throw new OrderInputError('Nothing to change.');
    values.push(req.params.pid, id);
    const r = await db.query(`UPDATE order_photos SET ${sets.join(', ')} WHERE id = $${values.length - 1} AND order_id = $${values.length} RETURNING *`, values);
    if (!r.rowCount) throw new OrderInputError('Photo not found.', 404);
    res.json({ success: true, data: photoView(r.rows[0]) });
}));

router.delete('/:id/photos/:pid', handle('delete the photo', async (req, res) => {
    const id = orderIdOf(req);
    const r = await db.query('DELETE FROM order_photos WHERE id = $1 AND order_id = $2 RETURNING *', [req.params.pid, id]);
    if (!r.rowCount) throw new OrderInputError('Photo not found.', 404);
    for (const rel of [r.rows[0].file_path, r.rows[0].thumb_path]) {
        if (!rel) continue;
        const abs = path.resolve(BACKEND_DIR, rel);
        if (abs.startsWith(PHOTO_DIR)) await fs.promises.rm(abs, { force: true });
    }
    await addEvent(id, { kind: 'photo', title: 'Deleted a photo', actor: actorOf(req) });
    res.json({ success: true });
}));

// ── Every file as one zip ───────────────────────────────────────────────

const safeName = (name, fallback) => (String(name || '').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || fallback);

router.get('/:id/files.zip', handle('build the zip', async (req, res) => {
    const id = orderIdOf(req);
    await requireOrder(id);
    const [items, photos] = await Promise.all([
        db.query('SELECT id, file_name, original_file_path, configured_file_path, flat_file_path FROM order_items WHERE order_id = $1 ORDER BY id', [id]),
        db.query('SELECT id, file_path, original_name FROM order_photos WHERE order_id = $1 ORDER BY id', [id]),
    ]);
    const root = `Order-${id}`;
    const entries = [];
    const used = new Set();
    const add = (rel, name) => {
        if (!rel) return;
        const abs = path.resolve(BACKEND_DIR, rel);
        if (!abs.startsWith(path.resolve(BACKEND_DIR, 'uploads')) || !fs.existsSync(abs)) return;
        let entryName = name;
        for (let n = 2; used.has(entryName.toLowerCase()); n += 1) entryName = name.replace(/(\.[^./]+)?$/, ` (${n})$1`);
        used.add(entryName.toLowerCase());
        entries.push({ name: entryName, path: abs });
    };
    items.rows.forEach((item, i) => {
        const folder = `${root}/Part ${i + 1} - ${safeName(path.parse(item.file_name || '').name, `part-${item.id}`)}`;
        const ext = (rel) => path.extname(rel || '');
        add(item.original_file_path, `${folder}/Customer file - ${safeName(item.file_name, `part${ext(item.original_file_path)}`)}`);
        add(item.configured_file_path, `${folder}/Manufacturing model${ext(item.configured_file_path)}`);
        add(item.flat_file_path, `${folder}/Flat pattern${ext(item.flat_file_path)}`);
    });
    photos.rows.forEach((p, i) => add(p.file_path, `${root}/Photos/${String(i + 1).padStart(2, '0')} - ${safeName(path.parse(p.original_name || '').name, `photo-${p.id}`)}.jpg`));
    if (!entries.length) throw new OrderInputError('This order has no files on the server.', 404);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${root}-files.zip"`);
    res.setHeader('Cache-Control', 'no-store');
    try {
        await streamZip(res, entries);
    } catch (err) {
        console.error(`[Admin orders] zip for order #${id}`, err.message);
        if (!res.headersSent) throw err;
        res.destroy();
    }
}));

module.exports = router;

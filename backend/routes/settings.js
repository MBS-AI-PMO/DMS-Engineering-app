/*
 * Site settings: one JSON value per key in site_settings. Mounted at
 * /api/settings. Read by the whole public site (contact details, logos,
 * social links, SEO, tracking pixels, payment switches…) and written by
 * several admin screens (Contact, SEO & Tracking, Email, Payment, Hero…).
 *
 *   Public   GET /                 every key except PRIVATE_KEYS, as { key: value }
 *            GET /:key             one value (404 for unknown or private keys)
 *   Admin    GET /admin/private    only the PRIVATE_KEYS
 *            PUT /:key             { value } -> saves it (some keys are checked first)
 *            POST /upload-logo     multipart: logo (image) + key -> optimised image path saved under key
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, badRequest, HttpError, validate: v } = require('../helpers');
const { optimizeImage, optimizeHeroImage } = require('../utils/imageOptimizer');
const { validateSeoMeta, validateTrackingPixels } = require('../utils/seoSettings');

const router = express.Router();
const admin = [authenticate, requireAdmin];

// Structured settings (SEO meta tags, tracking pixel IDs) validated on PUT.
const STRUCTURED_VALIDATORS = { seo_meta: validateSeoMeta, tracking_pixels: validateTrackingPixels };

// Settings only admins may read: left out of the public GETs below and
// served by GET /admin/private. contact_form_recipients is where website
// contact messages are emailed (see routes/contact.js).
const PRIVATE_KEYS = new Set(['contact_form_recipients', 'payment_paypal_sandbox_secret', 'payment_paypal_live_secret']);
const MAX_RECIPIENTS = 5;
const MAX_LOGO_MB = 12;

/* Checks and normalises a value before it is stored; throws a 400 when it is wrong. */
function cleanValue(key, value) {
    if (key === 'contact_form_recipients') {
        const list = String(value || '').split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
        if (list.length > MAX_RECIPIENTS || list.some(e => e.length > 200 || !v.EMAIL_RE.test(e))) {
            throw badRequest(`Use up to ${MAX_RECIPIENTS} valid email addresses, separated by commas.`);
        }
        return list.join(', ');
    }
    if (STRUCTURED_VALIDATORS[key]) {
        const checked = STRUCTURED_VALIDATORS[key](value);
        if (checked.error) throw badRequest(checked.error);
        return checked.value;
    }
    return value;
}

async function saveSetting(key, value) {
    const result = await db.query(`
        INSERT INTO site_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
        RETURNING value
    `, [key, JSON.stringify(value)]);
    return result.rows[0].value;
}

// Logo / image uploads land in uploads/logos and are then optimised in place.
const LOGO_DIR = path.join(__dirname, '../uploads/logos');
const IMAGE_RE = /jpeg|jpg|png|svg|webp|gif|avif/;
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            fs.mkdirSync(LOGO_DIR, { recursive: true });
            cb(null, LOGO_DIR);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            const key = req.body.key || 'logo';
            cb(null, `${key}_${Date.now()}${ext}`);
        },
    }),
    limits: { fileSize: MAX_LOGO_MB * 1024 * 1024 }, // large hero uploads
    fileFilter: (req, file, cb) => {
        if (IMAGE_RE.test(path.extname(file.originalname).toLowerCase()) && IMAGE_RE.test(file.mimetype)) return cb(null, true);
        cb(badRequest('Only images (jpg, png, svg, webp, avif, gif) are allowed'));
    },
});

/* multer errors -> a 400 the admin can act on. */
const uploadLogo = (req, res, next) => upload.single('logo')(req, res, (err) => {
    if (!err) return next();
    const message = err instanceof HttpError ? err.message
        : err.code === 'LIMIT_FILE_SIZE' ? `Images must be under ${MAX_LOGO_MB} MB.` : 'Upload failed.';
    res.status(400).json({ success: false, error: message });
});

const removeFile = (file) => { if (file?.path) fs.unlink(file.path, () => { }); };

router.get('/', route('load the settings', async (req, res) => {
    const result = await db.query('SELECT key, value FROM site_settings');
    const settings = {};
    result.rows.forEach(row => {
        if (!PRIVATE_KEYS.has(row.key)) settings[row.key] = row.value;
    });
    ok(res, settings);
}));

router.get('/admin/private', admin, route('load the settings', async (req, res) => {
    const result = await db.query('SELECT key, value FROM site_settings WHERE key = ANY($1::text[])', [[...PRIVATE_KEYS]]);
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    ok(res, settings);
}));

router.get('/:key', route('load the setting', async (req, res) => {
    if (PRIVATE_KEYS.has(req.params.key)) throw new HttpError(404, 'Setting not found');
    const result = await db.query('SELECT value FROM site_settings WHERE key = $1', [req.params.key]);
    if (!result.rowCount) throw new HttpError(404, 'Setting not found');
    ok(res, result.rows[0].value);
}));

router.put('/:key', admin, route('save the setting', async (req, res) => {
    const { value } = req.body || {};
    if (value === undefined) throw badRequest('Value is required');
    ok(res, await saveSetting(req.params.key, cleanValue(req.params.key, value)));
}));

router.post('/upload-logo', admin, uploadLogo, route('upload the image', async (req, res) => {
    if (!req.file) throw badRequest('No file uploaded');
    const { key } = req.body || {};
    if (!key) {
        removeFile(req.file);
        throw badRequest('Setting key is required');
    }
    if (STRUCTURED_VALIDATORS[key] || PRIVATE_KEYS.has(key)) {
        removeFile(req.file);
        throw badRequest('This setting cannot hold an uploaded image');
    }

    let valueToSave;
    if (key === 'hero_image') {
        const heroFiles = await optimizeHeroImage(req.file.path);
        if (heroFiles?.avif || heroFiles?.webp || heroFiles?.jpg) {
            valueToSave = {
                avif: heroFiles.avif ? `/uploads/logos/${heroFiles.avif}` : '',
                webp: heroFiles.webp ? `/uploads/logos/${heroFiles.webp}` : '',
                jpg: heroFiles.jpg ? `/uploads/logos/${heroFiles.jpg}` : '',
            };
        } else {
            valueToSave = heroFiles?.src ? `/uploads/logos/${heroFiles.src}` : `/uploads/logos/${path.basename(req.file.path)}`;
        }
    } else {
        // Logos: WebP, resized, metadata stripped.
        valueToSave = `/uploads/logos/${await optimizeImage(req.file.path)}`;
    }

    await saveSetting(key, valueToSave);
    ok(res, valueToSave);
}));

module.exports = router;

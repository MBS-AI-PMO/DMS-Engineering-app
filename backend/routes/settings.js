const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { optimizeImage, optimizeHeroImage } = require('../utils/imageOptimizer');

const router = express.Router();

// Settings only admins may read: left out of the public GETs below and
// served by GET /admin/private. contact_form_recipients is where website
// contact messages are emailed (see routes/contact.js).
const PRIVATE_KEYS = new Set(['contact_form_recipients']);
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

// Setup multer for logo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/logos');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const key = req.body.key || 'logo';
        cb(null, `${key}_${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 12 * 1024 * 1024 }, // 12MB limit for large hero uploads
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|svg|webp|gif|avif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Only images (jpg, png, svg, webp, avif, gif) are allowed'));
    }
});

// GET /api/settings - Public
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT key, value FROM site_settings');
        const settings = {};
        result.rows.forEach(row => {
            if (!PRIVATE_KEYS.has(row.key)) settings[row.key] = row.value;
        });
        res.json({ success: true, data: settings });
    } catch (err) {
        console.error('Error fetching settings:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
});

// GET /api/settings/admin/private - Admin only
router.get('/admin/private', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT key, value FROM site_settings WHERE key = ANY($1::text[])', [[...PRIVATE_KEYS]]);
        const settings = {};
        result.rows.forEach(row => { settings[row.key] = row.value; });
        res.json({ success: true, data: settings });
    } catch (err) {
        console.error('Error fetching private settings:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
});

// GET /api/settings/:key - Public
router.get('/:key', async (req, res) => {
    if (PRIVATE_KEYS.has(req.params.key)) {
        return res.status(404).json({ success: false, error: 'Setting not found' });
    }
    try {
        const result = await db.query('SELECT value FROM site_settings WHERE key = $1', [req.params.key]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Setting not found' });
        }
        res.json({ success: true, data: result.rows[0].value });
    } catch (err) {
        console.error('Error fetching setting:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch setting' });
    }
});

// PUT /api/settings/:key - Admin only
router.put('/:key', authenticate, requireAdmin, async (req, res) => {
    try {
        let { value } = req.body;
        if (value === undefined) {
            return res.status(400).json({ success: false, error: 'Value is required' });
        }
        if (req.params.key === 'contact_form_recipients') {
            const list = String(value || '').split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
            if (list.length > 5 || list.some(e => e.length > 200 || !EMAIL_RE.test(e))) {
                return res.status(400).json({ success: false, error: 'Use up to 5 valid email addresses, separated by commas.' });
            }
            value = list.join(', ');
        }

        const result = await db.query(`
            UPDATE site_settings 
            SET value = $1, updated_at = CURRENT_TIMESTAMP
            WHERE key = $2
            RETURNING *
        `, [JSON.stringify(value), req.params.key]);

        if (result.rows.length === 0) {
            const insertResult = await db.query(`
                INSERT INTO site_settings (key, value)
                VALUES ($1, $2)
                RETURNING *
            `, [req.params.key, JSON.stringify(value)]);
            return res.json({ success: true, data: insertResult.rows[0].value });
        }

        res.json({ success: true, data: result.rows[0].value });
    } catch (err) {
        console.error('Error updating setting:', err);
        res.status(500).json({ success: false, error: 'Failed to update setting' });
    }
});

// POST /api/settings/upload-logo - Admin only
router.post('/upload-logo', authenticate, requireAdmin, upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const { key } = req.body;
        if (!key) {
            return res.status(400).json({ success: false, error: 'Setting key is required' });
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
            // Optimize logos (converts to WebP, resizes, strips metadata)
            const optimizedFilename = await optimizeImage(req.file.path);
            valueToSave = `/uploads/logos/${optimizedFilename}`;
        }

        // Update database
        await db.query(`
            INSERT INTO site_settings (key, value)
            VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE 
            SET value = $2, updated_at = CURRENT_TIMESTAMP
        `, [key, JSON.stringify(valueToSave)]);

        res.json({ success: true, data: valueToSave });
    } catch (err) {
        console.error('Error uploading logo:', err);
        res.status(500).json({ success: false, error: 'Failed to upload logo' });
    }
});

module.exports = router;

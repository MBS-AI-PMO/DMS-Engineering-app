const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { optimizeHeroImage } = require('../utils/imageOptimizer');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/service-heroes');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = path
            .basename(file.originalname, ext)
            .replace(/[^a-z0-9]/gi, '_')
            .toLowerCase();

        cb(null, `${Date.now()}_${name}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp|avif|svg/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);

        if (ext && mime) return cb(null, true);
        cb(new Error('Only images are allowed'));
    }
});

// GET /api/hero-sections/admin
router.get('/admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                s.id AS service_id,
                s.title,
                s.slug,
                s.display_order,
                hs.hero_image,
                hs.updated_at
            FROM services s
            LEFT JOIN hero_sections hs ON hs.service_id = s.id
            ORDER BY s.display_order, s.id
        `);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching hero sections:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hero sections'
        });
    }
});

// POST /api/hero-sections/admin/upload
router.post('/admin/upload', authenticate, requireAdmin, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image uploaded'
            });
        }

        const heroFiles = await optimizeHeroImage(req.file.path);

        const heroImage = {
            avif: heroFiles.avif ? `/uploads/service-heroes/${heroFiles.avif}` : '',
            webp: heroFiles.webp ? `/uploads/service-heroes/${heroFiles.webp}` : '',
            jpg: heroFiles.jpg ? `/uploads/service-heroes/${heroFiles.jpg}` : '',
            src: heroFiles.src ? `/uploads/service-heroes/${heroFiles.src}` : ''
        };

        res.json({ success: true, data: heroImage });
    } catch (err) {
        console.error('Hero upload failed:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to upload hero image'
        });
    }
});

// PUT /api/hero-sections/admin/:serviceId
router.put('/admin/:serviceId', authenticate, requireAdmin, async (req, res) => {
    try {
        const serviceId = Number(req.params.serviceId);
        const { hero_image } = req.body;

        if (!serviceId) {
            return res.status(400).json({
                success: false,
                error: 'Invalid service id'
            });
        }

        const result = await db.query(`
            INSERT INTO hero_sections (service_id, hero_image)
            VALUES ($1, $2)
            ON CONFLICT (service_id)
            DO UPDATE SET 
                hero_image = EXCLUDED.hero_image,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [serviceId, JSON.stringify(hero_image || {})]);

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error saving hero section:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to save hero section'
        });
    }
});

// DELETE /api/hero-sections/admin/:serviceId
router.delete('/admin/:serviceId', authenticate, requireAdmin, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM hero_sections WHERE service_id = $1',
            [req.params.serviceId]
        );

        res.json({
            success: true,
            message: 'Hero image removed'
        });
    } catch (err) {
        console.error('Error deleting hero section:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to remove hero section'
        });
    }
});

module.exports = router;
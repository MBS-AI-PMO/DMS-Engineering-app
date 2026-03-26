const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/guidelines — Fetch all guidelines
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM service_guidelines
            ORDER BY id
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching guidelines:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch guidelines' });
    }
});

// GET /api/guidelines/:serviceId — Fetch for specific service
router.get('/:serviceId', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM service_guidelines WHERE service_id = $1',
            [req.params.serviceId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Guidelines not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error fetching specific guideline:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch guidelines' });
    }
});

// POST /api/guidelines/admin — Create/Update guidelines
router.post('/admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const { service_id, title, content, requirements, tables } = req.body;
        
        if (!service_id || !title) {
            return res.status(400).json({ success: false, error: 'service_id and title are required' });
        }

        const result = await db.query(`
            INSERT INTO service_guidelines (service_id, title, content, requirements, tables)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (service_id) DO UPDATE SET
                title = EXCLUDED.title,
                content = EXCLUDED.content,
                requirements = EXCLUDED.requirements,
                tables = EXCLUDED.tables,
                updated_at = NOW()
            RETURNING *
        `, [service_id, title, content, JSON.stringify(requirements || []), JSON.stringify(tables || [])]);

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error saving guidelines:', err);
        res.status(500).json({ success: false, error: 'Failed to save guidelines' });
    }
});

module.exports = router;

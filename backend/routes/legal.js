const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/legal/:type — Fetch all sections for a document type (privacy/terms)
router.get('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        if (!['privacy', 'terms'].includes(type)) {
            return res.status(400).json({ success: false, error: 'Invalid document type' });
        }

        const result = await db.query(`
            SELECT * FROM legal_documents
            WHERE type = $1
            ORDER BY serial_number ASC, display_order ASC
        `, [type]);

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching legal documents:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch legal documents' });
    }
});

// GET /api/legal/admin/:type — Admin fetch (includes all fields)
router.get('/admin/:type', authenticate, requireAdmin, async (req, res) => {
    try {
        const { type } = req.params;
        const result = await db.query(`
            SELECT * FROM legal_documents
            WHERE type = $1
            ORDER BY display_order ASC, serial_number ASC
        `, [type]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// POST /api/legal/admin — Create or Update a section
router.post('/admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const { id, type, serial_number, icon, heading, color, content, display_order } = req.body;

        if (!type || !serial_number || !heading || !icon || !color) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        if (id) {
            // Update
            const result = await db.query(`
                UPDATE legal_documents
                SET type = $1, serial_number = $2, icon = $3, heading = $4, color = $5, content = $6, display_order = $7, updated_at = NOW()
                WHERE id = $8
                RETURNING *
            `, [type, serial_number, icon, heading, color, JSON.stringify(content || []), display_order || 0, id]);
            res.json({ success: true, data: result.rows[0] });
        } else {
            // Create
            const result = await db.query(`
                INSERT INTO legal_documents (type, serial_number, icon, heading, color, content, display_order)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [type, serial_number, icon, heading, color, JSON.stringify(content || []), display_order || 0]);
            res.json({ success: true, data: result.rows[0] });
        }
    } catch (err) {
        console.error('Error saving legal document:', err);
        res.status(500).json({ success: false, error: 'Failed to save document' });
    }
});

// DELETE /api/legal/admin/:id — Delete a section
router.delete('/admin/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM legal_documents WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Section deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to delete section' });
    }
});

module.exports = router;

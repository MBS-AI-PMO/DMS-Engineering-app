/*
 * Privacy policy and terms of service, as numbered sections. Mounted at
 * /api/legal.
 *
 *   Public   GET /:type            sections of 'privacy' or 'terms' (the public pages sort them again)
 *   Admin    GET /admin/:type      the same rows for Admin > Terms & Policy
 *            POST /admin           create (no id) or update (with id) a section
 *            DELETE /admin/:id
 *
 * content is a list of plain-text paragraphs; the public page turns lines
 * starting with "-", "*", "•" or "1." into lists. color is kept for older
 * designs but no longer shown on the public pages.
 */
const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, badRequest, HttpError, validate: v } = require('../helpers');

const router = express.Router();
const admin = [authenticate, requireAdmin];
const TYPES = ['privacy', 'terms'];
const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function readSection(body) {
    if (v.blank(body.type) || v.blank(body.serial_number) || v.blank(body.heading) || v.blank(body.icon) || v.blank(body.color)) {
        throw badRequest('Missing required fields');
    }
    const color = v.text(body.color, 'Colour', { required: true, max: 20 });
    if (!COLOR_RE.test(color)) throw badRequest('Colour must be a hex value such as #6366f1.');
    const content = v.list(body.content, 'Paragraphs', { max: 200 })
        .map(item => (item === null || item === undefined ? '' : String(item)))
        .map((item, i) => {
            if (item.length > 20000) throw badRequest(`Paragraph ${i + 1} is too long (max 20000 characters).`);
            return item;
        });
    return {
        type: v.oneOf(body.type, TYPES, 'Document'),
        serial_number: v.text(body.serial_number, 'Number', { required: true, max: 20 }),
        icon: v.text(body.icon, 'Icon', { required: true, max: 60 }),
        heading: v.text(body.heading, 'Heading', { required: true, max: 255 }),
        color,
        content,
        display_order: v.integer(body.display_order, 'Position', { min: -100000, max: 100000 }) ?? 0,
    };
}

router.get('/:type', route('load the document', async (req, res) => {
    const { type } = req.params;
    if (!TYPES.includes(type)) throw badRequest('Invalid document type');
    const result = await db.query(`
        SELECT * FROM legal_documents
        WHERE type = $1
        ORDER BY serial_number ASC, display_order ASC
    `, [type]);
    ok(res, result.rows);
}));

router.get('/admin/:type', admin, route('load the sections', async (req, res) => {
    const result = await db.query(`
        SELECT * FROM legal_documents
        WHERE type = $1
        ORDER BY display_order ASC, serial_number ASC
    `, [req.params.type]);
    ok(res, result.rows);
}));

router.post('/admin', admin, route('save the section', async (req, res) => {
    const body = req.body || {};
    const s = readSection(body);
    const values = [s.type, s.serial_number, s.icon, s.heading, s.color, JSON.stringify(s.content), s.display_order];
    if (!v.blank(body.id)) {
        const id = v.id(body.id, 'Section');
        const result = await db.query(`
            UPDATE legal_documents
            SET type = $1, serial_number = $2, icon = $3, heading = $4, color = $5, content = $6, display_order = $7, updated_at = NOW()
            WHERE id = $8
            RETURNING *
        `, [...values, id]);
        if (!result.rowCount) throw new HttpError(404, 'Section not found');
        return ok(res, result.rows[0]);
    }
    const result = await db.query(`
        INSERT INTO legal_documents (type, serial_number, icon, heading, color, content, display_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, values);
    return ok(res, result.rows[0]);
}));

router.delete('/admin/:id', admin, route('delete the section', async (req, res) => {
    const id = v.id(req.params.id, 'Section');
    const result = await db.query('DELETE FROM legal_documents WHERE id = $1 RETURNING id', [id]);
    if (!result.rowCount) throw new HttpError(404, 'Section not found');
    ok(res, undefined, { message: 'Section deleted' });
}));

module.exports = router;

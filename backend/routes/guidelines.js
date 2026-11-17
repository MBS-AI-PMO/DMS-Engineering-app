/*
 * Design guidelines per service (intro text, requirements, size tables per
 * material). Mounted at /api/guidelines.
 *
 *   Public (Guidelines and service pages; cached by utils/publicCache)
 *     GET  /             every service's guidelines
 *     GET  /:serviceId   one service's guidelines (404 when it has none)
 *   Admin
 *     POST /admin        create or replace a service's guidelines (one row per service)
 *
 * tables: [{ material, headers: [..], rows: [{ <header>: value }] }]. Older
 * rows use short keys ("t", "minF"); the client maps them to headers.
 */
const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, badRequest, HttpError, validate: v } = require('../helpers');

const router = express.Router();

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const cellText = (value) => (value === null || value === undefined ? '' : String(value).slice(0, 500));

function cleanRequirements(value) {
    return v.list(value, 'Requirements', { max: 200 })
        .map(item => (item === null || item === undefined ? '' : String(item).slice(0, 2000)));
}

function cleanTables(value) {
    return v.list(value, 'Tables', { max: 100 }).map((table, i) => {
        if (!isPlainObject(table)) throw badRequest(`Table ${i + 1} is not valid.`);
        const headers = table.headers === undefined ? undefined : v.list(table.headers, `Table ${i + 1} columns`, { max: 40 }).map(cellText);
        const rows = v.list(table.rows, `Table ${i + 1} rows`, { max: 1000 }).map((row, r) => {
            if (!isPlainObject(row)) throw badRequest(`Table ${i + 1}, row ${r + 1} is not valid.`);
            return Object.fromEntries(Object.entries(row).map(([key, cell]) => [String(key).slice(0, 200), cellText(cell)]));
        });
        return {
            ...table,
            material: cellText(table.material),
            ...(headers ? { headers } : {}),
            rows,
        };
    });
}

router.get('/', route('load the guidelines', async (req, res) => {
    const result = await db.query('SELECT * FROM service_guidelines ORDER BY id');
    ok(res, result.rows);
}));

router.get('/:serviceId', route('load the guidelines', async (req, res) => {
    const serviceId = v.id(req.params.serviceId, 'Service');
    const result = await db.query('SELECT * FROM service_guidelines WHERE service_id = $1', [serviceId]);
    if (!result.rowCount) throw new HttpError(404, 'Guidelines not found');
    ok(res, result.rows[0]);
}));

router.post('/admin', authenticate, requireAdmin, route('save the guidelines', async (req, res) => {
    const body = req.body || {};
    if (v.blank(body.service_id) || v.blank(body.title)) throw badRequest('service_id and title are required');
    const serviceId = v.id(body.service_id, 'Service');
    const title = v.text(body.title, 'Title', { required: true, max: 200 });
    const content = v.text(body.content, 'Introduction', { max: 20000, trim: false });
    const requirements = cleanRequirements(body.requirements);
    const tables = cleanTables(body.tables);

    const service = await db.query('SELECT 1 FROM services WHERE id = $1', [serviceId]);
    if (!service.rowCount) throw badRequest('That service no longer exists.');

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
    `, [serviceId, title, content, JSON.stringify(requirements), JSON.stringify(tables)]);
    ok(res, result.rows[0]);
}));

module.exports = router;

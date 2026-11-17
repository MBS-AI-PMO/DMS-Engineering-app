/*
 * Hardware insertion catalog: types (Flush Stud, Flush Standoff, Nut, Flush
 * Nut, …) and their items. Mounted at /api/hardware. Edited from the
 * Hardware service in Admin > Services.
 *
 *   GET    /all                     types with their items (types without items left out; no countersink types)
 *   GET    /types                   every type with item_count
 *   GET    /types/:id/items         a type's items
 *   POST   /admin/types/:id/image   replace a type's picture (admin) -> { path }
 *   POST   /admin/items             create an item (admin)
 *   PUT    /admin/items/:id         update an item (admin)
 *   DELETE /admin/items/:id         delete an item (admin)
 *   POST   /admin/items/:id/image   replace an item's picture (admin) -> { path }
 */
const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { route, ok, HttpError, badRequest, imageUpload, handleUpload, saveImage } = require('../helpers');

const router = express.Router();
router.use('/admin', authenticate, requireAdmin);

const intParam = (value, message) => {
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n)) throw badRequest(message);
    return n;
};
const itemNotFound = () => new HttpError(404, 'Item not found');
const uploadOne = handleUpload(imageUpload({ maxMb: 25, maxFiles: 1 }).single('image'), { maxMb: 25, maxFiles: 1 });
const saveHardwareImage = (file) => saveImage(file, { folder: 'hardware', maxWidth: 1200, thumbWidth: 320 });

// ── Public ───────────────────────────────────────────────

// GET /api/hardware/all — all types with their items embedded (for service detail page)
router.get('/all', route('load the hardware', async (req, res) => {
    const types = (await db.query(`
        SELECT ht.* FROM hardware_types ht
        WHERE LOWER(ht.name) NOT LIKE '%countersink%'
        ORDER BY ht.id
    `)).rows;
    const items = types.length
        ? (await db.query('SELECT * FROM hardware_items WHERE hardware_type_id = ANY($1) ORDER BY id', [types.map(t => t.id)])).rows
        : [];
    const enriched = types.map(t => ({ ...t, items: items.filter(i => i.hardware_type_id === t.id) }));
    ok(res, enriched.filter(t => t.items.length > 0));
}));

// GET /api/hardware/types — every type with its item count
router.get('/types', route('load the hardware types', async (req, res) => {
    const result = await db.query(`
        SELECT ht.*,
               (SELECT COUNT(*) FROM hardware_items hi WHERE hi.hardware_type_id = ht.id) AS item_count
        FROM hardware_types ht
        ORDER BY ht.id
    `);
    ok(res, result.rows);
}));

// GET /api/hardware/types/:id/items — all items for a type
router.get('/types/:id/items', route('load the hardware items', async (req, res) => {
    const typeId = intParam(req.params.id, 'Invalid type ID');
    const result = await db.query('SELECT * FROM hardware_items WHERE hardware_type_id = $1 ORDER BY id', [typeId]);
    ok(res, result.rows);
}));

// ── Admin ────────────────────────────────────────────────

// POST /api/hardware/admin/types/:id/image — upload/replace type representative photo
router.post('/admin/types/:id/image', uploadOne, route('upload the type image', async (req, res) => {
    const typeId = intParam(req.params.id, 'Invalid type ID');
    if (!req.file) throw badRequest('No file uploaded');
    const img = await saveHardwareImage(req.file);
    await db.query('UPDATE hardware_types SET image_path = $1 WHERE id = $2', [img.url, typeId]);
    ok(res, { path: img.url });
}));

/* Optional measurements: a number or null (0 and blanks become null, as before). */
const num = (value) => parseFloat(value) || null;
const itemValues = (b) => [
    b.size_spec || null, b.price || 0, b.notes || null, b.is_active !== false,
    num(b.length), num(b.min_edge_distance), num(b.tooling_diameter),
    num(b.base_width), num(b.shank),
    num(b.major_dia), num(b.minor_dia), num(b.angle), num(b.max_hole_diameter),
];

// POST /api/hardware/admin/items — create item
router.post('/admin/items', route('create the hardware item', async (req, res) => {
    const { hardware_type_id: typeId, name } = req.body;
    if (!typeId || !name) throw badRequest('hardware_type_id and name are required');
    const result = await db.query(
        `INSERT INTO hardware_items (hardware_type_id, name, size_spec, price, notes, is_active, length, min_edge_distance, tooling_diameter, base_width, shank, major_dia, minor_dia, angle, max_hole_diameter)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [typeId, name, ...itemValues(req.body)]
    );
    ok(res, result.rows[0]);
}));

// PUT /api/hardware/admin/items/:id — update item
router.put('/admin/items/:id', route('update the hardware item', async (req, res) => {
    const itemId = intParam(req.params.id, 'Invalid item ID');
    const result = await db.query(
        `UPDATE hardware_items
         SET name = $1, size_spec = $2, price = $3, notes = $4, is_active = $5,
             length = $6, min_edge_distance = $7, tooling_diameter = $8,
             base_width = $9, shank = $10,
             major_dia = $11, minor_dia = $12, angle = $13, max_hole_diameter = $14
         WHERE id = $15
         RETURNING *`,
        [req.body.name, ...itemValues(req.body), itemId]
    );
    if (!result.rowCount) throw itemNotFound();
    ok(res, result.rows[0]);
}));

// DELETE /api/hardware/admin/items/:id — delete item
router.delete('/admin/items/:id', route('delete the hardware item', async (req, res) => {
    const itemId = intParam(req.params.id, 'Invalid item ID');
    const result = await db.query('DELETE FROM hardware_items WHERE id = $1', [itemId]);
    if (!result.rowCount) throw itemNotFound();
    ok(res);
}));

// POST /api/hardware/admin/items/:id/image — upload/replace item image
router.post('/admin/items/:id/image', uploadOne, route('upload the item image', async (req, res) => {
    const itemId = intParam(req.params.id, 'Invalid item ID');
    if (!req.file) throw badRequest('No file uploaded');
    const img = await saveHardwareImage(req.file);
    await db.query('UPDATE hardware_items SET image_path = $1 WHERE id = $2', [img.url, itemId]);
    ok(res, { path: img.url });
}));

module.exports = router;

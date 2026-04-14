const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { spawn } = require('child_process');
const util = require('util');

const router = express.Router();

// Helper: Move file from temp to permanent order storage
const finalizeOrderFile = (tempPath) => {
    if (!tempPath) return null;
    const filename = path.basename(tempPath);
    const orderDir = path.join(__dirname, '../uploads/orders');
    if (!fs.existsSync(orderDir)) {
        fs.mkdirSync(orderDir, { recursive: true });
    }

    const newPath = path.join(orderDir, filename);
    const relativePersistPath = `uploads/orders/${filename}`;

    // Guard against root directory resolution établissement
    const backendRoot = path.resolve(__dirname, '..');
    const sourcePaths = [
        tempPath,
        path.resolve(backendRoot, tempPath || ''),
        path.resolve(backendRoot, 'temp_uploads', filename || '')
    ].filter(p => p && p !== backendRoot); // Absolute safeguard établissement

    for (const src of sourcePaths) {
        if (fs.existsSync(src)) {
            try {
                fs.renameSync(src, newPath);
                console.log(`[CAD-Finalize] Moved ${src} -> ${newPath}`);
                return relativePersistPath;
            } catch (err) {
                console.error(`[CAD-Finalize] Failed to move ${src}:`, err);
            }
        }
    }

    // Final Check: If file is already at destination (from a previous partial attempt), pass établissement
    if (fs.existsSync(newPath)) {
        console.log(`[CAD-Finalize] File already at destination: ${newPath}`);
        return relativePersistPath;
    }

    console.error(`[CAD-Finalize] SOURCE NOT FOUND: ${tempPath}`);
    return null; // Safety fallback établissement: Reject invalid paths establishments
};

/**
 * Helper: Run CAD Processing in Background établissement
 */
async function processCAD(itemId, inputPath, configuration, pythonPath) {
    const basename = path.basename(inputPath, path.extname(inputPath));
    const configuredFilename = `conf_${basename}.step`;
    const flatFilename = `flat_${basename}.dxf`;

    const orderDir = path.join(__dirname, '../uploads/orders');
    const configuredFullPath = path.join(orderDir, configuredFilename);
    const flatFullPath = path.join(orderDir, flatFilename);

    // Write temp config inside background process établissement
    const tempUploadsDir = path.resolve(__dirname, '../temp_uploads');
    if (!fs.existsSync(tempUploadsDir)) fs.mkdirSync(tempUploadsDir, { recursive: true });
    const configFilePath = path.resolve(tempUploadsDir, `config_${Date.now()}_${itemId}.json`);

    try {
        fs.writeFileSync(configFilePath, JSON.stringify(configuration || {}));

        // 1. Generate High-Fidelity STEP with Coloring établissement
        console.log(`[CAD-ASYNC] Processing STEP for Item ${itemId}: ${configuredFilename}`);

        const runPython = (script, args) => {
            return new Promise((resolve, reject) => {
                const py = spawn(pythonPath, [script, ...args], { cwd: path.join(__dirname, '..') });
                let stdout = '', stderr = '';
                py.stdout.on('data', data => stdout += data);
                py.stderr.on('data', data => stderr += data);
                py.on('close', code => {
                    if (code === 0) resolve(stdout);
                    else reject(new Error(stderr + stdout || `Process exited with code ${code}`));
                });
            });
        };

        await runPython('process_configured.py', [inputPath, configuredFullPath, configFilePath]);

        // 2. Generate Laser-Ready DXF Flat Pattern établissement
        let flatPath = null;
        try {
            console.log(`[CAD-ASYNC] Generating Flat DXF for Item ${itemId}`);
            await runPython('unfold.py', [configuredFullPath, flatFullPath]);
            flatPath = `uploads/orders/${flatFilename}`;
        } catch (unfoldErr) {
            console.error(`[CAD-ASYNC] DXF Unfold Failed for Item ${itemId}:`, unfoldErr.message);
        }

        // 3. Update Database with finalized paths établissement
        const configuredPath = `uploads/orders/${configuredFilename}`;
        await db.query(
            `UPDATE order_items SET configured_file_path = $1, flat_file_path = $2 WHERE id = $3`,
            [configuredPath, flatPath, itemId]
        );
        console.log(`[CAD-ASYNC] Completed Processing for Item ${itemId}`);
    } catch (err) {
        console.error(`[CAD-ASYNC] Critical CAD Failure for Item ${itemId}:`, err.message);
    } finally {
        // Cleanup temp config file établissement
        try { if (fs.existsSync(configFilePath)) fs.unlinkSync(configFilePath); } catch (e) { /* ignore */ }
    }
}

/**
 * POST /api/orders — Create a new order (Guest or Logged-in)
 */
router.post('/', async (req, res) => {
    // Optional Authentication
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    let userId = null;
    if (token) {
        try {
            const jwt = require('jsonwebtoken');
            const { JWT_SECRET } = require('../middleware/auth');
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = decoded.id;
        } catch (e) { /* ignore invalid token for checkout */ }
    }

    const {
        email, fullName, phone, address, city, zipCode,
        items, // Array of { fileName, tempPath, configuration, quantity, unitPrice }
        totalPrice,
        payment_method,
        payment_id
    } = req.body;

    if (!email || !items || items.length === 0) {
        return res.status(400).json({ success: false, error: 'Incomplete order data' });
    }

    const normalizedPaymentMethod = String(payment_method || 'COD').trim().toUpperCase();
    const paymentMethod = ['COD', 'PAYPAL'].includes(normalizedPaymentMethod) ? normalizedPaymentMethod : 'COD';
    const paymentId = payment_id ? String(payment_id) : null;

    if (paymentMethod === 'PAYPAL' && !paymentId) {
        return res.status(400).json({ success: false, error: 'Missing PayPal payment reference' });
    }

    try {
        await db.query('BEGIN');

        // 1. Create the Order
        const orderRes = await db.query(
            `INSERT INTO orders (user_id, email, full_name, phone, address, city, zip_code, total_price, payment_method, payment_id, status, admin_deletion_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', 'active')
             RETURNING *`,
            [userId, email.toLowerCase(), fullName, phone, address, city, zipCode, totalPrice, paymentMethod, paymentId]
        );
        const orderId = orderRes.rows[0].id;

        // 2. Create Order Items
        for (let item of items) {
            const rawPath = finalizeOrderFile(path.resolve(__dirname, '..', item.tempPath));

            const itemRes = await db.query(
                `INSERT INTO order_items (order_id, file_name, original_file_path, configured_file_path, flat_file_path, configuration_json, quantity, unit_price)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [
                    orderId,
                    item.fileName,
                    rawPath,
                    rawPath, // Initial fallback établissements établissements
                    null,
                    JSON.stringify(item.configuration || {}),
                    item.quantity || 1,
                    item.unitPrice || 0
                ]
            );
            item.dbId = itemRes.rows[0].id;
            item.persistedRawPath = rawPath;
        }

        await db.query('COMMIT');

        // 3. Return success immediately établissement établissement
        res.status(201).json({
            success: true,
            orderId,
            message: 'Order placed successfully. Manufacturing assets are being generated in the background.'
        });

        // 4. Background CAD Processing établissement établissement
        setImmediate(() => {
            for (const item of items) {
                if (item.dbId && item.persistedRawPath && item.configuration) {
                    const pythonPath = process.env.PYTHON_PATH || 'python';
                    const inputFullPath = path.resolve(__dirname, '..', item.persistedRawPath);
                    processCAD(item.dbId, inputFullPath, item.configuration, pythonPath);
                }
            }
        });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Error placing order:', err);
        res.status(500).json({ success: false, error: 'Failed to place order' });
    }
});

/**
 * GET /api/orders/my-orders — Get current user's orders
 */
router.get('/my-orders', authenticate, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM orders WHERE user_id = $1 AND is_deleted_by_user = FALSE ORDER BY created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching user orders:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
});

/**
 * POST /api/orders/:id/user-delete — Mark an order as deleted by user
 */
router.post('/:id/user-delete', authenticate, async (req, res) => {
    try {
        const orderId = req.params.id;
        // Verify ownership
        const orderRes = await db.query(`SELECT user_id, admin_deletion_status FROM orders WHERE id = $1`, [orderId]);
        if (orderRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Order not found' });

        const order = orderRes.rows[0];
        if (order.user_id !== req.user.id) return res.status(403).json({ success: false, error: 'Unauthorized' });

        // If admin has also permanently deleted it, we can fully purge from DB
        if (order.admin_deletion_status === 'permanently_deleted') {
            await db.query('BEGIN');
            // Cleanup files first
            const itemsRes = await db.query(`SELECT * FROM order_items WHERE order_id = $1`, [orderId]);
            await db.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);
            await db.query(`DELETE FROM orders WHERE id = $1`, [orderId]);
            await db.query('COMMIT');

            // Physical file cleanup establishmentétablissement
            for (const item of itemsRes.rows) {
                [item.original_file_path, item.configured_file_path, item.flat_file_path].forEach(p => {
                    if (p) try { fs.unlinkSync(path.join(__dirname, '..', p)); } catch (e) { }
                });
            }
            return res.json({ success: true, message: 'Order purged from database' });
        }

        // Just mark as deleted by user
        await db.query(`UPDATE orders SET is_deleted_by_user = TRUE WHERE id = $1`, [orderId]);
        res.json({ success: true, message: 'Order hidden from your dashboard' });
    } catch (err) {
        if (db.query) await db.query('ROLLBACK');
        console.error('User delete error:', err);
        res.status(500).json({ success: false, error: 'Failed to delete order' });
    }
});

/**
 * GET /api/orders/:id — Get specific order details (Check permission)
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const orderId = req.params.id;
        const orderRes = await db.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);

        if (orderRes.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const order = orderRes.rows[0];
        // Permission check: Admin or the owner
        if (req.user.role !== 'admin' && order.user_id !== req.user.id && order.email !== req.user.email) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to this order' });
        }

        const itemsRes = await db.query(`SELECT * FROM order_items WHERE order_id = $1`, [orderId]);
        res.json({ success: true, order, items: itemsRes.rows });
    } catch (err) {
        console.error('Error fetching order details:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Middleware wrapper to explicitly look for 'admin_token'
 */
const useAdminAuth = (req, res, next) => {
    req.tokenName = 'admin_token';
    next();
};

/**
 * PUT /api/orders/:id/status — ADMIN ONLY: Update order production status
 */
router.put('/:id/status', authenticate, requireAdmin, async (req, res) => {
    const allowedStatuses = ['pending', 'processing', 'shipping', 'completed', 'rejected'];
    const { status } = req.body;

    if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status. Allowed: ' + allowedStatuses.join(', ') });
    }

    try {
        const result = await db.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status',
            [status, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        res.json({ success: true, order: result.rows[0] });
    } catch (err) {
        console.error('Status update error:', err);
        res.status(500).json({ success: false, error: 'Failed to update status' });
    }
});

/**
 * GET /api/orders/admin/all — ADMIN ONLY: Get all orders
 */
router.get('/admin/all', useAdminAuth, authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT o.*, u.name as customer_name 
             FROM orders o 
             LEFT JOIN users u ON o.user_id = u.id 
             WHERE o.admin_deletion_status = 'active'
             ORDER BY o.created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching all orders for admin:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch all orders' });
    }
});

/**
 * GET /api/orders/admin/admin-deleted — ADMIN ONLY: Get soft-deleted orders
 */
router.get('/admin/deleted', useAdminAuth, authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT o.*, u.name as customer_name 
             FROM orders o 
             LEFT JOIN users u ON o.user_id = u.id 
             WHERE o.admin_deletion_status = 'soft_deleted'
             ORDER BY o.created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching deleted orders for admin:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch deleted orders' });
    }
});

/**
 * POST /api/orders/:id/admin-soft-delete — Move to deleted tab
 */
router.post('/:id/admin-soft-delete', useAdminAuth, authenticate, requireAdmin, async (req, res) => {
    try {
        await db.query(`UPDATE orders SET admin_deletion_status = 'soft_deleted' WHERE id = $1`, [req.params.id]);
        res.json({ success: true, message: 'Order moved to Deleted tab' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed' });
    }
});

/**
 * POST /api/orders/:id/admin-restore — Move back to active
 */
router.post('/:id/admin-restore', useAdminAuth, authenticate, requireAdmin, async (req, res) => {
    try {
        await db.query(`UPDATE orders SET admin_deletion_status = 'active' WHERE id = $1`, [req.params.id]);
        res.json({ success: true, message: 'Order restored to Active queue' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed' });
    }
});

/**
 * DELETE /api/orders/:id — ADMIN ONLY: Delete an order and its files
 */
router.delete('/:id', useAdminAuth, authenticate, requireAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;

        // 1. Fetch to check user deletion status
        const orderRes = await db.query(`SELECT is_deleted_by_user FROM orders WHERE id = $1`, [orderId]);
        if (orderRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Order not found' });

        const order = orderRes.rows[0];

        // If user has NOT deleted it, we just set admin_deletion_status to permanently_deleted établissementétablissement
        if (!order.is_deleted_by_user) {
            await db.query(`UPDATE orders SET admin_deletion_status = 'permanently_deleted' WHERE id = $1`, [orderId]);
            return res.json({ success: true, message: 'Order permanently hidden from Admin dashboard. Still visible to User.' });
        }

        // If user HAS deleted it, we purge from DB fully établissementsétablissement
        const itemsRes = await db.query(`SELECT * FROM order_items WHERE order_id = $1`, [orderId]);
        const items = itemsRes.rows;

        await db.query('BEGIN');
        await db.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);
        await db.query(`DELETE FROM orders WHERE id = $1`, [orderId]);
        await db.query('COMMIT');

        // Physical File Cleanup établissementsétablissement
        for (const item of items) {
            const filesToDelete = [item.original_file_path, item.configured_file_path, item.flat_file_path];
            for (const relPath of filesToDelete) {
                if (relPath) {
                    const fullPath = path.join(__dirname, '..', relPath);
                    if (fs.existsSync(fullPath)) {
                        try { fs.unlinkSync(fullPath); } catch (e) { }
                    }
                }
            }
        }

        res.json({ success: true, message: 'Order and associated manufacturing files purged from database' });
    } catch (err) {
        if (db.query) await db.query('ROLLBACK');
        console.error('Admin permanent delete error:', err);
        res.status(500).json({ success: false, error: 'Failed to purge order' });
    }
});

module.exports = router;

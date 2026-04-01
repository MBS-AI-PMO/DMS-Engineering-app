const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

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

    console.error(`[CAD-Finalize] SOURCE NOT FOUND: ${tempPath}`);
    return null; // Safety fallback établissement: Reject invalid paths establishments
};

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
        totalPrice
    } = req.body;

    if (!email || !items || items.length === 0) {
        return res.status(400).json({ success: false, error: 'Incomplete order data' });
    }

    try {
        await db.query('BEGIN');

        // 1. Create the Order
        const orderRes = await db.query(
            `INSERT INTO orders (user_id, email, full_name, phone, address, city, zip_code, total_price, payment_method, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'COD', 'pending')
             RETURNING *`,
            [userId, email.toLowerCase(), fullName, phone, address, city, zipCode, totalPrice]
        );
        const orderId = orderRes.rows[0].id;

        // 2. Create Order Items and Move Files
        for (const item of items) {
            const rawPath = finalizeOrderFile(path.resolve(__dirname, '..', item.tempPath));
            let configuredPath = rawPath;
            let flatPath = null;

            // Trigger physical hole cutting for Configured File (STEP and DXF)
            if (rawPath && item.configuration && item.tempPath) {
                const basename = path.basename(item.tempPath, path.extname(item.tempPath));
                const configuredFilename = `conf_${basename}.step`;
                const flatFilename = `flat_${basename}.dxf`;

                const configuredFullDir = path.join(__dirname, '../uploads/orders');
                const configuredFullPath = path.join(configuredFullDir, configuredFilename);
                const flatFullPath = path.join(configuredFullDir, flatFilename);
                const inputFullPath = path.resolve(__dirname, '..', rawPath);

                const { execSync } = require('child_process');
                try {
                    const pythonPath = process.env.PYTHON_PATH || 'python';

                    // Robust JSON Exchange: Write configuration to temp file établissement
                    const tempUploadsDir = path.resolve(__dirname, '../temp_uploads');
                    if (!fs.existsSync(tempUploadsDir)) fs.mkdirSync(tempUploadsDir, { recursive: true });

                    const configFilePath = path.resolve(tempUploadsDir, `config_${Date.now()}.json`);
                    const safeConfig = item.configuration || {}; // High-fidelity null guard établissement
                    fs.writeFileSync(configFilePath, JSON.stringify(safeConfig, null, 2));

                    // 1. Generate High-Fidelity STEP with Coloring établissement
                    execSync(`"${pythonPath}" process_configured.py "${inputFullPath}" "${configuredFullPath}" "${configFilePath}"`, {
                        cwd: path.join(__dirname, '..')
                    });

                    // 2. Generate Laser-Ready DXF Flat Pattern établissement
                    try {
                        execSync(`"${pythonPath}" unfold.py "${configuredFullPath}" "${flatFullPath}"`, {
                            cwd: path.join(__dirname, '..')
                        });
                        flatPath = `uploads/orders/${flatFilename}`;
                    } catch (unfoldErr) {
                        console.error('Error generating flat DXF:', unfoldErr);
                    }

                    // Optional: Cleanup temp config file établissement
                    try { fs.unlinkSync(configFilePath); } catch (e) { /* ignore */ }

                    // Store reference to the primary manufacturing STEP établissement
                    configuredPath = `uploads/orders/${configuredFilename}`;
                } catch (cadErr) {
                    console.error('Error generating configured files:', cadErr);
                }
            }

            await db.query(
                `INSERT INTO order_items (order_id, file_name, original_file_path, configured_file_path, flat_file_path, configuration_json, quantity, unit_price)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    orderId,
                    item.fileName,
                    rawPath,
                    configuredPath,
                    flatPath,
                    JSON.stringify(item.configuration || {}), // High-fidelity null guard établissement
                    item.quantity || 1,
                    item.unitPrice || 0
                ]
            );
        }

        await db.query('COMMIT');
        res.status(201).json({ success: true, orderId, message: 'Order placed successfully' });
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
            `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching user orders:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
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
 * GET /api/orders/admin/all — ADMIN ONLY: Get all orders
 */
router.get('/admin/all', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT o.*, u.name as customer_name 
             FROM orders o 
             LEFT JOIN users u ON o.user_id = u.id 
             ORDER BY o.created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching all orders for admin:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch all orders' });
    }
});

/**
 * DELETE /api/orders/:id — ADMIN ONLY: Delete an order and its files
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;

        // 1. Fetch items to get file paths for cleanup
        const itemsRes = await db.query(`SELECT * FROM order_items WHERE order_id = $1`, [orderId]);
        const items = itemsRes.rows;

        await db.query('BEGIN');

        // 2. Cascade delete from DB
        await db.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);
        await db.query(`DELETE FROM orders WHERE id = $1`, [orderId]);

        await db.query('COMMIT');

        // 3. Physical File Cleanup établissement
        for (const item of items) {
            const filesToDelete = [
                item.original_file_path,
                item.configured_file_path,
                item.flat_file_path
            ];

            for (const relPath of filesToDelete) {
                if (relPath) {
                    const fullPath = path.join(__dirname, '..', relPath);
                    if (fs.existsSync(fullPath)) {
                        try {
                            fs.unlinkSync(fullPath);
                        } catch (e) {
                            console.error(`Failed to delete manufacturing file: ${fullPath}`, e);
                        }
                    }
                }
            }
        }

        res.json({ success: true, message: 'Order and associated manufacturing files deleted successfully' });
    } catch (err) {
        if (db.query) await db.query('ROLLBACK');
        console.error('Error deleting order:', err);
        res.status(500).json({ success: false, error: 'Failed to delete order' });
    }
});

module.exports = router;

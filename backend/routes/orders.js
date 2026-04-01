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
    try {
        if (fs.existsSync(tempPath)) {
            fs.renameSync(tempPath, newPath);
            return `uploads/orders/${filename}`;
        }
    } catch (err) {
        console.error('Error moving order file:', err);
    }
    return tempPath; // Fallback to original if move fails
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

            // Trigger physical hole cutting for Configured File
            if (item.configuration && item.tempPath) {
                const configuredFilename = `conf_${path.basename(item.tempPath)}`;
                const configuredFullDir = path.join(__dirname, '../uploads/orders');
                const configuredFullPath = path.join(configuredFullDir, configuredFilename);
                const inputFullPath = path.resolve(__dirname, '..', rawPath);

                const { execSync } = require('child_process');
                try {
                    // Try to run the CAD processor
                    const pythonPath = 'python'; // or your miniconda path
                    const configStr = JSON.stringify(item.configuration).replace(/"/g, '\\"');
                    execSync(`${pythonPath} process_configured.py "${inputFullPath}" "${configuredFullPath}" "${configStr}"`, {
                        cwd: path.join(__dirname, '..')
                    });
                    configuredPath = `uploads/orders/${configuredFilename}`;
                } catch (cadErr) {
                    console.error('Error generating configured STEP:', cadErr);
                    // Fallback to rawPath if generation fails
                }
            }

            await db.query(
                `INSERT INTO order_items (order_id, file_name, original_file_path, configured_file_path, configuration_json, quantity, unit_price)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [orderId, item.fileName, rawPath, configuredPath, JSON.stringify(item.configuration), item.quantity, item.unitPrice]
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

module.exports = router;

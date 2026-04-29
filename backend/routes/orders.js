const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { spawn } = require('child_process');
const util = require('util');

const router = express.Router();

const toFiniteNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const INCH_TO_MM = 25.4;
const inToMm = (value) => {
    const num = toFiniteNumber(value);
    return num === null ? null : num * INCH_TO_MM;
};

const mmToIn = (value) => {
    const num = toFiniteNumber(value);
    return num === null ? null : num / INCH_TO_MM;
};

const normalizeServiceDimension = (inchesValue, unit) => {
    return unit === 'mm' ? inToMm(inchesValue) : inchesValue;
};

const extractOrderItemDimensionsInches = (item) => {
    const cfg = item?.configuration || {};
    const dimIn = cfg?.dimensions?.inches || {};
    const dimMm = cfg?.dimensions?.mm || {};

    let lengthIn = toFiniteNumber(dimIn.l);
    let widthIn = toFiniteNumber(dimIn.w);
    let thicknessIn = toFiniteNumber(dimIn.t);

    if (lengthIn === null) lengthIn = mmToIn(dimMm.l);
    if (widthIn === null) widthIn = mmToIn(dimMm.w);
    if (thicknessIn === null) thicknessIn = mmToIn(dimMm.t);

    return { lengthIn, widthIn, thicknessIn };
};

const validateMetalBounds = ({ metalName, metalConfig, lengthIn, widthIn, thicknessIn }) => {
    if (!(lengthIn > 0) || !(widthIn > 0) || !(thicknessIn > 0)) {
        return 'Missing or invalid model dimensions.';
    }

    const lengthMm = inToMm(lengthIn);
    const widthMm = inToMm(widthIn);
    const thicknessMm = inToMm(thicknessIn);

    // metal_configs bounds are stored in inches; convert to mm for comparison
    const minX = inToMm(metalConfig?.min_x);
    const maxX = inToMm(metalConfig?.max_x);
    const minY = inToMm(metalConfig?.min_y);
    const maxY = inToMm(metalConfig?.max_y);
    const minZ = inToMm(metalConfig?.min_z);
    const maxZ = inToMm(metalConfig?.max_z);

    if (maxX !== null && maxX > 0 && lengthMm > maxX) {
        return `Part length ${lengthMm.toFixed(3)} mm exceeds max ${maxX.toFixed(3)} mm for ${metalName}.`;
    }
    if (minX !== null && minX > 0 && lengthMm < minX) {
        return `Part length ${lengthMm.toFixed(3)} mm is below min ${minX.toFixed(3)} mm for ${metalName}.`;
    }
    if (maxY !== null && maxY > 0 && widthMm > maxY) {
        return `Part width ${widthMm.toFixed(3)} mm exceeds max ${maxY.toFixed(3)} mm for ${metalName}.`;
    }
    if (minY !== null && minY > 0 && widthMm < minY) {
        return `Part width ${widthMm.toFixed(3)} mm is below min ${minY.toFixed(3)} mm for ${metalName}.`;
    }
    // Thickness validation is not needed here — the user selects from a
    // dropdown of available_thicknesses in the UI.  The dimensions.mm.t
    // value is the model's physical thickness which can differ from stock
    // thickness (e.g. bent/formed parts), so comparing it against the
    // allowed list produces false rejections.

    return null;
};

const validateServiceBounds = ({ service, lengthIn, widthIn, thicknessIn }) => {
    if (!service) return null;
    if (!(lengthIn > 0) || !(widthIn > 0) || !(thicknessIn > 0)) {
        return `Missing or invalid dimensions for service ${service.title}.`;
    }

    const unit = String(service.dimensions_unit || 'in').toLowerCase() === 'mm' ? 'mm' : 'in';
    const lengthVal = normalizeServiceDimension(lengthIn, unit);
    const widthVal = normalizeServiceDimension(widthIn, unit);
    const thickVal = normalizeServiceDimension(thicknessIn, unit);
    const unitLabel = unit === 'mm' ? 'mm' : 'in';

    const minL = toFiniteNumber(service.min_length);
    const maxL = toFiniteNumber(service.max_length);
    const minW = toFiniteNumber(service.min_width);
    const maxW = toFiniteNumber(service.max_width);
    const minH = toFiniteNumber(service.min_height);
    const maxH = toFiniteNumber(service.max_height);

    if (maxL !== null && maxL > 0 && lengthVal > maxL) {
        return `Part length ${lengthVal.toFixed(3)} ${unitLabel} exceeds ${service.title} max ${maxL.toFixed(3)} ${unitLabel}.`;
    }
    if (minL !== null && minL > 0 && lengthVal < minL) {
        return `Part length ${lengthVal.toFixed(3)} ${unitLabel} is below ${service.title} min ${minL.toFixed(3)} ${unitLabel}.`;
    }
    if (maxW !== null && maxW > 0 && widthVal > maxW) {
        return `Part width ${widthVal.toFixed(3)} ${unitLabel} exceeds ${service.title} max ${maxW.toFixed(3)} ${unitLabel}.`;
    }
    if (minW !== null && minW > 0 && widthVal < minW) {
        return `Part width ${widthVal.toFixed(3)} ${unitLabel} is below ${service.title} min ${minW.toFixed(3)} ${unitLabel}.`;
    }
    if (maxH !== null && maxH > 0 && thickVal > maxH) {
        return `Part thickness ${thickVal.toFixed(3)} ${unitLabel} exceeds ${service.title} max ${maxH.toFixed(3)} ${unitLabel}.`;
    }
    if (minH !== null && minH > 0 && thickVal < minH) {
        return `Part thickness ${thickVal.toFixed(3)} ${unitLabel} is below ${service.title} min ${minH.toFixed(3)} ${unitLabel}.`;
    }

    return null;
};

const validateOrderItemsAgainstBounds = async (items = []) => {
    const metalCache = new Map();
    const serviceCache = new Map();

    for (let index = 0; index < items.length; index++) {
        const item = items[index] || {};
        const itemLabel = item.fileName || `Item ${index + 1}`;
        const { lengthIn, widthIn, thicknessIn } = extractOrderItemDimensionsInches(item);

        if (!(lengthIn > 0) || !(widthIn > 0) || !(thicknessIn > 0)) {
            return `${itemLabel}: missing or invalid model dimensions.`;
        }

        const metalId = toFiniteNumber(
            item?.configuration?.metal?.id ||
            item?.configuration?.metal_id ||
            item?.metal_id
        );
        if (metalId !== null) {
            let metalCtx = metalCache.get(metalId);
            if (!metalCtx) {
                const metalRes = await db.query(`
                    SELECT m.id, m.name,
                           mc.min_x, mc.max_x, mc.min_y, mc.max_y, mc.min_z, mc.max_z,
                           COALESCE(mc.available_thicknesses, '[]'::jsonb) AS available_thicknesses
                    FROM metals m
                    LEFT JOIN metal_configs mc ON mc.metal_id = m.id
                    WHERE m.id = $1
                `, [metalId]);
                metalCtx = metalRes.rows[0] || null;
                metalCache.set(metalId, metalCtx);
            }

            if (!metalCtx) {
                return `${itemLabel}: selected metal was not found.`;
            }

            const metalError = validateMetalBounds({
                metalName: metalCtx.name,
                metalConfig: metalCtx,
                lengthIn,
                widthIn,
                thicknessIn,
            });
            if (metalError) return `${itemLabel}: ${metalError}`;
        }

        const serviceId = toFiniteNumber(
            item?.configuration?.productionService?.id ||
            item?.configuration?.productionServiceId ||
            item?.configuration?.service?.id ||
            item?.service_id
        );
        if (serviceId !== null) {
            let svc = serviceCache.get(serviceId);
            if (!svc) {
                const svcRes = await db.query(`
                    SELECT id, title, dimensions_unit,
                           min_length, max_length, min_width, max_width, min_height, max_height
                    FROM services
                    WHERE id = $1
                `, [serviceId]);
                svc = svcRes.rows[0] || null;
                serviceCache.set(serviceId, svc);
            }

            if (!svc) {
                return `${itemLabel}: selected production method was not found.`;
            }

            const svcError = validateServiceBounds({ service: svc, lengthIn, widthIn, thicknessIn });
            if (svcError) return `${itemLabel}: ${svcError}`;
        }
    }

    return null;
};

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

    const boundsValidationError = await validateOrderItemsAgainstBounds(items);
    if (boundsValidationError) {
        return res.status(400).json({ success: false, error: boundsValidationError });
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

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const router = express.Router();
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const previewJobs = new Map();
const previewResultCache = new Map();
const CONFIGURED_PREVIEW_ENGINE_VERSION = 'v12-tap-axis-aware-cut';
const PREVIEW_RESULT_TTL_MS = 8 * 60 * 1000;
const PREVIEW_RESULT_CACHE_MAX = 256;

const cleanupPreviewResultCache = () => {
    const now = Date.now();
    for (const [key, entry] of previewResultCache.entries()) {
        if (!entry || entry.expiresAt <= now) {
            previewResultCache.delete(key);
        }
    }

    while (previewResultCache.size > PREVIEW_RESULT_CACHE_MAX) {
        const oldestKey = previewResultCache.keys().next().value;
        if (!oldestKey) break;
        previewResultCache.delete(oldestKey);
    }
};

const getHotPreviewResult = (cacheHash) => {
    cleanupPreviewResultCache();
    const entry = previewResultCache.get(cacheHash);
    if (!entry) return null;
    return entry.value || null;
};

const setHotPreviewResult = (cacheHash, value) => {
    cleanupPreviewResultCache();
    previewResultCache.set(cacheHash, {
        value,
        expiresAt: Date.now() + PREVIEW_RESULT_TTL_MS,
    });
};

const safeReadJson = (filePath) => {
    try {
        if (!filePath || !fs.existsSync(filePath)) return null;
        const raw = fs.readFileSync(filePath, 'utf-8');
        if (!raw || !raw.trim()) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const runPythonScript = (pythonPath, scriptName, args, cwd, timeoutMs = 600000) => {
    return new Promise((resolve, reject) => {
        const py = spawn(pythonPath, [scriptName, ...args], { cwd });
        let stdout = '';
        let stderr = '';
        let timedOut = false;

        const timeout = setTimeout(() => {
            timedOut = true;
            try {
                py.kill('SIGKILL');
            } catch (e) {
                // ignore
            }
            reject(new Error(`Python process timeout after ${timeoutMs}ms (${scriptName})`));
        }, timeoutMs);

        py.stdout.on('data', (data) => { stdout += data.toString(); });
        py.stderr.on('data', (data) => { stderr += data.toString(); });
        py.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
        py.on('close', (code) => {
            clearTimeout(timeout);
            if (timedOut) return;
            if (code === 0) return resolve({ stdout, stderr });
            const msg = (stderr || stdout || `Python process exited with code ${code}`).trim();
            reject(new Error(msg));
        });
    });
};

const findModelInputPath = (backendRoot, tempPath) => {
    const fileName = path.basename(String(tempPath || ''));
    const candidates = [
        path.resolve(backendRoot, String(tempPath || '')),
        path.resolve(backendRoot, 'temp_uploads', fileName),
        path.resolve(backendRoot, 'uploads', 'orders', fileName)
    ];

    const backendRootNorm = backendRoot.toLowerCase();
    for (const candidate of candidates) {
        const normalized = candidate.toLowerCase();
        if (!normalized.startsWith(backendRootNorm)) continue;
        if (fs.existsSync(candidate)) return candidate;
    }

    return null;
};

const compactHardwareAssignments = (selectedHardware = {}) => {
    if (!selectedHardware || typeof selectedHardware !== 'object') return {};

    const compacted = {};
    for (const [holeId, config] of Object.entries(selectedHardware)) {
        if (!config || typeof config !== 'object') continue;

        const hole = config.hole || {};
        const item = config.item || {};

        compacted[holeId] = {
            typeId: config.typeId ?? null,
            face: config.face ?? null,
            hole: {
                id: hole.id ?? holeId,
                position: hole.position ?? null,
                axis: hole.axis ?? null,
                diameter_mm: hole.diameter_mm ?? null,
                diameter_in: hole.diameter_in ?? null,
                diameterInches: hole.diameterInches ?? null,
                depth_mm: hole.depth_mm ?? null,
                depthMm: hole.depthMm ?? null,
                depthInches: hole.depthInches ?? null
            },
            item: {
                name: item.name ?? null,
                size_spec: item.size_spec ?? null,
                tooling_diameter: item.tooling_diameter ?? null,
                minor_dia: item.minor_dia ?? null,
                shank: item.shank ?? null,
                base_width: item.base_width ?? null,
                major_dia: item.major_dia ?? null,
                length: item.length ?? null,
                max_hole_diameter: item.max_hole_diameter ?? null
            }
        };
    }

    return compacted;
};

const compactPreviewConfig = (configuration = {}) => {
    return {
        selectedTaps: configuration.selectedTaps || {},
        selectedCountersinks: configuration.selectedCountersinks || {},
        selectedHardware: compactHardwareAssignments(configuration.selectedHardware || {}),
        thickness: configuration.thickness ?? configuration.selectedThickness ?? configuration?.dimensions?.mm?.t ?? null,
        dimensions: configuration.dimensions || null,
        anodizingColor: configuration.anodizingColor || null
    };
};

const toFiniteNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const INCH_TO_MM = 25.4;
const inToMm = (value) => {
    const num = toFiniteNumber(value);
    return num === null ? null : num * INCH_TO_MM;
};

const findClosest = (values, target) => {
    if (!Array.isArray(values) || values.length === 0) return null;
    let closest = values[0];
    let minDelta = Math.abs(values[0] - target);
    for (let i = 1; i < values.length; i++) {
        const delta = Math.abs(values[i] - target);
        if (delta < minDelta) {
            minDelta = delta;
            closest = values[i];
        }
    }
    return { value: closest, delta: minDelta };
};

const validateMetalBounds = ({ metal, metalConfig, lengthIn, heightIn, thicknessIn }) => {
    if (!metal) return null;
    if (!(lengthIn > 0) || !(heightIn > 0) || !(thicknessIn > 0)) return null;

    const lengthMm = inToMm(lengthIn);
    const heightMm = inToMm(heightIn);
    const thicknessMm = inToMm(thicknessIn);

    // metal_configs bounds are stored in inches; convert to mm for comparison
    const minX = inToMm(metalConfig?.min_x ?? metal?.min_x);
    const maxX = inToMm(metalConfig?.max_x ?? metal?.max_x);
    const minY = inToMm(metalConfig?.min_y ?? metal?.min_y);
    const maxY = inToMm(metalConfig?.max_y ?? metal?.max_y);
    const minZ = inToMm(metalConfig?.min_z ?? metal?.min_z);
    const maxZ = inToMm(metalConfig?.max_z ?? metal?.max_z);

    if (maxX !== null && maxX > 0 && lengthMm > maxX) {
        return `Part length ${lengthMm.toFixed(3)} mm exceeds max ${maxX.toFixed(3)} mm for ${metal.name}.`;
    }
    if (minX !== null && minX > 0 && lengthMm < minX) {
        return `Part length ${lengthMm.toFixed(3)} mm is below min ${minX.toFixed(3)} mm for ${metal.name}.`;
    }
    if (maxY !== null && maxY > 0 && heightMm > maxY) {
        return `Part width ${heightMm.toFixed(3)} mm exceeds max ${maxY.toFixed(3)} mm for ${metal.name}.`;
    }
    if (minY !== null && minY > 0 && heightMm < minY) {
        return `Part width ${heightMm.toFixed(3)} mm is below min ${minY.toFixed(3)} mm for ${metal.name}.`;
    }
    // Thickness validation skipped — user selects from available_thicknesses
    // dropdown.  dimensions.mm.t is the model's physical thickness which can
    // differ from stock thickness on bent/formed parts.

    return null;
};

const normalizeServiceDimension = (inchesValue, unit) => {
    return unit === 'mm' ? inToMm(inchesValue) : inchesValue;
};

const validateServiceBounds = ({ service, lengthIn, heightIn, thicknessIn }) => {
    if (!service) return null;
    if (!(lengthIn > 0) || !(heightIn > 0) || !(thicknessIn > 0)) return null;

    const unit = String(service.dimensions_unit || 'in').toLowerCase() === 'mm' ? 'mm' : 'in';
    const lengthVal = normalizeServiceDimension(lengthIn, unit);
    const heightVal = normalizeServiceDimension(heightIn, unit);
    const thickVal = normalizeServiceDimension(thicknessIn, unit);

    const minL = toFiniteNumber(service.min_length);
    const maxL = toFiniteNumber(service.max_length);
    const minW = toFiniteNumber(service.min_width);
    const maxW = toFiniteNumber(service.max_width);
    const minH = toFiniteNumber(service.min_height);
    const maxH = toFiniteNumber(service.max_height);
    const unitLabel = unit === 'mm' ? 'mm' : 'in';

    if (maxL !== null && maxL > 0 && lengthVal > maxL) {
        return `Part length ${lengthVal.toFixed(3)} ${unitLabel} exceeds ${service.title} max ${maxL.toFixed(3)} ${unitLabel}.`;
    }
    if (minL !== null && minL > 0 && lengthVal < minL) {
        return `Part length ${lengthVal.toFixed(3)} ${unitLabel} is below ${service.title} min ${minL.toFixed(3)} ${unitLabel}.`;
    }
    if (maxW !== null && maxW > 0 && heightVal > maxW) {
        return `Part width ${heightVal.toFixed(3)} ${unitLabel} exceeds ${service.title} max ${maxW.toFixed(3)} ${unitLabel}.`;
    }
    if (minW !== null && minW > 0 && heightVal < minW) {
        return `Part width ${heightVal.toFixed(3)} ${unitLabel} is below ${service.title} min ${minW.toFixed(3)} ${unitLabel}.`;
    }
    if (maxH !== null && maxH > 0 && thickVal > maxH) {
        return `Part thickness ${thickVal.toFixed(3)} ${unitLabel} exceeds ${service.title} max ${maxH.toFixed(3)} ${unitLabel}.`;
    }
    if (minH !== null && minH > 0 && thickVal < minH) {
        return `Part thickness ${thickVal.toFixed(3)} ${unitLabel} is below ${service.title} min ${minH.toFixed(3)} ${unitLabel}.`;
    }

    return null;
};

// ── Admin Routes ─────────────────────────────────────────

/**
 * GET /api/admin/pricing/metadata
 * Returns metals (with their available thicknesses) and services.
 */
router.get('/admin/metadata', authenticate, requireAdmin, async (req, res) => {
    try {
        const [metalsRes, servicesRes] = await Promise.all([
            db.query(`
                SELECT m.id, m.name, m.slug, m.image_path, m.services AS assigned_services,
                       m.quick_look, m.pricing_config
                FROM metals m
                ORDER BY m.name
            `),
            db.query(`SELECT id, title, description, is_production FROM services ORDER BY display_order, id`)
        ]);

        res.json({
            success: true,
            data: {
                metals: metalsRes.rows,
                services: servicesRes.rows
            }
        });
    } catch (err) {
        console.error('Error fetching pricing metadata:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch metadata' });
    }
});

/**
 * GET /api/admin/pricing/:metalId/:serviceId
 * Returns existing pricing rules for a specific metal/service.
 */
router.get('/admin/rules/:metalId/:serviceId', authenticate, requireAdmin, async (req, res) => {
    const { metalId, serviceId } = req.params;
    try {
        const result = await db.query(
            'SELECT * FROM pricing_rules WHERE metal_id = $1 AND service_id = $2',
            [metalId, serviceId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching pricing rules:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch pricing rules' });
    }
});

/**
 * POST /api/admin/pricing/upsert
 * Batch saves/updates pricing rules for a metal/service combination.
 */
router.post('/admin/upsert', authenticate, requireAdmin, async (req, res) => {
    const { metal_id, service_id, rules } = req.body;

    if (!metal_id || !service_id || !Array.isArray(rules)) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        await db.query('BEGIN');

        for (const rule of rules) {
            const { thickness_value, price_per_inch_height, price_per_inch_length, price_per_inch_thickness, base_price } = rule;

            await db.query(`
                INSERT INTO pricing_rules (metal_id, service_id, thickness_value, price_per_inch_height, price_per_inch_length, price_per_inch_thickness, base_price, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (metal_id, service_id, thickness_value)
                DO UPDATE SET
                    price_per_inch_height = EXCLUDED.price_per_inch_height,
                    price_per_inch_length = EXCLUDED.price_per_inch_length,
                    price_per_inch_thickness = EXCLUDED.price_per_inch_thickness,
                    base_price = EXCLUDED.base_price,
                    updated_at = NOW()
            `, [metal_id, service_id, thickness_value, price_per_inch_height || 0, price_per_inch_length || 0, price_per_inch_thickness || 0, base_price || 0]);
        }

        await db.query('COMMIT');
        res.json({ success: true, message: 'Pricing rules updated successfully' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Error upserting pricing rules:', err);
        res.status(500).json({ success: false, error: 'Failed to update pricing rules' });
    }
});

// ── Quantity Discount Admin Routes ─────────────────────────
/**
 * GET /api/admin/pricing/discounts
 */
router.get('/admin/discounts', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM quantity_discounts ORDER BY (quantities->>0)::int ASC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching quantity discounts:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch discounts' });
    }
});

/**
 * POST /api/admin/pricing/discounts/upsert
 */
router.post('/admin/discounts/upsert', authenticate, requireAdmin, async (req, res) => {
    const { id, quantities, discount_percent, is_active } = req.body;

    if (!quantities || !Array.isArray(quantities) || quantities.length === 0 || discount_percent == null) {
        return res.status(400).json({ success: false, error: 'Missing required fields (quantities array and discount_percent)' });
    }

    try {
        const minQty = quantities.length > 0 ? Math.min(...quantities.map(q => parseInt(q))) : 0;

        if (id) {
            await db.query(`
                UPDATE quantity_discounts
                SET quantities = $1, min_quantity = $2, discount_percent = $3, is_active = $4, updated_at = NOW()
                WHERE id = $5
            `, [JSON.stringify(quantities), minQty, discount_percent, is_active !== false, id]);
        } else {
            await db.query(`
                INSERT INTO quantity_discounts (quantities, min_quantity, discount_percent, is_active)
                VALUES ($1, $2, $3, $4)
            `, [JSON.stringify(quantities), minQty, discount_percent, is_active !== false]);
        }
        res.json({ success: true, message: 'Discount tier saved successfully' });
    } catch (err) {
        console.error('Error upserting discount tier:', err);
        res.status(500).json({ success: false, error: 'Failed to save discount tier' });
    }
});

/**
 * DELETE /api/admin/pricing/discounts/:id
 */
router.delete('/admin/discounts/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM quantity_discounts WHERE id = $1', [id]);
        res.json({ success: true, message: 'Discount tier deleted successfully' });
    } catch (err) {
        console.error('Error deleting discount tier:', err);
        res.status(500).json({ success: false, error: 'Failed to delete discount tier' });
    }
});

// ── Laser Cut Rates Admin CRUD ────────────────────────────

/**
 * GET /api/admin/pricing/laser-rates
 */
router.get('/admin/laser-rates', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM laser_cut_rates ORDER BY material_family, thickness ASC'
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching laser rates:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch laser rates' });
    }
});

/**
 * POST /api/admin/pricing/laser-rates
 */
router.post('/admin/laser-rates', authenticate, requireAdmin, async (req, res) => {
    const { material_family, thickness, cut_rate, pierce_time } = req.body;
    if (!thickness || !cut_rate || pierce_time == null) {
        return res.status(400).json({ success: false, error: 'thickness, cut_rate, and pierce_time are required' });
    }
    try {
        const result = await db.query(
            `INSERT INTO laser_cut_rates (material_family, thickness, cut_rate, pierce_time)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [material_family || 'generic', parseFloat(thickness), parseFloat(cut_rate), parseFloat(pierce_time)]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error creating laser rate:', err);
        res.status(500).json({ success: false, error: 'Failed to create laser rate' });
    }
});

/**
 * PUT /api/admin/pricing/laser-rates/:id
 */
router.put('/admin/laser-rates/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { material_family, thickness, cut_rate, pierce_time } = req.body;
    try {
        const result = await db.query(
            `UPDATE laser_cut_rates
             SET material_family = $1, thickness = $2, cut_rate = $3, pierce_time = $4, updated_at = NOW()
             WHERE id = $5 RETURNING *`,
            [material_family || 'generic', parseFloat(thickness), parseFloat(cut_rate), parseFloat(pierce_time), id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Rate not found' });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error updating laser rate:', err);
        res.status(500).json({ success: false, error: 'Failed to update laser rate' });
    }
});

/**
 * DELETE /api/admin/pricing/laser-rates/:id
 */
router.delete('/admin/laser-rates/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM laser_cut_rates WHERE id = $1', [id]);
        res.json({ success: true, message: 'Laser rate deleted' });
    } catch (err) {
        console.error('Error deleting laser rate:', err);
        res.status(500).json({ success: false, error: 'Failed to delete laser rate' });
    }
});

// ── Sheet Cost Rates Admin CRUD ───────────────────────────

const parseSheetCostRatePayload = (body = {}) => {
    const family = typeof body.family === 'string' ? body.family.trim() : '';
    if (!family) {
        return { error: 'family is required' };
    }

    const hasThicknessPoint = body.thickness != null && String(body.thickness).trim() !== '';
    let minThick;
    let maxThick;

    if (hasThicknessPoint) {
        const thickness = parseFloat(body.thickness);
        if (!Number.isFinite(thickness) || thickness <= 0) {
            return { error: 'thickness must be a positive number' };
        }
        minThick = thickness;
        maxThick = thickness;
    } else {
        minThick = parseFloat(body.min_thick);
        maxThick = parseFloat(body.max_thick);
        if (!Number.isFinite(minThick) || !Number.isFinite(maxThick) || minThick <= 0 || maxThick <= 0) {
            return { error: 'thickness is required' };
        }
        if (maxThick < minThick) {
            return { error: 'max_thick must be greater than or equal to min_thick' };
        }
    }

    // Column name is legacy; value now represents cost for a 5x10 sheet.
    const sheetCost = parseFloat(body.sheet_cost_5x10 ?? body.sheet_cost_4x8);
    if (!Number.isFinite(sheetCost) || sheetCost < 0) {
        return { error: 'sheet_cost_5x10 must be a valid non-negative number' };
    }

    let gauge = null;
    if (body.ga != null && String(body.ga).trim() !== '') {
        gauge = parseInt(body.ga, 10);
        if (!Number.isFinite(gauge)) {
            return { error: 'ga must be an integer' };
        }
    }

    return {
        family,
        minThick,
        maxThick,
        gauge,
        sheetCost,
    };
};

/**
 * GET /api/admin/pricing/sheet-cost-rates
 */
router.get('/admin/sheet-cost-rates', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT *,
                    COALESCE(max_thick, min_thick) AS thickness,
                    sheet_cost_4x8 AS sheet_cost_5x10
             FROM sheet_cost_rates
             ORDER BY family, COALESCE(max_thick, min_thick) ASC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching sheet cost rates:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch sheet cost rates' });
    }
});

/**
 * POST /api/admin/pricing/sheet-cost-rates
 */
router.post('/admin/sheet-cost-rates', authenticate, requireAdmin, async (req, res) => {
    const parsed = parseSheetCostRatePayload(req.body || {});
    if (parsed.error) {
        return res.status(400).json({ success: false, error: parsed.error });
    }

    try {
        const result = await db.query(
            `INSERT INTO sheet_cost_rates (family, min_thick, max_thick, ga, sheet_cost_4x8)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [parsed.family, parsed.minThick, parsed.maxThick, parsed.gauge, parsed.sheetCost]
        );
        res.json({
            success: true,
            data: {
                ...result.rows[0],
                thickness: result.rows[0].max_thick,
                sheet_cost_5x10: result.rows[0].sheet_cost_4x8,
            }
        });
    } catch (err) {
        console.error('Error creating sheet cost rate:', err);
        res.status(500).json({ success: false, error: 'Failed to create sheet cost rate' });
    }
});

/**
 * PUT /api/admin/pricing/sheet-cost-rates/:id
 */
router.put('/admin/sheet-cost-rates/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const parsed = parseSheetCostRatePayload(req.body || {});
    if (parsed.error) {
        return res.status(400).json({ success: false, error: parsed.error });
    }

    try {
        const result = await db.query(
            `UPDATE sheet_cost_rates
             SET family = $1, min_thick = $2, max_thick = $3, ga = $4, sheet_cost_4x8 = $5, updated_at = NOW()
             WHERE id = $6 RETURNING *`,
            [parsed.family, parsed.minThick, parsed.maxThick, parsed.gauge, parsed.sheetCost, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Rate not found' });
        res.json({
            success: true,
            data: {
                ...result.rows[0],
                thickness: result.rows[0].max_thick,
                sheet_cost_5x10: result.rows[0].sheet_cost_4x8,
            }
        });
    } catch (err) {
        console.error('Error updating sheet cost rate:', err);
        res.status(500).json({ success: false, error: 'Failed to update sheet cost rate' });
    }
});

/**
 * DELETE /api/admin/pricing/sheet-cost-rates/:id
 */
router.delete('/admin/sheet-cost-rates/:id', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM sheet_cost_rates WHERE id = $1', [id]);
        res.json({ success: true, message: 'Sheet cost rate deleted' });
    } catch (err) {
        console.error('Error deleting sheet cost rate:', err);
        res.status(500).json({ success: false, error: 'Failed to delete sheet cost rate' });
    }
});

// ── Public Discount Tiers (no auth required) ────────────────
router.get('/discounts', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM quantity_discounts WHERE is_active = true ORDER BY (quantities->>0)::int ASC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching public discounts:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch discounts' });
    }
});

// ── Configured STEP Preview (Fast Cached) ─────────────────────────────────
router.post('/configure-preview', async (req, res) => {
    const { tempPath, configuration = {} } = req.body || {};

    if (!tempPath || typeof tempPath !== 'string') {
        return res.status(400).json({ success: false, error: 'tempPath is required' });
    }

    const lowerPath = tempPath.toLowerCase();
    if (!lowerPath.endsWith('.step') && !lowerPath.endsWith('.stp')) {
        return res.status(400).json({ success: false, error: 'Only STEP/STP files are supported' });
    }

    try {
        const backendRoot = path.resolve(__dirname, '..');
        const inputPath = findModelInputPath(backendRoot, tempPath);
        if (!inputPath) {
            return res.status(404).json({ success: false, error: 'Source STEP file not found' });
        }

        const previewConfig = compactPreviewConfig(configuration);
        const hasCountersinks = Object.keys(previewConfig.selectedCountersinks || {}).length > 0;
        const hasTaps = Object.keys(previewConfig.selectedTaps || {}).length > 0;
        const hasHardwareResizing = Object.values(previewConfig.selectedHardware || {}).some((hw) => {
            const t = Number(hw?.typeId);
            return t === 1 || t === 2 || t === 3 || t === 4;
        });
        if (!hasCountersinks && !hasTaps && !hasHardwareResizing) {
            return res.json({ success: true, skipped: true, cached: true, previewPath: null, hardwareResizeReport: {} });
        }

        const stat = fs.statSync(inputPath);
        const scriptPath = path.join(backendRoot, 'process_configured.py');
        const scriptMtimeMs = fs.existsSync(scriptPath) ? fs.statSync(scriptPath).mtimeMs : 0;
        const cacheHash = crypto.createHash('sha1')
            .update(JSON.stringify({
                engine: CONFIGURED_PREVIEW_ENGINE_VERSION,
                scriptMtimeMs,
                source: path.basename(inputPath),
                size: stat.size,
                mtimeMs: stat.mtimeMs,
                cfg: previewConfig
            }))
            .digest('hex')
            .slice(0, 20);

        const previewDir = path.join(backendRoot, 'temp_uploads', 'configured_preview');
        fs.mkdirSync(previewDir, { recursive: true });

        const outputFileName = `preview_${cacheHash}.step`;
        const outputPath = path.join(previewDir, outputFileName);
        // Use /api-prefixed path so production reverse proxies route preview STEP downloads to backend.
        const relativeOutputPath = `api/temp_uploads/configured_preview/${outputFileName}`;
        const reportFileName = `report_${cacheHash}.json`;
        const reportPath = path.join(previewDir, reportFileName);

        const hotResult = getHotPreviewResult(cacheHash);
        if (hotResult && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            return res.json({
                success: true,
                cached: true,
                hot: true,
                previewPath: hotResult.previewPath || relativeOutputPath,
                hardwareResizeReport: hotResult.hardwareResizeReport || {}
            });
        }

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            const cachedReport = safeReadJson(reportPath);
            const cachedResult = {
                previewPath: relativeOutputPath,
                hardwareResizeReport: cachedReport?.hardwareResize || {}
            };
            setHotPreviewResult(cacheHash, cachedResult);
            return res.json({
                success: true,
                cached: true,
                previewPath: relativeOutputPath,
                hardwareResizeReport: cachedResult.hardwareResizeReport
            });
        }

        let job = previewJobs.get(cacheHash);
        if (!job) {
            job = (async () => {
                const configPath = path.join(previewDir, `cfg_${cacheHash}.json`);
                fs.writeFileSync(configPath, JSON.stringify(previewConfig));

                try {
                    const pythonPath = process.env.PYTHON_PATH || 'python';
                    await runPythonScript(
                        pythonPath,
                        'process_configured.py',
                        [inputPath, outputPath, configPath, '--mode=preview', `--report-json=${reportPath}`],
                        backendRoot,
                        60000  // 60-second timeout for preview generation
                    );
                } finally {
                    try { if (fs.existsSync(configPath)) fs.unlinkSync(configPath); } catch (e) { /* ignore */ }
                }
            })();
            previewJobs.set(cacheHash, job);
        }

        try {
            await job;
        } finally {
            if (previewJobs.get(cacheHash) === job) previewJobs.delete(cacheHash);
        }

        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size <= 0) {
            return res.status(500).json({ success: false, error: 'Configured preview generation failed' });
        }

        const generatedReport = safeReadJson(reportPath);
        const generatedResult = {
            previewPath: relativeOutputPath,
            hardwareResizeReport: generatedReport?.hardwareResize || {}
        };
        setHotPreviewResult(cacheHash, generatedResult);
        return res.json({
            success: true,
            cached: false,
            previewPath: relativeOutputPath,
            hardwareResizeReport: generatedResult.hardwareResizeReport
        });
    } catch (err) {
        console.error('Error generating configured preview:', err);
        return res.status(500).json({ success: false, error: err.message || 'Failed to generate configured preview' });
    }
});

// ── Public Calculation Route ────────────────────────────

/**
 * POST /api/pricing/calculate
 *
 * Pricing engine based on CSV formulas:
 *
 * MATERIAL COST  — Sheet nesting formula (sheet metal material.csv)
 *   material_cost = sheet_cost_5x10 / parts_per_sheet
 *   parts_per_sheet = floor(usable_L / buffered_L) × floor(usable_W / buffered_W)
 *   Sheet = 120x60 in (5x10). Buffers: edge=0.125, part=0.0625, kerf=0.01
 *
 * LASER CUTTING  — Time-based formula (laser.csv)
 *   runtime_h = (perimeter_mm / cut_rate_mm_s / 3600) + (pierce_count × pierce_time_s / 3600)
 *   setup_hrs = 0.3 (default), 0.25 if thickness > 0.25 in
 *   cost_per_unit = (hourly_rate × setup_hrs / qty) + (hourly_rate × runtime_h)
 *
 * BENDING        — Categorised per-bend rates (bending.csv)
 *   cost_per_unit = (setup_fee / qty) + sum_of_bend_rates
 *
 * POWDER COATING — Batch-based oven utilisation (powder coating.csv)
 *   Scenario 1: floor(ovenW / (partW+partGap)) × floor(ovenL / (thickness+rackClearance))
 *   Scenario 2: floor(ovenL / (partW+partGap)) × floor(ovenW / (thickness+rackClearance))
 *   parts_per_batch = max(s1, s2)
 *   cost_per_unit = (setup_charge + num_batches × batch_cost) / qty
 *
 * GENERAL MARKUP — percentage from site_settings (general markup.csv)
 */
router.post('/calculate', async (req, res) => {
    const {
        metal_id,
        service_id,
        thickness_value,
        length_in,
        height_in,
        quantity = 1,
        additional_services = [],
        taps = [],
        hardware = [],
        countersinks = []
    } = req.body;

    if (!metal_id && !service_id) {
        return res.status(400).json({ success: false, error: 'Select either a material or a production method to see pricing.' });
    }

    try {
        const qty = parseInt(quantity) || 1;
        const lengthInNum = toFiniteNumber(length_in);
        const heightInNum = toFiniteNumber(height_in);
        const thicknessInNum = toFiniteNumber(thickness_value);

        // 1. Fetch Metal (with category/family for sheet cost lookup) and Primary Service
        const [metalRes, serviceRes, metalConfigRes] = await Promise.all([
            metal_id
                ? db.query(`
                    SELECT m.*, mc.name AS material_family
                    FROM metals m
                    LEFT JOIN metal_categories mc ON m.category_id = mc.id
                    WHERE m.id = $1
                  `, [metal_id])
                : Promise.resolve({ rows: [] }),
            service_id
                ? db.query('SELECT * FROM services WHERE id = $1', [service_id])
                : Promise.resolve({ rows: [] }),
            metal_id
                ? db.query(`
                    SELECT min_x, max_x, min_y, max_y, min_z, max_z,
                           COALESCE(available_thicknesses, '[]'::jsonb) AS available_thicknesses
                    FROM metal_configs
                    WHERE metal_id = $1
                  `, [metal_id])
                : Promise.resolve({ rows: [] })
        ]);

        const metal = metalRes.rows[0] || null;
        const mainService = serviceRes.rows[0] || null;
        const metalConfig = metalConfigRes.rows[0] || null;

        const metalValidationError = validateMetalBounds({
            metal,
            metalConfig,
            lengthIn: lengthInNum,
            heightIn: heightInNum,
            thicknessIn: thicknessInNum,
        });
        if (metalValidationError) {
            return res.status(400).json({ success: false, error: metalValidationError });
        }

        const serviceValidationError = validateServiceBounds({
            service: mainService,
            lengthIn: lengthInNum,
            heightIn: heightInNum,
            thicknessIn: thicknessInNum,
        });
        if (serviceValidationError) {
            return res.status(400).json({ success: false, error: serviceValidationError });
        }

        // ── MATERIAL COST (Sheet Nesting Formula) ─────────────────────────────
        // Source: sheet metal material.csv
        // Cost = sheet_cost_5x10 / parts_per_sheet (per unit)
        // Lookup priority:
        // 1) exact/range match in selected family
        // 2) closest thickness in selected family
        // 3) generic fallback family
        let material_cost = 0;

        const EDGE_BUFFER = 0.125;   // inches – distance from sheet edge to parts
        const PART_BUFFER = 0.0625;  // inches – gap between parts
        const KERF_WIDTH = 0.01;    // inches – laser kerf
        const SHEET_L = 120;      // inches – 10 ft (long side of 5x10 sheet)
        const SHEET_W = 60;       // inches – 5 ft (short side of 5x10 sheet)

        if (metal && thickness_value && parseFloat(length_in) > 0 && parseFloat(height_in) > 0) {
            const thickNum = parseFloat(thickness_value);
            const family = metal.material_family || 'generic';

            let sheetRes = await db.query(
                `SELECT sheet_cost_4x8 FROM sheet_cost_rates
                 WHERE family = $1 AND min_thick <= $2 AND max_thick >= $2
                 ORDER BY max_thick ASC, min_thick ASC
                 LIMIT 1`,
                [family, thickNum]
            );

            if (sheetRes.rows.length === 0) {
                sheetRes = await db.query(
                    `SELECT sheet_cost_4x8 FROM sheet_cost_rates
                     WHERE family = $1
                     ORDER BY ABS(COALESCE(max_thick, min_thick) - $2) ASC,
                              COALESCE(max_thick, min_thick) ASC
                     LIMIT 1`,
                    [family, thickNum]
                );
            }

            if (sheetRes.rows.length === 0 && family !== 'generic') {
                sheetRes = await db.query(
                    `SELECT sheet_cost_4x8 FROM sheet_cost_rates
                     WHERE family = 'generic'
                     ORDER BY ABS(COALESCE(max_thick, min_thick) - $1) ASC,
                              COALESCE(max_thick, min_thick) ASC
                     LIMIT 1`,
                    [thickNum]
                );
            }

            if (sheetRes.rows.length > 0) {
                const sheetCost = parseFloat(sheetRes.rows[0].sheet_cost_4x8);
                const pL = parseFloat(length_in);
                const pW = parseFloat(height_in);

                // Buffered part footprint
                const buffL = pL + PART_BUFFER + KERF_WIDTH;
                const buffW = pW + PART_BUFFER + KERF_WIDTH;

                // Usable sheet dimensions (subtract edge buffers, add one part_buffer back
                // because the last part doesn't need a trailing gap)
                const usableL = SHEET_L - 2 * EDGE_BUFFER + PART_BUFFER;
                const usableW = SHEET_W - 2 * EDGE_BUFFER + PART_BUFFER;

                const pps = Math.floor(usableL / buffL) * Math.floor(usableW / buffW);
                if (pps > 0) {
                    material_cost = sheetCost / pps;
                }
            }
        }

        // ── MAIN SERVICE COST ──────────────────────────────────────────────────
        let main_service_cost = 0;
        let laser_warning = false;
        const techData = req.body.technical_data || {};

        if (mainService) {
            const config = mainService.pricing_config || {};
            const isLaser = mainService.title.toLowerCase().includes('laser');
            const isBending = mainService.title.toLowerCase().includes('bending');
            const isCNC = parseInt(mainService.id) === 2;

            // ── LASER CUTTING (laser.csv) ─────────────────────────────────────
            // runtime_h = (perimeter_mm / cut_rate_mm_s / 3600) + (pierces × pierce_time_s / 3600)
            // setup_hrs = 0.3 default; 0.25 if thickness > 0.25 in  (from CSV conditional)
            // cost/unit = (hourly_rate × setup_hrs / qty) + (hourly_rate × runtime_h)
            if (isLaser && thickness_value) {
                const thickNum = parseFloat(thickness_value);
                const family = metal?.material_family || 'generic';
                const hourly_rate = parseFloat(config.hourly_rate) || 100;

                // Prefer closest available thickness for family/generic rates to avoid false zero-cost results.
                const laserRes = await db.query(
                    `SELECT cut_rate, pierce_time FROM laser_cut_rates
                     WHERE (material_family = $1 OR material_family = 'generic')
                     ORDER BY CASE WHEN material_family = $1 THEN 0 ELSE 1 END,
                              ABS(thickness - $2) ASC,
                              thickness ASC
                     LIMIT 1`,
                    [family, thickNum]
                );

                const rule = laserRes.rows[0];
                if (rule && parseFloat(rule.cut_rate) > 0) {
                    const cut_rate = parseFloat(rule.cut_rate);   // mm/s
                    const pierce_time = parseFloat(rule.pierce_time) || 0; // s

                    // Setup time: 0.3 h thin material, 0.25 h thick material (CSV formula)
                    const setup_hrs = thickNum > 0.25 ? 0.25 : 0.3;

                    // Use technical-data perimeter when available; otherwise approximate from part envelope.
                    const envelopePerimeterMm = ((parseFloat(length_in) || 0) + (parseFloat(height_in) || 0)) * 2 * 25.4;
                    const perimeter_mm = (parseFloat(techData.totalPerimeter) > 0)
                        ? parseFloat(techData.totalPerimeter)
                        : envelopePerimeterMm;

                    // Minimum of one pierce. If backend/front-end provides holes count, prefer that.
                    const pierces = Math.max(1, parseInt(techData.pierceCount || techData.holesCount || 1));

                    // runtime per part (hours)
                    const runtime_h = (perimeter_mm / cut_rate / 3600) + (pierces * pierce_time / 3600);

                    // Amortise one-time setup across qty; add per-part labour
                    main_service_cost = (hourly_rate * setup_hrs / qty) + (hourly_rate * runtime_h);

                    // Thickness warning (CSV: set_operation_name WARNING if > 0.376)
                    if (thickNum > 0.376) laser_warning = true;
                } else {
                    // Fallback when laser rate table has no matching rows.
                    const fallbackCutRate = Math.max(1, parseFloat(config.cut_rate_mm_s || config.cut_rate || 120));
                    const fallbackPierceTime = Math.max(0, parseFloat(config.pierce_time_s || config.pierce_time || 0.35));
                    const setup_hrs = thickNum > 0.25 ? 0.25 : 0.3;
                    const envelopePerimeterMm = ((parseFloat(length_in) || 0) + (parseFloat(height_in) || 0)) * 2 * 25.4;
                    const perimeter_mm = (parseFloat(techData.totalPerimeter) > 0)
                        ? parseFloat(techData.totalPerimeter)
                        : envelopePerimeterMm;
                    const pierces = Math.max(1, parseInt(techData.pierceCount || techData.holesCount || 1));
                    const runtime_h = (perimeter_mm / fallbackCutRate / 3600) + (pierces * fallbackPierceTime / 3600);
                    main_service_cost = (hourly_rate * setup_hrs / qty) + (hourly_rate * runtime_h);

                    if (thickNum > 0.376) laser_warning = true;
                }
            }

            // ── BENDING (bending.csv) ─────────────────────────────────────────
            // cost/unit = (setup_cost / qty) + machine_cost
            // Setup Cost = Labor Rate * (Unique Bends + Unique Advanced Features) * Setup Time Per Feature
            // Machine Cost = (SmallBends * RateS + MedBends * RateM + LargeBends * RateL) * Labor Rate / 3600
            if (isBending && techData.bends && Array.isArray(techData.bends)) {
                // Get config with defaults based on bending.csv
                const laborRate = parseFloat(config.labor_rate) || 85;
                const setupTimePerUnique = parseFloat(config.setup_time_per_unique) || 0.25; // hours

                const medThreshIn = parseFloat(config.med_bend_threshold) || 8;  // inches
                const largeThreshIn = parseFloat(config.large_bend_threshold) || 20; // inches

                const runTimeSmall = parseFloat(config.run_time_small_sec) || 15; // seconds
                const runTimeMed = parseFloat(config.run_time_med_sec) || 15;
                const runTimeLarge = parseFloat(config.run_time_large_sec) || 20;
                const otherTime = parseFloat(config.other_feature_run_time_sec) || 20;

                let machineCostPerUnit = 0;
                const uniqueFeatures = new Set();
                let smallCount = 0, medCount = 0, largeCount = 0, otherCount = 0;

                techData.bends.forEach(bend => {
                    const lenMm = parseFloat(bend.length) || 0;
                    const lenIn = lenMm / 25.4;
                    const radMm = parseFloat(bend.radius) || 0;
                    const ang = Math.round(parseFloat(bend.angle) || 0);

                    // 1. Identify Unique Features (Rad + Angle + type)
                    // Hems are ~180 degree bends
                    const isHem = Math.abs(ang - 180) < 5;
                    const type = isHem ? 'hem' : 'standard';
                    uniqueFeatures.add(`${radMm}_${ang}_${type}`);

                    // 2. Count for Machine Cost
                    if (isHem) {
                        otherCount += 1;
                        machineCostPerUnit += otherTime;
                    } else if (lenIn >= largeThreshIn) {
                        largeCount += 1;
                        machineCostPerUnit += runTimeLarge;
                    } else if (lenIn >= medThreshIn) {
                        medCount += 1;
                        machineCostPerUnit += runTimeMed;
                    } else {
                        smallCount += 1;
                        machineCostPerUnit += runTimeSmall;
                    }
                });

                // Calculate Totals using Bending.csv logic
                const totalUnique = uniqueFeatures.size;
                const setupTimeHrs = totalUnique * setupTimePerUnique;
                const totalSetupCost = setupTimeHrs * laborRate;

                // Final unit price for bending
                main_service_cost = (totalSetupCost / qty) + (machineCostPerUnit * laborRate / 3600);
            }

            // ── CNC MACHINING (dimension-based fallback) ──────────────────────
            if (main_service_cost === 0 && isCNC) {
                const base = parseFloat(config.base_setup) || 25;
                const w_cost = (parseFloat(height_in) || 0) * (parseFloat(config.price_per_width) || 0);
                const l_cost = (parseFloat(length_in) || 0) * (parseFloat(config.price_per_length) || 0);
                const t_cost = (parseFloat(thickness_value) || 0) * (parseFloat(config.price_per_thickness) || 0);
                main_service_cost = base + w_cost + l_cost + t_cost;
            }

            // ── GENERIC SERVICE FALLBACK ──────────────────────────────────────
            if (main_service_cost === 0) {
                main_service_cost = parseFloat(mainService.base_price) || 0;
            }
        }

        // ── ADDITIONAL SERVICES COST ──────────────────────────────────────────
        let additional_cost = 0;
        const service_breakdown = [];

        if (Array.isArray(additional_services) && additional_services.length > 0) {
            for (const sReq of additional_services) {
                const sId = typeof sReq === 'object' ? sReq.id : sReq;
                const optId = typeof sReq === 'object' ? sReq.option_id : null;

                const sRes = await db.query('SELECT * FROM services WHERE id = $1', [sId]);
                if (sRes.rows.length === 0) continue;
                const s = sRes.rows[0];
                const sTitleLower = s.title.toLowerCase();

                // Skip special manual features - they are added separately below with summarized hole costs
                if (sTitleLower.includes('tap') || sTitleLower.includes('hardware') || sTitleLower.includes('countersink')) {
                    continue;
                }

                let sPrice = parseFloat(s.base_price) || 0;
                let sName = s.title;

                const isPowder = sTitleLower.includes('powder') || sTitleLower.includes('coating');

                // ── POWDER COATING (powder coating.csv) ──────────────────────
                // Two orientations tried; use the one that fits more parts per batch.
                // Hanging dimension uses part THICKNESS + 24" (rack clearance), NOT length.
                // cost/unit = (setup_charge + num_batches × batch_cost) / qty
                if (isPowder && s.pricing_config) {
                    const cfg = s.pricing_config;
                    const ovenW = parseFloat(cfg.oven_width) || 90;
                    const ovenL = parseFloat(cfg.oven_length) || 160;
                    const batchCost = parseFloat(cfg.batch_cost) || 150;
                    const setupCharge = (parseFloat(cfg.setup_time) || 15) * (parseFloat(cfg.shop_rate) || 38) / 60;

                    const partGap = parseFloat(cfg.part_gap) || 6;           // inches — horizontal gap between parts
                    const rackClearance = parseFloat(cfg.rack_clearance) || 24; // inches — vertical rack clearance above part

                    const pW = (parseFloat(height_in) || 10) + partGap;              // part width + horizontal gap
                    const pThick = (parseFloat(thickness_value) || 0.1) + rackClearance; // thickness + rack clearance

                    // Scenario 1: part width along oven width, parts hang along oven length
                    const s1 = Math.floor(ovenW / pW) * Math.floor(ovenL / pThick);
                    // Scenario 2: part width along oven length, parts hang along oven width
                    const s2 = Math.floor(ovenL / pW) * Math.floor(ovenW / pThick);

                    const perBatch = Math.max(1, s1, s2);
                    const numBatches = Math.ceil(qty / perBatch);

                    sPrice = (setupCharge + numBatches * batchCost) / qty;
                }

                // Option/colour mapping
                if (optId !== null && s.service_options && Array.isArray(s.service_options)) {
                    const opt = s.service_options.find((o, idx) => o.id === optId || o.index === optId || idx === optId || o.name === optId);
                    if (opt) {
                        sName = `${s.title} - ${opt.name || opt.color}`;
                        // For Powder Coating, the enging covers the cost. 
                        // For others (Anodizing, etc.), they might have a fixed price surcharge.
                        if (!isPowder) {
                            sPrice += parseFloat(opt.price || 0);
                        }
                    }
                }

                // ── BENDING (as additional service) ──────────────────────────
                if (sTitleLower.includes('bend') && techData && Array.isArray(techData.bends) && techData.bends.length > 0) {
                    const cfg = s.pricing_config || {};
                    const laborRate = parseFloat(cfg.labor_rate) || 85;
                    const setupTimePerUnique = parseFloat(cfg.setup_time_per_unique) || 0.25;
                    const medThreshIn = parseFloat(cfg.med_bend_threshold) || 8;
                    const largeThreshIn = parseFloat(cfg.large_bend_threshold) || 20;
                    const runTimeSmall = parseFloat(cfg.run_time_small_sec) || 15;
                    const runTimeMed = parseFloat(cfg.run_time_med_sec) || 15;
                    const runTimeLarge = parseFloat(cfg.run_time_large_sec) || 20;

                    let machineCostPerUnit = 0;
                    const uniqueFeatures = new Set();

                    techData.bends.forEach(bend => {
                        const radMm = Math.round((bend.radius || 0) * 10) / 10;
                        const ang = Math.round(bend.angle || 90);
                        const isHem = Math.abs(ang - 180) < 5;
                        const type = isHem ? 'HEM' : 'BEND';
                        const lenIn = (bend.length || 0) / 25.4;

                        uniqueFeatures.add(`${radMm}_${ang}_${type}`);

                        if (isHem) {
                            machineCostPerUnit += runTimeLarge; // Hem = Large rate
                        } else if (lenIn >= largeThreshIn) {
                            machineCostPerUnit += runTimeLarge;
                        } else if (lenIn >= medThreshIn) {
                            machineCostPerUnit += runTimeMed;
                        } else {
                            machineCostPerUnit += runTimeSmall;
                        }
                    });

                    const totalUnique = uniqueFeatures.size;
                    const setupTimeHrs = totalUnique * setupTimePerUnique;
                    const totalSetupCost = setupTimeHrs * laborRate;

                    sPrice = (totalSetupCost / qty) + (machineCostPerUnit * laborRate / 3600);
                }

                additional_cost += sPrice;
                service_breakdown.push({ name: sName, price: sPrice });
            }
        }

        const parseManualPrice = (p) => {
            if (p === undefined || p === null) return 0;
            const price = parseFloat(p);
            return isNaN(price) ? 0 : price;
        };

        if (Array.isArray(taps) && taps.length > 0) {
            const tapTotal = taps.reduce((acc, t) => acc + parseManualPrice(t.price), 0);
            additional_cost += tapTotal;
            service_breakdown.push({ name: 'Tapping', price: tapTotal });
        }

        if (Array.isArray(hardware) && hardware.length > 0) {
            const hwTotal = hardware.reduce((acc, h) => acc + parseManualPrice(h.price), 0);
            additional_cost += hwTotal;
            service_breakdown.push({ name: 'Hardware', price: hwTotal });
        }

        if (Array.isArray(countersinks) && countersinks.length > 0) {
            const csTotal = countersinks.reduce((acc, c) => acc + parseManualPrice(c.price), 0);
            additional_cost += csTotal;
            service_breakdown.push({ name: 'Countersinking', price: csTotal });
        }

        let unit_total = material_cost + main_service_cost + additional_cost;

        // ── GLOBAL MARKUP (general markup.csv) ───────────────────────────────
        // Simple percentage applied to all pricing — configured in Contact/Settings admin.
        const markupRes = await db.query("SELECT value FROM site_settings WHERE key = 'general_markup'");
        const markupPercent = markupRes.rows.length > 0 ? parseFloat(markupRes.rows[0].value) : 10;
        unit_total = unit_total * (1 + markupPercent / 100);

        // ── QUANTITY DISCOUNTS ────────────────────────────────────────────────
        let discount_percent = 0;
        let applied_tier = null;

        const discountRes = await db.query(`
            SELECT * FROM quantity_discounts
            WHERE is_active = true
            ORDER BY (quantities->>0)::int DESC
        `);

        if (discountRes.rows.length > 0) {
            const matchedTier = discountRes.rows.find(tier => {
                const triggers = Array.isArray(tier.quantities) ? tier.quantities : [];
                return triggers.some(q => parseInt(qty) >= parseInt(q));
            });
            if (matchedTier) {
                discount_percent = parseFloat(matchedTier.discount_percent);
                applied_tier = matchedTier;
            }
        }

        const unit_discount_amount = unit_total * (discount_percent / 100);
        const final_unit_price = Math.max(0, unit_total - unit_discount_amount);
        const final_total = final_unit_price * qty;

        res.json({
            success: true,
            total_price: final_total,
            breakdown: {
                material_cost,
                production_cost: main_service_cost,
                additional_services_cost: additional_cost,
                service_breakdown,
                unit_total,
                final_unit_price,
                discount_percent,
                discount_amount: unit_discount_amount * qty,
                applied_tier,
                warnings: laser_warning
                    ? ['Part thickness exceeds 0.376 in. Please verify laser cutting capability.']
                    : []
            }
        });

    } catch (err) {
        console.error('Error calculating price:', err);
        res.status(500).json({ success: false, error: 'Calculation failed' });
    }
});

module.exports = router;

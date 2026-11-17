const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const router = express.Router();
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const costing = require('../costing');

const previewJobs = new Map();
const previewResultCache = new Map();
const CONFIGURED_PREVIEW_ENGINE_VERSION = 'v14-preview-cleaned';
const PREVIEW_RESULT_TTL_MS = 8 * 60 * 1000;
const PREVIEW_RESULT_CACHE_MAX = 256;

const parseBooleanSetting = (value, fallback = true) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return false;
    if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) return true;
    return fallback;
};

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
                rim_diameter_mm: hole.rim_diameter_mm ?? null,
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
            db.query(`SELECT id, title, description, is_production, is_active FROM services ORDER BY display_order, id`)
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

// ── Public Discount Tiers (no auth required) ────────────────
router.get('/discounts', async (req, res) => {
    try {
        const settingsRes = await db.query("SELECT value FROM site_settings WHERE key = 'discounts_enabled'");
        const discountsEnabled = parseBooleanSetting(settingsRes.rows[0]?.value, true);
        if (!discountsEnabled) {
            return res.json({ success: true, data: [] });
        }

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

/* POST /api/pricing/calculate — a part's price, worked out with the shop's
 * costing rules (backend/costing, set in Admin > Costing). Order placement
 * and PayPal price through priceForSite too, so nothing trusts a price sent
 * by the browser. options.requireMeasured: use only the server's own
 * measurement of the uploaded file (see costing/measure.js). */
async function priceForSite(body = {}, options = {}) {
    const result = await costing.priceQuote(body, options);
    return { ...result, engine: costing.ENGINE_VERSION };
}

router.post('/calculate', async (req, res) => {
    const result = await priceForSite(req.body || {});
    res.status(result.status).json(result.body);
});

module.exports = router;
module.exports.priceForSite = priceForSite;

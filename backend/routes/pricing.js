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

const toFiniteNumber = (val) => {
    const n = parseFloat(val);
    return isFinite(n) ? n : 0;
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

const getConfigHours = (config, keyPrefix, defaultUnit = 'Hours') => {
    let value = parseFloat(config?.[keyPrefix]) || 0;
    const unit = config?.[`${keyPrefix}_unit`] || defaultUnit;

    if (unit === 'Minutes') value /= 60;
    else if (unit === 'Seconds') value /= 3600;

    return value;
};

const getConfigBool = (config, key, fallback = false) => {
    const value = config?.[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    }
    return fallback;
};

const getConfigNumber = (config, key, fallback = 0) => {
    const value = config?.[key];
    if (value === undefined || value === null || value === '') return fallback;
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : fallback;
};

const getConfigInteger = (config, key, fallback = 0) => {
    const value = config?.[key];
    if (value === undefined || value === null || value === '') return fallback;
    const num = parseInt(value, 10);
    return Number.isFinite(num) ? num : fallback;
};

const deriveCncMetrics = ({ lengthIn, heightIn, thicknessIn, techData = {}, config = {} }) => {
    const partLengthIn = Math.max(toFiniteNumber(lengthIn), toFiniteNumber(heightIn));
    const partWidthIn = Math.min(toFiniteNumber(lengthIn), toFiniteNumber(heightIn));
    const partThicknessIn = toFiniteNumber(thicknessIn);
    const areaSqIn = toFiniteNumber(techData.areaSqIn) || (partLengthIn * partWidthIn);
    const perimeterIn = toFiniteNumber(techData.perimeterIn) || (toFiniteNumber(techData.totalPerimeter) / 25.4);
    const holeCount = Math.max(0, parseInt(techData.holeCount ?? techData.holesCount ?? 0, 10) || 0);
    const bendCount = Math.max(0, parseInt(techData.bendCount ?? (Array.isArray(techData.bends) ? techData.bends.length : 0), 10) || 0);
    const hasRaisedFeatures = Boolean(techData.hasRaisedFeatures);
    const raisedFeatureFaceCount = Math.max(0, parseInt(techData.raisedFeatureFaceCount ?? 0, 10) || 0);
    const partVolumeCuIn = toFiniteNumber(techData.partVolumeCuIn);
    const pocketCount = Math.max(0, getConfigInteger(techData, 'pocketCount', 0));
    const slotCount = Math.max(0, getConfigInteger(techData, 'slotCount', 0));
    const recessedFaceCount = Math.max(0, getConfigInteger(techData, 'recessedFaceCount', 0));
    const deepPocketCount = Math.max(0, getConfigInteger(techData, 'deepPocketCount', 0));
    const machiningDirectionCount = Math.max(0, getConfigInteger(techData, 'machiningDirectionCount', 0));
    const setupCountEstimate = Math.max(1, getConfigInteger(techData, 'setupCountEstimate', 1));
    const throughHoleCount = Math.max(0, getConfigInteger(techData, 'throughHoleCount', 0));
    const blindHoleCount = Math.max(0, getConfigInteger(techData, 'blindHoleCount', 0));
    const verticalWallFaceCount = Math.max(0, getConfigInteger(techData, 'verticalWallFaceCount', 0));
    const cylindricalFaceCount = Math.max(0, getConfigInteger(techData, 'cylindricalFaceCount', 0));
    const planarFaceCount = Math.max(0, getConfigInteger(techData, 'planarFaceCount', 0));
    const pocketDepthInMax = toFiniteNumber(techData.pocketDepthInMax)
        || (toFiniteNumber(techData.pocketDepthMmMax) / 25.4);
    const cylindricalAreaRatio = toFiniteNumber(techData.cylindricalAreaRatio);
    const rotationalCandidate = getConfigBool(techData, 'rotationalCandidate', false);

    const stockPadLength = Math.max(0, toFiniteNumber(config.cnc_stock_pad_length_in));
    const stockPadWidth = Math.max(0, toFiniteNumber(config.cnc_stock_pad_width_in));
    const stockPadThickness = Math.max(0, toFiniteNumber(config.cnc_stock_pad_thickness_in));
    const stockLengthIn = partLengthIn + stockPadLength;
    const stockWidthIn = partWidthIn + stockPadWidth;
    const stockThicknessIn = partThicknessIn + stockPadThickness;
    const stockVolumeCuIn = stockLengthIn * stockWidthIn * stockThicknessIn;

    const removedVolumeCuIn = Math.max(
        0,
        toFiniteNumber(techData.removedVolumeCuIn) || (stockVolumeCuIn > 0 && partVolumeCuIn > 0 ? stockVolumeCuIn - partVolumeCuIn : 0)
    );
    const removedVolumeRatio = toFiniteNumber(techData.removedVolumeRatio)
        || (stockVolumeCuIn > 0 ? removedVolumeCuIn / stockVolumeCuIn : 0);

    const featureDensity = toFiniteNumber(techData.featureDensity)
        || (areaSqIn > 0 ? holeCount / areaSqIn : 0);

    const thicknessToSpanRatio = toFiniteNumber(techData.thicknessToSpanRatio)
        || ((partLengthIn > 0 && partWidthIn > 0) ? (partThicknessIn / Math.max(partLengthIn, partWidthIn)) : 0);

    const defaultComplexity =
        (perimeterIn > 0 && areaSqIn > 0 ? perimeterIn / Math.max(1, Math.sqrt(areaSqIn)) : 0)
        + (holeCount * 0.35)
        + (bendCount * 0.5)
        + (pocketCount * 0.8)
        + (slotCount * 0.9)
        + (recessedFaceCount * 0.45)
        + (deepPocketCount * 1.1)
        + (machiningDirectionCount * 0.4)
        + (blindHoleCount * 0.35)
        + (verticalWallFaceCount * 0.08)
        + (cylindricalAreaRatio * 2.5)
        + (removedVolumeRatio * 4)
        + (hasRaisedFeatures ? 2 : 0)
        + (raisedFeatureFaceCount * 0.1);

    const complexityScore = toFiniteNumber(techData.complexityScore) || defaultComplexity;

    const rotationalMinorTolerance = Math.max(0, toFiniteNumber(config.cnc_rotational_minor_tolerance_in)) || 0.05;
    const rotationalLengthRatioThreshold = Math.max(0, toFiniteNumber(config.cnc_rotational_length_ratio_threshold)) || 1.5;
    const minorA = Math.min(partWidthIn, partThicknessIn);
    const minorB = Math.max(partWidthIn, partThicknessIn);
    const likelyRotationalFromEnvelope = minorA > 0
        && Math.abs(minorB - minorA) <= rotationalMinorTolerance
        && (partLengthIn / minorA) >= rotationalLengthRatioThreshold;
    const likelyRotational = Boolean(rotationalCandidate || likelyRotationalFromEnvelope);

    return {
        partLengthIn,
        partWidthIn,
        partThicknessIn,
        areaSqIn,
        perimeterIn,
        holeCount,
        bendCount,
        pocketCount,
        slotCount,
        recessedFaceCount,
        deepPocketCount,
        machiningDirectionCount,
        setupCountEstimate,
        throughHoleCount,
        blindHoleCount,
        verticalWallFaceCount,
        cylindricalFaceCount,
        planarFaceCount,
        pocketDepthInMax,
        cylindricalAreaRatio,
        rotationalCandidate,
        hasRaisedFeatures,
        raisedFeatureFaceCount,
        partVolumeCuIn,
        stockLengthIn,
        stockWidthIn,
        stockThicknessIn,
        stockVolumeCuIn,
        removedVolumeCuIn,
        removedVolumeRatio,
        featureDensity,
        thicknessToSpanRatio,
        complexityScore,
        likelyRotational
    };
};

const deriveCncSetupContext = (config, metrics) => {
    const factorDetails = [];
    let setupCount = Math.max(0, getConfigInteger(config, 'cnc_setup_base_count', 1));
    const maxDimensionIn = Math.max(metrics.partLengthIn, metrics.partWidthIn, metrics.partThicknessIn);

    factorDetails.push({
        label: 'Base Setup Count',
        added_count: setupCount,
        detail: 'Starting setup count before geometry adjustments.'
    });

    const addSetupFactor = (label, addedCount, condition, detail) => {
        if (!condition || addedCount === 0) return;
        setupCount += addedCount;
        factorDetails.push({
            label,
            added_count: addedCount,
            detail
        });
    };

    addSetupFactor(
        'Rotational Part Bonus',
        Math.max(0, getConfigInteger(config, 'cnc_setup_rotational_extra', 0)),
        metrics.likelyRotational,
        'Turned or near-cylindrical parts can require dedicated workholding.'
    );

    const largePartThreshold = Math.max(0, getConfigNumber(config, 'cnc_setup_large_part_threshold_in', 0));
    addSetupFactor(
        'Large Part Threshold',
        Math.max(0, getConfigInteger(config, 'cnc_setup_large_part_extra', 0)),
        largePartThreshold > 0 && maxDimensionIn >= largePartThreshold,
        `Largest dimension ${maxDimensionIn.toFixed(3)} in meets threshold ${largePartThreshold.toFixed(3)} in.`
    );

    const holeThreshold = Math.max(0, getConfigInteger(config, 'cnc_setup_hole_threshold', 0));
    addSetupFactor(
        'Hole Count Threshold',
        Math.max(0, getConfigInteger(config, 'cnc_setup_hole_extra', 0)),
        holeThreshold > 0 && metrics.holeCount >= holeThreshold,
        `Hole count ${metrics.holeCount} meets threshold ${holeThreshold}.`
    );

    const removedRatioThreshold = Math.max(0, getConfigNumber(config, 'cnc_setup_removed_ratio_threshold', 0));
    addSetupFactor(
        'Removed Material Threshold',
        Math.max(0, getConfigInteger(config, 'cnc_setup_removed_ratio_extra', 0)),
        removedRatioThreshold > 0 && metrics.removedVolumeRatio >= removedRatioThreshold,
        `Removed ratio ${metrics.removedVolumeRatio.toFixed(3)} meets threshold ${removedRatioThreshold.toFixed(3)}.`
    );

    const complexityThreshold = Math.max(0, getConfigNumber(config, 'cnc_setup_complexity_threshold', 0));
    addSetupFactor(
        'Complexity Threshold',
        Math.max(0, getConfigInteger(config, 'cnc_setup_complexity_extra', 0)),
        complexityThreshold > 0 && metrics.complexityScore >= complexityThreshold,
        `Complexity ${metrics.complexityScore.toFixed(3)} meets threshold ${complexityThreshold.toFixed(3)}.`
    );

    addSetupFactor(
        'Raised Feature Bonus',
        Math.max(0, getConfigInteger(config, 'cnc_setup_raised_feature_extra', 0)),
        metrics.hasRaisedFeatures,
        'Raised features can require extra orientation or handling.'
    );

    if (getConfigBool(config, 'cnc_setup_feature_estimate_enabled', false)) {
        const featureEstimateWeight = Math.max(0, getConfigNumber(config, 'cnc_setup_feature_estimate_weight', 1));
        const detectedSetupFloor = Math.max(1, Math.round(Math.max(1, metrics.setupCountEstimate || 1) * featureEstimateWeight));
        if (detectedSetupFloor > setupCount) {
            factorDetails.push({
                label: 'CAD Setup Estimate',
                added_count: detectedSetupFloor - setupCount,
                detail: `Topology analysis estimated ${metrics.setupCountEstimate} setup(s), scaled to ${detectedSetupFloor}.`
            });
            setupCount = detectedSetupFloor;
        }
    }

    const maxCount = Math.max(0, getConfigInteger(config, 'cnc_setup_max_count', 0));
    if (maxCount > 0 && setupCount > maxCount) {
        factorDetails.push({
            label: 'Setup Count Cap',
            added_count: maxCount - setupCount,
            detail: `Setup count capped at ${maxCount}.`
        });
        setupCount = maxCount;
    }

    return {
        setup_count: Math.max(0, setupCount),
        max_dimension_in: maxDimensionIn,
        factor_details: factorDetails
    };
};

const isCncOperationEnabled = (op, config, metrics, pricingMode) => {
    const mode = String(
        config?.[`cnc_${op}_mode`]
        || (pricingMode === 'smart' ? 'auto' : 'always')
    ).trim().toLowerCase();

    if (mode === 'never' || mode === 'off' || mode === 'disabled') {
        return { enabled: false, mode, reason: 'Disabled by admin setting.' };
    }

    if (mode === 'always' || pricingMode !== 'smart') {
        return { enabled: true, mode, reason: null };
    }

    if (getConfigBool(config, `cnc_${op}_require_rotational`, false) && !metrics.likelyRotational) {
        return { enabled: false, mode, reason: 'Requires a rotational part.' };
    }

    if (getConfigBool(config, `cnc_${op}_require_non_rotational`, false) && metrics.likelyRotational) {
        return { enabled: false, mode, reason: 'Requires a non-rotational part.' };
    }

    if (metrics.partLengthIn < Math.max(0, toFiniteNumber(config?.[`cnc_${op}_min_length_in`]))) {
        return { enabled: false, mode, reason: 'Part length is below the configured threshold.' };
    }

    if (metrics.partWidthIn < Math.max(0, toFiniteNumber(config?.[`cnc_${op}_min_width_in`]))) {
        return { enabled: false, mode, reason: 'Part width is below the configured threshold.' };
    }

    if (metrics.partThicknessIn < Math.max(0, toFiniteNumber(config?.[`cnc_${op}_min_thickness_in`]))) {
        return { enabled: false, mode, reason: 'Part thickness is below the configured threshold.' };
    }

    if (metrics.holeCount < Math.max(0, parseInt(config?.[`cnc_${op}_min_holes`] ?? 0, 10) || 0)) {
        return { enabled: false, mode, reason: 'Hole count is below the configured threshold.' };
    }

    if (metrics.removedVolumeCuIn < Math.max(0, toFiniteNumber(config?.[`cnc_${op}_min_removed_volume_cuin`]))) {
        return { enabled: false, mode, reason: 'Removed volume is below the configured threshold.' };
    }

    if (metrics.removedVolumeRatio < Math.max(0, toFiniteNumber(config?.[`cnc_${op}_min_removed_ratio`]))) {
        return { enabled: false, mode, reason: 'Removed material ratio is below the configured threshold.' };
    }

    if (metrics.complexityScore < Math.max(0, toFiniteNumber(config?.[`cnc_${op}_min_complexity`]))) {
        return { enabled: false, mode, reason: 'Complexity score is below the configured threshold.' };
    }

    if (metrics.pocketCount < Math.max(0, getConfigInteger(config, `cnc_${op}_min_pockets`, 0))) {
        return { enabled: false, mode, reason: 'Pocket count is below the configured threshold.' };
    }

    if (metrics.slotCount < Math.max(0, getConfigInteger(config, `cnc_${op}_min_slots`, 0))) {
        return { enabled: false, mode, reason: 'Slot count is below the configured threshold.' };
    }

    if (metrics.setupCountEstimate < Math.max(0, getConfigInteger(config, `cnc_${op}_min_setup_count_est`, 0))) {
        return { enabled: false, mode, reason: 'Estimated setup count is below the configured threshold.' };
    }

    if (metrics.machiningDirectionCount < Math.max(0, getConfigInteger(config, `cnc_${op}_min_direction_count`, 0))) {
        return { enabled: false, mode, reason: 'Machining direction count is below the configured threshold.' };
    }

    if (metrics.cylindricalAreaRatio < Math.max(0, getConfigNumber(config, `cnc_${op}_min_cylindrical_ratio`, 0))) {
        return { enabled: false, mode, reason: 'Cylindrical area ratio is below the configured threshold.' };
    }

    switch (op) {
        case 'lathe':
            return {
                enabled: metrics.likelyRotational,
                mode,
                reason: metrics.likelyRotational ? null : 'Lathe is only enabled for rotational geometry.'
            };
        case 'mill':
            return {
                enabled: !metrics.likelyRotational || metrics.holeCount > 0 || metrics.removedVolumeCuIn > 0,
                mode,
                reason: null
            };
        case 'deburr':
            return {
                enabled: metrics.perimeterIn > 0 || metrics.holeCount > 0,
                mode,
                reason: null
            };
        case 'inspect':
            return { enabled: true, mode, reason: null };
        case 'saw':
        default:
            return {
                enabled: metrics.stockVolumeCuIn > 0,
                mode,
                reason: metrics.stockVolumeCuIn > 0 ? null : 'No stock envelope was available for saw estimation.'
            };
    }
};

const getSmartCncRuntimeHours = (op, config, metrics) => {
    const baseRuntime = getConfigHours(config, `cnc_${op}_runtime`, 'Hours');
    const minRuntime = Math.max(0, toFiniteNumber(config?.[`cnc_${op}_min_runtime_hr`]));

    let runtime =
        baseRuntime
        + (metrics.partLengthIn * toFiniteNumber(config?.[`cnc_${op}_per_length_hr`]))
        + (metrics.partWidthIn * toFiniteNumber(config?.[`cnc_${op}_per_width_hr`]))
        + (metrics.partThicknessIn * toFiniteNumber(config?.[`cnc_${op}_per_thickness_hr`]))
        + (metrics.areaSqIn * toFiniteNumber(config?.[`cnc_${op}_per_area_hr`]))
        + (metrics.perimeterIn * toFiniteNumber(config?.[`cnc_${op}_per_perimeter_hr`]))
        + (metrics.holeCount * toFiniteNumber(config?.[`cnc_${op}_per_hole_hr`]))
        + (metrics.bendCount * toFiniteNumber(config?.[`cnc_${op}_per_bend_hr`]))
        + (metrics.partVolumeCuIn * toFiniteNumber(config?.[`cnc_${op}_per_part_volume_hr`]))
        + (metrics.removedVolumeCuIn * toFiniteNumber(config?.[`cnc_${op}_per_removed_volume_hr`]))
        + (metrics.removedVolumeRatio * toFiniteNumber(config?.[`cnc_${op}_per_removed_ratio_hr`]))
        + (metrics.complexityScore * toFiniteNumber(config?.[`cnc_${op}_per_complexity_hr`]))
        + (metrics.featureDensity * toFiniteNumber(config?.[`cnc_${op}_per_feature_density_hr`]))
        + (metrics.thicknessToSpanRatio * toFiniteNumber(config?.[`cnc_${op}_per_thickness_span_hr`]))
        + (metrics.pocketCount * toFiniteNumber(config?.[`cnc_${op}_per_pocket_hr`]))
        + (metrics.slotCount * toFiniteNumber(config?.[`cnc_${op}_per_slot_hr`]))
        + (metrics.recessedFaceCount * toFiniteNumber(config?.[`cnc_${op}_per_recessed_face_hr`]))
        + (metrics.deepPocketCount * toFiniteNumber(config?.[`cnc_${op}_per_deep_pocket_hr`]))
        + (metrics.setupCountEstimate * toFiniteNumber(config?.[`cnc_${op}_per_setup_count_hr`]))
        + (metrics.machiningDirectionCount * toFiniteNumber(config?.[`cnc_${op}_per_direction_hr`]))
        + (metrics.throughHoleCount * toFiniteNumber(config?.[`cnc_${op}_per_through_hole_hr`]))
        + (metrics.blindHoleCount * toFiniteNumber(config?.[`cnc_${op}_per_blind_hole_hr`]))
        + (metrics.verticalWallFaceCount * toFiniteNumber(config?.[`cnc_${op}_per_vertical_wall_face_hr`]))
        + (metrics.cylindricalAreaRatio * toFiniteNumber(config?.[`cnc_${op}_per_cylindrical_ratio_hr`]))
        + (metrics.pocketDepthInMax * toFiniteNumber(config?.[`cnc_${op}_per_pocket_depth_hr`]));

    if (metrics.hasRaisedFeatures) {
        runtime += toFiniteNumber(config?.[`cnc_${op}_raised_feature_hr`]);
    }

    if (metrics.likelyRotational && getConfigBool(config, `cnc_${op}_rotational_bonus_enabled`, false)) {
        runtime += toFiniteNumber(config?.[`cnc_${op}_rotational_bonus_hr`]);
    }

    runtime = Math.max(0, runtime);
    if (minRuntime > 0) runtime = Math.max(runtime, minRuntime);

    return runtime;
};

const deriveCncRiskAdjustments = (config, metrics) => {
    const enabled = getConfigBool(config, 'cnc_risk_enabled', false);
    const items = [];
    const warnings = [];
    let costPerUnit = 0;

    if (!enabled) {
        return {
            enabled: false,
            cost_per_unit: 0,
            items,
            warnings
        };
    }

    const addRisk = ({ key, label, condition, surcharge, metricValue, threshold, comparison, warning }) => {
        if (!condition) return;
        const appliedSurcharge = Math.max(0, surcharge);
        costPerUnit += appliedSurcharge;
        items.push({
            key,
            label,
            surcharge: appliedSurcharge,
            metric_value: metricValue,
            threshold,
            comparison
        });
        if (warning) warnings.push(warning);
    };

    const complexityThreshold = Math.max(0, getConfigNumber(config, 'cnc_risk_complexity_threshold', 0));
    addRisk({
        key: 'complexity',
        label: 'Complexity Risk',
        condition: complexityThreshold > 0 && metrics.complexityScore >= complexityThreshold,
        surcharge: getConfigNumber(config, 'cnc_risk_complexity_surcharge', 0),
        metricValue: metrics.complexityScore,
        threshold: complexityThreshold,
        comparison: '>=',
        warning: `High CNC complexity detected (${metrics.complexityScore.toFixed(2)}).`
    });

    const holeThreshold = Math.max(0, getConfigInteger(config, 'cnc_risk_hole_threshold', 0));
    addRisk({
        key: 'holes',
        label: 'Hole Count Risk',
        condition: holeThreshold > 0 && metrics.holeCount >= holeThreshold,
        surcharge: getConfigNumber(config, 'cnc_risk_hole_surcharge', 0),
        metricValue: metrics.holeCount,
        threshold: holeThreshold,
        comparison: '>=',
        warning: `High hole count detected (${metrics.holeCount} holes).`
    });

    const removedRatioThreshold = Math.max(0, getConfigNumber(config, 'cnc_risk_removed_ratio_threshold', 0));
    addRisk({
        key: 'removed_ratio',
        label: 'Material Removal Risk',
        condition: removedRatioThreshold > 0 && metrics.removedVolumeRatio >= removedRatioThreshold,
        surcharge: getConfigNumber(config, 'cnc_risk_removed_ratio_surcharge', 0),
        metricValue: metrics.removedVolumeRatio,
        threshold: removedRatioThreshold,
        comparison: '>=',
        warning: `High material removal ratio detected (${metrics.removedVolumeRatio.toFixed(3)}).`
    });

    const thicknessSpanThreshold = Math.max(0, getConfigNumber(config, 'cnc_risk_thickness_span_threshold', 0));
    addRisk({
        key: 'thickness_span',
        label: 'Thin Wall Risk',
        condition: thicknessSpanThreshold > 0 && metrics.thicknessToSpanRatio > 0 && metrics.thicknessToSpanRatio <= thicknessSpanThreshold,
        surcharge: getConfigNumber(config, 'cnc_risk_thickness_span_surcharge', 0),
        metricValue: metrics.thicknessToSpanRatio,
        threshold: thicknessSpanThreshold,
        comparison: '<=',
        warning: `Low thickness-to-span ratio detected (${metrics.thicknessToSpanRatio.toFixed(4)}).`
    });

    addRisk({
        key: 'raised_features',
        label: 'Raised Feature Risk',
        condition: metrics.hasRaisedFeatures,
        surcharge: getConfigNumber(config, 'cnc_risk_raised_feature_surcharge', 0),
        metricValue: metrics.raisedFeatureFaceCount,
        threshold: null,
        comparison: 'present',
        warning: 'Raised or non-flat features detected and may require additional machining attention.'
    });

    addRisk({
        key: 'rotational',
        label: 'Rotational Geometry Risk',
        condition: metrics.likelyRotational,
        surcharge: getConfigNumber(config, 'cnc_risk_rotational_surcharge', 0),
        metricValue: 1,
        threshold: null,
        comparison: 'present',
        warning: 'Rotational geometry detected and may require turning-specific setup.'
    });

    return {
        enabled: true,
        cost_per_unit: costPerUnit,
        items,
        warnings
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

    // Support both sheet sizes. Use 0 as default if missing.
    const cost4x8 = parseFloat(body.sheet_cost_4x8 || 0);
    const cost5x10 = parseFloat(body.sheet_cost_5x10 || 0);

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
        cost4x8,
        cost5x10,
        thickness: (minThick + maxThick) / 2
    };
};

/**
 * GET /api/admin/pricing/sheet-cost-rates
 */
router.get('/admin/sheet-cost-rates', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM sheet_cost_rates
             ORDER BY family, COALESCE(max_thick, min_thick, thickness) ASC`
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
            `INSERT INTO sheet_cost_rates (family, min_thick, max_thick, ga, sheet_cost_4x8, sheet_cost_5x10, thickness)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [parsed.family, parsed.minThick, parsed.maxThick, parsed.gauge, parsed.cost4x8, parsed.cost5x10, parsed.thickness]
        );
        res.json({
            success: true,
            data: result.rows[0]
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
             SET family = $1, min_thick = $2, max_thick = $3, ga = $4, sheet_cost_4x8 = $5, sheet_cost_5x10 = $6, thickness = $7, updated_at = NOW()
             WHERE id = $8 RETURNING *`,
            [parsed.family, parsed.minThick, parsed.maxThick, parsed.gauge, parsed.cost4x8, parsed.cost5x10, parsed.thickness, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Rate not found' });
        res.json({
            success: true,
            data: result.rows[0]
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
        const config = mainService?.pricing_config || {};

        const metalValidationError = validateMetalBounds({
            metal,
            metalConfig,
            lengthIn: lengthInNum,
            heightIn: heightInNum,
            thicknessIn: thicknessInNum,
        });

        const serviceValidationError = validateServiceBounds({
            service: mainService,
            lengthIn: lengthInNum,
            heightIn: heightInNum,
            thicknessIn: thicknessInNum,
        });

        const boundsWarning = metalValidationError || serviceValidationError;

        // ── MATERIAL COST (Sheet Nesting Formula) ─────────────────────────────
        // Source: sheet metal material.csv
        // Cost = sheet_cost_5x10 / parts_per_sheet (per unit)
        // Lookup priority:
        // 1) exact/range match in selected family
        // 2) closest thickness in selected family
        // 3) generic fallback family
        let material_cost = 0;
        let lead_days = 0;
        let laser_warning = false;

        if (metal && thickness_value && parseFloat(length_in) > 0 && parseFloat(height_in) > 0) {
            const thickNum = parseFloat(thickness_value);
            const family = metal.material_family || 'generic';

            let sheetRes = await db.query(
                `SELECT sheet_cost_4x8, sheet_cost_5x10 FROM sheet_cost_rates
                 WHERE family = $1 AND min_thick < $2 - 0.001 AND max_thick >= $2
                 ORDER BY max_thick ASC, min_thick ASC
                 LIMIT 1`,
                [family, thickNum]
            );

            if (sheetRes.rows.length === 0) {
                sheetRes = await db.query(
                    `SELECT sheet_cost_4x8, sheet_cost_5x10 FROM sheet_cost_rates
                     WHERE family = $1
                     ORDER BY ABS(COALESCE(max_thick, min_thick) - $2) ASC,
                              COALESCE(max_thick, min_thick) ASC
                     LIMIT 1`,
                    [family, thickNum]
                );
            }

            if (sheetRes.rows.length === 0 && family !== 'generic') {
                sheetRes = await db.query(
                    `SELECT sheet_cost_4x8, sheet_cost_5x10 FROM sheet_cost_rates
                     WHERE family = 'generic'
                     ORDER BY ABS(COALESCE(max_thick, min_thick) - $1) ASC,
                              COALESCE(max_thick, min_thick) ASC
                     LIMIT 1`,
                    [thickNum]
                );
            }

            if (sheetRes.rows.length > 0) {
                const row = sheetRes.rows[0];
                let active_sheet_cost = 0;
                let active_L = 96;
                let active_W = 48;

                // Priority: 5x10 if cost > 0, else 4x8
                if (parseFloat(row.sheet_cost_5x10) > 0) {
                    active_sheet_cost = parseFloat(row.sheet_cost_5x10);
                    active_L = 120;
                    active_W = 60;
                } else if (parseFloat(row.sheet_cost_4x8) > 0) {
                    active_sheet_cost = parseFloat(row.sheet_cost_4x8);
                    active_L = 96;
                    active_W = 48;
                }

                if (active_sheet_cost > 0) {
                    // Buffers from config or formula defaults
                    const EDGE_BUFFER = parseFloat(config.edge_buffer) || 0.125;
                    const PART_BUFFER = parseFloat(config.part_buffer) || 0.0625;
                    const KERF_WIDTH = parseFloat(config.kerf_width) || 0.01;

                    // Orientation-agnostic part dims
                    const pL = Math.max(parseFloat(length_in), parseFloat(height_in));
                    const pW = Math.min(parseFloat(length_in), parseFloat(height_in));

                    const buffL = pL + PART_BUFFER + KERF_WIDTH;
                    const buffW = pW + PART_BUFFER + KERF_WIDTH;

                    // Usable sheet dimensions (subtract edge buffers, add one part_buffer back)
                    const sL = Math.max(active_L, active_W);
                    const sW = Math.min(active_L, active_W);

                    const usableL = sL - 2 * EDGE_BUFFER + PART_BUFFER;
                    const usableW = sW - 2 * EDGE_BUFFER + PART_BUFFER;

                    const pps = Math.floor(usableL / buffL) * Math.floor(usableW / buffW);
                    if (pps > 0) {
                        material_cost = active_sheet_cost / pps;
                    } else {
                        material_cost = 0;
                        laser_warning = true;
                    }
                }
            }
        }

        // ── MAIN SERVICE COST ──────────────────────────────────────────────────
        let main_service_cost = 0;
        const techData = req.body.technical_data || {};
        let cncOperationBreakdown = [];
        let cncDerivedMetrics = null;
        let cncSetupContext = null;
        let cncRiskBreakdown = null;
        let cncWarnings = [];

        if (mainService) {
            const sTitle = (mainService.title || "").toLowerCase();
            const isLaser = sTitle.includes('laser');
            const isBending = sTitle.includes('bending');
            const isCNC = parseInt(mainService.id) === 2 || sTitle.includes('cnc');

            // ── LASER CUTTING (Refined Formula) ───────────────────────────────
            if (isLaser && thickness_value) {
                const thickNum = parseFloat(thickness_value);
                const family = metal?.material_family || 'generic';
                const hourly_rate = parseFloat(config.hourly_rate) || 0;
                const daily_capacity = parseFloat(config.daily_capacity_hrs) || 0;

                // Lookup rates: thickness >= part_thickness
                const laserRes = await db.query(
                    `SELECT cut_rate, pierce_time FROM laser_cut_rates
                     WHERE (material_family = $1 OR material_family = 'generic')
                       AND thickness >= $2
                     ORDER BY CASE WHEN material_family = $1 THEN 0 ELSE 1 END,
                              thickness ASC,
                              cut_rate DESC
                     LIMIT 1`,
                    [family, thickNum]
                );

                const rule = laserRes.rows[0];
                if (rule && parseFloat(rule.cut_rate) > 0) {
                    const cut_rate = parseFloat(rule.cut_rate);   // mm/s
                    const pierce_time = parseFloat(rule.pierce_time) || 0; // s

                    // 1. Setup Time: Formula defaults (0.3/0.25) or Config override
                    let setup_hrs = parseFloat(config.laser_setup_time_hr);
                    if (isNaN(setup_hrs) || setup_hrs === 0) {
                        setup_hrs = thickNum > 0.25 ? 0.25 : 0.3;
                    }

                    // 2. Cut Length (Perimeter + Etching)
                    const envelopePerimeterMm = ((parseFloat(length_in) || 0) + (parseFloat(height_in) || 0)) * 2 * 25.4;
                    const perimeter_mm = (parseFloat(techData.totalPerimeter) > 0)
                        ? parseFloat(techData.totalPerimeter)
                        : envelopePerimeterMm;

                    const etch_mm = (parseFloat(techData.etchLength) || 0) * 25.4;
                    const total_cut_mm = perimeter_mm + etch_mm;

                    // 3. Pierce Count
                    const pierces = Math.max(1, parseInt(techData.pierceCount || techData.holesCount || 1)) + 1;

                    // 4. Runtime per part (hours)
                    const runtime_h = (total_cut_mm / cut_rate / 3600) + (pierces * pierce_time / 3600);

                    // 5. Total Cost
                    const setup_cost = hourly_rate * setup_hrs;
                    main_service_cost = (setup_cost / qty) + (hourly_rate * runtime_h);

                    // 6. Lead Days
                    if (daily_capacity > 0) {
                        lead_days = Math.ceil((setup_hrs + runtime_h * qty) / daily_capacity);
                    }

                    // Thickness warning (CSV: set_operation_name WARNING if > 0.376)
                    if (thickNum > 0.376) laser_warning = true;
                } else {
                    // Fallback logic
                    const fallbackCutRate = parseFloat(config.cut_rate_mm_s || config.cut_rate) || 0;
                    const fallbackPierceTime = parseFloat(config.pierce_time_s || config.pierce_time) || 0;

                    let setup_hrs = parseFloat(config.laser_setup_time_hr);
                    if (isNaN(setup_hrs) || setup_hrs === 0) {
                        setup_hrs = thickNum > 0.25 ? 0.25 : 0.3;
                    }

                    const envelopePerimeterMm = ((parseFloat(length_in) || 0) + (parseFloat(height_in) || 0)) * 2 * 25.4;
                    const perimeter_mm = (parseFloat(techData.totalPerimeter) > 0)
                        ? parseFloat(techData.totalPerimeter)
                        : envelopePerimeterMm;

                    const pierces = Math.max(1, parseInt(techData.pierceCount || techData.holesCount || 1)) + 1;
                    const runtime_h = (perimeter_mm / (fallbackCutRate || 1) / 3600) + (pierces * fallbackPierceTime / 3600);

                    main_service_cost = (hourly_rate * setup_hrs / qty) + (hourly_rate * runtime_h);

                    const daily_capacity = parseFloat(config.daily_capacity_hrs) || 0;
                    if (daily_capacity > 0) {
                        lead_days = Math.ceil((setup_hrs + runtime_h * qty) / daily_capacity);
                    }

                    if (thickNum > 0.376) laser_warning = true;
                }
            }

            // ── BENDING (bending.csv) ─────────────────────────────────────────
            // cost/unit = (setup_cost / qty) + machine_cost
            // Setup Cost = Labor Rate * (Unique Bends) * Setup Time Per Feature
            // Machine Cost = (SmallBends * RateS + MedBends * RateM + LargeBends * RateL + Other * RateO)
            if (isBending && techData.bends && Array.isArray(techData.bends)) {
                const laborRate = parseFloat(config.labor_rate) || 0;
                const setupTimePerUnique = parseFloat(config.setup_time_per_unique) || 0;

                const medThreshIn = parseFloat(config.med_bend_threshold) || 0;
                const largeThreshIn = parseFloat(config.large_bend_threshold) || 0;

                const rateSmall = parseFloat(config.small_bend_rate) || 0;
                const rateMed = parseFloat(config.med_bend_rate) || 0;
                const rateLarge = parseFloat(config.large_bend_rate) || 0;
                const rateOther = parseFloat(config.other_formed_feature_rate) || 0;

                let machineCostPerUnit = 0;
                const uniqueFeatures = new Set();

                techData.bends.forEach(bend => {
                    const lenMm = parseFloat(bend.length) || 0;
                    const lenIn = lenMm / 25.4;
                    const radMm = Math.round((parseFloat(bend.radius) || 0) * 10) / 10;
                    const ang = Math.round(parseFloat(bend.angle) || 0);

                    const isHem = Math.abs(ang - 180) < 5;
                    const type = isHem ? 'hem' : 'standard';
                    uniqueFeatures.add(`${radMm}_${ang}_${type}`);

                    if (isHem) {
                        machineCostPerUnit += rateOther;
                    } else if (lenIn >= largeThreshIn) {
                        machineCostPerUnit += rateLarge;
                    } else if (lenIn >= medThreshIn) {
                        machineCostPerUnit += rateMed;
                    } else {
                        machineCostPerUnit += rateSmall;
                    }
                });

                const totalUnique = uniqueFeatures.size;
                const totalSetupCost = totalUnique * setupTimePerUnique * laborRate;

                // Final unit price for bending (Setup amortized + direct machine dollar rates)
                main_service_cost = (totalSetupCost / qty) + machineCostPerUnit;
            }

            // ── CNC MACHINING (Multi-Operation Formula) ──────────────────────
            if (isCNC) {
                let totalCncProductionCost = 0;
                const operations = ['saw', 'lathe', 'mill', 'deburr', 'inspect'];
                const cncPricingMode = String(config.cnc_pricing_mode || 'manual').trim().toLowerCase();
                let enabledCncOperationCount = 0;
                cncDerivedMetrics = deriveCncMetrics({
                    lengthIn: lengthInNum,
                    heightIn: heightInNum,
                    thicknessIn: thicknessInNum,
                    techData,
                    config
                });
                cncSetupContext = cncPricingMode === 'smart'
                    ? deriveCncSetupContext(config, cncDerivedMetrics)
                    : null;

                operations.forEach(op => {
                    const baseSetupHours = getConfigHours(config, `cnc_${op}_setup`, 'Hours');
                    let setupHours = baseSetupHours;
                    let runtime = getConfigHours(config, `cnc_${op}_runtime`, 'Hours');
                    const rate = parseFloat(config[`cnc_${op}_rate`]) || 0;
                    const enabledInfo = isCncOperationEnabled(op, config, cncDerivedMetrics, cncPricingMode);
                    const setupMultiplier = cncPricingMode === 'smart'
                        ? Math.max(0, getConfigNumber(config, `cnc_${op}_setup_multiplier`, 1))
                        : 1;
                    const setupCount = cncPricingMode === 'smart'
                        ? Math.max(0, toFiniteNumber(cncSetupContext?.setup_count))
                        : 1;

                    if (cncPricingMode === 'smart') {
                        runtime = getSmartCncRuntimeHours(op, config, cncDerivedMetrics);
                        setupHours = baseSetupHours * setupMultiplier * setupCount;
                    }

                    if (!enabledInfo.enabled || rate <= 0 || (setupHours <= 0 && runtime <= 0)) {
                        cncOperationBreakdown.push({
                            operation: op,
                            enabled: false,
                            mode: enabledInfo.mode,
                            skip_reason: enabledInfo.reason || null,
                            base_setup_hours: baseSetupHours,
                            setup_multiplier: setupMultiplier,
                            setup_count: setupCount,
                            setup_hours: setupHours,
                            runtime_hours_per_part: runtime,
                            rate,
                            unit_cost: 0
                        });
                        return;
                    }

                    enabledCncOperationCount += 1;

                    // PRICE = (runtime * qty + setup) * shop_rate
                    const opCostTotal = (runtime * qty + setupHours) * rate;
                    const unitCost = qty > 0 ? (opCostTotal / qty) : 0;

                    if (qty > 0) {
                        totalCncProductionCost += unitCost;
                    }

                    cncOperationBreakdown.push({
                        operation: op,
                        enabled: true,
                        mode: enabledInfo.mode,
                        skip_reason: null,
                        base_setup_hours: baseSetupHours,
                        setup_multiplier: setupMultiplier,
                        setup_count: setupCount,
                        setup_hours: setupHours,
                        runtime_hours_per_part: runtime,
                        rate,
                        unit_cost: unitCost
                    });
                });

                if (cncPricingMode === 'smart') {
                    cncRiskBreakdown = deriveCncRiskAdjustments(config, cncDerivedMetrics);
                    const rawRiskCost = Math.max(0, toFiniteNumber(cncRiskBreakdown?.cost_per_unit));
                    const applyRiskCost = enabledCncOperationCount > 0 && rawRiskCost > 0;
                    const appliedRiskCost = applyRiskCost ? rawRiskCost : 0;

                    cncRiskBreakdown = {
                        ...(cncRiskBreakdown || {}),
                        applied: applyRiskCost,
                        cost_per_unit_raw: rawRiskCost,
                        cost_per_unit: appliedRiskCost,
                        items: Array.isArray(cncRiskBreakdown?.items)
                            ? cncRiskBreakdown.items.map(item => ({
                                ...item,
                                surcharge_applied: applyRiskCost ? Math.max(0, toFiniteNumber(item?.surcharge)) : 0
                            }))
                            : []
                    };

                    cncWarnings = Array.isArray(cncRiskBreakdown?.warnings)
                        ? [...cncRiskBreakdown.warnings]
                        : [];

                    if (enabledCncOperationCount === 0) {
                        cncWarnings.push('No CNC operations were enabled by the current smart rules.');
                    }

                    totalCncProductionCost += appliedRiskCost;
                }

                if (totalCncProductionCost > 0) {
                    console.log(`[Debug] CNC Production Cost Breakdown:`, {
                        totalUnit: totalCncProductionCost,
                        mode: cncPricingMode,
                        metrics: cncDerivedMetrics,
                        setupContext: cncSetupContext,
                        risk: cncRiskBreakdown,
                        operations: cncOperationBreakdown,
                        qty
                    });
                }
                main_service_cost = totalCncProductionCost;
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
                    const ovenW = parseFloat(cfg.oven_width) || 0;
                    const ovenL = parseFloat(cfg.oven_length) || 0;
                    const batchCost = parseFloat(cfg.batch_cost) || 0;
                    const setupCharge = (parseFloat(cfg.setup_time) || 0) * (parseFloat(cfg.shop_rate) || 0) / 60;

                    const partGap = parseFloat(cfg.part_gap) || 0;
                    const rackClearance = parseFloat(cfg.rack_clearance) || 0;

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
                    const laborRate = parseFloat(cfg.labor_rate) || 0;
                    const setupTimePerUnique = parseFloat(cfg.setup_time_per_unique) || 0;
                    const medThreshIn = parseFloat(cfg.med_bend_threshold) || 0;
                    const largeThreshIn = parseFloat(cfg.large_bend_threshold) || 0;

                    const rateSmall = parseFloat(cfg.small_bend_rate) || 0;
                    const rateMed = parseFloat(cfg.med_bend_rate) || 0;
                    const rateLarge = parseFloat(cfg.large_bend_rate) || 0;
                    const rateOther = parseFloat(cfg.other_formed_feature_rate) || 0;

                    let machineCostPerUnit = 0;
                    const uniqueFeatures = new Set();
                    const bends = Array.isArray(techData.bends) ? techData.bends : [];

                    bends.forEach(bend => {
                        const radMm = Math.round((parseFloat(bend.radius) || 0) * 10) / 10;
                        const ang = Math.round(parseFloat(bend.angle) || 0);
                        const isHem = Math.abs(ang - 180) < 5;
                        const type = isHem ? 'HEM' : 'BEND';
                        const lenIn = (parseFloat(bend.length) || 0) / 25.4;

                        uniqueFeatures.add(`${radMm}_${ang}_${type}`);

                        if (isHem) {
                            machineCostPerUnit += rateOther;
                        } else if (lenIn >= largeThreshIn) {
                            machineCostPerUnit += rateLarge;
                        } else if (lenIn >= medThreshIn) {
                            machineCostPerUnit += rateMed;
                        } else {
                            machineCostPerUnit += rateSmall;
                        }
                    });

                    const totalUnique = uniqueFeatures.size;
                    const totalSetupCost = totalUnique * setupTimePerUnique * laborRate;
                    sPrice = (totalSetupCost / qty) + machineCostPerUnit;
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

        // ── MARKUPS & FINAL TOTALS ──────────────────────────────────────────
        const settingsRes = await db.query("SELECT key, value FROM site_settings WHERE key IN ('general_markup', 'inside_labor_markup', 'material_markup', 'overhead_markup', 'markup_enabled_services')");
        const settings = {};
        settingsRes.rows.forEach(r => {
            if (r.key === 'markup_enabled_services') {
                try {
                    settings[r.key] = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
                } catch (e) { settings[r.key] = []; }
            } else {
                settings[r.key] = toFiniteNumber(r.value);
            }
        });

        const genMU = settings.general_markup || 0;
        const insMU = settings.inside_labor_markup || 0;
        const matMU = settings.material_markup || 0;
        const ovhMU = settings.overhead_markup || 0;
        const markupServices = Array.isArray(settings.markup_enabled_services) ? settings.markup_enabled_services : [];

        // Factors
        const material_factor = 1 + matMU / 100;
        const inside_factor = 1 + (genMU + insMU + ovhMU) / 100;

        // Apply markup selectively to Main Service
        const applyToMain = markupServices.includes(mainService?.title);
        const main_mu_factor = applyToMain ? inside_factor : 1;

        const material_marked_up = material_cost * material_factor;
        const production_marked_up = main_service_cost * main_mu_factor;
        const markedCncOperationBreakdown = cncOperationBreakdown.map(op => ({
            ...op,
            unit_cost_marked_up: (parseFloat(op?.unit_cost) || 0) * main_mu_factor
        }));
        const markedCncRiskBreakdown = cncRiskBreakdown ? {
            ...cncRiskBreakdown,
            cost_per_unit_marked_up: (parseFloat(cncRiskBreakdown?.cost_per_unit) || 0) * main_mu_factor,
            cost_per_unit_raw_marked_up: (parseFloat(cncRiskBreakdown?.cost_per_unit_raw) || 0) * main_mu_factor,
            items: Array.isArray(cncRiskBreakdown.items)
                ? cncRiskBreakdown.items.map(item => ({
                    ...item,
                    surcharge_marked_up: (parseFloat(item?.surcharge_applied ?? item?.surcharge) || 0) * main_mu_factor
                }))
                : []
        } : null;

        const marked_service_breakdown = [];
        let total_additional_marked_up = 0;
        let total_sub_services_marked_up = 0;

        // 1. Add Main Service (e.g. Laser Cutting)
        if (production_marked_up > 0.001) {
            marked_service_breakdown.push({
                name: mainService?.title || 'Production',
                price: production_marked_up
            });
        }

        // 2. Add existing labor items (Bending, Tapping, Hardware, etc.)
        for (const item of service_breakdown) {
            const applyToSvc = markupServices.includes(item.name);
            const svc_mu_factor = applyToSvc ? inside_factor : 1;
            const price_mu = item.price * svc_mu_factor;

            if (price_mu > 0.001) {
                total_sub_services_marked_up += price_mu;
                marked_service_breakdown.push({
                    name: item.name,
                    price: price_mu
                });
            }
        }

        // 3. Add Additional Services (e.g. Powder Coating)
        for (const svc of additional_services) {
            const applyToSvc = markupServices.includes(svc.service_title);
            const svc_mu_factor = applyToSvc ? inside_factor : 1;
            const price_mu = svc.price_raw * svc_mu_factor;

            if (price_mu > 0.001) {
                total_additional_marked_up += price_mu;
                marked_service_breakdown.push({
                    name: svc.service_title,
                    price: price_mu
                });
            }
        }

        let unit_total = material_marked_up + production_marked_up + total_sub_services_marked_up + total_additional_marked_up;

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
                return triggers.length > 0 && triggers.some(q => {
                    const val = parseInt(q);
                    return !isNaN(val) && parseInt(qty) >= val;
                });
            });
            if (matchedTier) {
                discount_percent = parseFloat(matchedTier.discount_percent);
                applied_tier = matchedTier;
            }
        }

        const unit_discount_amount = unit_total * (discount_percent / 100);
        const final_unit_price = Math.max(0, unit_total - unit_discount_amount);
        const final_total = Number.isFinite(final_unit_price * qty) ? (final_unit_price * qty) : 0;

        console.log('[Debug] Price Calculation:', {
            material: material_marked_up,
            production: production_marked_up,
            sub_services: total_sub_services_marked_up,
            additional: total_additional_marked_up,
            unit_total,
            final_unit_price,
            qty,
            final_total
        });

        const warnings = Array.from(new Set([
            ...(boundsWarning ? [boundsWarning] : []),
            ...(laser_warning ? ['Part dimensions or thickness exceed standard limits. Please verify capability.'] : []),
            ...(material_cost === 0 && (parseFloat(length_in) > 0 || parseFloat(height_in) > 0) ? ['Part is too large for a standard 5x10 sheet.'] : []),
            ...(Array.isArray(cncWarnings) ? cncWarnings : [])
        ].filter(Boolean)));

        res.json({
            success: true,
            total_price: final_total,
            lead_days: lead_days || 0,
            breakdown: {
                material_cost: material_marked_up,
                production_cost: production_marked_up,
                additional_services_cost: total_additional_marked_up,
                service_breakdown: marked_service_breakdown,
                unit_total,
                final_unit_price,
                discount_percent,
                discount_amount: unit_discount_amount * qty,
                applied_tier,
                cnc_operation_breakdown: markedCncOperationBreakdown,
                cnc_derived_metrics: cncDerivedMetrics,
                cnc_setup_context: cncSetupContext,
                cnc_risk_breakdown: markedCncRiskBreakdown,
                warnings
            }
        });

    } catch (err) {
        console.error('Error calculating price:', err);
        res.status(500).json({ success: false, error: 'Calculation failed' });
    }
});

module.exports = router;

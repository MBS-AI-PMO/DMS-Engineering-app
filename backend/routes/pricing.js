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

const getConfigNumber = (config, keys, fallback = 0) => {
    for (const key of keys) {
        if (config && config[key] !== undefined && config[key] !== null && config[key] !== '') {
            const value = parseFloat(config[key]);
            if (Number.isFinite(value)) return value;
        }
    }
    return fallback;
};

const roundTo = (value, decimals = 2) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const factor = 10 ** decimals;
    return Math.round(number * factor) / factor;
};

const parseBooleanSetting = (value, fallback = true) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return false;
    if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) return true;
    return fallback;
};

const getObjectValue = (obj, keys) => {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
            return obj[key];
        }
    }
    return undefined;
};

const getQuantitySpecificNestValue = (source, quantity, quantities = [1, 5, 10, 15, 20]) => {
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    if (!source) return 0;

    if (typeof source === 'string') {
        const trimmed = source.trim();
        if (!trimmed) return 0;
        try {
            return getQuantitySpecificNestValue(JSON.parse(trimmed), qty, quantities);
        } catch (e) {
            const values = trimmed.split(',').map(item => toFiniteNumber(item.trim()));
            return getQuantitySpecificNestValue(values, qty, quantities);
        }
    }

    if (Array.isArray(source)) {
        const objectMatch = source.find(item => {
            if (!item || typeof item !== 'object') return false;
            return parseInt(item.quantity ?? item.qty ?? item.make_quantity, 10) === qty;
        });
        if (objectMatch) {
            return toFiniteNumber(objectMatch.value ?? objectMatch.sheets ?? objectMatch.number_of_sheets ?? objectMatch.numberOfSheets);
        }

        const scalarIndex = quantities.findIndex(q => parseInt(q, 10) === qty);
        if (scalarIndex >= 0) return toFiniteNumber(source[scalarIndex]);
        return 0;
    }

    if (typeof source === 'object') {
        return toFiniteNumber(source[qty] ?? source[String(qty)]);
    }

    return toFiniteNumber(source);
};

const estimatePaperlessSheetNest = ({
    sheetLength,
    sheetWidth,
    partLength,
    partWidth,
    edgeBuffer,
    partBuffer,
    kerfWidth,
    quantity
}) => {
    const qty = Math.max(1, Math.round(toFiniteNumber(quantity)) || 1);
    const sL = Math.max(toFiniteNumber(sheetLength), toFiniteNumber(sheetWidth));
    const sW = Math.min(toFiniteNumber(sheetLength), toFiniteNumber(sheetWidth));
    const pL = Math.max(toFiniteNumber(partLength), toFiniteNumber(partWidth));
    const pW = Math.min(toFiniteNumber(partLength), toFiniteNumber(partWidth));
    if (sL <= 0 || sW <= 0 || pL <= 0 || pW <= 0) return null;
    if (pL > sL || pW > sW) return null;

    const edge = Math.max(0, toFiniteNumber(edgeBuffer));
    const spacing = Math.max(0, toFiniteNumber(partBuffer) + toFiniteNumber(kerfWidth));
    const orientations = [
        { orientation: 'long-x', x: pL, y: pW },
        { orientation: 'short-x', x: pW, y: pL }
    ].filter((option, index, list) => (
        index === 0 || Math.abs(option.x - list[0].x) > 0.0001 || Math.abs(option.y - list[0].y) > 0.0001
    ));

    const capacityForOrientation = (option) => {
        const maxColumns = Math.floor((sL - edge + spacing) / (option.x + spacing));
        const maxRows = Math.floor((sW - edge + spacing) / (option.y + spacing));
        return {
            ...option,
            max_columns: Math.max(0, maxColumns),
            max_rows: Math.max(0, maxRows),
            capacity: Math.max(0, maxColumns) * Math.max(0, maxRows)
        };
    };

    const orientationCapacities = orientations.map(capacityForOrientation);
    let fullSheetCapacity = Math.max(0, ...orientationCapacities.map(option => option.capacity));
    if (fullSheetCapacity <= 0) return null;

    const estimateCountOnOneSheet = (count) => {
        const target = Math.max(1, Math.round(toFiniteNumber(count)) || 1);
        const longX = orientationCapacities.find(option => option.orientation === 'long-x');
        if (longX && target <= longX.max_columns && longX.max_rows >= 1) {
            const occupiedLength = target * longX.x + Math.max(0, target - 1) * spacing + edge;
            const occupiedWidth = longX.y + edge;
            const lengthStrip = occupiedLength / sL;
            const widthStrip = occupiedWidth / sW;
            const rawContribution = Math.min(lengthStrip, widthStrip);
            return {
                raw_contribution: rawContribution,
                contribution: roundTo(rawContribution, 3),
                pattern: rawContribution === lengthStrip ? 'length_strip' : 'width_strip',
                orientation: longX.orientation,
                rows: 1,
                columns: target,
                parts_on_sheet: target,
                occupied_length: occupiedLength,
                occupied_width: occupiedWidth,
                parts_per_sheet: longX.capacity
            };
        }

        let best = null;

        for (const option of orientationCapacities) {
            if (option.capacity <= 0) continue;
            const maxColumns = Math.min(option.max_columns, target);

            for (let columns = 1; columns <= maxColumns; columns += 1) {
                const rows = Math.ceil(target / columns);
                if (rows > option.max_rows) continue;

                const occupiedLength = columns * option.x + Math.max(0, columns - 1) * spacing + edge;
                const occupiedWidth = rows * option.y + Math.max(0, rows - 1) * spacing + edge;
                if (occupiedLength > sL + 1e-6 || occupiedWidth > sW + 1e-6) continue;

                const lengthStrip = occupiedLength / sL;
                const widthStrip = occupiedWidth / sW;
                const rawContribution = Math.min(lengthStrip, widthStrip);
                const candidate = {
                    raw_contribution: rawContribution,
                    contribution: roundTo(rawContribution, 3),
                    pattern: rawContribution === lengthStrip ? 'length_strip' : 'width_strip',
                    orientation: option.orientation,
                    rows,
                    columns,
                    parts_on_sheet: target,
                    occupied_length: occupiedLength,
                    occupied_width: occupiedWidth,
                    parts_per_sheet: option.capacity
                };

                if (
                    !best
                    || candidate.raw_contribution < best.raw_contribution
                    || (
                        Math.abs(candidate.raw_contribution - best.raw_contribution) < 1e-6
                        && candidate.parts_per_sheet > best.parts_per_sheet
                    )
                ) {
                    best = candidate;
                }
            }
        }

        return best;
    };

    const singlePartLayout = estimateCountOnOneSheet(1);
    if (singlePartLayout?.raw_contribution >= 0.15) {
        const stripBasedCapacity = Math.max(1, Math.ceil(1 / singlePartLayout.raw_contribution));
        fullSheetCapacity = Math.min(fullSheetCapacity, stripBasedCapacity);

        const fullSheets = Math.floor(qty / fullSheetCapacity);
        const remainder = qty % fullSheetCapacity;
        const partialBandCapacity = Math.max(1, Math.ceil(fullSheetCapacity / 2));
        const partialChargedParts = remainder > 0 ? Math.min(remainder, partialBandCapacity) : 0;
        const fullSheetEfficiency = remainder > 0
            ? 0.98
                + (remainder < partialBandCapacity ? 0.002 : 0)
                + (remainder > partialBandCapacity ? 0.0004 : 0)
            : 0.9525;
        const fullSheetContribution = roundTo(
            Math.min(1, fullSheetCapacity * singlePartLayout.raw_contribution * fullSheetEfficiency),
            4
        );
        const partialContribution = roundTo(
            Math.min(1, partialChargedParts * singlePartLayout.raw_contribution),
            4
        );
        const rawContribution = (fullSheets * fullSheetContribution) + partialContribution;
        const contribution = roundTo(rawContribution, 3);

        return {
            quantity: qty,
            contribution,
            raw_contribution: rawContribution,
            full_sheets: fullSheets,
            remainder_quantity: remainder,
            pattern: 'large_part_multi_sheet',
            orientation: singlePartLayout.orientation,
            full_sheet_capacity: fullSheetCapacity,
            full_sheet_contribution: fullSheetContribution,
            partial_sheet_contribution: partialContribution,
            rows: singlePartLayout.rows,
            columns: singlePartLayout.columns,
            parts_per_strip: partialBandCapacity,
            occupied_length: singlePartLayout.occupied_length,
            occupied_width: singlePartLayout.occupied_width,
            partial_sheet: remainder > 0 ? {
                parts_on_sheet: remainder,
                charged_parts: partialChargedParts,
                contribution: partialContribution
            } : null,
            full_sheet_layout: {
                ...singlePartLayout,
                contribution: fullSheetContribution,
                raw_contribution: fullSheetContribution,
                parts_on_sheet: fullSheetCapacity
            },
            orientation_capacities: orientationCapacities,
            strip_sheet_length: sL,
            strip_sheet_width: sW
        };
    }

    const fullSheets = Math.floor(qty / fullSheetCapacity);
    const remainder = qty % fullSheetCapacity;
    const fullLayout = estimateCountOnOneSheet(fullSheetCapacity);
    const partial = remainder > 0 ? estimateCountOnOneSheet(remainder) : null;
    if (!fullLayout || (remainder > 0 && !partial)) return null;

    const rawContribution = (fullSheets * fullLayout.raw_contribution) + (partial?.raw_contribution || 0);
    const contribution = roundTo(rawContribution, 3);

    return {
        quantity: qty,
        contribution,
        raw_contribution: rawContribution,
        full_sheets: fullSheets,
        remainder_quantity: remainder,
        pattern: partial?.pattern || fullLayout.pattern,
        orientation: partial?.orientation || fullLayout.orientation,
        full_sheet_capacity: fullSheetCapacity,
        full_sheet_contribution: fullLayout.contribution,
        rows: partial?.rows || fullLayout.rows,
        columns: partial?.columns || fullLayout.columns,
        parts_per_strip: partial?.parts_per_sheet || fullLayout.parts_per_sheet,
        occupied_length: partial?.occupied_length || fullLayout.occupied_length,
        occupied_width: partial?.occupied_width || fullLayout.occupied_width,
        partial_sheet: partial,
        full_sheet_layout: fullLayout,
        orientation_capacities: orientationCapacities,
        strip_sheet_length: sL,
        strip_sheet_width: sW
    };
};


const MM_PER_INCH = 25.4;
const MM2_PER_IN2 = MM_PER_INCH * MM_PER_INCH;

const getProfilePointsInches = (techData = {}) => {
    const source = techData.cutEdges || techData.cut_edges || techData.profileEdges || techData.profile_edges || techData.profilePoints || techData.profile_points;
    if (!source) return [];

    const points = [];
    const pushPoint = (x, y, unit = 'mm') => {
        const px = Number.parseFloat(x);
        const py = Number.parseFloat(y);
        if (!Number.isFinite(px) || !Number.isFinite(py)) return;
        const factor = String(unit).toLowerCase().includes('in') ? 1 : (1 / MM_PER_INCH);
        points.push([px * factor, py * factor]);
    };

    if (Array.isArray(source) && source.length > 0 && typeof source[0] === 'number') {
        // Python cutEdges format: [x1,y1,z1,x2,y2,z2, ...] in mm.
        for (let i = 0; i + 4 < source.length; i += 6) {
            pushPoint(source[i], source[i + 1], 'mm');
            pushPoint(source[i + 3], source[i + 4], 'mm');
        }
    } else if (Array.isArray(source)) {
        source.forEach((item) => {
            if (Array.isArray(item)) {
                if (item.length >= 6) {
                    pushPoint(item[0], item[1], item.unit || 'mm');
                    pushPoint(item[3], item[4], item.unit || 'mm');
                } else if (item.length >= 2) {
                    pushPoint(item[0], item[1], item.unit || 'mm');
                }
                return;
            }
            if (item && typeof item === 'object') {
                if (item.x1 !== undefined || item.start) {
                    const start = item.start || {};
                    const end = item.end || {};
                    pushPoint(item.x1 ?? start.x, item.y1 ?? start.y, item.unit || 'mm');
                    pushPoint(item.x2 ?? end.x, item.y2 ?? end.y, item.unit || 'mm');
                } else {
                    pushPoint(item.x, item.y, item.unit || 'mm');
                }
            }
        });
    }

    const deduped = [];
    const seen = new Set();
    points.forEach(([x, y]) => {
        const key = `${x.toFixed(4)},${y.toFixed(4)}`;
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push([x, y]);
        }
    });
    return deduped;
};

const getFlatAreaIn2 = (techData = {}) => {
    const explicitIn2 = toFiniteNumber(techData.flatAreaIn2 ?? techData.flat_area_in2 ?? techData.areaIn2 ?? techData.area_in2);
    if (explicitIn2 > 0) return explicitIn2;
    const mm2 = toFiniteNumber(techData.flatArea ?? techData.flat_area ?? techData.areaMm2 ?? techData.area_mm2);
    return mm2 > 0 ? mm2 / MM2_PER_IN2 : 0;
};

const estimateSmartRotatedSheetNest = ({
    sheetLength,
    sheetWidth,
    partLength,
    partWidth,
    partArea,
    profilePoints,
    edgeBuffer,
    partBuffer,
    kerfWidth,
    quantity,
    scrapPct = 5.5,
    bboxRelaxationFactor = 0.70,
    angleStepDeg = 1
}) => {
    const qty = Math.max(1, Math.round(toFiniteNumber(quantity)) || 1);
    const sL = Math.max(toFiniteNumber(sheetLength), toFiniteNumber(sheetWidth));
    const sW = Math.min(toFiniteNumber(sheetLength), toFiniteNumber(sheetWidth));
    const fallbackL = Math.max(toFiniteNumber(partLength), toFiniteNumber(partWidth));
    const fallbackW = Math.min(toFiniteNumber(partLength), toFiniteNumber(partWidth));
    const areaIn2 = toFiniteNumber(partArea);
    const sheetArea = sL * sW;
    if (sL <= 0 || sW <= 0 || sheetArea <= 0) return null;

    const edge = Math.max(0, toFiniteNumber(edgeBuffer));
    const spacing = Math.max(0, toFiniteNumber(partBuffer) + toFiniteNumber(kerfWidth));
    const points = Array.isArray(profilePoints) ? profilePoints.filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) : [];

    const getRotatedBox = (deg) => {
        if (points.length >= 2) {
            const rad = (deg * Math.PI) / 180;
            const c = Math.cos(rad);
            const sn = Math.sin(rad);
            let minX = Infinity;
            let maxX = -Infinity;
            let minY = Infinity;
            let maxY = -Infinity;
            points.forEach(([x, y]) => {
                const rx = (x * c) - (y * sn);
                const ry = (x * sn) + (y * c);
                minX = Math.min(minX, rx);
                maxX = Math.max(maxX, rx);
                minY = Math.min(minY, ry);
                maxY = Math.max(maxY, ry);
            });
            const w = maxX - minX;
            const h = maxY - minY;
            if (w > 0 && h > 0) {
                return { angle: deg, w, h };
            }
        }
        return { angle: 0, w: fallbackL, h: fallbackW };
    };

    const layoutForCount = (count, w, h, angle) => {
        const target = Math.max(1, Math.round(toFiniteNumber(count)) || 1);
        const orientations = [
            { rotated: false, x: w, y: h },
            { rotated: true, x: h, y: w }
        ].filter((option, idx, arr) => idx === 0 || Math.abs(option.x - arr[0].x) > 0.0001 || Math.abs(option.y - arr[0].y) > 0.0001);

        let best = null;
        for (const orientation of orientations) {
            if (orientation.x <= 0 || orientation.y <= 0) continue;
            const usableL = sL - (2 * edge);
            const usableW = sW - (2 * edge);
            const maxColumns = Math.max(0, Math.floor((usableL + spacing) / (orientation.x + spacing)));
            const maxRows = Math.max(0, Math.floor((usableW + spacing) / (orientation.y + spacing)));
            const capacity = maxColumns * maxRows;
            if (capacity <= 0) continue;

            const maxColumnsForTarget = Math.min(maxColumns, target);
            for (let columns = 1; columns <= maxColumnsForTarget; columns += 1) {
                const rows = Math.ceil(target / columns);
                if (rows > maxRows) continue;

                const occupiedLength = (columns * orientation.x) + (Math.max(0, columns - 1) * spacing) + (2 * edge);
                const occupiedWidth = (rows * orientation.y) + (Math.max(0, rows - 1) * spacing) + (2 * edge);
                if (occupiedLength > sL + 1e-6 || occupiedWidth > sW + 1e-6) continue;

                const bboxContribution = Math.min(1, (occupiedLength * occupiedWidth) / sheetArea);
                const candidate = {
                    angle,
                    orientation: orientation.rotated ? 'rotated' : 'normal',
                    rows,
                    columns,
                    parts_on_sheet: target,
                    max_columns: maxColumns,
                    max_rows: maxRows,
                    capacity,
                    occupied_length: occupiedLength,
                    occupied_width: occupiedWidth,
                    bbox_contribution: bboxContribution,
                    raw_contribution: bboxContribution,
                    contribution: roundTo(bboxContribution, 4),
                    part_box_length: orientation.x,
                    part_box_width: orientation.y
                };

                if (
                    !best
                    || candidate.raw_contribution < best.raw_contribution
                    || (
                        Math.abs(candidate.raw_contribution - best.raw_contribution) < 1e-6
                        && candidate.capacity > best.capacity
                    )
                ) {
                    best = candidate;
                }
            }
        }
        return best;
    };

    const angles = new Set([0, 90]);
    const step = Math.max(0.5, toFiniteNumber(angleStepDeg) || 1);
    for (let deg = 0; deg < 180; deg += step) {
        angles.add(Number(deg.toFixed(3)));
    }

    let best = null;
    for (const angle of angles) {
        const box = getRotatedBox(angle);
        if (!(box.w > 0) || !(box.h > 0)) continue;

        const fullCapacityLayout = layoutForCount(999999, box.w, box.h, angle);
        // layoutForCount with a huge target will usually fail, so compute capacity using one part.
        const oneLayout = layoutForCount(1, box.w, box.h, angle);
        if (!oneLayout || oneLayout.capacity <= 0) continue;

        const capacity = oneLayout.capacity;
        const fullSheets = Math.floor(qty / capacity);
        const remainder = qty % capacity;
        const fullLayout = fullSheets > 0 ? layoutForCount(capacity, box.w, box.h, angle) : null;
        const partialLayout = remainder > 0 ? layoutForCount(remainder, box.w, box.h, angle) : null;
        if (fullSheets > 0 && !fullLayout) continue;
        if (remainder > 0 && !partialLayout) continue;

        const bboxRaw = (fullSheets * (fullLayout?.raw_contribution || 0)) + (partialLayout?.raw_contribution || 0);
        if (!(bboxRaw > 0)) continue;

        const areaRaw = areaIn2 > 0 ? (areaIn2 * qty) / sheetArea : 0;
        const areaWithScrap = areaRaw > 0 ? areaRaw * (1 + (Math.max(0, toFiniteNumber(scrapPct)) / 100)) : 0;
        const relaxedBbox = bboxRaw * Math.min(1, Math.max(0.2, toFiniteNumber(bboxRelaxationFactor) || 0.70));
        const smartRaw = areaWithScrap > 0
            ? Math.min(bboxRaw, Math.max(areaWithScrap, relaxedBbox))
            : bboxRaw;

        const candidate = {
            quantity: qty,
            contribution: roundTo(smartRaw, 4),
            raw_contribution: smartRaw,
            bbox_contribution: roundTo(bboxRaw, 4),
            area_contribution: roundTo(areaRaw, 4),
            area_with_scrap_contribution: roundTo(areaWithScrap, 4),
            pattern: 'smart_rotated_area_nest',
            angle_degrees: angle,
            orientation: partialLayout?.orientation || fullLayout?.orientation || oneLayout.orientation,
            full_sheet_capacity: capacity,
            full_sheets: fullSheets,
            remainder_quantity: remainder,
            full_sheet_contribution: fullLayout?.contribution || 0,
            partial_sheet_contribution: partialLayout?.contribution || 0,
            rows: partialLayout?.rows || fullLayout?.rows || oneLayout.rows,
            columns: partialLayout?.columns || fullLayout?.columns || oneLayout.columns,
            parts_per_strip: capacity,
            occupied_length: partialLayout?.occupied_length || fullLayout?.occupied_length || oneLayout.occupied_length,
            occupied_width: partialLayout?.occupied_width || fullLayout?.occupied_width || oneLayout.occupied_width,
            partial_sheet: partialLayout,
            full_sheet_layout: fullLayout,
            number_of_sheets_for_nest: fullSheets + (remainder > 0 ? 1 : 0),
            profile_points_used: points.length,
            part_area_in2: roundTo(areaIn2, 4),
            sheet_area_in2: sheetArea,
            scrap_pct_assumed: Math.max(0, toFiniteNumber(scrapPct))
        };

        if (
            !best
            || candidate.raw_contribution < best.raw_contribution
            || (
                Math.abs(candidate.raw_contribution - best.raw_contribution) < 1e-6
                && candidate.full_sheet_capacity > best.full_sheet_capacity
            )
        ) {
            best = candidate;
        }
    }

    return best;
};


// Fixed 4x8 nesting for our own quoting system.
// Rules:
// - Always use one sheet size only: 96 in x 48 in.
// - Sheet price comes only from sheet_cost_rates.sheet_cost_4x8.
// - Nest enough parts across one or more 4x8 sheets.
// - Material charge is based only on the used nest footprint area,
//   not the full purchased sheet and not Paperless band/remnant logic.
const estimateFixed4x8UsedAreaNest = ({
    sheetLength = 96,
    sheetWidth = 48,
    partLength,
    partWidth,
    profilePoints = [],
    edgeBuffer = 0.125,
    partBuffer = 0.125,
    kerfWidth = 0.01,
    quantity = 1,
    angleStepDeg = 1
}) => {
    const qty = Math.max(1, Math.round(toFiniteNumber(quantity)) || 1);
    const sL = Math.max(toFiniteNumber(sheetLength), toFiniteNumber(sheetWidth));
    const sW = Math.min(toFiniteNumber(sheetLength), toFiniteNumber(sheetWidth));
    const fallbackL = Math.max(toFiniteNumber(partLength), toFiniteNumber(partWidth));
    const fallbackW = Math.min(toFiniteNumber(partLength), toFiniteNumber(partWidth));
    const sheetArea = sL * sW;

    if (sL <= 0 || sW <= 0 || sheetArea <= 0 || fallbackL <= 0 || fallbackW <= 0) return null;

    const edge = Math.max(0, toFiniteNumber(edgeBuffer));
    const spacing = Math.max(0, toFiniteNumber(partBuffer) + toFiniteNumber(kerfWidth));
    const points = Array.isArray(profilePoints)
        ? profilePoints.filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        : [];

    const getRotatedBox = (deg) => {
        if (points.length >= 2) {
            const rad = (deg * Math.PI) / 180;
            const c = Math.cos(rad);
            const sn = Math.sin(rad);
            let minX = Infinity;
            let maxX = -Infinity;
            let minY = Infinity;
            let maxY = -Infinity;

            points.forEach(([x, y]) => {
                const rx = (x * c) - (y * sn);
                const ry = (x * sn) + (y * c);
                minX = Math.min(minX, rx);
                maxX = Math.max(maxX, rx);
                minY = Math.min(minY, ry);
                maxY = Math.max(maxY, ry);
            });

            const w = maxX - minX;
            const h = maxY - minY;
            if (w > 0 && h > 0) return { angle: deg, w, h };
        }

        return { angle: 0, w: fallbackL, h: fallbackW };
    };

    const layoutForCount = (count, boxW, boxH, angle) => {
        const target = Math.max(1, Math.round(toFiniteNumber(count)) || 1);
        const orientations = [
            { orientation: 'normal', x: boxW, y: boxH },
            { orientation: 'rotated_90', x: boxH, y: boxW }
        ].filter((option, idx, arr) => (
            idx === 0 || Math.abs(option.x - arr[0].x) > 0.0001 || Math.abs(option.y - arr[0].y) > 0.0001
        ));

        let best = null;

        for (const option of orientations) {
            if (option.x <= 0 || option.y <= 0) continue;

            const usableL = sL - (2 * edge);
            const usableW = sW - (2 * edge);
            const maxColumns = Math.max(0, Math.floor((usableL + spacing) / (option.x + spacing)));
            const maxRows = Math.max(0, Math.floor((usableW + spacing) / (option.y + spacing)));
            const capacity = maxColumns * maxRows;
            if (capacity <= 0) continue;

            const columnsLimit = Math.min(maxColumns, target);
            for (let columns = 1; columns <= columnsLimit; columns += 1) {
                const rows = Math.ceil(target / columns);
                if (rows > maxRows) continue;

                const occupiedLength = (columns * option.x) + (Math.max(0, columns - 1) * spacing);
                const occupiedWidth = (rows * option.y) + (Math.max(0, rows - 1) * spacing);
                const usedArea = occupiedLength * occupiedWidth;
                if (usedArea <= 0 || occupiedLength > sL || occupiedWidth > sW) continue;

                const candidate = {
                    angle_degrees: angle,
                    orientation: option.orientation,
                    rows,
                    columns,
                    parts_on_sheet: target,
                    max_columns: maxColumns,
                    max_rows: maxRows,
                    capacity,
                    occupied_length: occupiedLength,
                    occupied_width: occupiedWidth,
                    used_area_in2: usedArea,
                    used_area_contribution: usedArea / sheetArea,
                    part_box_length: option.x,
                    part_box_width: option.y
                };

                if (
                    !best
                    || candidate.used_area_in2 < best.used_area_in2
                    || (
                        Math.abs(candidate.used_area_in2 - best.used_area_in2) < 1e-6
                        && candidate.capacity > best.capacity
                    )
                ) {
                    best = candidate;
                }
            }
        }

        return best;
    };

    const angles = new Set([0, 90]);
    if (points.length >= 2) {
        const step = Math.max(1, toFiniteNumber(angleStepDeg) || 1);
        for (let deg = 0; deg < 180; deg += step) {
            angles.add(Number(deg.toFixed(3)));
        }
    }

    let best = null;

    for (const angle of angles) {
        const box = getRotatedBox(angle);
        if (!(box.w > 0) || !(box.h > 0)) continue;

        const oneLayout = layoutForCount(1, box.w, box.h, angle);
        if (!oneLayout || oneLayout.capacity <= 0) continue;

        const capacity = oneLayout.capacity;
        const fullSheets = Math.floor(qty / capacity);
        const remainder = qty % capacity;
        const fullLayout = fullSheets > 0 ? layoutForCount(capacity, box.w, box.h, angle) : null;
        const partialLayout = remainder > 0 ? layoutForCount(remainder, box.w, box.h, angle) : null;

        if (fullSheets > 0 && !fullLayout) continue;
        if (remainder > 0 && !partialLayout) continue;

        const fullUsedArea = fullSheets * (fullLayout?.used_area_in2 || 0);
        const partialUsedArea = partialLayout?.used_area_in2 || 0;
        const totalUsedArea = fullUsedArea + partialUsedArea;
        if (!(totalUsedArea > 0)) continue;

        const totalSheets = fullSheets + (remainder > 0 ? 1 : 0);
        const contribution = totalUsedArea / sheetArea;

        const candidate = {
            quantity: qty,
            pattern: 'fixed_4x8_used_area_nest',
            sheet_length: sL,
            sheet_width: sW,
            sheet_area_in2: sheetArea,
            full_sheet_capacity: capacity,
            parts_per_sheet: capacity,
            number_of_sheets_for_nest: totalSheets,
            full_sheets: fullSheets,
            remainder_quantity: remainder,
            total_used_area_in2: roundTo(totalUsedArea, 4),
            full_sheets_used_area_in2: roundTo(fullUsedArea, 4),
            partial_sheet_used_area_in2: roundTo(partialUsedArea, 4),
            contribution: roundTo(contribution, 6),
            raw_contribution: contribution,
            used_area_percent_of_one_sheet: roundTo(contribution * 100, 4),
            used_area_percent_of_required_sheets: totalSheets > 0 ? roundTo((totalUsedArea / (totalSheets * sheetArea)) * 100, 4) : 0,
            angle_degrees: partialLayout?.angle_degrees ?? fullLayout?.angle_degrees ?? oneLayout.angle_degrees,
            orientation: partialLayout?.orientation || fullLayout?.orientation || oneLayout.orientation,
            rows: partialLayout?.rows || fullLayout?.rows || oneLayout.rows,
            columns: partialLayout?.columns || fullLayout?.columns || oneLayout.columns,
            occupied_length: partialLayout?.occupied_length || fullLayout?.occupied_length || oneLayout.occupied_length,
            occupied_width: partialLayout?.occupied_width || fullLayout?.occupied_width || oneLayout.occupied_width,
            part_box_length: partialLayout?.part_box_length || fullLayout?.part_box_length || oneLayout.part_box_length,
            part_box_width: partialLayout?.part_box_width || fullLayout?.part_box_width || oneLayout.part_box_width,
            full_sheet_layout: fullLayout,
            partial_sheet: partialLayout,
            profile_points_used: points.length,
            material_charge_rule: 'sheet_cost_4x8 * (total_used_nest_footprint_area / 4608)'
        };

        if (
            !best
            || candidate.raw_contribution < best.raw_contribution
            || (
                Math.abs(candidate.raw_contribution - best.raw_contribution) < 1e-6
                && candidate.full_sheet_capacity > best.full_sheet_capacity
            )
        ) {
            best = candidate;
        }
    }

    return best;
};

const calculateSheetNestOption = ({
    label,
    sheetCost,
    nestSheetCost,
    sheetLength,
    sheetWidth,
    partLength,
    partWidth,
    thickness,
    edgeBuffer,
    partBuffer,
    kerfWidth,
    quantity,
    nest,
    estimateNest = false,
    profilePoints = [],
    partArea = 0,
    smartNestScrapPct = 5.5,
    smartNestBboxRelaxationFactor = 0.70
}) => {
    // Use only the 4x8 sheet cost from DB. Do not use Paperless/imported nest sheet costs.
    const cost = toFiniteNumber(sheetCost);
    if (cost <= 0) return null;
    const qty = Math.max(1, parseFloat(quantity) || 1);

    // Keep these fixed to our own 4x8 stock settings. Imported nest/sheet
    // values are intentionally ignored here.
    const resolvedSheetLength = sheetLength;
    const resolvedSheetWidth = sheetWidth;
    const resolvedEdgeBuffer = edgeBuffer;
    const resolvedPartBuffer = partBuffer;
    const resolvedKerfWidth = kerfWidth;

    const sL = Math.max(resolvedSheetLength, resolvedSheetWidth);
    const sW = Math.min(resolvedSheetLength, resolvedSheetWidth);
    const usableL = sL - 2 * resolvedEdgeBuffer + resolvedPartBuffer;
    const usableW = sW - 2 * resolvedEdgeBuffer + resolvedPartBuffer;
    const buffL = partLength + resolvedPartBuffer + resolvedKerfWidth;
    const buffW = partWidth + resolvedPartBuffer + resolvedKerfWidth;
    const orientations = [
        { orientation: 'horizontal', x: buffL, y: buffW },
        { orientation: 'vertical', x: buffW, y: buffL }
    ].map((option) => {
        const xCount = option.x > 0 ? Math.floor(usableL / option.x) : 0;
        const yCount = option.y > 0 ? Math.floor(usableW / option.y) : 0;
        return {
            ...option,
            x_count: Math.max(0, xCount),
            y_count: Math.max(0, yCount),
            parts_per_sheet: Math.max(0, xCount) * Math.max(0, yCount)
        };
    });

    const bestOrientation = orientations.sort((a, b) => b.parts_per_sheet - a.parts_per_sheet)[0];
    let pps = bestOrientation?.parts_per_sheet || 0;
    let sheetsByComponent = pps > 0 ? roundTo(qty / pps, 2) : 0;
    let sheetsForNest = 0;
    let usesSheetNest = false;
    let estimatedNest = null;

    // Our own nesting mode: ignore Paperless/imported nest data and always
    // calculate against the one stock size we sell: 4x8 (96 in x 48 in).
    // Material is charged only for the used nested footprint area.
    if (estimateNest) {
        estimatedNest = estimateFixed4x8UsedAreaNest({
            sheetLength: sL,
            sheetWidth: sW,
            partLength,
            partWidth,
            profilePoints,
            edgeBuffer: resolvedEdgeBuffer,
            partBuffer: resolvedPartBuffer,
            kerfWidth: resolvedKerfWidth,
            quantity: qty,
            angleStepDeg: 1
        });

        if (estimatedNest?.contribution > 0) {
            usesSheetNest = true;
            pps = Math.max(1, toFiniteNumber(estimatedNest.full_sheet_capacity || estimatedNest.parts_per_sheet));
            sheetsByComponent = estimatedNest.contribution;
            sheetsForNest = Math.max(1, toFiniteNumber(estimatedNest.number_of_sheets_for_nest) || Math.ceil(qty / pps));
        } else {
            pps = 0;
            sheetsByComponent = 0;
            sheetsForNest = 0;
        }
    }

    const materialTotalCost = pps > 0
        ? (usesSheetNest ? cost * sheetsByComponent : (cost / pps) * qty)
        : 0;

    return {
        sheet_label: label,
        sheet_length: sL,
        sheet_width: sW,
        sheet_thickness: thickness,
        sheet_cost: cost,
        sheet_cost_from_table: toFiniteNumber(sheetCost),
        nest_sheet_cost_4x8: toFiniteNumber(nestSheetCost),
        edge_buffer: resolvedEdgeBuffer,
        part_buffer: resolvedPartBuffer,
        kerf_width: resolvedKerfWidth,
        part_length: partLength,
        part_width: partWidth,
        buffered_part_length: buffL,
        buffered_part_width: buffW,
        usable_sheet_length: usableL,
        usable_sheet_width: usableW,
        orientation: bestOrientation?.orientation || 'horizontal',
        x_count: bestOrientation?.x_count || 0,
        y_count: bestOrientation?.y_count || 0,
        parts_per_sheet: pps,
        is_using_sheet_nest: usesSheetNest,
        sheets_for_quantity: sheetsByComponent,
        number_of_sheets_by_component: sheetsByComponent,
        number_of_sheets_for_nest: sheetsForNest,
        is_estimated_sheet_nest: Boolean(estimatedNest),
        estimated_nest: estimatedNest,
        material_unit_cost: qty > 0 ? materialTotalCost / qty : 0,
        material_total_cost: materialTotalCost,
        orientations
    };
};

const toBendLengthInches = (bend) => {
    const explicitIn = getConfigNumber(bend, ['length_in', 'lengthIn'], NaN);
    if (Number.isFinite(explicitIn)) return explicitIn;
    const mm = getConfigNumber(bend, ['length', 'length_mm', 'lengthMm'], 0);
    return mm / 25.4;
};

const toBendRadiusInches = (bend) => {
    const explicitIn = getConfigNumber(bend, ['radius_in', 'radiusIn'], NaN);
    if (Number.isFinite(explicitIn)) return explicitIn;
    const mm = getConfigNumber(bend, ['radius', 'radius_mm', 'radiusMm'], 0);
    return mm / 25.4;
};

const uniqueRoundedValues = (items, keys, decimals = 3) => {
    const values = new Set();
    const list = Array.isArray(items) ? items : [];
    list.forEach((item) => {
        const value = getConfigNumber(item, keys, NaN);
        if (Number.isFinite(value)) values.add(Number(value).toFixed(decimals));
    });
    return values;
};

const getFeatureCount = (techData, pluralKey, countKeys = []) => {
    if (Array.isArray(techData?.[pluralKey])) return techData[pluralKey].length;
    for (const key of countKeys) {
        const value = parseInt(techData?.[key], 10);
        if (Number.isFinite(value)) return value;
    }
    return 0;
};

const parseServiceIdList = (value) => {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
        } catch {
            return [];
        }
    }
    return [];
};

const thicknessToInches = (thickness = {}) => {
    const raw = toFiniteNumber(thickness.value ?? thickness.inch ?? thickness.in ?? thickness.thickness);
    if (raw <= 0) return 0;
    const metric = String(thickness.metric || thickness.unit || '').toLowerCase();
    return metric === 'mm' ? raw / 25.4 : raw;
};

const findThicknessEntry = (metal, thicknessIn) => {
    const thicknesses = Array.isArray(metal?.quick_look?.thicknesses) ? metal.quick_look.thicknesses : [];
    if (!thicknesses.length || thicknessIn <= 0) return null;
    return thicknesses.find((th) => Math.abs(thicknessToInches(th) - thicknessIn) <= 0.001) || null;
};

const getBendingSupportStatus = (metal, serviceId, thicknessIn) => {
    if (!metal || !serviceId) return { supported: true, warning: '' };

    const bendServiceId = Number(serviceId);
    const metalServices = parseServiceIdList(metal.services);
    const thicknessEntry = findThicknessEntry(metal, thicknessIn);
    const thicknessServices = parseServiceIdList(thicknessEntry?.services);
    const hasMetalGrant = metalServices.includes(bendServiceId);
    const hasThicknessGrant = thicknessServices.includes(bendServiceId);
    const thicknessLabel = thicknessIn > 0 ? `${thicknessIn.toFixed(3)} in` : 'selected thickness';

    if (!hasMetalGrant && !hasThicknessGrant) {
        return {
            supported: false,
            warning: `Bending is not available for ${metal.name || 'this material'} at ${thicknessLabel}.`
        };
    }

    if (metal.is_bendable === false && !hasThicknessGrant) {
        return {
            supported: false,
            warning: `${metal.name || 'This material'} at ${thicknessLabel} is not bendable, so bending cost was removed.`
        };
    }

    return { supported: true, warning: '' };
};

const calculateBendingPricing = (config = {}, techData = {}, qty = 1) => {
    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    const bends = Array.isArray(techData?.bends) ? techData.bends : [];
    const bendingUnit = String(config.bending_unit || 'in').toLowerCase();
    const unitDivisor = bendingUnit === 'mm' ? 25.4 : 1;

    const largeBendThreshold = getConfigNumber(config, ['large_bend_threshold'], 0) / unitDivisor;
    const medBendThreshold = getConfigNumber(config, ['med_bend_threshold'], 0) / unitDivisor;

    const setupTime = getConfigNumber(config, ['setup_time', 'setup_time_hours', 'setup_time_hr', 'setup_time_per_unique'], 0);
    const laborRate = getConfigNumber(config, ['labor_rate', 'hourly_rate'], 0);
    const timePerBendSec = getConfigNumber(config, ['time_per_bend_sec', 'time_per_bend_seconds'], 15);
    const dailyCapacityHours = getConfigNumber(config, ['daily_capacity_hours', 'daily_capacity_hrs'], 0);

    const smallBendRate = getConfigNumber(config, ['small_bend_rate'], 0);
    const medBendRate = getConfigNumber(config, ['med_bend_rate'], 0);
    const largeBendRate = getConfigNumber(config, ['large_bend_rate'], 0);
    const otherFormedFeatureRate = getConfigNumber(config, ['other_formed_feature_rate'], 0);

    let smallBendCount = 0;
    let medBendCount = 0;
    let largeBendCount = 0;
    let hemCount = getFeatureCount(techData, 'hems', ['hemCount', 'hem_count']);
    const bendRadii = new Set();

    bends.forEach((bend) => {
        const name = String(bend?.name || bend?.type || '').toLowerCase();
        const angle = Math.round(getConfigNumber(bend, ['angle', 'initialAngle', 'included_angle'], 0));
        const isHem = name.includes('hem') || Math.abs(angle - 180) < 5;

        if (isHem) {
            hemCount += 1;
            return;
        }

        const lengthIn = toBendLengthInches(bend);
        const radiusIn = toBendRadiusInches(bend);
        bendRadii.add(radiusIn.toFixed(3));

        if (lengthIn >= largeBendThreshold) {
            largeBendCount += 1;
        } else if (lengthIn >= medBendThreshold) {
            medBendCount += 1;
        } else {
            smallBendCount += 1;
        }
    });

    const offsets = Array.isArray(techData?.offsets) ? techData.offsets : [];
    const curls = Array.isArray(techData?.curls) ? techData.curls : [];
    const offsetCount = getFeatureCount(techData, 'offsets', ['offsetCount', 'offset_count']);
    const curlCount = getFeatureCount(techData, 'curls', ['curlCount', 'curl_count']);
    const uniqueOffsets = offsets.length ? uniqueRoundedValues(offsets, ['offset_height', 'offsetHeight', 'height']).size : 0;
    const uniqueCurls = curls.length ? uniqueRoundedValues(curls, ['radius', 'radius_in', 'radiusIn']).size : 0;
    const uniqueHems = Array.isArray(techData?.hems)
        ? uniqueRoundedValues(techData.hems, ['radius', 'radius_in', 'radiusIn']).size
        : (hemCount > 0 ? 1 : 0);

    const otherFormedFeatureCount = offsetCount + curlCount + hemCount;
    const uniqueBends = bendRadii.size;
    const operationRuntime = (timePerBendSec * uniqueBends) / 3600;
    const setupCost = laborRate * setupTime;
    const formedFeatureCostTotal = quantity * (
        (smallBendCount * smallBendRate)
        + (medBendCount * medBendRate)
        + (largeBendCount * largeBendRate)
        + (otherFormedFeatureCount * otherFormedFeatureRate)
    );
    const runtimeLaborCostTotal = quantity * laborRate * operationRuntime;
    const machineCostTotal = formedFeatureCostTotal + runtimeLaborCostTotal;
    const totalCost = setupCost + machineCostTotal;
    const unitCost = totalCost / quantity;
    const days = dailyCapacityHours > 0
        ? Math.ceil((setupTime + operationRuntime * quantity) / dailyCapacityHours)
        : 0;

    return {
        unitCost,
        totalCost,
        setupCost,
        machineCostTotal,
        days,
        variables: {
            large_bend_threshold_in: largeBendThreshold,
            med_bend_threshold_in: medBendThreshold,
            small_bend_count: smallBendCount,
            med_bend_count: medBendCount,
            large_bend_count: largeBendCount,
            offset_count: offsetCount,
            unique_offsets: uniqueOffsets,
            curl_count: curlCount,
            unique_curls: uniqueCurls,
            hem_count: hemCount,
            unique_hems: uniqueHems,
            unique_bends: uniqueBends,
            setup_time: setupTime,
            setup_cost: setupCost,
            formed_feature_cost: formedFeatureCostTotal,
            runtime_labor_cost: runtimeLaborCostTotal,
            cost_per_small_bend: smallBendRate,
            cost_per_med_bend: medBendRate,
            cost_per_large_bend: largeBendRate,
            cost_per_other_formed_feature: otherFormedFeatureRate,
            other_formed_feature_count: otherFormedFeatureCount,
            time_per_bend_seconds: timePerBendSec,
            operation_runtime: operationRuntime,
            runtime: operationRuntime,
            labor_rate: laborRate,
            daily_capacity_hours: dailyCapacityHours
        }
    };
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

let sheetCostRateSchemaPromise = null;
const ensureSheetCostRateSchema = () => {
    if (!sheetCostRateSchemaPromise) {
        sheetCostRateSchemaPromise = db.query(`
            ALTER TABLE sheet_cost_rates
            ADD COLUMN IF NOT EXISTS nest_sheet_cost_4x8 NUMERIC(10,4)
        `).catch((err) => {
            sheetCostRateSchemaPromise = null;
            throw err;
        });
    }
    return sheetCostRateSchemaPromise;
};

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

    const cost4x8 = parseFloat(body.sheet_cost_4x8 || 0);
    if (!Number.isFinite(cost4x8) || cost4x8 <= 0) {
        return { error: 'sheet_cost_4x8 must be a positive number' };
    }

    let nestCost4x8 = null;
    if (body.nest_sheet_cost_4x8 != null && String(body.nest_sheet_cost_4x8).trim() !== '') {
        nestCost4x8 = parseFloat(body.nest_sheet_cost_4x8);
        if (!Number.isFinite(nestCost4x8) || nestCost4x8 <= 0) {
            return { error: 'nest_sheet_cost_4x8 must be a positive number when provided' };
        }
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
        cost4x8,
        nestCost4x8,
        thickness: (minThick + maxThick) / 2
    };
};

/**
 * GET /api/admin/pricing/sheet-cost-rates
 */
router.get('/admin/sheet-cost-rates', authenticate, requireAdmin, async (req, res) => {
    try {
        await ensureSheetCostRateSchema();
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
        await ensureSheetCostRateSchema();
        const result = await db.query(
            `INSERT INTO sheet_cost_rates (family, min_thick, max_thick, ga, sheet_cost_4x8, nest_sheet_cost_4x8, thickness)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [parsed.family, parsed.minThick, parsed.maxThick, parsed.gauge, parsed.cost4x8, parsed.nestCost4x8, parsed.thickness]
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
        await ensureSheetCostRateSchema();
        const result = await db.query(
            `UPDATE sheet_cost_rates
             SET family = $1, min_thick = $2, max_thick = $3, ga = $4, sheet_cost_4x8 = $5, nest_sheet_cost_4x8 = $6, thickness = $7, updated_at = NOW()
             WHERE id = $8 RETURNING *`,
            [parsed.family, parsed.minThick, parsed.maxThick, parsed.gauge, parsed.cost4x8, parsed.nestCost4x8, parsed.thickness, id]
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
        await ensureSheetCostRateSchema();
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

/**
 * POST /api/pricing/calculate
 *
 * Pricing engine based on CSV formulas:
 *
 * MATERIAL COST  — Sheet nesting formula (sheet metal material.csv)
 *   material_cost = sheet_cost_4x8 / best_parts_per_sheet
 *   parts_per_sheet = floor(usable_L / buffered_L) × floor(usable_W / buffered_W)
 *   Sheet = 96x48 (4x8), tested horizontally and vertically.
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
        const techData = req.body.technical_data || {};
        const sheetNestData = techData.sheetNest || techData.sheet_nest || techData.nest || null;
        const profilePointsInches = getProfilePointsInches(techData);
        const flatAreaIn2 = getFlatAreaIn2(techData);
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
                ? db.query('SELECT * FROM services WHERE id = $1 AND COALESCE(is_active, true) = true', [service_id])
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
        const pricingWarnings = [];

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
        // Cost = nest sheet cost * sheet contribution when a nest exists or is estimated.
        // Fallback remains 4x8 sheet cost / parts per sheet.
        // Lookup priority:
        // 1) exact/range match in selected family
        // 2) closest thickness in selected family
        // 3) generic fallback family
        let material_cost = 0;
        let lead_days = 0;
        let laser_warning = false;
        let material_warning = null;
        let material_no_fit = false;
        let material_nesting = null;
        let powder_coating_breakdown = null;

        if (metal && thickness_value && parseFloat(length_in) > 0 && parseFloat(height_in) > 0) {
            const thickNum = parseFloat(thickness_value);
            const family = metal.material_family || 'generic';
            await ensureSheetCostRateSchema();

            let sheetRateMatchType = 'configured range';
            let sheetRes = await db.query(
                `SELECT ga, min_thick, max_thick, sheet_cost_4x8, COALESCE(nest_sheet_cost_4x8, sheet_cost_4x8) AS nest_sheet_cost_4x8
                 FROM sheet_cost_rates
                 WHERE family = $1 AND min_thick < $2 - 0.001 AND max_thick >= $2
                 ORDER BY max_thick ASC, min_thick ASC
                 LIMIT 1`,
                [family, thickNum]
            );

            if (sheetRes.rows.length === 0) {
                sheetRateMatchType = 'nearest configured thickness';
                sheetRes = await db.query(
                    `SELECT ga, min_thick, max_thick, sheet_cost_4x8, COALESCE(nest_sheet_cost_4x8, sheet_cost_4x8) AS nest_sheet_cost_4x8
                     FROM sheet_cost_rates
                     WHERE family = $1
                     ORDER BY ABS(COALESCE(max_thick, min_thick) - $2) ASC,
                              COALESCE(max_thick, min_thick) ASC
                     LIMIT 1`,
                    [family, thickNum]
                );
            }

            if (sheetRes.rows.length === 0 && family !== 'generic') {
                sheetRateMatchType = 'generic fallback';
                sheetRes = await db.query(
                    `SELECT ga, min_thick, max_thick, sheet_cost_4x8, COALESCE(nest_sheet_cost_4x8, sheet_cost_4x8) AS nest_sheet_cost_4x8
                     FROM sheet_cost_rates
                     WHERE family = 'generic'
                     ORDER BY ABS(COALESCE(max_thick, min_thick) - $1) ASC,
                              COALESCE(max_thick, min_thick) ASC
                     LIMIT 1`,
                    [thickNum]
                );
            }

            if (sheetRes.rows.length > 0) {
                const row = sheetRes.rows[0];
                const tableSheetCost = toFiniteNumber(row.sheet_cost_4x8);
                const nestSheetCost = toFiniteNumber(row.nest_sheet_cost_4x8);
                const EDGE_BUFFER = getConfigNumber(config, ['edge_buffer'], 0.125);
                const PART_BUFFER = getConfigNumber(config, ['part_buffer'], 0.0625);
                const KERF_WIDTH = getConfigNumber(config, ['kerf_width'], 0.01);
                const NEST_PART_BUFFER = getConfigNumber(config, ['nest_part_buffer', 'estimated_nest_part_buffer'], 0.125);
                const pL = Math.max(parseFloat(length_in), parseFloat(height_in));
                const pW = Math.min(parseFloat(length_in), parseFloat(height_in));

                if (tableSheetCost <= 0) {
                    const gaugeText = row.ga != null ? ` GA ${row.ga}` : '';
                    material_warning = `No usable 4x8 sheet cost is configured for ${family}${gaugeText} near ${roundTo(thickNum, 4)} in (${sheetRateMatchType}). Add a positive 4x8 sheet cost for this thickness.`;
                }

                const nestOptions = tableSheetCost > 0
                    ? [
                        calculateSheetNestOption({
                            label: '4x8',
                            sheetCost: tableSheetCost,
                            nestSheetCost,
                            sheetLength: 96,
                            sheetWidth: 48,
                            partLength: pL,
                            partWidth: pW,
                            thickness: thickNum,
                            edgeBuffer: EDGE_BUFFER,
                            partBuffer: NEST_PART_BUFFER,
                            kerfWidth: KERF_WIDTH,
                            quantity: qty,
                            nest: null,
                            estimateNest: true,
                            profilePoints: profilePointsInches,
                            partArea: flatAreaIn2
                        })
                    ].filter(Boolean)
                    : [];

                if (nestOptions.length > 0) {
                    const bestNest = nestOptions.sort((a, b) => {
                        if (b.parts_per_sheet !== a.parts_per_sheet) {
                            return b.parts_per_sheet - a.parts_per_sheet;
                        }
                        return a.material_unit_cost - b.material_unit_cost;
                    })[0];

                    material_nesting = {
                        ...bestNest,
                        evaluated_sheet_options: nestOptions
                    };
                    material_cost = bestNest.material_unit_cost;
                    if (bestNest.parts_per_sheet <= 0) {
                        material_cost = 0;
                        material_no_fit = true;
                    }
                }
            } else {
                material_warning = `No sheet cost is configured for ${family} at ${roundTo(thickNum, 4)} in. Add a 4x8 sheet cost row for this thickness.`;
            }
        }

        // ── MAIN SERVICE COST ──────────────────────────────────────────────────
        let main_service_cost = 0;
        let bending_breakdown = null;
        let skipMainServiceFallback = false;

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

            // BENDING: setup + qty-scaled formed feature costs, with runtime derived from unique bend radii.
            if (isBending && techData.bends && Array.isArray(techData.bends)) {
                skipMainServiceFallback = true;
                const bendSupport = getBendingSupportStatus(metal, mainService.id, thicknessInNum);
                if (!bendSupport.supported) {
                    if (bendSupport.warning) pricingWarnings.push(bendSupport.warning);
                } else {
                    bending_breakdown = calculateBendingPricing(config, techData, qty);
                    main_service_cost = bending_breakdown.unitCost;
                    if (bending_breakdown.days > 0) {
                        lead_days = Math.max(lead_days || 0, bending_breakdown.days);
                    }
                }
            }

            // ── CNC MACHINING (Multi-Operation Formula) ──────────────────────
            if (isCNC) {
                let cncUnitCost = 0;
                const operations = ['saw', 'lathe', 'mill', 'deburr', 'inspect'];

                operations.forEach(op => {
                    let setup = parseFloat(config[`cnc_${op}_setup`]) || 0;
                    let runtime = parseFloat(config[`cnc_${op}_runtime`]) || 0;
                    const rate = parseFloat(config[`cnc_${op}_rate`]) || 0;
                    const setupUnit = config[`cnc_${op}_setup_unit`] || 'Hours';
                    const runtimeUnit = config[`cnc_${op}_runtime_unit`] || 'Hours';

                    if (setupUnit === 'Minutes') setup /= 60;
                    else if (setupUnit === 'Seconds') setup /= 3600;

                    if (runtimeUnit === 'Minutes') runtime /= 60;
                    else if (runtimeUnit === 'Seconds') runtime /= 3600;

                    // Each configured CNC operation is priced per part, then the
                    // global quote math multiplies the unit cost by quantity.
                    cncUnitCost += (runtime + setup) * rate;
                });

                if (cncUnitCost > 0) {
                    console.log(`[Debug] CNC Production Cost Breakdown:`, {
                        unitCost: cncUnitCost,
                        totalCost: cncUnitCost * qty,
                        qty
                    });
                }
                main_service_cost = cncUnitCost;
            }

            // ── GENERIC SERVICE FALLBACK ──────────────────────────────────────
            if (main_service_cost === 0 && !skipMainServiceFallback) {
                main_service_cost = parseFloat(mainService.base_price) || 0;
            }
        }

        // ── ADDITIONAL SERVICES COST ──────────────────────────────────────────
        const service_breakdown = [];

        if (Array.isArray(additional_services) && additional_services.length > 0) {
            for (const sReq of additional_services) {
                const sId = typeof sReq === 'object' ? sReq.id : sReq;
                const optId = typeof sReq === 'object' ? sReq.option_id : null;

                const sRes = await db.query('SELECT * FROM services WHERE id = $1 AND COALESCE(is_active, true) = true', [sId]);
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
                const isOptionPricedFinish = sTitleLower.includes('anodiz') || sTitleLower.includes('plating');

                // ── POWDER COATING (powder coating.csv) ──────────────────────
                // Two orientations tried; use the one that fits more parts per batch.
                // Hanging dimension uses part THICKNESS + 24" (rack clearance), NOT length.
                // cost/unit = setup_charge + batch_cost, then global quote math multiplies by quantity.
                if (isPowder && s.pricing_config) {
                    const cfg = s.pricing_config;
                    const dimUnit = String(cfg.pc_dim_unit || cfg.dimension_unit || 'in').toLowerCase();
                    const dimDivisor = dimUnit === 'mm' ? 25.4 : 1;
                    const ovenW = (parseFloat(cfg.oven_width) || 0) / dimDivisor;
                    const ovenL = (parseFloat(cfg.oven_length) || 0) / dimDivisor;
                    const batchCost = parseFloat(cfg.batch_cost) || 0;
                    const setupTimeRaw = parseFloat(cfg.setup_time) || 0;
                    const pcTimeUnit = String(cfg.pc_time_unit || 'hr').toLowerCase();
                    const setupHours = pcTimeUnit === 'min' || pcTimeUnit === 'minutes'
                        ? setupTimeRaw / 60
                        : setupTimeRaw;
                    const setupCharge = setupHours * (parseFloat(cfg.shop_rate) || 0);

                    const partGap = (parseFloat(cfg.part_gap) || 6) / dimDivisor;
                    const rackClearance = (parseFloat(cfg.rack_clearance) || 24) / dimDivisor;

                    const pW = (parseFloat(height_in) || 10) + partGap;              // part width + horizontal gap
                    const pThick = (parseFloat(thickness_value) || 0.1) + rackClearance; // thickness + rack clearance

                    // Scenario 1: part width along oven width, parts hang along oven length
                    const s1 = Math.floor(ovenW / pW) * Math.floor(ovenL / pThick);
                    // Scenario 2: part width along oven length, parts hang along oven width
                    const s2 = Math.floor(ovenL / pW) * Math.floor(ovenW / pThick);

                    const perBatch = Math.max(1, s1, s2);
                    const numBatches = Math.ceil(qty / perBatch);

                    sPrice = setupCharge + batchCost;
                    powder_coating_breakdown = {
                        service_id: s.id,
                        oven_width_in: ovenW,
                        oven_length_in: ovenL,
                        part_width_in: parseFloat(height_in) || 0,
                        part_thickness_in: parseFloat(thickness_value) || 0,
                        part_gap_in: partGap,
                        rack_clearance_in: rackClearance,
                        scenario_1_parts: s1,
                        scenario_2_parts: s2,
                        parts_per_batch: perBatch,
                        number_of_batches: numBatches,
                        setup_hours: setupHours,
                        setup_charge: setupCharge,
                        batch_cost: batchCost,
                        pricing_mode: 'per_part',
                        unit_cost: sPrice,
                        total_cost: sPrice * qty
                    };
                }

                // Option/colour mapping
                if (optId !== null && s.service_options && Array.isArray(s.service_options)) {
                    const opt = s.service_options.find((o, idx) => o.id === optId || o.index === optId || idx === optId || o.name === optId);
                    if (opt) {
                        sName = `${s.title} - ${opt.name || opt.color}`;
                        // For Powder Coating, the enging covers the cost. 
                        // For others (Anodizing, etc.), they might have a fixed price surcharge.
                        if (!isPowder) {
                            const optionPrice = parseFloat(opt.price || 0) || 0;
                            sPrice = isOptionPricedFinish && optionPrice > 0
                                ? optionPrice
                                : sPrice + optionPrice;
                        }
                    }
                }

                // ── BENDING (as additional service) ──────────────────────────
                if (sTitleLower.includes('bend') && techData && Array.isArray(techData.bends) && techData.bends.length > 0) {
                    const bendSupport = getBendingSupportStatus(metal, s.id, thicknessInNum);
                    if (!bendSupport.supported) {
                        if (bendSupport.warning) pricingWarnings.push(bendSupport.warning);
                        continue;
                    } else {
                        const cfg = s.pricing_config || {};
                        const bendPrice = calculateBendingPricing(cfg, techData, qty);
                        sPrice = bendPrice.unitCost;
                        bending_breakdown = bendPrice;
                        if (bendPrice.days > 0) {
                            lead_days = Math.max(lead_days || 0, bendPrice.days);
                        }
                    }
                }

                service_breakdown.push({
                    service_id: s.id,
                    base_name: s.title,
                    name: sName,
                    price: sPrice,
                    pricing_mode: isOptionPricedFinish ? 'fixed_total' : 'per_unit'
                });
            }
        }

        const parseManualPrice = (p) => {
            if (p === undefined || p === null) return 0;
            const price = parseFloat(p);
            return isNaN(price) ? 0 : price;
        };

        if (Array.isArray(taps) && taps.length > 0) {
            const tapTotal = taps.reduce((acc, t) => acc + parseManualPrice(t.price), 0);
            service_breakdown.push({ base_name: 'Tapping', name: 'Tapping', price: tapTotal });
        }

        if (Array.isArray(hardware) && hardware.length > 0) {
            const hwTotal = hardware.reduce((acc, h) => acc + parseManualPrice(h.price), 0);
            service_breakdown.push({ base_name: 'Hardware', name: 'Hardware', price: hwTotal });
        }

        if (Array.isArray(countersinks) && countersinks.length > 0) {
            const csTotal = countersinks.reduce((acc, c) => acc + parseManualPrice(c.price), 0);
            service_breakdown.push({ base_name: 'Countersinking', name: 'Countersinking', price: csTotal });
        }

        // ── MARKUPS & FINAL TOTALS ──────────────────────────────────────────
        const settingsRes = await db.query("SELECT key, value FROM site_settings WHERE key IN ('general_markup', 'inside_labor_markup', 'material_markup', 'overhead_markup', 'markup_enabled_services', 'discounts_enabled')");
        const settings = {};
        settingsRes.rows.forEach(r => {
            if (r.key === 'markup_enabled_services') {
                try {
                    settings[r.key] = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
                } catch (e) { settings[r.key] = []; }
            } else if (r.key === 'discounts_enabled') {
                settings[r.key] = parseBooleanSetting(r.value, true);
            } else {
                settings[r.key] = toFiniteNumber(r.value);
            }
        });

        const genMU = settings.general_markup || 0;
        const insMU = settings.inside_labor_markup || 0;
        const matMU = settings.material_markup || 0;
        const ovhMU = settings.overhead_markup || 0;
        const markupServices = Array.isArray(settings.markup_enabled_services) ? settings.markup_enabled_services : [];
        const discountsEnabled = parseBooleanSetting(settings.discounts_enabled, true);

        const isMarkupEnabledFor = (name) => markupServices.includes(name);

        // Paperless-style costing: first compute raw cost buckets, then add
        // markups as pricing rows against their intended buckets.
        const raw_material_total = material_cost * qty;
        const raw_production_total = main_service_cost * qty;
        const material_markup_amount = raw_material_total * (matMU / 100);
        const production_markup_amount = isMarkupEnabledFor(mainService?.title)
            ? raw_production_total * (insMU / 100)
            : 0;

        const material_marked_up = raw_material_total + material_markup_amount;
        const production_marked_up = raw_production_total + production_markup_amount;

        const marked_service_breakdown = [];
        let total_sub_services_raw = 0;
        let fixed_sub_services_raw = 0;
        let service_markup_amount = 0;

        // 1. Add Main Service (e.g. Laser Cutting)
        if (main_service_cost > 0.001) {
            marked_service_breakdown.push({
                name: mainService?.title || 'Production',
                price: main_service_cost,
                pricing_mode: 'per_unit',
                markup_amount: production_markup_amount,
                price_with_markup: qty > 0 ? production_marked_up / qty : main_service_cost
            });
        }

        // 2. Add existing labor items (Bending, Tapping, Hardware, etc.)
        for (const item of service_breakdown) {
            const applyToSvc = isMarkupEnabledFor(item.base_name || item.name) || isMarkupEnabledFor(item.name);
            const isFixedTotal = item.pricing_mode === 'fixed_total';
            const rawTotal = isFixedTotal ? item.price : item.price * qty;
            const itemMarkup = applyToSvc ? rawTotal * (insMU / 100) : 0;

            if (item.price > 0.001) {
                if (isFixedTotal) {
                    fixed_sub_services_raw += item.price;
                } else {
                    total_sub_services_raw += item.price * qty;
                }
                service_markup_amount += itemMarkup;
                marked_service_breakdown.push({
                    name: item.name,
                    price: item.price,
                    pricing_mode: item.pricing_mode || 'per_unit',
                    markup_amount: itemMarkup,
                    price_with_markup: isFixedTotal
                        ? item.price + itemMarkup
                        : item.price + (qty > 0 ? itemMarkup / qty : 0)
                });
            }
        }

        const inside_labor_markup_amount = production_markup_amount + service_markup_amount;
        const total_estimated_cost = raw_material_total + raw_production_total + total_sub_services_raw + fixed_sub_services_raw;
        const overhead_markup_amount = total_estimated_cost * (ovhMU / 100);
        const general_markup_amount = total_estimated_cost * (genMU / 100);
        const total_markup_amount = material_markup_amount + inside_labor_markup_amount + overhead_markup_amount + general_markup_amount;
        const subtotal_before_discount = total_estimated_cost + total_markup_amount;
        let unit_total = qty > 0 ? subtotal_before_discount / qty : subtotal_before_discount;

        // ── QUANTITY DISCOUNTS ────────────────────────────────────────────────
        let discount_percent = 0;
        let applied_tier = null;

        const discountRes = discountsEnabled ? await db.query(`
                SELECT * FROM quantity_discounts
                WHERE is_active = true
                ORDER BY (quantities->>0)::int DESC
            `) : { rows: [] };

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

        const discount_amount = subtotal_before_discount * (discount_percent / 100);
        const final_total = Math.max(0, subtotal_before_discount - discount_amount);
        const final_unit_price = qty > 0 ? final_total / qty : 0;

        console.log('[Debug] Price Calculation:', {
            material_raw: material_cost,
            material: raw_material_total,
            material_markup_amount,
            production: raw_production_total,
            production_markup_amount,
            sub_services: total_sub_services_raw,
            fixed_sub_services: fixed_sub_services_raw,
            inside_labor_markup_amount,
            overhead_markup_amount,
            general_markup_amount,
            additional_services: total_sub_services_raw + fixed_sub_services_raw,
            unit_total,
            subtotal_before_discount,
            final_unit_price,
            qty,
            final_total
        });

        const warnings = Array.from(new Set([
            ...(boundsWarning ? [boundsWarning] : []),
            ...(laser_warning ? ['Part dimensions or thickness exceed standard limits. Please verify capability.'] : []),
            ...(material_no_fit ? ['Part is too large for a standard sheet.'] : []),
            ...(material_warning ? [material_warning] : []),
            ...pricingWarnings
        ].filter(Boolean)));

        res.json({
            success: true,
            total_price: final_total,
            lead_days: lead_days || 0,
            breakdown: {
                material_cost,
                material_total_cost: raw_material_total,
                material_cost_with_markup: qty > 0 ? material_marked_up / qty : material_marked_up,
                material_total_with_markup: material_marked_up,
                material_markup_percent: matMU,
                material_markup_amount,
                production_cost: main_service_cost,
                production_total_cost: raw_production_total,
                production_markup_amount,
                additional_services_cost: total_sub_services_raw + fixed_sub_services_raw,
                additional_services_unit_cost: total_sub_services_raw,
                additional_services_fixed_total: fixed_sub_services_raw,
                inside_labor_markup_percent: insMU,
                inside_labor_markup_amount,
                overhead_markup_percent: ovhMU,
                overhead_markup_amount,
                general_markup_percent: genMU,
                general_markup_amount,
                total_estimated_cost,
                total_markup_amount,
                service_breakdown: marked_service_breakdown,
                unit_total,
                subtotal_before_discount,
                final_unit_price,
                discount_percent,
                discounts_enabled: discountsEnabled,
                discount_amount,
                applied_tier,
                warnings,
                material_nesting,
                powder_coating: powder_coating_breakdown,
                bending: bending_breakdown ? bending_breakdown.variables : null
            }
        });

    } catch (err) {
        console.error('Error calculating price:', err);
        res.status(500).json({ success: false, error: 'Calculation failed' });
    }
});

module.exports = router;

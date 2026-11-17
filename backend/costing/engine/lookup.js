const {
    toNumber, asArray, isBlank, compactText,
    normalizeLookupText, isGenericLookupText, isExactMaterialMatch,
} = require('./util');

/*
 * Picking the Sheet Costs row and the Laser Cut Rates row for a part, scored
 * the way Zamyr scores them (quoteRoutingService.js findSheetCostLookupRow
 * 1721 and findLaserRateLookupRow 1397).
 *
 * metal: { id, name, family }   thicknessIn: the chosen stock thickness
 */

const metalNames = (metal) => [metal?.name, metal?.displayName].filter(Boolean);

function sheetThicknessMatch(row, thicknessIn, tolerance) {
    const rowThickness = toNumber(row.thickness_in, 0);
    const minThickness = toNumber(row.min_thick, 0);
    const maxThickness = toNumber(row.max_thick, 0);
    if (thicknessIn <= 0) return { matches: false, rowThickness };
    if (rowThickness > 0) {
        return { matches: Math.abs(rowThickness - thicknessIn) <= tolerance, rowThickness };
    }
    if (minThickness > 0 || maxThickness > 0) {
        const aboveMin = minThickness <= 0 || thicknessIn >= minThickness - tolerance;
        const belowMax = maxThickness <= 0 || thicknessIn <= maxThickness + tolerance;
        // A band match scores as an exact thickness hit, as in Zamyr.
        return { matches: aboveMin && belowMax, rowThickness: thicknessIn };
    }
    return { matches: false, rowThickness };
}

/* rows: [{ id, family, metal_id, material, ga, thickness_in, min_thick,
 *          max_thick, sort_order, prices: { [sheetSizeId]: cost } }]
 * A row is only a candidate when it has a price for this sheet size (a
 * blank cell is "not stocked in that size"; 0 is a real, if useless, 0).
 * Among equal scores a positive cost beats a $0 row, then row order. */
function findSheetCost(rows, { metal, thicknessIn, sheetSizeId, tolerance = 0.003 }) {
    const normalizedFamily = normalizeLookupText(metal?.family);
    if (!normalizedFamily) return null;

    const candidates = asArray(rows).flatMap((row, index) => {
        const thickness = sheetThicknessMatch(row, thicknessIn, tolerance);
        if (!thickness.matches) return [];

        const rawCost = row.prices ? row.prices[sheetSizeId] : undefined;
        if (isBlank(rawCost)) return [];

        if (normalizeLookupText(row.family) !== normalizedFamily) return [];

        const rowMaterial = compactText(row.material);
        const exactMaterial = (row.metal_id && metal?.id && Number(row.metal_id) === Number(metal.id))
            || isExactMaterialMatch(rowMaterial, metalNames(metal));

        let score = 20;
        if (exactMaterial) score += 60;
        if (!rowMaterial && !row.metal_id) score += 8;
        if (thickness.rowThickness > 0) score += 5 - Math.min(4, Math.abs(thickness.rowThickness - thicknessIn) * 100);
        score += 4;
        return [{ row, index, score, sheetCost: toNumber(rawCost, 0) }];
    });

    candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aPriced = a.sheetCost > 0, bPriced = b.sheetCost > 0;
        if (aPriced !== bPriced) return aPriced ? -1 : 1;
        return a.index - b.index;
    });
    return candidates[0] || null;
}

/* rows: [{ id, material_family, material, metal_id, thickness, cut_rate,
 *          pierce_time, sort_order }]
 * Family (or exact metal) match beats a generic row; then the thinnest row
 * at or above the part, else the thickest below it. */
function findLaserRate(rows, { metal, thicknessIn }) {
    const normalizedFamily = normalizeLookupText(metal?.family);
    const thickness = Math.max(0, toNumber(thicknessIn, 0));

    const candidates = asArray(rows).flatMap((row, index) => {
        const rowThickness = toNumber(row.thickness, 0);
        const rowFamily = compactText(row.material_family);
        const rowMaterial = compactText(row.material);
        const genericFamily = isGenericLookupText(rowFamily);
        const genericMaterial = isGenericLookupText(rowMaterial);
        const familyMatches = Boolean(rowFamily && normalizedFamily && normalizeLookupText(rowFamily) === normalizedFamily);
        const exactMaterial = (row.metal_id && metal?.id && Number(row.metal_id) === Number(metal.id))
            || isExactMaterialMatch(rowMaterial, metalNames(metal));
        const genericMatch = genericFamily || genericMaterial;

        if (!familyMatches && !exactMaterial && !genericMatch) return [];
        if (rowFamily && normalizedFamily && !familyMatches && !genericFamily) return [];

        const cutRate = toNumber(row.cut_rate, 0);
        let score = 0;
        if (familyMatches) score += 20;
        if (exactMaterial) score += 60;
        if (genericFamily || genericMaterial) score += 2;
        if (!rowMaterial || genericMaterial) score += 8;
        const isCeiling = thickness <= 0 || rowThickness <= 0 ? false : rowThickness + 1e-9 >= thickness;
        const thicknessDelta = thickness > 0 && rowThickness > 0 ? Math.abs(rowThickness - thickness) : Number.MAX_SAFE_INTEGER;
        return [{ row, index, score, rowThickness, thicknessDelta, isCeiling, cutRate }];
    });

    candidates.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        if (a.isCeiling !== b.isCeiling) return a.isCeiling ? -1 : 1;
        if (a.isCeiling && b.isCeiling) {
            if (a.rowThickness !== b.rowThickness) return a.rowThickness - b.rowThickness;
        } else if (a.rowThickness !== b.rowThickness) {
            return b.rowThickness - a.rowThickness;
        }
        if (a.thicknessDelta !== b.thicknessDelta) return a.thicknessDelta - b.thicknessDelta;
        if ((b.cutRate || 0) !== (a.cutRate || 0)) return (a.cutRate || 0) - (b.cutRate || 0);
        return a.index - b.index;
    });
    return candidates[0] || null;
}

/* How many parts fit on a sheet: straight and rotated rectangular grids,
 * the better one wins. Zamyr's sheetNestingYield (3087-3161). */
function sheetNestingYield({ partLength, partWidth, sheetLength, sheetWidth, edgeBuffer, partBuffer, kerfWidth }) {
    const safeEdgeBuffer = Math.max(0, toNumber(edgeBuffer, 0));
    // Kerf is consumed around every cut, so the pitch is part + buffer + kerf.
    const safePartBuffer = Math.max(0, toNumber(partBuffer, 0)) + Math.max(0, toNumber(kerfWidth, 0));
    const usableLength = Math.max(0, toNumber(sheetLength, 0) - safeEdgeBuffer * 2);
    const usableWidth = Math.max(0, toNumber(sheetWidth, 0) - safeEdgeBuffer * 2);
    const safePartLength = Math.max(0, toNumber(partLength, 0));
    const safePartWidth = Math.max(0, toNumber(partWidth, 0));
    const bufferedPartLength = safePartLength > 0 ? safePartLength + safePartBuffer : 0;
    const bufferedPartWidth = safePartWidth > 0 ? safePartWidth + safePartBuffer : 0;

    const fit = (stockLength, stockWidth, pieceLength, pieceWidth) => {
        if (stockLength <= 0 || stockWidth <= 0 || pieceLength <= 0 || pieceWidth <= 0) {
            return { alongLength: 0, acrossWidth: 0, total: 0 };
        }
        const tolerance = 1e-9;
        const alongLength = Math.max(0, Math.floor((stockLength + tolerance) / pieceLength));
        const acrossWidth = Math.max(0, Math.floor((stockWidth + tolerance) / pieceWidth));
        return { alongLength, acrossWidth, total: alongLength * acrossWidth };
    };

    const straight = fit(usableLength, usableWidth, bufferedPartLength, bufferedPartWidth);
    const rotated = fit(usableLength, usableWidth, bufferedPartWidth, bufferedPartLength);
    return {
        usableLength,
        usableWidth,
        straightYield: straight.total,
        rotatedYield: rotated.total,
        maximumYield: Math.max(straight.total, rotated.total),
    };
}

module.exports = { findSheetCost, findLaserRate, sheetNestingYield };

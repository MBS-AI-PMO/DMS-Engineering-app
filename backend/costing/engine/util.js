/*
 * Numbers, rounding and text matching, ported as-is from Zamyr's
 * quoteRoutingService.js (lines 11-80 and 1269-1400) so DMS prices round
 * and match rows exactly the way the shop's quotes do.
 */

function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

// Money to the cent; Zamyr's roundMoney.
function round2(value) {
    return Math.round(toNumber(value) * 100) / 100;
}

// Unit costs to 4 places; Zamyr's roundUnit.
function round4(value) {
    return Math.round(toNumber(value) * 10000) / 10000;
}

const asArray = (value) => (Array.isArray(value) ? value : []);

const isBlank = (value) => value == null || String(value).trim() === '';

const compactText = (value) => String(value || '').trim();

function normalizeLookupText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/aluminium/g, 'aluminum')
        .replace(/[^a-z0-9]+/g, '');
}

function isGenericLookupText(value) {
    return ['generic', 'all', 'any', 'default', '*'].includes(String(value || '').trim().toLowerCase());
}

function materialGradeTokens(text) {
    return String(text || '').toLowerCase().match(/\b[0-9]{3,4}(?:[-_ ]?[a-z0-9]+)?\b/g) || [];
}

/* Does a row's material/grade text name this metal? Zamyr's
 * isExactMaterialMatch, against the metal's name. */
function isExactMaterialMatch(rowMaterial, metalNames) {
    const candidate = compactText(rowMaterial);
    if (!candidate) return false;
    const normalizedCandidate = normalizeLookupText(candidate);
    const candidateGrades = materialGradeTokens(candidate);
    return asArray(metalNames).map(compactText).filter(Boolean).some((text) => {
        const normalizedText = normalizeLookupText(text);
        if (!normalizedText) return false;
        if (normalizedText === normalizedCandidate) return true;
        if (candidateGrades.length && candidateGrades.some(grade => normalizedText.includes(normalizeLookupText(grade)))) return true;
        return normalizedCandidate.length >= 4 && /\d/.test(normalizedCandidate) && normalizedText.includes(normalizedCandidate);
    });
}

// Time in hours from a value and its unit.
function toHours(value, unit) {
    const amount = Math.max(0, toNumber(value, 0));
    const u = String(unit || 'hours').toLowerCase();
    if (u.startsWith('min')) return amount / 60;
    if (u.startsWith('sec')) return amount / 3600;
    return amount;
}

module.exports = {
    toNumber, round2, round4, asArray, isBlank, compactText,
    normalizeLookupText, isGenericLookupText, isExactMaterialMatch, toHours,
};

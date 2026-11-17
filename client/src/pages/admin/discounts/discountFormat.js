/* Quantity lists shown as ranges, and typed ranges read back into lists. */

const MAX_RANGE = 500;

/* [2, 10, 11, 12] -> [[2, 2], [10, 12]] */
export function toRanges(quantities) {
    const nums = [...new Set((quantities || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
    const ranges = [];
    for (const n of nums) {
        const last = ranges[ranges.length - 1];
        if (last && n === last[1] + 1) last[1] = n;
        else ranges.push([n, n]);
    }
    return ranges;
}

/* The largest quantity any tier lists: a range ending there reads "N+". */
export const topQuantity = (tiers) => Math.max(0, ...tiers.flatMap(t => (Array.isArray(t.quantities) ? t.quantities.map(Number) : [])));

export const rangeLabel = ([start, end], top = 0) => {
    if (top > 0 && end === top) return `${start}+`;
    return start === end ? `${start}` : `${start}–${end}`;
};

export const rangesText = (quantities, top = 0) => {
    const ranges = toRanges(quantities);
    return ranges.length ? ranges.map(r => rangeLabel(r, top)).join(', ') : 'No quantities';
};

/**
 * "50", "10-25", "500+" or several separated by commas -> numbers.
 * "500+" adds 500 (the top tier then covers every larger quantity).
 * Returns { values } or { error }.
 */
export function parseQuantities(input) {
    const parts = String(input || '').split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return { error: 'Type a quantity, e.g. 50, 10-25 or 500+.' };
    const values = [];
    for (const part of parts) {
        const range = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
        const single = part.match(/^(\d+)\+?$/);
        if (range) {
            const start = Number(range[1]);
            const end = Number(range[2]);
            if (!(start > 0) || end < start) return { error: `"${part}" is not a range from low to high.` };
            if (end - start + 1 > MAX_RANGE) return { error: `"${part}" is too long. Keep a range under ${MAX_RANGE} quantities.` };
            for (let n = start; n <= end; n += 1) values.push(n);
        } else if (single && Number(single[1]) > 0) {
            values.push(Number(single[1]));
        } else {
            return { error: `"${part}" is not a quantity. Use whole numbers like 50, 10-25 or 500+.` };
        }
    }
    return { values };
}

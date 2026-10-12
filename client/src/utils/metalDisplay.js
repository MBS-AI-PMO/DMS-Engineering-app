/**
 * How metal names and thickness lines are shown on the public site, so
 * the home page, the footer and the metals page all say them the same way.
 */

/**
 * Admin metal names are typed in capitals ("5052 H32 ALUMINUM"). Plain
 * words go to normal case while grades and codes stay as typed: words with
 * a digit or "&" (H32, (A36), HRP&O) and words with no vowel (CPM). Names
 * that are not all capitals are left untouched.
 */
export const displayMetalName = (name = '') => {
    if (!/[A-Z]/.test(name) || name !== name.toUpperCase()) return name;
    return name.split(' ').map((word) => {
        if (/[\d&]/.test(word) || !/[AEIOUY]/.test(word)) return word;
        return word.replace(/[A-Z]+/, (letters) => letters[0] + letters.slice(1).toLowerCase());
    }).join(' ');
};

/**
 * '11 thicknesses: .030" - .500"' -> { count: 11, range: '.030" – .500"' }
 * 'Thicknesses: .030" – .135"'    -> { count: null, range: '.030" – .135"' }
 * Anything else comes back whole as the range.
 */
export const parseThickness = (raw = '') => {
    const text = String(raw || '');
    const match = text.match(/^\s*(?:(\d+)\s+)?thickness(?:es)?\s*:\s*(.+)$/i);
    if (!match) return { count: null, range: text.trim() };
    return {
        count: match[1] ? Number(match[1]) : null,
        range: match[2].trim().replace(/\s*[-–—]\s*/, ' – '),
    };
};

// '11 thicknesses: .030" - .500"' -> '11 thicknesses · .030" – .500"'
export const displayThickness = (raw = '') => {
    const { count, range } = parseThickness(raw);
    if (count === null) return range;
    return `${count} ${count === 1 ? 'thickness' : 'thicknesses'} · ${range}`;
};

/**
 * The thinnest and thickest stock across a list of thickness lines, as
 * '.030"' style text, or null when no inch values can be read.
 */
export const thicknessBounds = (rawList = []) => {
    const values = [];
    rawList.forEach((raw) => {
        const { range } = parseThickness(raw);
        for (const m of range.matchAll(/(\d*\.\d+|\d+(?:\.\d+)?)\s*(?:"|”|″|in\b)/g)) {
            const n = Number(m[1]);
            if (Number.isFinite(n) && n > 0) values.push(n);
        }
    });
    if (!values.length) return null;
    const fmt = (n) => `${n.toFixed(3).replace(/^0(?=\.)/, '')}"`;
    return { min: fmt(Math.min(...values)), max: fmt(Math.max(...values)) };
};

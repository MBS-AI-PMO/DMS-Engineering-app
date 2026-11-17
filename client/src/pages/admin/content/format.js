/* Dates for admin content screens: "17 Nov 2026". Accepts a Date or a string. */
export function shortDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* For stat cards: "25 Mar" this year, "Mar 2025" before. */
export function compactDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.getFullYear() === new Date().getFullYear()
        ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

/* "3 paragraphs", "1 paragraph". */
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

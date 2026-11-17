/* Dates, money and order statuses as the people screens and the dashboard show them. */

// Order statuses, with the labels and kit tones Admin › Orders uses.
export const ORDER_STATUSES = [
    { key: 'pending', label: 'Pending review', short: 'Pending', tone: 'amber' },
    { key: 'processing', label: 'In production', short: 'In production', tone: 'blue' },
    { key: 'shipping', label: 'Shipped', short: 'Shipped', tone: 'cyan' },
    { key: 'completed', label: 'Completed', short: 'Completed', tone: 'green' },
    { key: 'rejected', label: 'Rejected', short: 'Rejected', tone: 'red' },
];
export const orderStatus = (key) => ORDER_STATUSES.find(s => s.key === key) || { key, label: key || 'Unknown', tone: 'gray' };

/** Orders that count towards money taken (rejected ones do not). */
export const countsTowardRevenue = (order) => order.status !== 'rejected';

const toDate = (value) => {
    const d = value ? new Date(value) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
};

/** "Nov 17, 2026" ('' when missing). */
export const dateText = (value) => toDate(value)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || '';

/** "3 days ago" ('' when missing). */
export function ago(value) {
    const d = toDate(value);
    if (!d) return '';
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'just now';
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, size] of units) {
        const n = Math.floor(s / size);
        if (n >= 1) return `${n} ${unit}${n > 1 ? 's' : ''} ago`;
    }
    return '';
}

/** True when the date is within the last `days` days. */
export const withinDays = (value, days) => {
    const d = toDate(value);
    return Boolean(d) && Date.now() - d.getTime() <= days * 86400000;
};

export const money = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—';
};

/** "1 order" / "3 orders". */
export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** One page of a list: { rows, page } (page kept within 1…last). For <Pager>. */
export function paginate(list, page, pageSize) {
    const pages = Math.max(1, Math.ceil(list.length / pageSize));
    const current = Math.min(Math.max(1, page), pages);
    return { rows: list.slice((current - 1) * pageSize, current * pageSize), page: current };
}

/** Case-insensitive "does any of these contain the text". */
export const matchesText = (query, ...values) => {
    const q = query.trim().toLowerCase();
    return !q || values.some(v => v !== undefined && v !== null && String(v).toLowerCase().includes(q));
};

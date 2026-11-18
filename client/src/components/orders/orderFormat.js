/*
 * How an order's status and dates read to a customer, on My orders and on
 * the public tracking page (/track-order).
 */

export const STATUS_LABEL = {
    pending: 'Received',
    processing: 'In production',
    shipping: 'Shipped',
    shipped: 'Shipped',
    completed: 'Completed',
    rejected: 'Needs attention',
    cancelled: 'Cancelled',
};

export const statusLabel = (status) => STATUS_LABEL[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown');

/* A timestamp as "Nov 17, 2026". */
export const dateText = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/* A plain day ("2026-11-17", as the shop typed it) as "Nov 17, 2026", in no time zone. */
export const dayText = (day) => {
    const m = String(day || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
};

/* Only real web addresses become links. */
export const safeLink = (url) => (/^https?:\/\/\S+$/i.test(String(url || '')) ? url : null);

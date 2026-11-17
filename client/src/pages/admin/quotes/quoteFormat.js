/* Labels and formatting shared by Admin > Quotes (list and request page). */

export const STATUSES = [
    { key: 'new', label: 'New', hint: 'Waiting for a price' },
    { key: 'quoted', label: 'Quoted', hint: 'Price sent, waiting for the customer' },
    { key: 'accepted', label: 'Accepted', hint: 'The customer said yes' },
    { key: 'declined', label: 'Declined', hint: 'The customer said no, or we cannot make it' },
    { key: 'closed', label: 'Closed', hint: 'Done; nothing more to do' },
];
export const statusMeta = (key) => STATUSES.find(s => s.key === key) || { key, label: key || 'Unknown', hint: '' };

// Kit tones (Pill, Tabs dots) for each status.
const TONES = { new: 'amber', quoted: 'blue', accepted: 'green', declined: 'red', closed: 'gray' };
export const statusTone = (key) => TONES[key] || 'gray';

export const money = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—';
};

export const dateText = (value, withTime = false) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', withTime
        ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
        : { month: 'short', day: 'numeric', year: 'numeric' });
};

export const ago = (value) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'just now';
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, size] of units) {
        const n = Math.floor(s / size);
        if (n >= 1) return `${n} ${unit}${n > 1 ? 's' : ''} ago`;
    }
    return '';
};

export const fileSize = (bytes) => {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

const counted = (list) => (list || []).map(x => `${x.name}${x.count > 1 ? ` ×${x.count}` : ''}`).join(', ');
const inches = (n) => (Number(n) > 0 ? Number(n).toFixed(3) : null);
const mm = (n) => (Number(n) > 0 ? Number(n).toFixed(1) : null);

/* The part as [label, value] rows (KeyValue drops empty ones). */
export function partRows(cfg = {}) {
    const sIn = cfg.size_in || {};
    const sMm = cfg.size_mm || {};
    return [
        ['Material', cfg.material],
        ['Thickness', cfg.thickness],
        ['Process', cfg.process],
        ['Flat size', inches(sIn.l) && inches(sIn.w)
            ? `${inches(sIn.l)} × ${inches(sIn.w)} in${mm(sMm.l) && mm(sMm.w) ? ` (${mm(sMm.l)} × ${mm(sMm.w)} mm)` : ''}`
            : null],
        ['Finishing', (cfg.finishes || []).map(f => (f.color ? `${f.title} (${f.color})` : f.title)).join(', ')],
        ['Tapped holes', counted(cfg.taps)],
        ['Countersinks', counted(cfg.countersinks)],
        ['Hardware', counted(cfg.hardware)],
        ['Holes', Number.isFinite(Number(cfg.holes)) && cfg.holes !== null ? String(cfg.holes) : null],
        ['Bends', Number(cfg.bends) > 0 ? String(cfg.bends) : (cfg.bends === 0 ? 'None (flat part)' : null)],
    ];
}

/* What happened to an email, as a toast. */
export function emailToast(toast, email, done = 'Saved') {
    if (!email || email.status === 'skipped') { toast(done, 'success'); return; }
    if (email.status === 'sent') { toast(`${done}. Email sent to ${email.to}.`, 'success'); return; }
    if (email.status === 'sending') { toast(`${done}. The email is still sending; check the activity log.`, 'info'); return; }
    toast(`${done}, but the email was not sent: ${email.error || 'unknown error'}`, 'warning');
}

/* The part's flat outline as an SVG path, from the cut edges in the pricing
 * request (x, y, z triples in pairs: one segment per six numbers, in mm).
 * Same drawing as the order page (orders/orderFormat outlinePath). */
export function outlinePath(cutEdges) {
    if (!Array.isArray(cutEdges) || cutEdges.length < 12) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i + 2 < cutEdges.length; i += 3) {
        const x = cutEdges[i], y = cutEdges[i + 1];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const w = maxX - minX, h = maxY - minY;
    if (!(w > 0) || !(h > 0)) return null;
    const r = (v) => Math.round(v * 100) / 100;
    const parts = [];
    for (let i = 0; i + 5 < cutEdges.length; i += 6) {
        const [x1, y1, , x2, y2] = cutEdges.slice(i, i + 6);
        if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
        parts.push(`M${r(x1 - minX)} ${r(maxY - y1)}L${r(x2 - minX)} ${r(maxY - y2)}`);
    }
    const pad = Math.max(w, h) * 0.04;
    return { d: parts.join(''), viewBox: `${r(-pad)} ${r(-pad)} ${r(w + pad * 2)} ${r(h + pad * 2)}`, stroke: Math.max(w, h) / 180 };
}

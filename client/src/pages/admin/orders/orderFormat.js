/* Labels, formatting and part details shared by the order list and page. */

export const STATUSES = [
    { key: 'pending', label: 'Pending review', short: 'Pending' },
    { key: 'processing', label: 'In production', short: 'In production' },
    { key: 'shipping', label: 'Shipped', short: 'Shipped' },
    { key: 'completed', label: 'Completed', short: 'Completed' },
    { key: 'rejected', label: 'Rejected', short: 'Rejected' },
];
export const statusMeta = (key) => STATUSES.find(s => s.key === key) || { key: key || 'pending', label: key || 'Unknown', short: key || 'Unknown' };

// Kit tones (Pill, StatCard, Tabs dots) for each status.
export const STATUS_TONE = { pending: 'amber', processing: 'blue', shipping: 'cyan', completed: 'green', rejected: 'red' };
export const statusTone = (key) => STATUS_TONE[key] || 'gray';

// The steps customers are emailed about ("pending" is where every order starts).
export const ANNOUNCED = new Set(['processing', 'shipping', 'completed', 'rejected']);

export const PAYMENT_LABEL = { COD: 'Cash on delivery', PAYPAL: 'PayPal' };
export const paymentLabel = (method) => PAYMENT_LABEL[String(method || '').toUpperCase()] || method || '—';

export const money = (value) => {
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

/* A plain day ("2026-11-17") shown as that day wherever the browser is. */
export const dayText = (day) => {
    const match = String(day || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
export const todayDay = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

const num = (v) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
};

/* "M6 x1.0" ×4, "M8" ×2 from { holeId: { name } } */
function countByName(entries, nameOf) {
    const counts = new Map();
    for (const entry of Object.values(entries || {})) {
        const name = nameOf(entry) || 'Unnamed';
        counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

/* Everything about a part the shop needs, from its saved configuration. */
export function partDetails(cfg = {}) {
    const inches = cfg.dimensions?.inches || {};
    const mm = cfg.dimensions?.mm || {};
    const tech = cfg.pricingTechnicalData || {};
    const finishes = (cfg.additionalServices || []).filter(Boolean).map(service => {
        const color = cfg.selectedFinishColors?.[service.id];
        const colorName = color?.name || color?.service_name || '';
        return { title: service.title, color: colorName, swatch: color?.hex || color?.color || null };
    });
    const bends = Math.max(
        num(cfg.bendCount) || 0,
        Object.keys(cfg.selectedBends || {}).length,
        Array.isArray(cfg.detectedBends) ? cfg.detectedBends.length : 0,
    );
    const thicknessIn = num(String(cfg.selectedThickness || '').replace(/["\s]/g, '').replace(/^\./, '0.'));
    return {
        material: cfg.metal?.name || '',
        process: cfg.productionService?.title || '',
        thickness: cfg.selectedThicknessDisplay
            || (thicknessIn ? `${thicknessIn.toFixed(3)} in (${(thicknessIn * 25.4).toFixed(2)} mm)` : '')
            || (num(cfg.thickness) ? `${num(cfg.thickness).toFixed(2)} mm (model)` : ''),
        size: num(inches.l) && num(inches.w)
            ? `${num(inches.l).toFixed(3)} × ${num(inches.w).toFixed(3)} in`
            : '',
        sizeMm: num(mm.l) && num(mm.w) ? `${num(mm.l).toFixed(1)} × ${num(mm.w).toFixed(1)} mm` : '',
        sizeSource: cfg.modelDimensionSource || '',
        flatArea: num(tech.flatArea) ? `${(num(tech.flatArea) / 645.16).toFixed(2)} in²` : '',
        cutLength: num(tech.totalPerimeter) ? `${(num(tech.totalPerimeter) / 25.4).toFixed(1)} in` : '',
        pierces: num(tech.pierceCount),
        holes: Array.isArray(cfg.detectedHoles) ? cfg.detectedHoles.length : null,
        bends,
        anodize: cfg.anodizingColor?.name || cfg.anodizingColor?.label || '',
        finishes,
        taps: countByName(cfg.selectedTaps, t => t?.tap_name || t?.name),
        countersinks: countByName(cfg.selectedCountersinks, c => c?.name),
        hardware: countByName(cfg.selectedHardware, h => h?.item?.name || h?.name),
    };
}

/* The part's flat outline as an SVG path, from the cut edges saved with it
 * (x, y, z triples in pairs: one line segment per six numbers, in mm). */
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
        // y flipped so the drawing reads like the CAD view.
        parts.push(`M${r(x1 - minX)} ${r(maxY - y1)}L${r(x2 - minX)} ${r(maxY - y2)}`);
    }
    const pad = Math.max(w, h) * 0.04;
    return { d: parts.join(''), viewBox: `${r(-pad)} ${r(-pad)} ${r(w + pad * 2)} ${r(h + pad * 2)}`, stroke: Math.max(w, h) / 180 };
}

/* Quick starts for "Email the customer". */
export const EMAIL_PRESETS = [
    {
        key: 'custom', label: 'Blank message', subject: (o) => `An update on your order #${o.id}`, message: () => '',
    },
    {
        key: 'files', label: 'Files need changes',
        subject: (o) => `Order #${o.id}: a question about your files`,
        message: () => "We've reviewed your files and need a small change before we can start production:\n\n[describe the change]\n\nReply to this email with an updated file or any questions, and we'll get your parts moving.",
    },
    {
        key: 'pickup', label: 'Ready for pickup',
        subject: (o) => `Order #${o.id} is ready for pickup`,
        message: () => 'Your parts are finished and ready for pickup at our shop, Monday to Friday, 8 am to 5 pm.\n\nBring your order number and we will have them ready for you.',
    },
    {
        key: 'delay', label: 'Delay notice',
        subject: (o) => `Order #${o.id}: updated timing`,
        message: () => "A quick heads-up: your order is taking a little longer than planned.\n\n[reason and new expected date]\n\nThanks for your patience. Reply to this email if the new date doesn't work for you.",
    },
    {
        key: 'photos', label: 'Photos of the parts',
        subject: (o) => `Photos of your order #${o.id}`,
        message: () => "Here's how your parts came out. Let us know if anything looks off before we ship.",
    },
];

/* What happened to the email, as a toast. */
export function emailToast(toast, email, done = 'Saved') {
    if (!email || email.status === 'skipped') { toast(done, 'success'); return; }
    if (email.status === 'sent') { toast(`${done}. Email sent to ${email.to}.`, 'success'); return; }
    if (email.status === 'sending') { toast(`${done}. The email is still sending; check the activity log.`, 'info'); return; }
    toast(`${done}, but the email was not sent: ${email.error || 'unknown error'}`, 'warning');
}

/* ── Cost and profit ──────────────────────────────────────────────────── */

export const BUCKET_LABEL = { material: 'Material', inside: 'Shop labour', outside: 'Outside services', purchased: 'Bought-in parts' };
const BUCKETS = Object.keys(BUCKET_LABEL);

/* What the customer paid for a line (the server price saved at checkout). */
export const linePaid = (item) => (item.line_total !== null && item.line_total !== undefined
    ? Number(item.line_total)
    : Number(item.unit_price) * (Number(item.quantity) || 1));

/* A part's cost and profit from item.costing (see backend itemCosting):
 * every operation with its cost, its share of the markups and its price;
 * markups on a cost group (material, labour…) are shared over that group's
 * operations, overhead and general markups over all of them, by cost. */
export function costView(item) {
    const c = item.costing || {};
    const paid = linePaid(item);
    if (!c.totals) return { known: false, source: c.source || 'none', paid, reasons: c.reasons || [] };
    const ops = (c.operations || []).map(o => ({ name: o.name, bucket: o.bucket, details: o.details, cost: Number(o.totalCost) || 0, markup: 0 }));
    for (const m of c.markups || []) {
        const amount = Number(m.totalCost) || 0;
        if (!amount) continue;
        const targets = BUCKETS.includes(m.base) ? ops.filter(o => o.bucket === m.base) : ops;
        const base = targets.reduce((s, o) => s + o.cost, 0);
        if (base > 0) targets.forEach(o => { o.markup += amount * (o.cost / base); });
    }
    ops.forEach(o => { o.price = o.cost + o.markup; });
    const t = c.totals;
    const cost = Number(t.totalEstimatedCost) || ops.reduce((s, o) => s + o.cost, 0);
    const byBucket = Object.fromEntries(BUCKETS.map(b => [b, ops.filter(o => o.bucket === b).reduce((s, o) => s + o.cost, 0)]));
    return {
        known: true,
        source: c.source,
        pricedAt: c.pricedAt,
        ops,
        markups: (c.markups || []).filter(m => Number(m.totalCost) !== 0),
        addOns: Number(t.addOnCost) || 0,
        discount: Number(t.discountAmount) || 0,
        rulePrice: Number(t.finalTotal ?? t.subtotal) || 0,
        cost,
        byBucket,
        paid,
        profit: paid - cost,
        margin: paid > 0 ? (paid - cost) / paid : 0,
    };
}

/* The whole order: sums of the parts whose cost is known. */
export function orderCost(items) {
    const views = items.map(costView);
    const known = views.filter(v => v.known);
    const sum = (f) => known.reduce((s, v) => s + f(v), 0);
    const paid = sum(v => v.paid);
    const cost = sum(v => v.cost);
    return {
        views,
        knownCount: known.length,
        unknownCount: views.length - known.length,
        estimated: known.some(v => v.source === 'estimate'),
        paid,
        cost,
        profit: paid - cost,
        margin: paid > 0 ? (paid - cost) / paid : 0,
        byBucket: Object.fromEntries(BUCKETS.map(b => [b, sum(v => v.byBucket[b] || 0)])),
        markups: sum(v => v.ops.reduce((s, o) => s + o.markup, 0)),
        unknownPaid: views.filter(v => !v.known).reduce((s, v) => s + v.paid, 0),
    };
}

export const percent = (ratio) => `${(ratio * 100).toFixed(1)}%`;

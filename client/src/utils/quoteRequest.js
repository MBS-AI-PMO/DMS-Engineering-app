/*
 * Helpers for "Request a quote" (components/QuoteRequestDialog.jsx), used by
 * the quote page and the cart: what the customer chose, in the small shape
 * the server stores, and why a part had no instant price, in plain words.
 */

const num = (v) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
};

/* { holeId: { name } } -> [{ name, count }] */
function countByName(entries, nameOf) {
    const counts = new Map();
    Object.values(entries || {}).forEach(entry => {
        const name = nameOf(entry) || 'Unnamed';
        counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

const sizeOf = (dims) => (dims ? { l: num(dims.l), w: num(dims.w), t: num(dims.t) } : null);

/* A part's configuration (the cart's shape: productionService, metal,
 * selectedThickness, additionalServices, selectedFinishColors, selectedTaps,
 * selectedCountersinks, selectedHardware, dimensions, bendCount …) as the
 * summary sent with a quote request. */
export function configurationSummary(cfg = {}) {
    const finishes = (cfg.additionalServices || []).filter(Boolean).map(service => {
        const color = cfg.selectedFinishColors?.[service.id];
        return {
            title: service.title,
            color: color?.name || color?.service_name || null,
            swatch: color?.hex || color?.color || null,
        };
    });
    const bends = Math.max(
        num(cfg.bendCount) || 0,
        Object.keys(cfg.selectedBends || {}).length,
        Array.isArray(cfg.detectedBends) ? cfg.detectedBends.length : 0,
    );
    return {
        process: cfg.productionService?.title || null,
        process_id: cfg.productionService?.id ?? null,
        material: cfg.metal?.name || null,
        material_id: cfg.metal?.id ?? null,
        thickness: cfg.selectedThickness ? String(cfg.selectedThickness) : (cfg.selectedThicknessDisplay || null),
        finishes,
        taps: countByName(cfg.selectedTaps, t => t?.tap_name || t?.name),
        countersinks: countByName(cfg.selectedCountersinks, c => c?.name),
        hardware: countByName(cfg.selectedHardware, h => h?.item?.name || h?.name),
        bends,
        holes: Array.isArray(cfg.detectedHoles) ? cfg.detectedHoles.length : null,
        size_in: sizeOf(cfg.dimensions?.inches),
        size_mm: sizeOf(cfg.dimensions?.mm),
        size_source: cfg.modelDimensionSource || null,
    };
}

const counted = (list) => (list || []).map(x => `${x.name}${x.count > 1 ? ` ×${x.count}` : ''}`).join(', ');

/* The summary as short labelled facts for the dialog. */
export function summaryFacts(summary = {}) {
    const l = num(summary.size_in?.l);
    const w = num(summary.size_in?.w);
    return [
        ['Material', summary.material],
        ['Thickness', summary.thickness],
        ['Process', summary.process],
        ['Size', l && w ? `${l.toFixed(2)} × ${w.toFixed(2)} in` : null],
        ['Finishing', (summary.finishes || []).map(f => (f.color ? `${f.title} (${f.color})` : f.title)).join(', ')],
        ['Tapped holes', counted(summary.taps)],
        ['Countersinks', counted(summary.countersinks)],
        ['Hardware', counted(summary.hardware)],
        ['Bends', summary.bends > 0 ? String(summary.bends) : null],
    ].filter(([, value]) => value);
}

// Reasons whose server wording is written for the shop, said for a customer.
const PLAIN = {
    NO_SHEET_SIZE: 'We need to pick the right sheet size for this part.',
    NO_CUT_LENGTH: "We couldn't measure the cutting length from the file.",
    LASER_RATE_INVALID: 'Cutting this thickness is priced by our team.',
    OP_CONFIG_INVALID: 'Part of this job is priced by our team.',
    ZERO_TOTAL: "This part couldn't be priced automatically.",
    NOT_PRICEABLE: "This part couldn't be priced automatically.",
};

/* [{ code, message }] -> unique plain sentences. */
export function plainReasons(reasons = []) {
    const out = [];
    (reasons || []).forEach(r => {
        const text = PLAIN[r?.code] || r?.message;
        if (text && !out.includes(text)) out.push(text);
    });
    return out;
}

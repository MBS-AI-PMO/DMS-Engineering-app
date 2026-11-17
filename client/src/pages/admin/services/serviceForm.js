/*
 * The service editor's data. Production limits (min/max length, width,
 * height) are stored in the service's own dimensions_unit ('in' or 'mm').
 * service_options holds the catalog list that matches the service: colours
 * (anodizing, powder coating), taps, or countersink profiles. Pricing is
 * not edited here: it lives in Admin > Costing; pricing_config and
 * base_price are only carried through unchanged.
 */

export const LIMIT_FIELDS = [
    { label: 'Length', min: 'min_length', max: 'max_length' },
    { label: 'Width', min: 'min_width', max: 'max_width' },
    { label: 'Height', min: 'min_height', max: 'max_height' },
];
const LIMIT_KEYS = LIMIT_FIELDS.flatMap(d => [d.min, d.max]);

export const EMPTY_SERVICE = {
    title: '', description: '', image_path: '', display_order: 0,
    is_production: false, parent_ids: [], is_active: true,
    min_length: 0, max_length: 0, min_width: 0, max_width: 0, min_height: 0, max_height: 0,
    dimensions_unit: 'in', service_options: [], base_price: 0,
    pricing_config: {},
};

/** API row -> form (the whole row is kept so nothing is lost on save). */
export function toForm(row) {
    return {
        ...row,
        title: row.title || '',
        description: row.description || '',
        image_path: row.image_path || '',
        parent_ids: Array.isArray(row.parent_ids) ? row.parent_ids.map(Number) : [],
        service_options: Array.isArray(row.service_options) ? row.service_options : [],
        pricing_config: row.pricing_config || {},
        dimensions_unit: row.dimensions_unit || 'in',
        is_active: row.is_active !== false,
    };
}

const num = (v) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

/** form -> API body */
export function toPayload(form) {
    const body = { ...form, title: form.title.trim(), display_order: Number.parseInt(form.display_order, 10) || 0 };
    LIMIT_KEYS.forEach(k => { body[k] = num(form[k]); });
    return body;
}

/** The limits converted to another unit (4 decimals). */
export function convertLimits(form, unit) {
    if (form.dimensions_unit === unit) return form;
    const ratio = unit === 'mm' ? 25.4 : 1 / 25.4;
    const next = { ...form, dimensions_unit: unit };
    LIMIT_KEYS.forEach(k => { next[k] = Number.parseFloat((num(form[k]) * ratio).toFixed(4)); });
    return next;
}

/** Which catalog list this service edits, from its title. */
export function catalogKind(title = '') {
    const t = title.toLowerCase();
    if (t.includes('anodiz')) return 'anodizing';
    if (t.includes('powder coat')) return 'powder';
    if (t.includes('tap')) return 'taps';
    if (t.includes('countersink')) return 'countersinks';
    if (t.includes('hardware') || t.includes('insertion')) return 'hardware';
    return null;
}

export const money = (v, digits = 2) => `$${(Number.parseFloat(v) || 0).toFixed(digits)}`;

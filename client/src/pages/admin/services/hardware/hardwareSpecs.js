/*
 * Hardware item measurements. They are stored in inches; the editor can
 * show them in mm. Which fields a type has, and what they are called,
 * depends on the type (by id, as the quote page expects; slug as fallback):
 *   1 Flush stud · 2 Flush standoff · 3 Nut · 4 Flush nut.
 */

export const MEASURE_KEYS = ['length', 'base_width', 'min_edge_distance', 'tooling_diameter', 'max_hole_diameter'];

export function typeKind(type) {
    const id = Number(type?.id);
    if (id === 4 || type?.slug === 'flush-nut') return 'flushNut';
    if (id === 3 || type?.slug === 'nut') return 'nut';
    if (id === 2 || type?.slug === 'flush-standoff') return 'standoff';
    return 'stud';
}

/**
 * The fields shown for a type: [{ key, label, short, hint?, inches (false = a count) }].
 * short is the label used in the items table.
 */
export function specFields(type) {
    const kind = typeKind(type);
    const nutLike = kind === 'nut' || kind === 'flushNut';
    return [
        { key: 'length', label: kind === 'flushNut' ? 'Thickness (A)' : kind === 'nut' ? 'Thickness (T)' : 'Length', short: kind === 'flushNut' ? 'A' : kind === 'nut' ? 'T' : 'L', inches: true },
        ...(nutLike ? [{ key: 'base_width', label: kind === 'flushNut' ? 'Base width (H)' : 'Outside dimension (E)', short: kind === 'flushNut' ? 'H' : 'E', inches: true }] : []),
        ...(kind === 'flushNut' ? [{ key: 'shank', label: 'Shank', short: 'Shank', inches: false, step: '1', placeholder: 'e.g. 2' }] : []),
        { key: 'min_edge_distance', label: nutLike ? 'Min centerline to edge' : 'Min edge distance', short: 'Edge', inches: true },
        {
            key: 'tooling_diameter',
            label: kind === 'standoff' ? 'Standoff outer diameter' : 'Tooling diameter',
            short: 'Tool',
            inches: true,
            hint: kind === 'standoff' ? 'Used as the standoff body diameter in the 3D viewer.' : undefined,
        },
        { key: 'max_hole_diameter', label: 'Max hole diameter', short: 'Max hole', inches: true, hint: 'Holes larger than this cannot use this item.', placeholder: 'No limit' },
    ];
}

const trim = (s) => s.replace(/\.?0+$/, '');
/** "0.6250" (in) -> "15.875" (mm), and back. Blank stays blank. */
export const inToMm = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number.parseFloat(v)) ? '' : trim((Number.parseFloat(v) * 25.4).toFixed(4)));
export const mmToIn = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number.parseFloat(v)) ? '' : trim((Number.parseFloat(v) / 25.4).toFixed(4)));
/** A stored inch value as text in the chosen unit. */
export const showIn = (v, unit) => (unit === 'mm' ? inToMm(v) : (v === null || v === undefined ? '' : trim(String(v))));

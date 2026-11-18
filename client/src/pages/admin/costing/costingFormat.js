/* Labels and small formatters shared by the Costing screens. */

export const money = (v) => `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* A stored decimal ("0.063000") shown without trailing zeros. */
export const trimNumber = (v) => (v === null || v === undefined || v === '' ? '' : String(Number(v)));

/* Where an operation's cost goes (decides which markup applies). */
export const BUCKETS = [
    { value: 'material', label: 'Material' },
    { value: 'inside', label: 'Inside labor' },
    { value: 'outside', label: 'Outside service' },
    { value: 'purchased', label: 'Purchased component' },
];
export const bucketLabel = (value) => BUCKETS.find(b => b.value === value)?.label || value;

export const MARKUP_BASES = [
    { value: 'material', label: 'Material cost' },
    { value: 'inside', label: 'Inside labor' },
    { value: 'outside', label: 'Outside services' },
    { value: 'purchased', label: 'Purchased components' },
    { value: 'overhead', label: 'Overhead (all cost)' },
    { value: 'general', label: 'General (all cost)' },
];

/* Units of operation fields, as shown after the label. */
export const UNIT_LABEL = { '$/hr': '$/hr', hr: 'hours', in: 'in', sec: 'seconds', $: '$', '$ per bend': '$ per bend', '$ each': '$ each', count: '', time: '' };

/* Id-keyed option lists for selects. */
export const metalOptions = (metals, anyLabel = 'Any') => [
    { value: '', label: anyLabel },
    ...metals.map(m => ({ value: String(m.id), label: m.name })),
];

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

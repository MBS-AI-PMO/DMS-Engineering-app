/*
 * The metal editor's data: sections, empty record, and the conversions
 * between the API row and the form. Units: quick_look thickness values are
 * inch labels ('.063"'), metric is mm text ('1.60mm'). The quote page's
 * thickness buttons come from quick_look.thicknesses, so their shape
 * ({ value, metric, services? }) must stay exactly as it is.
 */

export const SPEC_SECTIONS = [
    { key: 'generalDetails', label: 'General details', fields: ['label', 'inch', 'mm'] },
    { key: 'laserCuttingSpecs', label: 'Laser cutting', fields: ['label', 'inch', 'mm'] },
    { key: 'bendingSpecs', label: 'Bending', fields: ['label', 'inch', 'mm'] },
    { key: 'countersinkSpecs', label: 'Countersink', fields: ['label', 'inch', 'mm'] },
    { key: 'deburringSpecs', label: 'Deburring', fields: ['label', 'inch', 'mm'] },
    { key: 'dimpleSpecs', label: 'Dimple', fields: ['label', 'inch', 'mm'] },
    { key: 'hardwareSpecs', label: 'Hardware', fields: ['label', 'inch', 'mm'] },
    { key: 'platingSpecs', label: 'Plating', fields: ['label', 'inch', 'mm'] },
    { key: 'powderCoatingSpecs', label: 'Powder coating', fields: ['label', 'inch', 'mm'] },
    { key: 'tappingSpecs', label: 'Tapping', fields: ['label', 'inch', 'mm'] },
    { key: 'tumbleSpecs', label: 'Tumble', fields: ['label', 'inch', 'mm'] },
    { key: 'anodizingSpecs', label: 'Anodizing', fields: ['label', 'inch', 'mm'] },
    { key: 'properties', label: 'Properties', fields: ['label', 'value'] },
];

export const FIELD_LABELS = { label: 'Label', inch: 'Inch', mm: 'mm', value: 'Value' };

/* custom_fields[].tab values the public metal page understands (keep as stored). */
export const CUSTOM_FIELD_TABS = [
    { value: 'Quick Look', label: 'Quick look' },
    { value: 'Pricing', label: 'Pricing' },
    { value: 'Specifications', label: 'Specifications' },
    { value: 'About', label: 'About' },
    { value: 'Services', label: 'Services' },
    { value: 'FAQs', label: 'FAQs' },
];

export const EMPTY_QUICK_LOOK = { thicknesses: [], cutSizes: [], tolerance: '' };

export const EMPTY_METAL = {
    name: '',
    category_id: '',
    thickness: '',
    description: '',
    image_path: '',
    display_order: 0,
    quick_look: EMPTY_QUICK_LOOK,
    specifications: {},
    thickness_specs: {},
    about_section: null,
    services: [],
    faqs: [],
    custom_fields: {},
    pricing_config: {},
};

/* API row -> form (only what the editor owns; pricing_config is carried through untouched). */
export function toForm(row) {
    return {
        id: row.id,
        slug: row.slug,
        name: row.name || '',
        category_id: row.category_id ?? '',
        thickness: row.thickness || '',
        description: row.description || '',
        image_path: row.image_path || '',
        display_order: row.display_order ?? 0,
        quick_look: row.quick_look || EMPTY_QUICK_LOOK,
        specifications: row.specifications || {},
        thickness_specs: row.thickness_specs || {},
        about_section: row.about_section || null,
        services: row.services || [],
        faqs: row.faqs || [],
        custom_fields: row.custom_fields || {},
        pricing_config: row.pricing_config || {},
    };
}

/* form -> API body */
export function toPayload(form) {
    const { id, slug, ...rest } = form;
    void id; void slug;
    return { ...rest, display_order: Number.parseInt(rest.display_order, 10) || 0 };
}

export const toIds = (list) => (Array.isArray(list) ? list.map(Number) : []);
export const thicknessLabel = (t, i) => t?.value || `Thickness ${i + 1}`;

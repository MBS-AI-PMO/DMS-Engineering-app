/*
 * What a part is made of and how, from the configuration saved with its
 * order item (order_items.configuration_json). Used by the order emails and
 * the public tracking page, so both describe a part the same way.
 *
 *   partSpecs(cfg) -> { material, thickness, services: ['Laser Cutting', 'Powder Coating (Gloss Black)', '2 bends'] }
 */

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* configuration_json as an object (pg returns JSONB parsed; older rows may be text). */
function parseConfig(value) {
    if (value && typeof value === 'object') return value;
    if (typeof value !== 'string') return {};
    try { return JSON.parse(value) || {}; } catch { return {}; }
}

function partSpecs(cfg = {}) {
    const services = [];
    if (cfg.productionService?.title) services.push(cfg.productionService.title);
    for (const service of cfg.additionalServices || []) {
        if (!service?.title) continue;
        const color = cfg.selectedFinishColors?.[service.id]?.name;
        services.push(color ? `${service.title} (${color})` : service.title);
    }
    const bends = Number(cfg.bendCount);
    if (bends > 0) services.push(plural(bends, 'bend'));
    return {
        material: cfg.metal?.name || null,
        thickness: cfg.selectedThickness || cfg.selectedThicknessDisplay || null,
        services,
    };
}

module.exports = { parseConfig, partSpecs };

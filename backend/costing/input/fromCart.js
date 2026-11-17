/*
 * The /api/pricing/calculate request for a cart item, so an order or a
 * PayPal payment is priced on the server, not taken from the browser.
 *
 * New carts carry the exact request the quote page priced (pricingInput);
 * older carts are rebuilt from the saved configuration the same way the
 * cart rebuilds them on a quantity change (client/src/context/CartProvider.jsx).
 * Either way the quantity is the cart's, and the material and process must
 * be the ones on the configuration.
 */

const optionIdFor = (service, chosen) => {
    if (!chosen) return null;
    const options = Array.isArray(service?.service_options) ? service.service_options : [];
    const index = options.findIndex(o =>
        (chosen.id != null && o.id === chosen.id)
        || (chosen.name && o.name === chosen.name)
        || (chosen.color && o.color === chosen.color));
    return chosen.id ?? chosen.index ?? (index >= 0 ? index : (chosen.name || null));
};

function thicknessInches(cfg) {
    const isCnc = String(cfg.productionService?.title || '').toLowerCase().includes('cnc');
    if (isCnc) return cfg.dimensions?.inches?.t;
    const selected = cfg.selectedThickness;
    const entry = (cfg.metal?.quick_look?.thicknesses || []).find(th => String(th.value) === String(selected));
    if (!entry) return selected;
    return entry.metric === 'mm' ? String(parseFloat(entry.value) / 25.4) : entry.value;
}

function fromConfiguration(cfg = {}) {
    return {
        metal_id: cfg.metal?.id ?? null,
        service_id: cfg.productionService?.id ?? null,
        thickness_value: thicknessInches(cfg),
        length_in: cfg.dimensions?.inches?.l,
        height_in: cfg.dimensions?.inches?.w,
        additional_services: (cfg.additionalServices || []).map(s => ({ id: s.id, option_id: optionIdFor(s, cfg.selectedFinishColors?.[s.id]) })),
        taps: Object.values(cfg.selectedTaps || {}).map(t => ({ name: t?.name })),
        hardware: Object.values(cfg.selectedHardware || {}).map(h => ({ id: h?.item?.id ?? null, name: h?.item?.name })),
        countersinks: Object.values(cfg.selectedCountersinks || {}).map(c => ({ name: c?.name })),
        technical_data: cfg.pricingTechnicalData || {
            totalPerimeter: ((parseFloat(cfg.dimensions?.inches?.l) || 0) + (parseFloat(cfg.dimensions?.inches?.w) || 0)) * 2 * 25.4,
            pierceCount: Math.max(0, (cfg.detectedHoles || []).length),
            bends: [],
        },
    };
}

/* Returns the request body, or null when the item cannot be priced. */
function pricingInputForItem(item = {}) {
    const cfg = item.configuration || {};
    const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
    const given = item.pricingInput && typeof item.pricingInput === 'object' ? item.pricingInput : null;
    const input = given ? { ...given } : fromConfiguration(cfg);

    // The request must describe the same part the order records.
    const sameId = (a, b) => a == null || b == null || String(a) === String(b);
    if (given && (!sameId(input.metal_id, cfg.metal?.id) || !sameId(input.service_id, cfg.productionService?.id))) return null;
    if (!input.metal_id && !input.service_id) return null;
    // Measured from the file this order will actually make, whatever the cart says.
    return { ...input, quantity, file_ref: item.tempPath || null };
}

/* What is kept on the order line: the request without bulky geometry. */
function snapshotInput(input) {
    const technical = { ...(input.technical_data || {}) };
    delete technical.cutEdges;
    delete technical.cut_edges;
    delete technical.profile_points;
    return { ...input, technical_data: technical };
}

module.exports = { pricingInputForItem, fromConfiguration, snapshotInput };

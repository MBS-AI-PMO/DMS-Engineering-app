/*
 * Turns what the quote page sends to /api/pricing/calculate into the
 * engine's input. Everything priced is looked up here on the server: hole
 * sizes and hardware by name/id from the admin's own lists, never a price
 * from the browser. Rules carried over from the previous pricing code
 * (routes/pricing.js): option matching, hem detection, bending permission,
 * metal and service size limits.
 */

const { measurementForUpload, ensureMeasurement } = require('../measure');

class CostingInputError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

const num = (value, fallback = 0) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
};

const asList = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
    }
    return [];
};

const serviceIdList = (value) => asList(value).map(Number).filter(Number.isFinite);

// ── Bending permission (routes/pricing.js getBendingSupportStatus) ──
const thicknessToInches = (t = {}) => {
    const raw = num(t.value ?? t.inch ?? t.in ?? t.thickness, 0);
    if (raw <= 0) return 0;
    return String(t.metric || t.unit || '').toLowerCase() === 'mm' ? raw / 25.4 : raw;
};

function bendingStatus(metal, bendServiceId, thicknessIn) {
    if (!metal || !bendServiceId) return { allowed: true, warning: '' };
    const thicknesses = Array.isArray(metal.quick_look?.thicknesses) ? metal.quick_look.thicknesses : [];
    const entry = thicknessIn > 0 ? thicknesses.find(th => Math.abs(thicknessToInches(th) - thicknessIn) <= 0.001) : null;
    const id = Number(bendServiceId);
    const metalGrant = serviceIdList(metal.services).includes(id);
    const thicknessGrant = serviceIdList(entry?.services).includes(id);
    const label = thicknessIn > 0 ? `${thicknessIn.toFixed(3)} in` : 'this thickness';
    if (!metalGrant && !thicknessGrant) return { allowed: false, warning: `Bending is not available for ${metal.name || 'this material'} at ${label}.` };
    if (metal.is_bendable === false && !thicknessGrant) return { allowed: false, warning: `${metal.name || 'This material'} at ${label} is not bendable.` };
    return { allowed: true, warning: '' };
}

// ── Size limits (routes/pricing.js validateMetalBounds / validateServiceBounds) ──
function metalBoundsProblem(metal, cfg, lengthIn, widthIn) {
    if (!metal || !cfg || !(lengthIn > 0) || !(widthIn > 0)) return null;
    // metal_configs limits are stored in inches.
    const maxX = num(cfg.max_x, 0), minX = num(cfg.min_x, 0), maxY = num(cfg.max_y, 0), minY = num(cfg.min_y, 0);
    if (maxX > 0 && lengthIn > maxX) return `Part length ${lengthIn.toFixed(3)} in is over the ${maxX} in maximum for ${metal.name}.`;
    if (minX > 0 && lengthIn < minX) return `Part length ${lengthIn.toFixed(3)} in is under the ${minX} in minimum for ${metal.name}.`;
    if (maxY > 0 && widthIn > maxY) return `Part width ${widthIn.toFixed(3)} in is over the ${maxY} in maximum for ${metal.name}.`;
    if (minY > 0 && widthIn < minY) return `Part width ${widthIn.toFixed(3)} in is under the ${minY} in minimum for ${metal.name}.`;
    return null;
}

function serviceBoundsProblem(service, lengthIn, widthIn, thicknessIn) {
    if (!service || !(lengthIn > 0) || !(widthIn > 0) || !(thicknessIn > 0)) return null;
    const mm = String(service.dimensions_unit || 'in').toLowerCase() === 'mm';
    const conv = (v) => (mm ? v * 25.4 : v);
    const unit = mm ? 'mm' : 'in';
    const checks = [
        ['length', conv(lengthIn), num(service.min_length, 0), num(service.max_length, 0)],
        ['width', conv(widthIn), num(service.min_width, 0), num(service.max_width, 0)],
        ['thickness', conv(thicknessIn), num(service.min_height, 0), num(service.max_height, 0)],
    ];
    for (const [what, value, min, max] of checks) {
        if (max > 0 && value > max) return `Part ${what} ${value.toFixed(3)} ${unit} is over the ${service.title} maximum of ${max} ${unit}.`;
        if (min > 0 && value < min) return `Part ${what} ${value.toFixed(3)} ${unit} is under the ${service.title} minimum of ${min} ${unit}.`;
    }
    return null;
}

// ── Bends, hems, curls, offsets (routes/pricing.js calculateBendingPricing) ──
function readBends(techData) {
    const bends = [];
    let hems = Array.isArray(techData.hems) ? techData.hems.length : Math.max(0, Math.floor(num(techData.hemCount ?? techData.hem_count, 0)));
    for (const bend of asList(techData.bends)) {
        const name = String(bend?.name || bend?.type || '').toLowerCase();
        const angle = Math.round(num(bend?.angle ?? bend?.initialAngle ?? bend?.included_angle, 0));
        if (name.includes('hem') || Math.abs(angle - 180) < 5) { hems += 1; continue; }
        const lengthIn = Number.isFinite(parseFloat(bend?.length_in ?? bend?.lengthIn)) ? num(bend.length_in ?? bend.lengthIn) : num(bend?.length ?? bend?.length_mm, 0) / 25.4;
        const radiusIn = Number.isFinite(parseFloat(bend?.radius_in ?? bend?.radiusIn)) ? num(bend.radius_in ?? bend.radiusIn) : num(bend?.radius ?? bend?.radius_mm, 0) / 25.4;
        bends.push({ lengthIn, radiusIn, angleDeg: angle });
    }
    const count = (plural, keys) => (Array.isArray(techData[plural]) ? techData[plural].length : Math.max(0, Math.floor(num(keys.map(k => techData[k]).find(v => v !== undefined), 0))));
    return { bends, hems, curls: count('curls', ['curlCount', 'curl_count']), offsets: count('offsets', ['offsetCount', 'offset_count']) };
}

// The option a customer picked on a service (colour, finish …).
function findOption(service, optionId) {
    if (optionId === null || optionId === undefined || optionId === '') return null;
    const options = asList(service.service_options);
    return options.find((o, idx) => o?.id === optionId || o?.index === optionId || idx === optionId || o?.name === optionId
        || (o?.id !== undefined && String(o.id) === String(optionId))) || null;
}

const titleHas = (service, word) => String(service?.title || '').toLowerCase().includes(word);

/* options.requireMeasured: the part's size, cut length, holes and bends must
 * come from the server's own measurement of the uploaded file (orders and
 * PayPal). Without it, a request naming a file still uses the server's
 * measurement when there is one, and falls back to the browser's numbers
 * only for showing a price. */
async function normalizeRequest(body, config, db, options = {}) {
    const qty = Math.min(100000, Math.max(1, Math.floor(num(body.quantity, 1)) || 1));
    const thicknessIn = Math.max(0, num(body.thickness_value, 0));
    const mainServiceId = Number(body.service_id) || null;
    const mainService = mainServiceId ? config.servicesById.get(mainServiceId) : null;
    const problems = [];
    const warnings = [];

    // Orders wait for the server to measure the file if it has not yet; a
    // price on the quote page uses what is stored and starts measuring in
    // the background so checkout has it.
    let measured = null;
    if (body.file_ref && options.requireMeasured) {
        measured = await ensureMeasurement(body.file_ref);
    } else if (body.file_ref) {
        measured = await measurementForUpload(body.file_ref, db);
        if (!measured) ensureMeasurement(body.file_ref).catch(() => {});
    }
    if (options.requireMeasured && !measured) {
        problems.push({ code: 'NOT_MEASURED', message: 'We could not re-check this file. Please upload it again on the quote page.' });
    }
    const lengthIn = measured ? measured.lengthIn : Math.max(0, num(body.length_in, 0));
    const widthIn = measured ? measured.widthIn : Math.max(0, num(body.height_in, 0));
    const techData = measured
        ? { totalPerimeter: measured.perimeterMm, pierceCount: measured.holeCount, bends: measured.bends }
        : (body.technical_data && typeof body.technical_data === 'object' ? body.technical_data : {});

    // Metal, its family for the rate tables, and its size limits.
    let metal = null;
    if (body.metal_id) {
        const res = await db.query(
            `SELECT m.id, m.name, m.services, m.quick_look, m.costing_family, mc.name AS category_name,
                    cfg.min_x, cfg.max_x, cfg.min_y, cfg.max_y
             FROM metals m
             LEFT JOIN metal_categories mc ON mc.id = m.category_id
             LEFT JOIN metal_configs cfg ON cfg.metal_id = m.id
             WHERE m.id = $1`,
            [body.metal_id]
        );
        const row = res.rows[0];
        if (row) {
            metal = {
                id: row.id,
                name: row.name,
                family: row.costing_family || row.category_name || '',
                services: row.services,
                quick_look: typeof row.quick_look === 'string' ? JSON.parse(row.quick_look || '{}') : (row.quick_look || {}),
                bendingAllowed: true,
            };
            const boundsProblem = metalBoundsProblem(metal, row, lengthIn, widthIn);
            if (boundsProblem) problems.push({ code: 'OUT_OF_BOUNDS', message: boundsProblem });
        }
    }
    const serviceBounds = serviceBoundsProblem(mainService, lengthIn, widthIn, thicknessIn);
    if (serviceBounds) problems.push({ code: 'OUT_OF_BOUNDS', message: serviceBounds });

    // Services picked, with their option. Tapping, countersinking and hardware
    // come from the hole and insert lists below, not from this list.
    const services = [];
    const seen = new Set([mainServiceId]);
    for (const req of asList(body.additional_services)) {
        const id = Number(typeof req === 'object' && req !== null ? req.id : req);
        const service = config.servicesById.get(id);
        if (!service || seen.has(id)) continue;
        if (titleHas(service, 'tap') || titleHas(service, 'countersink') || titleHas(service, 'hardware')) continue;
        seen.add(id);
        const optionId = typeof req === 'object' && req !== null ? req.option_id : null;
        services.push({ serviceId: id, option: findOption(service, optionId) });
    }
    const serviceByWord = (word) => [...config.servicesById.values()].find(s => titleHas(s, word));

    // Holes: priced from the tapping / countersinking size lists by name.
    const priceHoles = (items, word) => {
        const service = serviceByWord(word);
        const options = asList(service?.service_options);
        return asList(items).map(item => {
            const name = String(item?.name || '').trim();
            const option = options.find(o => String(o?.name || '').trim() === name);
            if (!option) throw new CostingInputError(`"${name || 'unnamed size'}" is no longer offered. Choose another size for that hole.`);
            return { name, unitPrice: num(option.price, 0) };
        });
    };
    const taps = priceHoles(body.taps, 'tap');
    const countersinks = priceHoles(body.countersinks, 'countersink');

    // Hardware: priced from the hardware list by id (name for older carts).
    const hardwareItems = asList(body.hardware);
    let hardware = [];
    if (hardwareItems.length) {
        const ids = [...new Set(hardwareItems.map(h => Number.parseInt(h?.id, 10)).filter(Number.isInteger))];
        const names = [...new Set(hardwareItems.map(h => String(h?.name || '').trim()).filter(Boolean))];
        const res = await db.query(
            'SELECT id, name, price FROM hardware_items WHERE COALESCE(is_active, true) = true AND (id = ANY($1::int[]) OR name = ANY($2::text[]))',
            [ids, names]
        );
        hardware = hardwareItems.map(h => {
            const id = Number.parseInt(h?.id, 10);
            const name = String(h?.name || '').trim();
            const row = Number.isInteger(id) ? res.rows.find(r => r.id === id) : res.rows.find(r => String(r.name || '').trim() === name);
            if (!row) throw new CostingInputError(`"${name || 'unnamed part'}" is no longer offered. Choose another part for that hole.`);
            return { id: row.id, name: row.name, unitPrice: num(row.price, 0) };
        });
    }
    for (const [list, word] of [[taps, 'tap'], [countersinks, 'countersink'], [hardware, 'hardware']]) {
        const service = list.length ? serviceByWord(word) : null;
        if (service && !seen.has(Number(service.id))) {
            seen.add(Number(service.id));
            services.push({ serviceId: Number(service.id), option: null });
        }
    }

    // Bending permission for the bending service picked, if any.
    const bendPick = services.find(s => titleHas(config.servicesById.get(s.serviceId), 'bend'));
    if (metal && bendPick) {
        const status = bendingStatus(metal, bendPick.serviceId, thicknessIn);
        metal.bendingAllowed = status.allowed;
        if (status.warning) warnings.push(status.warning);
    }

    const totalPerimeterMm = num(techData.totalPerimeter, 0);
    const cutLengthIn = totalPerimeterMm > 0 ? totalPerimeterMm / 25.4 : (lengthIn > 0 && widthIn > 0 ? 2 * (lengthIn + widthIn) : 0);
    const holeCount = Math.max(0, Math.floor(num(techData.pierceCount ?? techData.holesCount, 0)));

    return {
        qty,
        thicknessIn,
        metal,
        part: { lengthIn, widthIn, cutLengthIn, holeCount, ...readBends(techData) },
        measuredBy: measured ? 'server' : 'client',
        mainServiceId,
        services,
        selections: { taps, countersinks, hardware },
        problems,
        warnings,
    };
}

module.exports = { normalizeRequest, CostingInputError, bendingStatus };

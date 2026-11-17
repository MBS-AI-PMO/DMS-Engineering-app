const { toNumber, round2, round4, asArray, toHours } = require('./util');
const { findSheetCost, findLaserRate, sheetNestingYield } = require('./lookup');

/*
 * The operation types an admin can configure. Each type lists the values it
 * reads (shown as a form in Admin > Costing > Operations) and prices one
 * quote line from them. The maths follows Zamyr's quoteRoutingService.js;
 * where Zamyr runs a stored formula, the formula is noted.
 *
 * compute(ctx, vars, op) returns
 *   { totalCost, setupHours, runtimeHours, leadHours?, details, warnings?, reasons? }
 * or { skip: true, warning } when the operation does not apply to this part.
 * `reasons` are codes that stop the instant price (customer requests a quote).
 */

const reason = (code, message) => ({ code, message });

const OP_TYPES = {
    // ── Material | Sheet (Zamyr prepareSheetOperationRow 3163) ──
    material_sheet: {
        label: 'Sheet material',
        defaultBucket: 'material',
        fields: [
            { key: 'edge_buffer_in', label: 'Edge buffer', unit: 'in', default: 0.15, min: 0, help: 'Kept clear around the sheet edge.' },
            { key: 'part_buffer_in', label: 'Part buffer', unit: 'in', default: 0.15, min: 0, help: 'Gap between parts.' },
            { key: 'kerf_in', label: 'Kerf width', unit: 'in', default: 0.005, min: 0, help: 'Width the cut removes.' },
            { key: 'thickness_tolerance_in', label: 'Thickness match tolerance', unit: 'in', default: 0.003, min: 0, help: 'How close a sheet-cost row must be to the chosen thickness.' },
        ],
        compute(ctx, v) {
            const sheet = ctx.config.defaultSheetSize;
            if (!sheet) return { totalCost: 0, reasons: [reason('NO_SHEET_SIZE', 'No default sheet size is set.')] };

            const nest = sheetNestingYield({
                partLength: ctx.part.lengthIn,
                partWidth: ctx.part.widthIn,
                sheetLength: sheet.length_in,
                sheetWidth: sheet.width_in,
                edgeBuffer: v.edge_buffer_in,
                partBuffer: v.part_buffer_in,
                kerfWidth: v.kerf_in,
            });
            const details = { sheetSize: sheet.name, partsPerSheet: nest.maximumYield };
            const sheetText = `${Number(sheet.length_in)}" x ${Number(sheet.width_in)}" sheet`;
            const thicknessText = `${ctx.thicknessIn}"`;
            if (!(nest.maximumYield > 0)) {
                return { totalCost: 0, details, reasons: [reason('PART_EXCEEDS_SHEET', `The part is too big for our standard ${sheetText}.`)] };
            }

            const match = findSheetCost(ctx.config.sheetCosts, {
                metal: ctx.metal,
                thicknessIn: ctx.thicknessIn,
                sheetSizeId: sheet.id,
                tolerance: toNumber(v.thickness_tolerance_in, 0.003),
            });
            if (!match) {
                return { totalCost: 0, details, reasons: [reason('NO_SHEET_COST_ROW', `We don't have a stock price for ${ctx.metal?.name || 'this material'} at ${thicknessText}.`)] };
            }
            if (!(match.sheetCost > 0)) {
                return { totalCost: 0, details, reasons: [reason('SHEET_COST_ZERO', `We don't have a stock price for ${ctx.metal?.name || 'this material'} at ${thicknessText} yet.`)] };
            }

            const sheetsPerPart = 1 / nest.maximumYield;
            const unitCost = round4(sheetsPerPart * match.sheetCost);
            const totalCost = round2(unitCost * ctx.qty);
            return {
                totalCost,
                details: { ...details, sheetCost: match.sheetCost, sheetCostRowId: match.row.id, gauge: match.row.ga || null, unitMaterialCost: unitCost },
            };
        },
    },

    // ── Laser (Zamyr prepareLaserOperationRow 3827) ──
    laser: {
        label: 'Laser cutting',
        defaultBucket: 'inside',
        fields: [
            { key: 'labor_rate', label: 'Labor rate', unit: '$/hr', default: 120, min: 0 },
            { key: 'setup_hours', label: 'Setup time', unit: 'hr', default: 0.0833, min: 0, help: 'Charged once per line.' },
            { key: 'etch_length_in', label: 'Etching length', unit: 'in', default: 0, min: 0, help: 'Added to the cut length.' },
            { key: 'daily_capacity_hours', label: 'Daily capacity', unit: 'hr', default: 0, min: 0, help: 'For lead time only; 0 leaves lead time out.' },
        ],
        compute(ctx, v) {
            const cutLength = Math.max(0, toNumber(ctx.part.cutLengthIn, 0)) + Math.max(0, toNumber(v.etch_length_in, 0));
            if (!(cutLength > 0)) return { totalCost: 0, reasons: [reason('NO_CUT_LENGTH', 'The cut length of the part is unknown.')] };

            const match = findLaserRate(ctx.config.laserRates, { metal: ctx.metal, thicknessIn: ctx.thicknessIn });
            if (!match) return { totalCost: 0, reasons: [reason('NO_LASER_RATE', `We don't have a laser cutting rate for ${ctx.metal?.name || 'this material'} at ${ctx.thicknessIn}".`)] };
            const cutRate = toNumber(match.row.cut_rate, 0);
            const pierceRate = toNumber(match.row.pierce_time, 0);
            if (!(cutRate > 0)) return { totalCost: 0, reasons: [reason('LASER_RATE_INVALID', 'Laser cutting at this thickness needs a manual price.')] };

            const rate = toNumber(v.labor_rate, 0);
            if (!(rate > 0)) return { totalCost: 0, reasons: [reason('OP_CONFIG_INVALID', 'Laser cutting needs a manual price.')] };

            // Holes plus one lead-in for the outside profile.
            const pierceCount = Math.max(0, Math.round(toNumber(ctx.part.holeCount, 0))) + 1;
            const setupHours = Math.max(0, toNumber(v.setup_hours, 0));
            const cutTimeHours = (cutLength * 25.4) / cutRate / 3600;
            const pierceTimeHours = pierceCount > 0 && pierceRate > 0 ? (pierceCount * pierceRate) / 3600 : 0;
            const runtimeHours = cutTimeHours + pierceTimeHours;
            const setupCost = setupHours * rate;
            const laborCost = runtimeHours * rate * ctx.qty;
            const warnings = ctx.thicknessIn > 0.376 ? ['Laser cutting over 0.376" may need a manual review.'] : [];
            return {
                totalCost: round2(setupCost + laborCost),
                setupHours,
                runtimeHours,
                leadHours: setupHours + runtimeHours * ctx.qty,
                capacityHours: toNumber(v.daily_capacity_hours, 0),
                warnings,
                details: { cutLengthIn: cutLength, pierceCount, cutRate, pierceSeconds: pierceRate, laserRateRowId: match.row.id, rate },
            };
        },
    },

    // ── Bend (Zamyr prepareBendOperationRow 4600; per-bend values are $) ──
    bend: {
        label: 'Bending',
        defaultBucket: 'inside',
        fields: [
            { key: 'labor_rate', label: 'Labor rate', unit: '$/hr', default: 35, min: 0, help: 'Setup only; bends are priced per bend below.' },
            { key: 'setup_hours', label: 'Setup time', unit: 'hr', default: 0.0833, min: 0 },
            { key: 'med_threshold_in', label: 'Medium bend from', unit: 'in', default: 24, min: 0 },
            { key: 'large_threshold_in', label: 'Large bend from', unit: 'in', default: 72, min: 0 },
            { key: 'cost_small', label: 'Small bend', unit: '$ per bend', default: 1.5, min: 0 },
            { key: 'cost_med', label: 'Medium bend', unit: '$ per bend', default: 5, min: 0 },
            { key: 'cost_large', label: 'Large bend', unit: '$ per bend', default: 8, min: 0 },
            { key: 'cost_other', label: 'Other formed feature', unit: '$ each', default: 8, min: 0, help: 'Hems, curls and offsets.' },
            { key: 'features_per_hem', label: 'Formed features per hem', unit: 'count', default: 2, min: 0, help: 'A hem is a bend plus a flatten.' },
            { key: 'time_per_bend_sec', label: 'Time per bend', unit: 'sec', default: 15, min: 0, help: 'For lead time only; not priced.' },
            { key: 'daily_capacity_hours', label: 'Daily capacity', unit: 'hr', default: 0, min: 0, help: 'For lead time only; 0 leaves lead time out.' },
        ],
        compute(ctx, v) {
            const bends = asArray(ctx.part.bends);
            const hemCount = Math.max(0, toNumber(ctx.part.hems, 0));
            const curlCount = Math.max(0, toNumber(ctx.part.curls, 0));
            const offsetCount = Math.max(0, toNumber(ctx.part.offsets, 0));
            if (!bends.length && !hemCount && !curlCount && !offsetCount) {
                return { skip: true, warning: 'Bending was chosen but the part has no bends.' };
            }

            const large = toNumber(v.large_threshold_in, 72);
            const med = toNumber(v.med_threshold_in, 24);
            let smallBendCount = 0, medBendCount = 0, largeBendCount = 0;
            for (const bend of bends) {
                const length = Math.max(0, toNumber(bend.lengthIn, 0));
                if (length >= large) largeBendCount += 1;
                else if (length >= med) medBendCount += 1;
                else smallBendCount += 1;
            }
            const otherFormedFeatureCount = hemCount * toNumber(v.features_per_hem, 2) + curlCount + offsetCount;
            const laborRate = toNumber(v.labor_rate, 0);
            const setupTime = Math.max(0, toNumber(v.setup_hours, 0));
            const setupCost = Math.max(0, laborRate * setupTime);
            const machineCost = Math.max(0, ctx.qty * (
                otherFormedFeatureCount * toNumber(v.cost_other, 0)
                + largeBendCount * toNumber(v.cost_large, 0)
                + smallBendCount * toNumber(v.cost_small, 0)
                + medBendCount * toNumber(v.cost_med, 0)
            ));
            const uniqueBends = new Set(bends.map(b => `${round4(b.radiusIn || 0)}:${Math.round(toNumber(b.angleDeg, 0) * 100) / 100}`)).size;
            const runtimeHours = Math.max(0, toNumber(v.time_per_bend_sec, 0) * (bends.length ? Math.max(1, uniqueBends) : 0)) / 3600;
            return {
                totalCost: round2(setupCost + machineCost),
                setupHours: setupTime,
                runtimeHours,
                leadHours: setupTime + runtimeHours * ctx.qty,
                capacityHours: toNumber(v.daily_capacity_hours, 0),
                details: { smallBendCount, medBendCount, largeBendCount, hemCount, curlCount, offsetCount, otherFormedFeatureCount },
            };
        },
    },

    // ── Time-based operation (Zamyr Deburr formula / default time formula) ──
    // PRICE = (runtime × qty + setup) × rate, times converted to hours.
    time: {
        label: 'Time × rate',
        defaultBucket: 'inside',
        fields: [
            { key: 'setup', label: 'Setup time', unit: 'time', default: 0, min: 0, help: 'Charged once per line.' },
            { key: 'setup_unit', label: 'Setup unit', unit: 'select', options: ['hours', 'minutes', 'seconds'], default: 'hours' },
            { key: 'runtime', label: 'Run time per part', unit: 'time', default: 0, min: 0 },
            { key: 'runtime_unit', label: 'Run time unit', unit: 'select', options: ['hours', 'minutes', 'seconds'], default: 'hours' },
            { key: 'rate', label: 'Shop rate', unit: '$/hr', default: 100, min: 0 },
        ],
        compute(ctx, v) {
            const setupHours = toHours(v.setup, v.setup_unit);
            const runtimeHours = toHours(v.runtime, v.runtime_unit);
            const rate = toNumber(v.rate, 0);
            if (!(rate > 0) && (setupHours > 0 || runtimeHours > 0)) {
                return { totalCost: 0, reasons: [reason('OP_CONFIG_INVALID', 'Shop rate is 0.')] };
            }
            return {
                totalCost: round2((runtimeHours * ctx.qty + setupHours) * rate),
                setupHours,
                runtimeHours,
                details: { rate },
            };
        },
    },

    // ── Powder coat (Zamyr formula: setup × rate + cost per batch × batches) ──
    powder_coat: {
        label: 'Powder coating',
        defaultBucket: 'inside',
        fields: [
            { key: 'setup_hours', label: 'Setup time', unit: 'hr', default: 0.25, min: 0 },
            { key: 'shop_rate', label: 'Shop rate', unit: '$/hr', default: 38, min: 0 },
            { key: 'batch_cost', label: 'Cost per batch', unit: '$', default: 85, min: 0 },
            { key: 'parts_per_batch', label: 'Parts per batch', unit: 'count', default: 0, min: 0, help: '0 = the whole line goes in one batch.' },
        ],
        compute(ctx, v) {
            const partsPerBatch = Math.max(0, Math.floor(toNumber(v.parts_per_batch, 0)));
            const batches = partsPerBatch > 0 ? Math.ceil(ctx.qty / partsPerBatch) : 1;
            const setupHours = Math.max(0, toNumber(v.setup_hours, 0));
            return {
                totalCost: round2(setupHours * toNumber(v.shop_rate, 0) + toNumber(v.batch_cost, 0) * batches),
                setupHours,
                details: { batches },
            };
        },
    },

    // ── Hardware insertion labour (Zamyr "Hardware insert (construction)") ──
    hardware_insert: {
        label: 'Hardware insertion',
        defaultBucket: 'inside',
        fields: [
            { key: 'rate', label: 'Hourly rate', unit: '$/hr', default: 25, min: 0 },
            { key: 'seconds_per_insert', label: 'Time per insert', unit: 'sec', default: 30, min: 0 },
            { key: 'setup_hours', label: 'Setup time', unit: 'hr', default: 0, min: 0 },
        ],
        compute(ctx, v) {
            const hardwareCount = asArray(ctx.selections.hardware).length;
            if (!hardwareCount) return { skip: true };
            const rate = toNumber(v.rate, 0);
            const setupTime = Math.max(0, toNumber(v.setup_hours, 0));
            const runtime = (hardwareCount * toNumber(v.seconds_per_insert, 0) / 60) / 60;
            return {
                totalCost: round2(setupTime * rate + runtime * ctx.qty * rate),
                setupHours: setupTime,
                runtimeHours: runtime,
                details: { hardwareCount },
            };
        },
    },

    // ── Hardware parts themselves, from the Hardware catalog ──
    hardware_parts: {
        label: 'Hardware parts (catalog price)',
        defaultBucket: 'purchased',
        fields: [],
        compute(ctx) {
            const items = asArray(ctx.selections.hardware);
            if (!items.length) return { skip: true };
            const perPart = items.reduce((sum, item) => sum + Math.max(0, toNumber(item.unitPrice, 0)), 0);
            return { totalCost: round2(perPart * ctx.qty), details: { count: items.length, perPart: round4(perPart) } };
        },
    },

    // ── Taps or countersinks: catalog price per hole ──
    per_hole: {
        label: 'Price per hole (catalog)',
        defaultBucket: 'inside',
        fields: [
            { key: 'source', label: 'Holes from', unit: 'select', options: ['taps', 'countersinks'], default: 'taps' },
        ],
        compute(ctx, v) {
            const holes = asArray(v.source === 'countersinks' ? ctx.selections.countersinks : ctx.selections.taps);
            if (!holes.length) return { skip: true };
            const perPart = holes.reduce((sum, hole) => sum + Math.max(0, toNumber(hole.unitPrice, 0)), 0);
            return { totalCost: round2(perPart * ctx.qty), details: { holes: holes.length, perPart: round4(perPart) } };
        },
    },

    // ── A service's own catalog price (anodize colours, plating, …) ──
    service_price: {
        label: 'Service catalog price',
        defaultBucket: 'inside',
        fields: [
            { key: 'mode', label: 'Charge', unit: 'select', options: ['per_line', 'per_part'], default: 'per_part', help: 'per_line = one lot price for the whole line.' },
        ],
        compute(ctx, v, op) {
            const pick = ctx.serviceForOp;
            if (!pick) return { skip: true };
            const base = Math.max(0, toNumber(pick.service.base_price, 0));
            const optionPrice = toNumber(pick.option?.price, 0);
            if (v.mode === 'per_line') {
                // A lot price: the colour's own price when it has one, else base + option.
                const lot = optionPrice > 0 ? optionPrice : base + optionPrice;
                return { totalCost: round2(Math.max(0, lot)), details: { lot: round4(lot), option: pick.option?.name || null } };
            }
            const perPart = Math.max(0, base + optionPrice);
            return { totalCost: round2(perPart * ctx.qty), details: { perPart: round4(perPart), option: pick.option?.name || null } };
        },
    },
};

/* The values an operation prices with: its stored values over the type's
 * defaults, numbers parsed. */
function resolveVariables(op) {
    const type = OP_TYPES[op.op_type];
    const stored = op.variables && typeof op.variables === 'object' ? op.variables : {};
    const values = {};
    for (const field of type ? type.fields : []) {
        const raw = stored[field.key];
        if (field.unit === 'select') values[field.key] = field.options.includes(raw) ? raw : field.default;
        else values[field.key] = raw === undefined || raw === null || raw === '' ? field.default : toNumber(raw, field.default);
    }
    return values;
}

module.exports = { OP_TYPES, resolveVariables };

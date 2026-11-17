const { toNumber, round2, round4, asArray } = require('./util');
const { OP_TYPES, resolveVariables } = require('./ops');
const { applyMarkups, attributeMarkups } = require('./markups');

/*
 * Prices one quote line the way Zamyr does. Pure: no database, no clock.
 *
 * input:
 *   qty, thicknessIn,
 *   metal { id, name, family, bendingAllowed },
 *   part { lengthIn, widthIn, cutLengthIn, holeCount, bends[{ lengthIn, radiusIn, angleDeg }], hems, curls, offsets },
 *   mainServiceId,
 *   services [{ serviceId, option }]      the add-on services picked, plus tapping /
 *                                           countersinking / hardware when holes or inserts are chosen
 *   selections { taps[{ name, unitPrice }], countersinks[…], hardware[{ id, name, unitPrice }] },
 *   problems [{ code, message }]          found while reading the request (e.g. size limits)
 *
 * config: see costing/config/loadConfig.js.
 *
 * Returns { status: 'priced' | 'quote_required' | 'incomplete', reasons, warnings,
 *           operations, markups, addOns, totals, leadDays, configVersion }.
 * 'quote_required' means: no instant price, the customer asks for a quote.
 * 'incomplete' means: a choice is still missing (no material yet, …).
 */

const BUCKETS = ['material', 'inside', 'outside', 'purchased'];
const INCOMPLETE_CODES = new Set(['NO_PROCESS', 'NO_METAL', 'NO_THICKNESS', 'NO_DIMENSIONS']);

function discountFor(discounts, qty) {
    if (!discounts?.enabled) return { percent: 0, tier: null };
    const tiers = asArray(discounts.tiers)
        .filter(tier => tier.is_active !== false)
        .sort((a, b) => toNumber(asArray(b.quantities)[0], 0) - toNumber(asArray(a.quantities)[0], 0));
    const tier = tiers.find(t => asArray(t.quantities).some(q => {
        const value = parseInt(q, 10);
        return !Number.isNaN(value) && qty >= value;
    }));
    return tier ? { percent: toNumber(tier.discount_percent, 0), tier } : { percent: 0, tier: null };
}

/* The operations a line runs, in order: those linked to the main service
 * and to each picked service. A picked service with nothing linked is
 * charged its own catalog price per part, as DMS always has. */
function collectOperations(input, config) {
    const operationsById = new Map(asArray(config.operations).filter(op => op.is_active !== false).map(op => [Number(op.id), op]));
    const picks = [
        { serviceId: Number(input.mainServiceId), option: null },
        ...asArray(input.services).map(s => ({ serviceId: Number(s.serviceId), option: s.option || null })),
    ];
    const seen = new Set();
    const list = [];
    for (const pick of picks) {
        const service = config.servicesById.get(pick.serviceId);
        if (!service) continue;
        const linked = asArray(config.serviceOperations[pick.serviceId]).map(id => operationsById.get(Number(id))).filter(Boolean);
        const ops = linked.length || service.is_production
            ? linked
            : [{ id: `svc-${service.id}`, key: `service-${service.id}`, name: service.title, customer_label: service.title, op_type: 'service_price', bucket: 'inside', variables: { mode: 'per_part' }, sort_order: 1000 }];
        for (const op of ops) {
            // One run per operation, except a service's own price, which is per service.
            const key = op.op_type === 'service_price' ? `${op.id}:${service.id}` : String(op.id);
            if (seen.has(key)) continue;
            seen.add(key);
            list.push({ op, serviceForOp: { service, option: pick.option } });
        }
    }
    return list.sort((a, b) => toNumber(a.op.sort_order, 0) - toNumber(b.op.sort_order, 0) || String(a.op.name).localeCompare(String(b.op.name)));
}

function computeQuote(input, config) {
    const qty = Math.max(1, Math.floor(toNumber(input.qty, 1)));
    const reasons = [...asArray(input.problems)];
    const warnings = [];
    const mainService = config.servicesById.get(Number(input.mainServiceId));

    if (!mainService) reasons.push({ code: 'NO_PROCESS', message: 'Choose a production method.' });

    const ctxBase = {
        qty,
        thicknessIn: Math.max(0, toNumber(input.thicknessIn, 0)),
        metal: input.metal || null,
        part: input.part || {},
        selections: input.selections || {},
        config,
    };

    const operations = [];
    const costs = { materialCost: 0, insideCost: 0, outsideCost: 0, purchasedCost: 0 };
    // All non-material operations, summed in operation order like Zamyr's
    // operationCost: adding the same amounts in another order can move a
    // half-cent markup by a cent.
    let operationCost = 0;
    let leadDays = 0;

    for (const { op, serviceForOp } of mainService ? collectOperations(input, config) : []) {
        const type = OP_TYPES[op.op_type];
        if (!type) {
            warnings.push(`${op.name}: unknown operation type.`);
            continue;
        }
        if (op.op_type === 'bend' && input.metal && input.metal.bendingAllowed === false) {
            warnings.push(`Bending is not offered for ${input.metal.name || 'this material'} at this thickness.`);
            continue;
        }
        if (['material_sheet', 'laser'].includes(op.op_type)) {
            if (!input.metal) { reasons.push({ code: 'NO_METAL', message: 'Choose a material.' }); continue; }
            if (!(ctxBase.thicknessIn > 0)) { reasons.push({ code: 'NO_THICKNESS', message: 'Choose a thickness.' }); continue; }
            if (op.op_type === 'material_sheet' && !(toNumber(ctxBase.part.lengthIn) > 0 && toNumber(ctxBase.part.widthIn) > 0)) {
                reasons.push({ code: 'NO_DIMENSIONS', message: 'The part size could not be read.' });
                continue;
            }
        }

        const vars = resolveVariables(op);
        const result = type.compute({ ...ctxBase, serviceForOp }, vars, op);
        if (result.skip) {
            if (result.warning) warnings.push(result.warning);
            continue;
        }
        reasons.push(...asArray(result.reasons).map(r => ({ ...r, op: op.name })));
        warnings.push(...asArray(result.warnings));

        const bucket = BUCKETS.includes(op.bucket) ? op.bucket : type.defaultBucket;
        const totalCost = round2(Math.max(0, toNumber(result.totalCost, 0)));
        costs[`${bucket}Cost`] += totalCost;
        if (bucket !== 'material') operationCost += totalCost;
        if (result.capacityHours > 0 && result.leadHours > 0) {
            leadDays = Math.max(leadDays, Math.ceil(result.leadHours / result.capacityHours));
        }
        operations.push({
            id: op.id,
            key: op.key,
            name: op.name,
            label: op.customer_label || op.name,
            opType: op.op_type,
            bucket,
            serviceId: serviceForOp.service.id,
            totalCost,
            unitCost: round4(totalCost / qty),
            setupHours: result.setupHours || 0,
            runtimeHours: result.runtimeHours || 0,
            details: result.details || {},
        });
    }

    const totalEstimatedCost = round2(costs.materialCost + operationCost);

    const linkedMarkups = new Set(asArray(mainService && config.serviceMarkups[mainService.id]).map(Number));
    const markups = asArray(config.markups)
        .filter(m => m.is_active !== false && linkedMarkups.has(Number(m.id)))
        .sort((a, b) => toNumber(a.sort_order, 0) - toNumber(b.sort_order, 0));
    const markupResult = applyMarkups(markups, { ...costs, totalEstimatedCost });

    const linkedAddOns = new Set(asArray(mainService && config.serviceAddOns[mainService.id]).map(Number));
    const addOns = asArray(config.addOns)
        .filter(a => a.is_active !== false && a.apply_mode === 'always' && linkedAddOns.has(Number(a.id)))
        .map(a => ({ id: a.id, name: a.name, totalCost: round2(Math.max(0, toNumber(a.amount, 0))) }));
    const addOnCost = addOns.reduce((sum, a) => sum + a.totalCost, 0);

    const subtotal = round2(costs.materialCost + operationCost + markupResult.pricingCost + addOnCost);
    const unitPrice = round2(subtotal / qty);
    const discount = discountFor(config.discounts, qty);
    const discountAmount = round2(subtotal * (discount.percent / 100));
    const finalTotal = round2(Math.max(0, subtotal - discountAmount));
    const finalUnitPrice = round2(finalTotal / qty);

    if (!reasons.length && !(finalTotal > 0)) {
        reasons.push({ code: 'ZERO_TOTAL', message: 'This part could not be priced automatically.' });
    }

    // A choice still missing (method, material, thickness, size) is not a
    // part that needs a quote: the customer just hasn't finished choosing.
    const status = reasons.some(r => INCOMPLETE_CODES.has(r.code)) ? 'incomplete'
        : reasons.length ? 'quote_required' : 'priced';

    return {
        status,
        reasons,
        warnings: Array.from(new Set(warnings)),
        operations: attributeMarkups(operations, markupResult.rows),
        markups: markupResult.rows,
        addOns,
        totals: {
            materialCost: round2(costs.materialCost),
            insideCost: round2(costs.insideCost),
            outsideCost: round2(costs.outsideCost),
            purchasedCost: round2(costs.purchasedCost),
            operationCost: round2(operationCost),
            totalEstimatedCost,
            pricingCost: round2(markupResult.pricingCost),
            addOnCost: round2(addOnCost),
            subtotal,
            unitPrice,
            discountPercent: discount.percent,
            discountAmount,
            finalTotal,
            finalUnitPrice,
        },
        appliedDiscountTier: discount.tier,
        leadDays,
        qty,
        configVersion: config.version || null,
    };
}

module.exports = { computeQuote, collectOperations, discountFor };

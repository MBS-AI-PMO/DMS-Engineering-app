const db = require('../db');

function parsePositiveNumber(raw) {
    if (raw === null || raw === undefined) return null;
    const match = String(raw).trim().match(/\d*\.?\d+/);
    if (!match) return null;
    const n = parseFloat(match[0]);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeThicknessInches(entry) {
    if (!entry || typeof entry !== 'object') return null;

    // Prefer the advertised inch value when present.
    const inchValue = parsePositiveNumber(entry.value);
    if (inchValue) return inchValue;

    // Fall back to metric conversion.
    const mmValue = parsePositiveNumber(entry.metric);
    if (mmValue) return mmValue / 25.4;

    return null;
}

function roundTo6(n) {
    return parseFloat(Number(n).toFixed(6));
}

function pickNearestRule(rules, targetThickness) {
    let best = null;
    for (const r of rules) {
        const delta = Math.abs(r.thickness - targetThickness);
        if (!best || delta < best.delta || (delta === best.delta && r.thickness < best.rule.thickness)) {
            best = { rule: r, delta };
        }
    }
    return best?.rule || null;
}

async function getTargetThicknessesFromMetals() {
    const res = await db.query('SELECT quick_look FROM metals WHERE quick_look IS NOT NULL');
    const set = new Set();

    for (const row of res.rows) {
        const list = Array.isArray(row.quick_look?.thicknesses) ? row.quick_look.thicknesses : [];
        for (const item of list) {
            const inches = normalizeThicknessInches(item);
            if (!inches) continue;

            const rounded = roundTo6(inches);
            // Keep plausible sheet thickness range; avoids accidental junk values.
            if (rounded > 0 && rounded <= 5) {
                set.add(rounded);
            }
        }
    }

    return [...set].sort((a, b) => a - b);
}

async function getExistingGenericRules() {
    const res = await db.query(
        `SELECT thickness, cut_rate, pierce_time
         FROM laser_cut_rates
         WHERE material_family = 'generic'
         ORDER BY thickness ASC`
    );

    return res.rows.map((r) => ({
        thickness: roundTo6(parseFloat(r.thickness)),
        cut_rate: parseFloat(r.cut_rate),
        pierce_time: parseFloat(r.pierce_time),
    }));
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');

    try {
        const targetThicknesses = await getTargetThicknessesFromMetals();
        const existingRules = await getExistingGenericRules();

        if (!existingRules.length) {
            throw new Error('No generic laser_cut_rates rows found. Seed base laser rates first.');
        }

        const existingSet = new Set(existingRules.map((r) => r.thickness));
        const missing = targetThicknesses.filter((t) => !existingSet.has(t));

        if (!missing.length) {
            console.log('No missing thickness rows. Laser rates already cover all metal thicknesses.');
            process.exit(0);
        }

        const planned = missing.map((thickness) => {
            const source = pickNearestRule(existingRules, thickness);
            return {
                thickness,
                cut_rate: source.cut_rate,
                pierce_time: source.pierce_time,
                source_thickness: source.thickness,
            };
        });

        console.log(`Found ${missing.length} missing thickness rows for generic laser rates.`);
        console.table(planned.map((r) => ({
            thickness: r.thickness,
            cut_rate: r.cut_rate,
            pierce_time: r.pierce_time,
            source_from: r.source_thickness,
        })));

        if (dryRun) {
            console.log('Dry run complete. No rows inserted.');
            process.exit(0);
        }

        await db.query('BEGIN');

        let inserted = 0;
        for (const row of planned) {
            const res = await db.query(
                `INSERT INTO laser_cut_rates (material_family, thickness, cut_rate, pierce_time)
                 SELECT 'generic', $1, $2, $3
                 WHERE NOT EXISTS (
                    SELECT 1 FROM laser_cut_rates
                    WHERE material_family = 'generic' AND thickness = $1
                 )`,
                [row.thickness, row.cut_rate, row.pierce_time]
            );
            inserted += res.rowCount;
        }

        await db.query('COMMIT');
        console.log(`Inserted ${inserted} new generic laser rate rows.`);
        process.exit(0);
    } catch (err) {
        try {
            await db.query('ROLLBACK');
        } catch (_) {
            // no-op
        }
        console.error('Failed to backfill laser rates:', err.message || err);
        process.exit(1);
    }
}

main();

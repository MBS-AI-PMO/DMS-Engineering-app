const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { parseString } = require('dxf');
const db = require('../db');

/*
 * The server's own measurement of an uploaded part, so prices never rest on
 * numbers sent by the browser.
 *
 * STEP: when the CAD service finishes analysing a file (server.js, the
 * unfold routes), its result is turned into a measurement and stored by the
 * SHA-256 of the file's bytes. DXF: measured here on demand with the same
 * library and rules the quote page uses (client/src/utils/dxfAnalysis.js).
 *
 * Pricing then looks a file up by its content: the browser can only say
 * which uploaded file it means, not how big it is or how much it cuts.
 * The rules below mirror client/src/pages/InstantPricing.jsx
 * (deriveQuoteItem), including its rounding, so an honest customer sees the
 * same price on the quote page and at checkout.
 */

const MEASURE_VERSION = 'm1';
const BACKEND_ROOT = path.resolve(__dirname, '..');
const ALLOWED_DIRS = ['temp_uploads', path.join('uploads', 'orders')];

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const inches3 = (mm) => Number((mm / 25.4).toFixed(3));

// ── Hashing (cached per path, size and change time) ──
const hashCache = new Map();
function hashFile(absPath) {
    const stat = fs.statSync(absPath);
    const key = `${absPath}:${stat.size}:${stat.mtimeMs}`;
    if (hashCache.has(key)) return hashCache.get(key);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
    if (hashCache.size > 2000) hashCache.clear();
    hashCache.set(key, hash);
    return hash;
}
const hashBuffer = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

/* A stored upload ("temp_uploads/x.step", "/api/temp_uploads/x.step", an order
 * file …) on disk, or null. Only the upload folders are allowed. */
function resolveUpload(ref) {
    let rel = String(ref || '').trim();
    if (!rel) return null;
    try { if (/^https?:\/\//i.test(rel)) rel = new URL(rel).pathname; } catch { return null; }
    rel = rel.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^api\//, '');
    const abs = path.resolve(BACKEND_ROOT, rel);
    const inside = ALLOWED_DIRS.some(dir => abs.startsWith(path.join(BACKEND_ROOT, dir) + path.sep));
    if (!inside) return null;
    if (fs.existsSync(abs)) return abs;
    // Files move from temp_uploads to uploads/orders when an order is placed.
    const moved = path.join(BACKEND_ROOT, 'uploads', 'orders', path.basename(abs));
    return fs.existsSync(moved) ? moved : null;
}

// ── STEP: from the CAD service's result ──
function sumSegmentLengths(points) {
    if (!Array.isArray(points) || points.length < 6) return 0;
    let total = 0;
    for (let i = 0; i + 5 < points.length; i += 6) {
        const dx = num(points[i + 3]) - num(points[i]);
        const dy = num(points[i + 4]) - num(points[i + 1]);
        const dz = num(points[i + 5]) - num(points[i + 2]);
        total += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return total;
}

function measureStepResult(result = {}) {
    const bbox = result.bbox || {};
    const flatW = num(bbox.xSpan ?? bbox.width);
    const flatH = num(bbox.ySpan ?? bbox.height);
    let lengthMm, widthMm;
    if (flatW > 0 && flatH > 0) {
        lengthMm = Math.max(flatW, flatH);
        widthMm = Math.min(flatW, flatH);
    } else {
        lengthMm = num(bbox.length);
        widthMm = num(bbox.width);
    }
    if (!(lengthMm > 0) || !(widthMm > 0)) return null;

    const contours = Array.isArray(result.contours) ? result.contours : [];
    const contourCut = num(result.totalCutLength) > 0 && !contours.some(c => String(c?.source || '').includes('bbox_fallback'))
        ? num(result.totalCutLength) : 0;
    const perimeterMm = num(result.totalPerimeter) || contourCut || sumSegmentLengths(result.cutEdges) || (lengthMm + widthMm) * 2;

    const direct = Number.parseInt(result.pierceCount, 10);
    const holes = Number.isFinite(direct) && direct >= 0
        ? Math.max(0, direct - 1)               // the outline is not a hole
        : (Array.isArray(result.detectedHoles) ? result.detectedHoles.length : 0);

    return {
        kind: 'step',
        lengthIn: inches3(lengthMm),
        widthIn: inches3(widthMm),
        perimeterMm,
        holeCount: holes,
        bends: Array.isArray(result.bends) ? result.bends.map(b => ({ length: b.length, radius: b.radius, angle: b.angle, name: b.name, type: b.type })) : [],
        thicknessMm: num(result.thickness),
    };
}

// ── DXF: the quote page's analyzeDxfFile / calcDxfTechData ──
function flattenDxfEntities(parsed) {
    const all = [];
    const flatten = (entities, t = { x: 0, y: 0, scale: 1 }) => {
        (entities || []).forEach(e => {
            if (e.type === 'INSERT') {
                const block = parsed.blocks?.[e.name];
                if (block?.entities) flatten(block.entities, { x: t.x + e.position.x, y: t.y + e.position.y, scale: t.scale * (e.scale?.x || 1) });
                return;
            }
            const c = JSON.parse(JSON.stringify(e));
            if (c.position) { c.position.x = t.x + c.position.x * t.scale; c.position.y = t.y + c.position.y * t.scale; }
            if (c.center) { c.center.x = t.x + c.center.x * t.scale; c.center.y = t.y + c.center.y * t.scale; }
            if (c.r) c.r *= t.scale;
            if (c.vertices) c.vertices.forEach(v => { v.x = t.x + v.x * t.scale; v.y = t.y + v.y * t.scale; });
            all.push(c);
        });
    };
    flatten(parsed.entities || []);
    return all;
}

function dxfTechData(entities, isInch) {
    const toMm = v => (isInch ? v * 25.4 : v);
    let totalPerimeter = 0;
    let pierceCount = 0;
    const seg = (a, b) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    for (const e of entities || []) {
        if (e.type === 'LINE') {
            totalPerimeter += toMm(Math.sqrt(((e.end?.x || 0) - (e.start?.x || 0)) ** 2 + ((e.end?.y || 0) - (e.start?.y || 0)) ** 2));
        } else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
            const v = e.vertices || [];
            for (let i = 0; i < v.length - 1; i++) totalPerimeter += toMm(seg(v[i], v[i + 1]));
            if ((e.closed || (e.flag & 1)) && v.length > 1) {
                totalPerimeter += toMm(seg(v[v.length - 1], v[0]));
                pierceCount++;
            }
        } else if (e.type === 'ARC') {
            const start = e.startAngle || 0;
            let end = e.endAngle || 0;
            if (end <= start) end += 360;
            totalPerimeter += toMm((e.r || 0) * (end - start) * Math.PI / 180);
        } else if (e.type === 'CIRCLE') {
            totalPerimeter += toMm(2 * Math.PI * (e.r || 0));
            pierceCount++;
        } else if (e.type === 'SPLINE') {
            const p = e.controlPoints || e.fitPoints || [];
            for (let i = 0; i < p.length - 1; i++) totalPerimeter += toMm(seg(p[i], p[i + 1]));
        }
    }
    return { totalPerimeter, pierceCount: Math.max(1, pierceCount) };
}

function measureDxfText(text) {
    const parsed = parseString(text);
    const isInch = (parsed.header || {}).$INSUNITS === 1;
    const toMm = v => (isInch ? v * 25.4 : v);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const check = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
    (parsed.entities || []).forEach(e => {
        if (e.start) check(e.start.x, e.start.y);
        if (e.end) check(e.end.x, e.end.y);
        if (e.center) { check(e.center.x - e.r, e.center.y - e.r); check(e.center.x + e.r, e.center.y + e.r); }
        if (e.vertices) e.vertices.forEach(v => check(v.x, v.y));
    });
    // The quote page rounds the drawing's size to 0.01 mm, then to 0.001 in.
    const lengthMm = Number(toMm(maxX - minX).toFixed(2));
    const widthMm = Number(toMm(maxY - minY).toFixed(2));
    if (!(lengthMm > 0) || !(widthMm > 0)) return null;
    const tech = dxfTechData(flattenDxfEntities(parsed), isInch);
    return {
        kind: 'dxf',
        lengthIn: inches3(lengthMm),
        widthIn: inches3(widthMm),
        perimeterMm: tech.totalPerimeter,
        holeCount: tech.pierceCount,
        bends: [],
        thicknessMm: 0,
    };
}

// ── Storage ──
async function saveMeasurement(hash, measurement, client = db) {
    if (!hash || !measurement) return;
    await client.query(
        `INSERT INTO cad_measurements (file_hash, kind, measurement, version)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (file_hash) DO UPDATE SET kind = $2, measurement = $3, version = $4, updated_at = NOW()`,
        [hash, measurement.kind, JSON.stringify(measurement), MEASURE_VERSION]
    );
}

async function loadMeasurement(hash, client = db) {
    const res = await client.query('SELECT measurement FROM cad_measurements WHERE file_hash = $1', [hash]);
    return res.rows[0]?.measurement || null;
}

/* The server's measurement of a stored upload, or null when it has none
 * (a STEP file the CAD service never finished, a missing file …). */
async function measurementForUpload(ref, client = db) {
    const abs = resolveUpload(ref);
    if (!abs) return null;
    const hash = hashFile(abs);
    const stored = await loadMeasurement(hash, client);
    if (stored) return stored;
    if (/\.dxf$/i.test(abs)) {
        try {
            const m = measureDxfText(fs.readFileSync(abs, 'utf8'));
            if (m) await saveMeasurement(hash, m, client);
            return m;
        } catch (err) {
            console.error('[Measure] DXF could not be read:', err.message);
            return null;
        }
    }
    return null;
}

/* Called when the CAD service returns a STEP analysis for a file. */
async function recordStepAnalysis(hash, result) {
    try {
        if (!hash || !result?.success) return null;
        const m = measureStepResult(result);
        if (m) await saveMeasurement(hash, m);
        return m;
    } catch (err) {
        console.error('[Measure] STEP analysis not stored:', err.message);
        return null;
    }
}

// ── Measuring a STEP file here, when the quote page's analysis left none ──
// The CAD service (main.py) caches analyses by file content for 30 minutes,
// so a part the customer just priced comes back at once.
const CAD_SERVICE = `http://localhost:${process.env.PYTHON_PORT || 8000}`;
const inFlight = new Map();

async function analyseStepFile(abs, waitMs) {
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(abs)], { type: 'application/octet-stream' }), path.basename(abs));
    const start = await fetch(`${CAD_SERVICE}/unfold-job/start`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
    if (!start.ok) throw new Error(`CAD service refused the file (${start.status})`);
    const { jobId } = await start.json();
    if (!jobId) throw new Error('CAD service gave no job id');
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
        const res = await fetch(`${CAD_SERVICE}/unfold-job/status?jobId=${encodeURIComponent(jobId)}`, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error(`CAD service status failed (${res.status})`);
        const status = await res.json();
        if (status.status === 'completed') return status.result;
        if (status.status === 'failed') throw new Error(status.error || 'CAD analysis failed');
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('CAD analysis took too long');
}

/* The server's measurement of an upload, measuring it now if needed (STEP
 * through the CAD service, DXF here). Returns null if that is not possible.
 * One measurement per file at a time. */
async function ensureMeasurement(ref, { waitMs = 120000 } = {}) {
    const known = await measurementForUpload(ref);
    if (known) return known;
    const abs = resolveUpload(ref);
    if (!abs || !/\.(step|stp)$/i.test(abs)) return null;
    const hash = hashFile(abs);
    if (!inFlight.has(hash)) {
        inFlight.set(hash, (async () => {
            try {
                return await recordStepAnalysis(hash, await analyseStepFile(abs, waitMs));
            } catch (err) {
                console.error(`[Measure] ${path.basename(abs)} could not be measured: ${err.message}`);
                return null;
            } finally {
                inFlight.delete(hash);
            }
        })());
    }
    return inFlight.get(hash);
}

module.exports = {
    hashFile, hashBuffer, resolveUpload, measureStepResult, measureDxfText,
    measurementForUpload, ensureMeasurement, recordStepAnalysis, MEASURE_VERSION,
};

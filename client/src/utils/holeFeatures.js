/**
 * Tapping, countersinking and hardware rules, shared by the configure drawer
 * and the 3D view so both always agree. Every size can go on every hole: the
 * hole is re-cut to what the size needs (cut bigger, or filled and cut
 * again), the same rule the production cutter applies
 * (backend/process_configured.py). Sizes and prices come from the admin
 * dashboard (service_options for taps and countersinks, hardware_items for
 * hardware).
 */

const MM_PER_IN = 25.4;
// Matches resize_bore()'s 0.02 mm radius allowance in the cutter.
const SAME_SIZE_MM = 0.04;

// Machine screw gauges (major diameter, inches) for imperial tap names.
const SCREW_GAUGE_MAJOR_IN = {
  0: 0.06, 1: 0.073, 2: 0.086, 3: 0.099, 4: 0.112, 5: 0.125,
  6: 0.138, 8: 0.164, 10: 0.19, 12: 0.216,
};

const toNumber = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

const inchesToMm = (value) => {
  const n = toNumber(value);
  return n !== null && n > 0 ? n * MM_PER_IN : null;
};

/** Plain hole diameter in mm. */
export function holeDiameterMm(hole) {
  const mm = toNumber(hole?.diameter_mm);
  if (mm !== null && mm > 0) return mm;
  const inches = toNumber(hole?.diameterInches ?? hole?.diameter_in);
  return inches !== null && inches > 0 ? inches * MM_PER_IN : 0;
}

/** Widest point of a hole: an existing countersink or counterbore rim. */
export function holeOuterDiameterMm(hole) {
  const rim = toNumber(hole?.rim_diameter_mm);
  return Math.max(holeDiameterMm(hole), rim !== null && rim > 0 ? rim : 0);
}

/**
 * What re-cutting a hole to `targetMm` does to it:
 * 'none' (already that size), 'enlarge' (cut bigger) or 'fill' (filled,
 * then cut at the new size).
 */
export function holeChangeTo(hole, targetMm) {
  const dia = holeDiameterMm(hole);
  const outer = holeOuterDiameterMm(hole);
  if (!(targetMm > 0)) return 'none';
  if (Math.abs(dia - targetMm) <= SAME_SIZE_MM && outer <= dia + SAME_SIZE_MM) return 'none';
  return outer > targetMm + SAME_SIZE_MM ? 'fill' : 'enlarge';
}

/** Thread at the start of a name ("M5 x 0.8 ...", "10-24 ...", "5/16 - 18 ..."), or null. */
function parseThread(text) {
  const name = String(text || '').trim();
  const metric = name.match(/^M\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (metric) {
    return { system: 'metric', majorMm: Number(metric[1]), pitchMm: Number(metric[2]) };
  }
  const imperial = name.match(/^#?\s*(\d+\s*\/\s*\d+|\d+)\s*-\s*(\d+)/);
  if (imperial) {
    const size = imperial[1].replace(/\s+/g, '');
    const tpi = Number(imperial[2]);
    let majorIn = null;
    if (size.includes('/')) {
      const [n, d] = size.split('/').map(Number);
      majorIn = d ? n / d : null;
    } else {
      majorIn = SCREW_GAUGE_MAJOR_IN[Number(size)] ?? null;
    }
    if (majorIn && tpi > 0) {
      return { system: 'imperial', majorMm: majorIn * MM_PER_IN, pitchMm: MM_PER_IN / tpi };
    }
  }
  return null;
}

/** Thread size from a tap's name: "M5 x 0.8 Roll Tap", "10-24 Roll Tap", "5/16 - 18 Cut Tap". */
export function tapThreadSpec(option) {
  const parsed = parseThread(option?.name);
  if (parsed) return parsed;
  // Unknown naming: still draw something sensible from the hole range.
  const name = String(option?.name || '').trim();
  const maxMm = inchesToMm(option?.max_diameter) || 3;
  return { system: /^m\d/i.test(name) ? 'metric' : 'imperial', majorMm: maxMm * 1.2, pitchMm: maxMm * 0.18 };
}

/** The hole a tap needs: unchanged if already in the admin's range, else the middle of it. */
export function tapHoleTargetMm(option, hole) {
  const minMm = inchesToMm(option?.min_diameter);
  const maxMm = inchesToMm(option?.max_diameter);
  const dia = holeDiameterMm(hole);
  if (!minMm || !maxMm || maxMm < minMm) return dia;
  const hasRim = holeOuterDiameterMm(hole) > dia + SAME_SIZE_MM;
  if (!hasRim && dia >= minMm - 0.01 && dia <= maxMm + 0.01) return dia;
  return (minMm + maxMm) / 2;
}

/** Countersink geometry in mm: cone from `majorMm` at the face to `minorMm`, `depthMm` deep. */
export function countersinkGeometry(option) {
  const majorMm = inchesToMm(option?.major_dia) || 0;
  const minorMm = inchesToMm(option?.minor_dia) || 0;
  let angle = toNumber(option?.angle);
  if (angle === null || angle <= 1 || angle >= 179) angle = 82;
  const depthMm = majorMm > minorMm
    ? ((majorMm - minorMm) / 2) / Math.tan((angle * Math.PI) / 360)
    : 0;
  return { majorMm, minorMm, angle, depthMm };
}

/** Why a size can't be used on this hole of this sheet, or null when it can. */
export function optionBlockedReason(kind, option, sheetMm, hole = null) {
  if (kind === 'hw') return hardwareBlockedReason(option, hole);
  if (!(sheetMm > 0)) return null;
  if (kind === 'tap') {
    const maxDepthMm = inchesToMm(option?.max_depth);
    if (maxDepthMm && sheetMm > maxDepthMm + 0.01) return `Sheet too thick (max ${maxDepthMm.toFixed(1)} mm)`;
    return null;
  }
  const { majorMm, minorMm, depthMm } = countersinkGeometry(option);
  if (!(majorMm > minorMm) || !(minorMm > 0)) return 'Size not set up';
  if (depthMm > sheetMm * 0.95) return 'Too deep for this sheet';
  return null;
}

/** "0.472 / 0.255 / 90°" -- the way countersinks are listed. */
export function countersinkLabel(option) {
  const trim = (v) => {
    const n = toNumber(v);
    return n === null ? '—' : String(n);
  };
  return `${trim(option?.major_dia)} / ${trim(option?.minor_dia)} / ${countersinkGeometry(option).angle}°`;
}

export function optionPrice(option) {
  const n = toNumber(option?.price);
  return n !== null && n > 0 ? n : 0;
}

// ── Hardware (self-clinching studs, standoffs and nuts) ─────────────────
// Each part is a row of the admin's hardware list (hardware_items, sizes in
// inches); its kind is hardware_type_id.

/** The four kinds, in the order the drawer lists them. */
export const HARDWARE_TYPES = [
  { id: 1, label: 'Flush studs' },
  { id: 2, label: 'Flush standoffs' },
  { id: 3, label: 'Nuts' },
  { id: 4, label: 'Flush nuts' },
];

const inchValue = (item, key) => {
  const n = toNumber(item?.[key]);
  return n !== null && n > 0 ? n : null;
};

/** Major diameter in inches of "M3x0.5", "1/4-20" or "#6-32" -- the cutter's own parser. */
export function threadMajorInches(sizeSpec) {
  const text = String(sizeSpec || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!text) return null;
  const metric = text.match(/^M(\d+(?:\.\d+)?)/);
  if (metric) {
    const mm = Number(metric[1]);
    return mm > 0 ? mm / MM_PER_IN : null;
  }
  const fraction = text.match(/^(\d+)\/(\d+)-\d+/);
  if (fraction) {
    const d = Number(fraction[2]);
    return d ? Number(fraction[1]) / d : null;
  }
  const gauge = text.match(/^#?(\d+)-\d+/);
  if (gauge) return SCREW_GAUGE_MAJOR_IN[Number(gauge[1])] ?? null;
  return null;
}

/**
 * The hole a hardware part needs, in mm, or null when its sizes are not set
 * up. The same order of admin fields as the cutter
 * (resolve_*_target_diameter_mm in process_configured.py).
 */
export function hardwareHoleTargetMm(typeId, item) {
  const type = Number(typeId);
  const mm = (key) => {
    const inches = inchValue(item, key);
    return inches ? inches * MM_PER_IN : null;
  };
  const specMajorIn = threadMajorInches(item?.size_spec || item?.name);
  if (type === 3 || type === 4) {
    const explicit = mm('minor_dia') || mm('major_dia');
    if (explicit) return explicit;
    if (specMajorIn) return specMajorIn * MM_PER_IN * 1.02;
    const shank = inchValue(item, 'shank');
    if (shank && shank >= 0.04 && shank <= 0.6) return shank * MM_PER_IN;
    const tooling = inchValue(item, 'tooling_diameter');
    const base = inchValue(item, 'base_width');
    if (tooling && (!base || tooling < base * 0.9)) return tooling * MM_PER_IN;
    return null;
  }
  const order = type === 2
    ? ['tooling_diameter', 'shank', 'minor_dia', 'major_dia']
    : ['shank', 'tooling_diameter', 'minor_dia', 'major_dia'];
  for (const key of order) {
    const value = mm(key);
    if (value) return value;
  }
  return specMajorIn ? specMajorIn * MM_PER_IN : null;
}

/** Thread of a hardware part, for drawing it: from its size, else its name ("Flush stud, 4-40, .250"). */
export function hardwareThreadSpec(item) {
  const token = (text) => {
    const found = String(text || '').match(/M\s*\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?|#?\d+(?:\s*\/\s*\d+)?\s*-\s*\d+/i);
    return found ? found[0] : null;
  };
  for (const text of [item?.size_spec, token(item?.size_spec), token(item?.name)]) {
    const parsed = parseThread(text);
    if (parsed) return parsed;
  }
  const majorIn = threadMajorInches(item?.size_spec || item?.name);
  return majorIn
    ? { system: 'unknown', majorMm: majorIn * MM_PER_IN, pitchMm: majorIn * MM_PER_IN * 0.15 }
    : null;
}

/** Why a part can't go in this hole, or null when it can. */
export function hardwareBlockedReason(item, hole) {
  if (!hardwareHoleTargetMm(item?.hardware_type_id, item)) return 'Size not set up';
  const maxIn = inchValue(item, 'max_hole_diameter');
  if (maxIn && hole && holeDiameterMm(hole) > maxIn * MM_PER_IN + SAME_SIZE_MM) {
    return `Hole too big (max ${maxIn}")`;
  }
  return null;
}

/** The admin's sizes for a part, the way the catalog lists them: 'L .250"', 'T .060" · E .250"'. */
export function hardwareSpecText(item) {
  const inch = (key) => {
    const n = inchValue(item, key);
    return n ? `${n.toFixed(3).replace(/^0(?=\.)/, '')}"` : null;
  };
  const type = Number(item?.hardware_type_id);
  const parts = type === 3
    ? [inch('length') && `T ${inch('length')}`, inch('base_width') && `E ${inch('base_width')}`]
    : type === 4
      ? [inch('length') && `A ${inch('length')}`, inch('base_width') && `H ${inch('base_width')}`]
      : [inch('length') && `L ${inch('length')}`];
  return parts.filter(Boolean).join(' · ');
}

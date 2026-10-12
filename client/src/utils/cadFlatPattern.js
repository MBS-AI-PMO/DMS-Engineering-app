// Copied from Zamyr (apps/dashboard/src/Zamyr/parts/cadFlatPattern.js) so DMS
// draws the flat pattern exactly as Zamyr does from the same CAD engine output.
// Keep the two in step: change one, copy it to the other.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function getCadJson(analysis) {
  return analysis?.analysis_json || analysis?.analysisJson || analysis || {};
}

export function flatLooksEdgeOn(flatSize, reportedThickness) {
  const minFlatSpan = Math.max(
    0.001,
    Math.min(Math.abs(flatSize.length || 0), Math.abs(flatSize.width || 0)),
  );
  const maxFlatSpan = Math.max(
    Math.abs(flatSize.length || 0),
    Math.abs(flatSize.width || 0),
  );
  if (
    reportedThickness > 0 &&
    minFlatSpan <= reportedThickness * 2.5 &&
    maxFlatSpan > minFlatSpan * 8
  ) {
    return true;
  }
  return reportedThickness > 0 && reportedThickness > minFlatSpan * 0.45;
}

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pointToArray(point) {
  if (Array.isArray(point)) {
    return [finiteNumber(point[0]), finiteNumber(point[1]), finiteNumber(point[2])];
  }
  if (point && typeof point === 'object') {
    return [finiteNumber(point.x), finiteNumber(point.y), finiteNumber(point.z)];
  }
  return [0, 0, 0];
}

function normalizePositionArray(values) {
  if (!Array.isArray(values) || !values.length) return [];

  if (typeof values[0] === 'number') {
    const numbers = values.map((value) => finiteNumber(value));
    return numbers.length >= 9 && numbers.length % 3 === 0 ? numbers : [];
  }

  const positions = [];
  values.forEach((point) => {
    const [x, y, z] = pointToArray(point);
    positions.push(x, y, z);
  });
  return positions.length >= 9 && positions.length % 3 === 0 ? positions : [];
}

function normalizeLinePositions(values) {
  if (!Array.isArray(values) || !values.length) return [];

  if (typeof values[0] === 'number') {
    const stride = values.length % 6 === 0 ? 6 : values.length % 4 === 0 ? 4 : 0;
    if (!stride) return [];
    const positions = [];
    for (let i = 0; i + stride - 1 < values.length; i += stride) {
      positions.push(
        finiteNumber(values[i]),
        finiteNumber(values[i + 1]),
        stride === 6 ? finiteNumber(values[i + 2]) : 0,
        finiteNumber(values[i + (stride === 6 ? 3 : 2)]),
        finiteNumber(values[i + (stride === 6 ? 4 : 3)]),
        stride === 6 ? finiteNumber(values[i + 5]) : 0,
      );
    }
    return positions;
  }

  const positions = [];
  values.forEach((edge) => {
    if (!Array.isArray(edge)) return;

    if (typeof edge[0] === 'number') {
      const stride = edge.length >= 6 ? 6 : 4;
      positions.push(
        finiteNumber(edge[0]),
        finiteNumber(edge[1]),
        stride === 6 ? finiteNumber(edge[2]) : 0,
        finiteNumber(edge[stride === 6 ? 3 : 2]),
        finiteNumber(edge[stride === 6 ? 4 : 3]),
        stride === 6 ? finiteNumber(edge[5]) : 0,
      );
      return;
    }

    const start = pointToArray(edge[0]);
    const end = pointToArray(edge[1]);
    positions.push(start[0], start[1], start[2], end[0], end[1], end[2]);
  });

  return positions;
}

function boundsToBox(bounds) {
  if (!bounds?.min || !bounds?.max) return null;
  return new THREE.Box3(
    new THREE.Vector3(finiteNumber(bounds.min[0]), finiteNumber(bounds.min[1]), finiteNumber(bounds.min[2])),
    new THREE.Vector3(finiteNumber(bounds.max[0]), finiteNumber(bounds.max[1]), finiteNumber(bounds.max[2])),
  );
}

function boxFromPositions(positions) {
  const box = new THREE.Box3();
  for (let i = 0; i + 2 < positions.length; i += 3) {
    box.expandByPoint(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
  }
  return box.isEmpty() ? null : box;
}

function normalizeLoopPoints(loop) {
  if (!Array.isArray(loop) || loop.length < 3) return [];
  const points = [];
  loop.forEach((point) => {
    const [x, y] = pointToArray(point);
    const last = points[points.length - 1];
    if (!last || Math.abs(last[0] - x) > 0.001 || Math.abs(last[1] - y) > 0.001) {
      points.push([x, y]);
    }
  });
  if (points.length > 2) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.abs(first[0] - last[0]) <= 0.001 && Math.abs(first[1] - last[1]) <= 0.001) {
      points.pop();
    }
  }
  return points.length >= 3 ? points : [];
}

function loopToLinePositions(loop) {
  const positions = [];
  if (!Array.isArray(loop) || loop.length < 2) return positions;
  for (let i = 0; i < loop.length; i += 1) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    positions.push(a[0], a[1], 0, b[0], b[1], 0);
  }
  return positions;
}

/** Same as loopToLinePositions but NEVER joins last->first.
 *
 * Bridge-split glyph remnants are open on purpose: the analyzer cut the CAM
 * bridge that ties a compound glyph (0, S, 8) to its inner island, and closing
 * the remnant would draw that chord straight back across the letter. */
function chainToLinePositions(chain) {
  const positions = [];
  if (!Array.isArray(chain) || chain.length < 2) return positions;
  for (let i = 0; i < chain.length - 1; i += 1) {
    const a = chain[i];
    const b = chain[i + 1];
    positions.push(a[0], a[1], 0, b[0], b[1], 0);
  }
  return positions;
}

function normalizeLoopCollection(values) {
  if (!Array.isArray(values) || !values.length) return [];
  return values
    .map((item) => {
      const loop = Array.isArray(item?.points)
        ? item.points
        : Array.isArray(item?.outer)
          ? item.outer
          : item;
      return normalizeLoopPoints(loop);
    })
    .filter((loop) => loop.length >= 3);
}

function mergeLinePositionsUnique(...arrays) {
  const merged = [];
  const seen = new Set();
  arrays.forEach((positions) => {
    if (!Array.isArray(positions)) return;
    for (let i = 0; i + 5 < positions.length; i += 6) {
      const segment = [
        finiteNumber(positions[i]),
        finiteNumber(positions[i + 1]),
        finiteNumber(positions[i + 2]),
        finiteNumber(positions[i + 3]),
        finiteNumber(positions[i + 4]),
        finiteNumber(positions[i + 5]),
      ];
      const forward = segment.map((value) => Math.round(value * 1000)).join(':');
      const reverse = [
        segment[3],
        segment[4],
        segment[5],
        segment[0],
        segment[1],
        segment[2],
      ].map((value) => Math.round(value * 1000)).join(':');
      const key = forward < reverse ? forward : reverse;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(...segment);
    }
  });
  return merged;
}

function firstNonEmptyArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}

function selectContour(cadJson) {
  const contours = selectContours(cadJson);
  return contours[0] || null;
}

function selectContours(cadJson) {
  const contours = cadJson.contours || cadJson.cutContours || cadJson.cut_contours;
  if (!Array.isArray(contours) || !contours.length) return [];
  return contours.filter((candidate) => {
    const source = String(candidate?.source || '').toLowerCase();
    if (source.includes('bbox')) return false;
    return normalizeLoopPoints(candidate?.outer || candidate?.points).length >= 3;
  });
}

function isDxfSource(cadJson = {}) {
  const source = String(cadJson.source || cadJson.fileType || cadJson.file_type || '').toLowerCase();
  const analysisEngine = String(cadJson.analysisEngine || cadJson.analysis_engine || '').toLowerCase();
  return source === 'dxf' || analysisEngine.includes('dxf');
}

function translateLinePositions(positions, dx, dy) {
  if (!Array.isArray(positions) || !positions.length || (Math.abs(dx) <= 1e-9 && Math.abs(dy) <= 1e-9)) {
    return positions;
  }
  const translated = positions.slice();
  for (let i = 0; i + 1 < translated.length; i += 3) {
    translated[i] += dx;
    translated[i + 1] += dy;
  }
  return translated;
}

function translatePositionArray(positions, dx, dy) {
  if (!Array.isArray(positions) || !positions.length || (Math.abs(dx) <= 1e-9 && Math.abs(dy) <= 1e-9)) {
    return positions;
  }
  const translated = positions.slice();
  for (let i = 0; i + 1 < translated.length; i += 3) {
    translated[i] += dx;
    translated[i + 1] += dy;
  }
  return translated;
}

function flatRotationDegrees(cadJson, contour) {
  const values = [
    cadJson?.bbox?.rotation_deg,
    cadJson?.bbox?.rotationDeg,
    cadJson?.flatPattern?.rotation_deg,
    cadJson?.flatPattern?.rotationDeg,
    contour?.bbox?.rotation_deg,
    contour?.bbox?.rotationDeg,
  ];
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && Math.abs(numeric) > 0.001) {
      return numeric;
    }
  }
  return 0;
}

function orientPoint2d(point, rotationDeg) {
  const [x, y] = point;
  if (Math.abs(rotationDeg) <= 0.001) return [x, y];

  // Matches the backend OBB matrix:
  // x' = x cos(theta) + y sin(theta), y' = -x sin(theta) + y cos(theta).
  const theta = THREE.MathUtils.degToRad(rotationDeg);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return [
    x * cos + y * sin,
    -x * sin + y * cos,
  ];
}

function orientLoop(loop, rotationDeg) {
  if (!Array.isArray(loop) || !loop.length) return [];
  return loop.map((point) => orientPoint2d(point, rotationDeg));
}

function translateLoop(loop, dx, dy) {
  if (!Array.isArray(loop) || !loop.length) return [];
  if (Math.abs(dx) <= 1e-9 && Math.abs(dy) <= 1e-9) return loop;
  return loop.map(([x, y]) => [x + dx, y + dy]);
}

function orientLinePositions(positions, rotationDeg) {
  if (!Array.isArray(positions) || !positions.length || Math.abs(rotationDeg) <= 0.001) {
    return positions;
  }
  const oriented = positions.slice();
  for (let i = 0; i + 1 < oriented.length; i += 3) {
    const [x, y] = orientPoint2d([oriented[i], oriented[i + 1]], rotationDeg);
    oriented[i] = x;
    oriented[i + 1] = y;
  }
  return oriented;
}

function orientPositionArray(positions, rotationDeg) {
  if (!Array.isArray(positions) || !positions.length || Math.abs(rotationDeg) <= 0.001) {
    return positions;
  }
  const oriented = positions.slice();
  for (let i = 0; i + 1 < oriented.length; i += 3) {
    const [x, y] = orientPoint2d([oriented[i], oriented[i + 1]], rotationDeg);
    oriented[i] = x;
    oriented[i + 1] = y;
    oriented[i + 2] = 0;
  }
  return oriented;
}

function makeFlatMeshGeometry(positions) {
  if (!Array.isArray(positions) || positions.length < 9 || positions.length % 3 !== 0) {
    return null;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

function pointInLoop2d(point, loop) {
  if (!Array.isArray(loop) || loop.length < 3) return false;
  const [px, py] = point;
  let inside = false;
  let previous = loop[loop.length - 1];
  for (const current of loop) {
    const [x1, y1] = previous;
    const [x2, y2] = current;
    if ((y1 > py) !== (y2 > py)) {
      const xAtY = x1 + ((py - y1) * (x2 - x1)) / ((y2 - y1) || 1e-12);
      if (px < xAtY) inside = !inside;
    }
    previous = current;
  }
  return inside;
}

function pointInMaterial2d(point, outer, holes) {
  if (!pointInLoop2d(point, outer)) return false;
  return !holes.some((hole) => pointInLoop2d(point, hole));
}

function outsideSkinFlatPattern(cadJson) {
  const values = [
    cadJson?.outsideSkin,
    cadJson?.outside_skin,
    cadJson?.flatPattern?.outsideSkin,
    cadJson?.flat_pattern?.outsideSkin,
    cadJson?.flat_pattern?.outside_skin,
    cadJson?.analysisEngine,
    cadJson?.analysis_engine,
    cadJson?.bbox?.source,
    cadJson?.flatPattern?.source,
  ];
  return values.some((value) => {
    if (value === true) return true;
    const text = String(value || '').toLowerCase();
    return text.includes('outside_skin') || text.includes('partial_unfold_profile_recovery');
  });
}

function linesFromPositions(positions) {
  const lines = [];
  if (!Array.isArray(positions)) return lines;
  for (let i = 0; i + 5 < positions.length; i += 6) {
    const x1 = finiteNumber(positions[i]);
    const y1 = finiteNumber(positions[i + 1]);
    const x2 = finiteNumber(positions[i + 3]);
    const y2 = finiteNumber(positions[i + 4]);
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length <= 1e-5) continue;
    lines.push({ x1, y1, x2, y2 });
  }
  return lines;
}

function lineMetrics(line) {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-9) return null;
  let ux = dx / length;
  let uy = dy / length;
  let x1 = line.x1;
  let y1 = line.y1;
  let x2 = line.x2;
  let y2 = line.y2;
  if (ux < -1e-9 || (Math.abs(ux) <= 1e-9 && uy < 0)) {
    ux = -ux;
    uy = -uy;
    x1 = line.x2;
    y1 = line.y2;
    x2 = line.x1;
    y2 = line.y1;
  }
  const nx = -uy;
  const ny = ux;
  const offset = x1 * nx + y1 * ny;
  const t1 = x1 * ux + y1 * uy;
  const t2 = x2 * ux + y2 * uy;
  return {
    x1,
    y1,
    x2,
    y2,
    ux,
    uy,
    nx,
    ny,
    offset,
    tMin: Math.min(t1, t2),
    tMax: Math.max(t1, t2),
    length,
    angle: Math.atan2(uy, ux),
  };
}

function angleDistance(a, b) {
  let diff = Math.abs(a - b);
  while (diff > Math.PI) diff -= Math.PI;
  return Math.min(diff, Math.PI - diff);
}

function lineOverlapLength(a, b) {
  return Math.max(0, Math.min(a.tMax, b.tMax) - Math.max(a.tMin, b.tMin));
}

function estimateBendFaceSpacing(lines, outer) {
  if (!lines.length || !Array.isArray(outer) || outer.length < 3) return 0;
  const metrics = lines.map(lineMetrics).filter(Boolean);
  const box = boxFromPositions(loopToLinePositions(outer));
  const span = box
    ? Math.max(box.max.x - box.min.x, box.max.y - box.min.y, 1)
    : Math.max(...metrics.map((line) => line.length), 1);
  const minSpacing = Math.max(span * 0.006, 1.5);
  const maxSpacing = Math.max(span * 0.12, minSpacing * 2);
  const candidates = [];

  for (let i = 0; i < metrics.length; i += 1) {
    for (let j = i + 1; j < metrics.length; j += 1) {
      const a = metrics[i];
      const b = metrics[j];
      if (angleDistance(a.angle, b.angle) > THREE.MathUtils.degToRad(4)) continue;
      const overlap = lineOverlapLength(a, b);
      if (overlap < Math.min(a.length, b.length) * 0.35) continue;
      const distance = Math.abs(a.offset - b.offset);
      if (distance >= minSpacing && distance <= maxSpacing) {
        candidates.push(distance);
      }
    }
  }

  if (!candidates.length) return 0;
  candidates.sort((a, b) => a - b);
  return candidates[Math.floor(candidates.length / 2)];
}

function duplicateLine(candidate, lines, spacing) {
  const cm = lineMetrics(candidate);
  if (!cm) return true;
  const offsetTol = Math.max(spacing * 0.16, 2.5);
  const angleTol = THREE.MathUtils.degToRad(4);
  return lines.some((line) => {
    const lm = lineMetrics(line);
    if (!lm || angleDistance(cm.angle, lm.angle) > angleTol) return false;
    if (Math.abs(cm.offset - lm.offset) > offsetTol) return false;
    return lineOverlapLength(cm, lm) >= Math.min(cm.length, lm.length) * 0.25;
  });
}

function offsetLine(line, distance) {
  const metrics = lineMetrics(line);
  if (!metrics) return null;
  return {
    x1: line.x1 + metrics.nx * distance,
    y1: line.y1 + metrics.ny * distance,
    x2: line.x2 + metrics.nx * distance,
    y2: line.y2 + metrics.ny * distance,
  };
}

function inwardOffsetLine(line, distance, outer) {
  const candidates = [offsetLine(line, distance), offsetLine(line, -distance)].filter(Boolean);
  let best = null;
  let bestScore = -1;
  candidates.forEach((candidate) => {
    const mid = [(candidate.x1 + candidate.x2) * 0.5, (candidate.y1 + candidate.y2) * 0.5];
    const q1 = [candidate.x1 * 0.7 + candidate.x2 * 0.3, candidate.y1 * 0.7 + candidate.y2 * 0.3];
    const q2 = [candidate.x1 * 0.3 + candidate.x2 * 0.7, candidate.y1 * 0.3 + candidate.y2 * 0.7];
    const score = [mid, q1, q2].reduce(
      (sum, point) => sum + (pointInMaterial2d(point, outer, []) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });
  return bestScore > 0 ? best : null;
}

function loopEdgesAsLines(loop) {
  const lines = [];
  if (!Array.isArray(loop) || loop.length < 2) return lines;
  for (let i = 0; i < loop.length; i += 1) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    const line = { x1: a[0], y1: a[1], x2: b[0], y2: b[1] };
    if (lineMetrics(line)?.length > 1e-5) lines.push(line);
  }
  return lines;
}

function linePositionsFromLines(lines) {
  return lines.flatMap((line) => [line.x1, line.y1, 0, line.x2, line.y2, 0]);
}

function expectedBendLineCount(cadJson = {}) {
  const fromLineCount = Number(cadJson?.bendLineCount ?? cadJson?.displayBendCount);
  if (Number.isFinite(fromLineCount) && fromLineCount > 0) return fromLineCount;
  const fromBends = Array.isArray(cadJson?.bends) ? cadJson.bends.length : 0;
  if (fromBends > 0) return fromBends;
  return 0;
}

function limitLinePositionsToCount(positions, maxCount) {
  const lines = linesFromPositions(positions);
  if (!maxCount || maxCount <= 0 || lines.length <= maxCount) return positions || [];
  const ranked = lines
    .map((line) => ({ line, length: lineMetrics(line)?.length || 0 }))
    .sort((a, b) => b.length - a.length)
    .slice(0, maxCount)
    .map((entry) => entry.line);
  return linePositionsFromLines(ranked);
}

/**
 * One drawn crease per bend, the count the analyzer reports.
 *
 * This used to double the target for any part with six or more creases and
 * then invent a "partner" line for every crease that lacked one -- the tray
 * convention the analyzer itself dropped in August. On 22.stp the analyzer
 * returned 8 creases and the page drew 12, two of them running the length
 * of the return lip where no bend is.
 */
function displayBendLineTarget(cadJson = {}) {
  return expectedBendLineCount(cadJson);
}

function recoverOutsideSkinBendLines(cadJson, positions, outer) {
  if (!outsideSkinFlatPattern(cadJson)) return positions || [];
  const baseLines = linesFromPositions(positions);
  if (!baseLines.length || !Array.isArray(outer) || outer.length < 3) return positions || [];

  const expectedCount = expectedBendLineCount(cadJson);
  const displayTarget = displayBendLineTarget(cadJson);
  let next = positions || [];

  if (expectedCount > 0 && baseLines.length < expectedCount) {
    const spacing = estimateBendFaceSpacing(baseLines, outer);
    if (Number.isFinite(spacing) && spacing > 0) {
      const box = boxFromPositions(loopToLinePositions(outer));
      const span = box ? Math.max(box.max.x - box.min.x, box.max.y - box.min.y, 1) : 1;
      const minOuterEdgeLength = Math.max(spacing * 3.5, span * 0.12);
      const recovered = baseLines.slice();

      loopEdgesAsLines(outer).forEach((edge) => {
        const metrics = lineMetrics(edge);
        if (!metrics || metrics.length < minOuterEdgeLength) return;

        [spacing, spacing * 2].forEach((distance) => {
          const candidate = inwardOffsetLine(edge, distance, outer);
          if (!candidate || duplicateLine(candidate, recovered, spacing)) return;
          recovered.push(candidate);
        });
      });

      next = linePositionsFromLines(recovered);
    }
  }

  if (displayTarget > 0) {
    return limitLinePositionsToCount(next, displayTarget);
  }
  return next;
}

function addUniqueSplitValue(values, t) {
  if (!Number.isFinite(t) || t < -1e-7 || t > 1 + 1e-7) return;
  const clamped = Math.max(0, Math.min(1, t));
  if (!values.some((value) => Math.abs(value - clamped) <= 1e-5)) {
    values.push(clamped);
  }
}

function addLineLoopIntersections(splitValues, p, r, loop) {
  if (!Array.isArray(loop) || loop.length < 2) return;
  const rr = r.x * r.x + r.y * r.y;
  if (rr <= 1e-12) return;

  for (let index = 0; index < loop.length; index += 1) {
    const a = loop[index];
    const b = loop[(index + 1) % loop.length];
    const q = { x: a[0], y: a[1] };
    const s = { x: b[0] - a[0], y: b[1] - a[1] };
    const qmp = { x: q.x - p.x, y: q.y - p.y };
    const denom = r.x * s.y - r.y * s.x;

    if (Math.abs(denom) <= 1e-10) {
      const collinear = Math.abs(qmp.x * r.y - qmp.y * r.x) <= 1e-6;
      if (!collinear) continue;
      const t0 = (qmp.x * r.x + qmp.y * r.y) / rr;
      const qbs = { x: b[0] - p.x, y: b[1] - p.y };
      const t1 = (qbs.x * r.x + qbs.y * r.y) / rr;
      const start = Math.max(0, Math.min(t0, t1));
      const end = Math.min(1, Math.max(t0, t1));
      if (end >= start) {
        addUniqueSplitValue(splitValues, start);
        addUniqueSplitValue(splitValues, end);
      }
      continue;
    }

    const t = (qmp.x * s.y - qmp.y * s.x) / denom;
    const u = (qmp.x * r.y - qmp.y * r.x) / denom;
    if (t >= -1e-7 && t <= 1 + 1e-7 && u >= -1e-7 && u <= 1 + 1e-7) {
      addUniqueSplitValue(splitValues, t);
    }
  }
}

function clipLinePositionsToMaterial(positions, outer, holes) {
  if (!Array.isArray(positions) || positions.length < 6 || !Array.isArray(outer) || outer.length < 3) {
    return positions || [];
  }

  const clipped = [];
  for (let i = 0; i + 5 < positions.length; i += 6) {
    const p = { x: positions[i], y: positions[i + 1] };
    const end = { x: positions[i + 3], y: positions[i + 4] };
    const r = { x: end.x - p.x, y: end.y - p.y };
    const length = Math.hypot(r.x, r.y);
    if (length <= 1e-5) continue;

    const splitValues = [0, 1];
    addLineLoopIntersections(splitValues, p, r, outer);
    holes.forEach((hole) => addLineLoopIntersections(splitValues, p, r, hole));
    splitValues.sort((a, b) => a - b);

    for (let splitIndex = 0; splitIndex + 1 < splitValues.length; splitIndex += 1) {
      const t0 = splitValues[splitIndex];
      const t1 = splitValues[splitIndex + 1];
      if ((t1 - t0) * length <= 0.05) continue;

      const midpointT = (t0 + t1) * 0.5;
      const midpoint = [p.x + r.x * midpointT, p.y + r.y * midpointT];
      if (!pointInMaterial2d(midpoint, outer, holes)) continue;

      clipped.push(
        p.x + r.x * t0,
        p.y + r.y * t0,
        0,
        p.x + r.x * t1,
        p.y + r.y * t1,
        0,
      );
    }
  }
  return clipped;
}

function segmentLengths(positions) {
  const lengths = [];
  if (!Array.isArray(positions)) return lengths;
  for (let i = 0; i + 5 < positions.length; i += 6) {
    lengths.push(Math.hypot(
      positions[i + 3] - positions[i],
      positions[i + 4] - positions[i + 1],
    ));
  }
  return lengths;
}

function bendLineStyle(originalBends, clippedBends) {
  const clippedLengths = segmentLengths(clippedBends);
  if (clippedLengths.length < 6) return 'standard';
  const originalTotal = segmentLengths(originalBends).reduce((sum, value) => sum + value, 0);
  const clippedTotal = clippedLengths.reduce((sum, value) => sum + value, 0);
  const maxLength = Math.max(...clippedLengths, 0);
  const sorted = clippedLengths.slice().sort((a, b) => a - b);
  const medianLength = sorted[Math.floor(sorted.length / 2)] || 0;

  if (
    originalTotal > 0 &&
    clippedTotal < originalTotal * 0.35 &&
    maxLength <= 8 &&
    medianLength <= 4
  ) {
    return 'compact';
  }
  return 'standard';
}

function shouldUseHybridFill(flatPositions, outer, holes) {
  if (!Array.isArray(flatPositions) || flatPositions.length < 9) return false;
  const holePointCount = holes.reduce((sum, loop) => sum + loop.length, 0);
  return holes.length >= 24 || outer.length >= 500 || holePointCount >= 800;
}

function loopToShapePath(loop) {
  const path = new THREE.Path();
  loop.forEach(([x, y], index) => {
    if (index === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  path.closePath();
  return path;
}

function makeContourShapeGeometry(outer, holes = []) {
  if (!Array.isArray(outer) || outer.length < 3) return null;
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
  shape.holes = holes
    .filter((loop) => Array.isArray(loop) && loop.length >= 3)
    .map((loop) => loopToShapePath(loop));
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.computeBoundingBox();
  return geometry;
}

const NEST_PART_FILL_COLORS = [
  0xf8fafc,
  0xf1f5f9,
  0xe8edf3,
  0xdee5ed,
  0xd4dce6,
  0xcad4e0,
  0xc0ccda,
  0xb6c4d4,
];

function isNestSheetContour(contours, cadJson) {
  if (!Array.isArray(contours) || contours.length !== 1) return false;
  const contour = contours[0];
  if (String(contour?.nestRole || '').toLowerCase() === 'sheet_frame') return true;
  return String(cadJson?.dxf?.nestLayout || '').toLowerCase() === 'sheet_frame';
}

/**
 * A DXF of a part is line work: no face to shade, no bend to mark. The viewer
 * and the thumbnail both draw those as outline only, and share this predicate
 * so the thumbnail always matches the view it opens. A nest sheet is the one
 * DXF that keeps its fill — there the shading is what separates nested parts.
 */
export function rendersAsOutlineOnly(cadJson = {}) {
  if (!isDxfSource(cadJson)) return false;
  return !isNestSheetContour(selectContours(cadJson), cadJson);
}

function buildFlatDataFromDxf(
  cadJson,
  contours,
  cutEdgePositions,
  flatPositions = [],
  detailEdgePositions = [],
) {
  if (!contours.length) return null;

  const referenceContour = contours[0];
  const rotationDeg = flatRotationDegrees(cadJson, referenceContour);
  const orientedCuts = orientLinePositions(cutEdgePositions, rotationDeg);
  const orientedDetails = orientLinePositions(detailEdgePositions, rotationDeg);
  const orientedFlatPositions = orientPositionArray(flatPositions, rotationDeg);
  const storedEngravingLoops = firstNonEmptyArray(
    cadJson.dxfEngravingLoops,
    cadJson.dxf_engraving_loops,
    cadJson.dxf?.engravingLoops,
    cadJson.dxf?.engraving_loops,
  );
  const engravingLoops = normalizeLoopCollection(
    storedEngravingLoops,
  );
  // Open remnants left by the bridge split. Without these a compound glyph
  // loses its outline entirely instead of just losing the bridge stroke.
  const engravingOpenChains = normalizeLoopCollection(
    firstNonEmptyArray(
      cadJson.dxfEngravingOpenChains,
      cadJson.dxf_engraving_open_chains,
      cadJson.dxf?.engravingOpenChains,
      cadJson.dxf?.engraving_open_chains,
    ),
  );

  const orientedContourLoops = contours.flatMap((contour) => {
    const outer = orientLoop(
      normalizeLoopPoints(contour?.outer || contour?.points),
      rotationDeg,
    );
    const holes = Array.isArray(contour?.holes)
      ? contour.holes
        .map((hole) => normalizeLoopPoints(Array.isArray(hole) ? hole : hole?.points || hole?.outer))
        .filter((loop) => loop.length >= 3)
        .map((loop) => orientLoop(loop, rotationDeg))
      : [];
    return [outer, ...holes];
  }).filter((loop) => loop.length >= 3);

  const boundsPositions = orientedCuts.length >= 6
    ? orientedCuts
    : orientedContourLoops.flatMap((loop) => loopToLinePositions(loop));
  const orientedBox = boxFromPositions(boundsPositions);
  const finalDx = orientedBox ? -orientedBox.min.x : 0;
  const finalDy = orientedBox ? -orientedBox.min.y : 0;

  const displayCuts = translateLinePositions(orientedCuts, finalDx, finalDy);
  const displayDetails = translateLinePositions(orientedDetails, finalDx, finalDy);
  const displayFlatPositions = translatePositionArray(orientedFlatPositions, finalDx, finalDy);
  const displayEngravingLoops = engravingLoops
    .map((loop) => translateLoop(orientLoop(loop, rotationDeg), finalDx, finalDy))
    .filter((loop) => loop.length >= 3);
  const displayEngravingChains = engravingOpenChains
    .map((chain) => translateLoop(orientLoop(chain, rotationDeg), finalDx, finalDy))
    .filter((chain) => chain.length >= 2);
  const displayEngravingPositions = [
    ...displayEngravingLoops.flatMap((loop) => loopToLinePositions(loop)),
    // open — chainToLinePositions, never loopToLinePositions
    ...displayEngravingChains.flatMap((chain) => chainToLinePositions(chain)),
  ];
  const displayDetailLines = mergeLinePositionsUnique(displayDetails, displayEngravingPositions);

  const displayContours = contours.map((contour) => {
    const outer = translateLoop(
      orientLoop(normalizeLoopPoints(contour?.outer || contour?.points), rotationDeg),
      finalDx,
      finalDy,
    );
    const holes = (Array.isArray(contour?.holes) ? contour.holes : [])
      .map((hole) => normalizeLoopPoints(Array.isArray(hole) ? hole : hole?.points || hole?.outer))
      .filter((loop) => loop.length >= 3)
      .map((loop) => translateLoop(orientLoop(loop, rotationDeg), finalDx, finalDy));
    return { outer, holes };
  });

  const contourCutPositions = displayContours.flatMap(({ outer, holes }) => [
    ...loopToLinePositions(outer),
    ...holes.flatMap((loop) => loopToLinePositions(loop)),
  ]);

  const cutPositions = displayCuts.length >= 6 ? displayCuts : contourCutPositions;
  const nestSheet = isNestSheetContour(contours, cadJson);

  // A DXF of a part carries curves, never faces. The filled sheet-metal face
  // this used to build was invented from the contour so a cut file would look
  // like an unfolded solid, and the shading it needed then sat on top of the
  // only thing the file actually contains. Draw it as line work and nothing
  // else. A nest sheet is the exception and keeps its fill: there the shading
  // is what separates one nested part from the next.
  if (!nestSheet) {
    if (cutPositions.length < 6 && displayDetailLines.length < 6) return null;
    return {
      geometry: null,
      partFills: [],
      cutPositions,
      detailPositions: displayDetailLines,
      bendPositions: [],
      bendLineStyle: 'standard',
      fillSource: 'outline',
      bounds: boxFromPositions(cutPositions) || boxFromPositions(displayDetailLines),
      hasFilledFace: false,
      nestSheet: false,
    };
  }

  const useHybridFill = shouldUseHybridFill(
    displayFlatPositions,
    displayContours[0]?.outer || [],
    displayContours.flatMap((contour) => contour.holes || []),
  );

  const partFills = [];
  let geometry = null;

  if (useHybridFill) {
    geometry = makeFlatMeshGeometry(displayFlatPositions);
  }
  if (!geometry && displayContours[0]?.holes?.length) {
    const { outer, holes } = displayContours[0];
    geometry = makeContourShapeGeometry(outer, holes);
    holes.forEach((hole, index) => {
      const partGeometry = makeContourShapeGeometry(hole, []);
      if (!partGeometry) return;
      partFills.push({
        geometry: partGeometry,
        color: NEST_PART_FILL_COLORS[index % NEST_PART_FILL_COLORS.length],
      });
    });
  }
  if (!geometry) {
    const shapeGeometries = displayContours.map(({ outer, holes }, index) => {
      const partGeometry = makeContourShapeGeometry(outer, holes);
      if (!partGeometry) return null;
      if (displayContours.length > 1) {
        partFills.push({
          geometry: partGeometry,
          color: NEST_PART_FILL_COLORS[index % NEST_PART_FILL_COLORS.length],
        });
        return null;
      }
      return partGeometry;
    }).filter(Boolean);
    geometry = shapeGeometries.length === 1
      ? shapeGeometries[0]
      : (partFills.length ? null : mergeGeometries(shapeGeometries));
  }
  if (!geometry && !partFills.length) return null;
  if (geometry) {
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
  }

  return {
    geometry,
    partFills,
    cutPositions,
    detailPositions: displayDetailLines,
    bendPositions: [],
    bendLineStyle: 'standard',
    fillSource: useHybridFill ? 'flatVertices' : 'contours',
    bounds: boxFromPositions(cutPositions)
      || geometry?.boundingBox
      || partFills[0]?.geometry?.boundingBox,
    hasFilledFace: Boolean(geometry || partFills.length),
    nestSheet: true,
  };
}

function buildFlatDataFromContours(
  cadJson,
  bendPositions,
  cutEdgePositions,
  flatPositions = [],
  detailEdgePositions = [],
) {
  const contour = selectContour(cadJson);
  const outer = normalizeLoopPoints(contour?.outer || contour?.points);
  if (outer.length < 3) return null;

  const holes = Array.isArray(contour.holes)
    ? contour.holes.map((hole) => normalizeLoopPoints(Array.isArray(hole) ? hole : hole?.points || hole?.outer)).filter((loop) => loop.length >= 3)
    : [];

  const baseCutPositions = [
    ...loopToLinePositions(outer),
    ...holes.flatMap((loop) => loopToLinePositions(loop)),
  ];
  const contourBaseBox = boxFromPositions(baseCutPositions);
  const rawCutBox = boxFromPositions(cutEdgePositions);
  const rawDx = contourBaseBox && rawCutBox ? contourBaseBox.min.x - rawCutBox.min.x : 0;
  const rawDy = contourBaseBox && rawCutBox ? contourBaseBox.min.y - rawCutBox.min.y : 0;
  const alignedBends = translateLinePositions(bendPositions, rawDx, rawDy);
  const alignedDetails = translateLinePositions(detailEdgePositions, rawDx, rawDy);
  const alignedFlatPositions = translatePositionArray(flatPositions, rawDx, rawDy);

  const rotationDeg = flatRotationDegrees(cadJson, contour);
  const orientedOuter = orientLoop(outer, rotationDeg);
  const orientedHoles = holes.map((loop) => orientLoop(loop, rotationDeg));
  const orientedBends = orientLinePositions(alignedBends, rotationDeg);
  const orientedDetails = orientLinePositions(alignedDetails, rotationDeg);
  const orientedFlatPositions = orientPositionArray(alignedFlatPositions, rotationDeg);
  const orientedCutBox = boxFromPositions([
    ...loopToLinePositions(orientedOuter),
    ...orientedHoles.flatMap((loop) => loopToLinePositions(loop)),
  ]);
  const finalDx = orientedCutBox ? -orientedCutBox.min.x : 0;
  const finalDy = orientedCutBox ? -orientedCutBox.min.y : 0;
  const displayOuter = translateLoop(orientedOuter, finalDx, finalDy);
  const displayHoles = orientedHoles.map((loop) => translateLoop(loop, finalDx, finalDy));
  const displayBends = translateLinePositions(orientedBends, finalDx, finalDy);
  const displayDetails = translateLinePositions(orientedDetails, finalDx, finalDy);
  const displayFlatPositions = translatePositionArray(orientedFlatPositions, finalDx, finalDy);
  const recoveredBends = recoverOutsideSkinBendLines(cadJson, displayBends, displayOuter);
  const clippedBends = clipLinePositionsToMaterial(recoveredBends, displayOuter, []);
  const useHybridFill = shouldUseHybridFill(displayFlatPositions, displayOuter, displayHoles);
  const contourCutPositions = [
    ...loopToLinePositions(displayOuter),
    ...displayHoles.flatMap((loop) => loopToLinePositions(loop)),
  ];

  const shape = new THREE.Shape(displayOuter.map(([x, y]) => new THREE.Vector2(x, y)));
  shape.holes = displayHoles.map((loop) => {
    const path = new THREE.Path();
    loop.forEach(([x, y], index) => {
      if (index === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    path.closePath();
    return path;
  });

  const geometry = useHybridFill
    ? makeFlatMeshGeometry(displayFlatPositions) || new THREE.ShapeGeometry(shape)
    : new THREE.ShapeGeometry(shape);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const contourBox = boxFromPositions(contourCutPositions) || geometry.boundingBox;

  return {
    geometry,
    cutPositions: contourCutPositions,
    detailPositions: displayDetails,
    bendPositions: clippedBends,
    bendLineStyle: bendLineStyle(recoveredBends, clippedBends),
    fillSource: useHybridFill ? 'flatVertices' : 'contours',
    bounds: contourBox || geometry.boundingBox,
    hasFilledFace: true,
  };
}

function buildFlatDataFromFaceMeshes(cadJson) {
  const faceMeshes = cadJson.faceMeshes || {};
  const positions = [];
  for (const mesh of Object.values(faceMeshes)) {
    const vertices = mesh?.vertices;
    const indices = mesh?.indices;
    if (!Array.isArray(vertices) || vertices.length < 9 || !Array.isArray(indices)) {
      continue;
    }
    for (let index = 0; index + 2 < indices.length; index += 3) {
      const a = indices[index] * 3;
      const b = indices[index + 1] * 3;
      const c = indices[index + 2] * 3;
      if (a + 2 >= vertices.length || b + 2 >= vertices.length || c + 2 >= vertices.length) {
        continue;
      }
      positions.push(
        vertices[a], vertices[a + 1], vertices[a + 2],
        vertices[b], vertices[b + 1], vertices[b + 2],
        vertices[c], vertices[c + 1], vertices[c + 2],
      );
    }
  }
  if (positions.length < 9) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  let cutPositions = [];
  try {
    const indexedGeometry = mergeVertices(geometry, 0.001);
    indexedGeometry.computeVertexNormals();
    const boundaryGeometry = new THREE.EdgesGeometry(indexedGeometry, 1);
    const boundaryAttr = boundaryGeometry.getAttribute('position');
    cutPositions = boundaryAttr ? Array.from(boundaryAttr.array) : [];
    boundaryGeometry.dispose();
    indexedGeometry.dispose();
  } catch {
    cutPositions = [];
  }

  const bounds = geometry.boundingBox || boxFromPositions(positions);
  return {
    geometry,
    cutPositions,
    detailPositions: [],
    bendPositions: [],
    bounds,
    hasFilledFace: true,
  };
}

export function buildFlatData(cadJson) {
  const flatPositions = normalizePositionArray(cadJson.flatVertices || cadJson.flat_vertices);
  const geometry = new THREE.BufferGeometry();
  const analysisEngine = cadJson.analysisEngine || cadJson.analysis_engine || '';
  const isDxf = isDxfSource(cadJson);

  if (flatPositions.length) {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(flatPositions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
  }

  const bendPositions = isDxf
    ? []
    : normalizeLinePositions(cadJson.bendEdges || cadJson.bend_edges);
  const cutEdgePositions = normalizeLinePositions(cadJson.cutEdges || cadJson.cut_edges);
  const detailEdgePositions = normalizeLinePositions(firstNonEmptyArray(
    cadJson.dxfDetailEdges,
    cadJson.dxf_detail_edges,
    cadJson.drawingEdges,
    cadJson.drawing_edges,
    cadJson.detailEdges,
    cadJson.detail_edges,
    cadJson.markEdges,
    cadJson.mark_edges,
  ));
  const meshBox = flatPositions.length ? boxFromPositions(flatPositions) : null;
  const fallbackBox =
    meshBox ||
    boxFromPositions(cutEdgePositions) ||
    boundsToBox(cadJson.bounds);
  const flatSize = fallbackBox?.getSize(new THREE.Vector3()) || new THREE.Vector3();
  const reportedThickness = finiteNumber(cadJson.thickness);
  const edgeOnFlat = flatLooksEdgeOn(
    { length: flatSize.x, width: flatSize.y },
    reportedThickness,
  );

  if (!isDxf && edgeOnFlat) {
    const faceMeshData = buildFlatDataFromFaceMeshes(cadJson);
    if (faceMeshData) {
      faceMeshData.bendPositions = bendPositions;
      faceMeshData.detailPositions = detailEdgePositions;
      return faceMeshData;
    }
  }

  const isRolledPanel = analysisEngine === 'rolled_panel_unroll';
  const dxfContours = isDxf ? selectContours(cadJson) : [];

  if (isDxf && dxfContours.length > 0) {
    const dxfData = buildFlatDataFromDxf(
      cadJson,
      dxfContours,
      cutEdgePositions,
      flatPositions,
      detailEdgePositions,
    );
    if (dxfData) return dxfData;
  }

  const contourData = buildFlatDataFromContours(
    cadJson,
    bendPositions,
    cutEdgePositions,
    flatPositions,
    detailEdgePositions,
  );
  if (contourData) {
    return contourData;
  }

  let cutPositions = cutEdgePositions;
  let hasFilledFace = false;
  if (flatPositions.length) {
    hasFilledFace = true;
    // Rolled panels ship crisp, continuous line work straight from the model
    // edges (outline + holes + engraved graphic). Re-deriving cut lines from the
    // developed triangle mesh would shatter thin engraving grooves into floating
    // arcs, so for those trust the backend cut edges as-is.
    if (!isRolledPanel) {
      try {
        const indexedGeometry = mergeVertices(geometry, 0.001);
        indexedGeometry.computeVertexNormals();
        const boundaryGeometry = new THREE.EdgesGeometry(indexedGeometry, 1);
        const boundaryAttr = boundaryGeometry.getAttribute('position');
        const boundaryPositions = boundaryAttr ? Array.from(boundaryAttr.array) : [];
        boundaryGeometry.dispose();
        if (boundaryPositions.length >= 6) cutPositions = boundaryPositions;
        indexedGeometry.dispose();
      } catch {
        // Keep backend cut edges when mesh boundary extraction cannot run.
      }
    }
  }

  const bounds =
    meshBox ||
    boxFromPositions(cutPositions) ||
    boxFromPositions(detailEdgePositions) ||
    fallbackBox ||
    boxFromPositions(bendPositions);
  return {
    geometry,
    cutPositions,
    detailPositions: detailEdgePositions,
    bendPositions,
    bounds,
    hasFilledFace,
  };
}

export function flatDataHasGeometry(flatData) {
  return Boolean(
    flatData?.hasFilledFace ||
    flatData?.geometry ||
    flatData?.partFills?.length ||
    flatData?.cutPositions?.length >= 6 ||
    flatData?.detailPositions?.length >= 6 ||
    flatData?.bendPositions?.length >= 6
  );
}

export function hasFlatPatternGeometry(cadJson) {
  const flatData = buildFlatData(cadJson || {});
  const hasGeometry = flatDataHasGeometry(flatData);
  flatData.geometry?.dispose?.();
  flatData.partFills?.forEach((fill) => fill?.geometry?.dispose?.());
  return hasGeometry;
}

import * as THREE from 'three';

/**
 * Compute the axis-aligned bounding box from a list of Three.js BufferGeometry objects.
 */
export function computeBoundingBox(geometries) {
  const box = new THREE.Box3();
  geometries.forEach((geo) => {
    geo.computeBoundingBox();
    box.union(geo.boundingBox);
  });
  return box;
}

/**
 * Compute a bounding box from a flat array of XYZ positions.
 */
export function computeBoundingBoxFromPositions(positions) {
  const box = new THREE.Box3();

  for (let i = 0; i < positions.length; i += 3) {
    box.expandByPoint(
      new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2])
    );
  }

  return box;
}

/**
 * Convert a Box3 into a plain serializable bounds object.
 */
export function boxToBounds(box) {
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
  };
}

/**
 * Rehydrate a plain bounds object into a Box3 instance.
 */
export function boundsToBox(bounds) {
  if (!bounds?.min || !bounds?.max) {
    return null;
  }

  return new THREE.Box3(
    new THREE.Vector3(bounds.min[0], bounds.min[1], bounds.min[2]),
    new THREE.Vector3(bounds.max[0], bounds.max[1], bounds.max[2])
  );
}

/**
 * Returns dimensions { x, y, z } in model units from a Box3.
 */
export function getDimensions(box) {
  const size = new THREE.Vector3();
  box.getSize(size);
  return { x: size.x, y: size.y, z: size.z };
}

/**
 * Detect the likely sheet metal thickness: the smallest dimension.
 */
export function detectThickness(dims) {
  const vals = [dims.x, dims.y, dims.z];
  return Math.min(...vals);
}

/**
 * Detect the flat face normal axis: axis of smallest dimension.
 */
export function detectFlatAxis(dims) {
  const min = Math.min(dims.x, dims.y, dims.z);
  if (Math.abs(dims.z - min) < 0.001) return 'z';
  if (Math.abs(dims.y - min) < 0.001) return 'y';
  return 'x';
}

/**
 * Estimate whether a part is a flat/sheet metal piece.
 * True if the thinnest dimension is < 20% of the largest.
 */
export function isFlatPart(dims) {
  const thickness = detectThickness(dims);
  const maxDim = Math.max(dims.x, dims.y, dims.z);
  return maxDim > 0 && thickness / maxDim < 0.2;
}

/**
 * Compute surface area of a BufferGeometry (sum of triangle areas).
 */
export function computeSurfaceArea(geometry) {
  const pos = geometry.attributes.position;
  const idx = geometry.index ? geometry.index.array : null;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const cross = new THREE.Vector3();
  let area = 0;

  const triCount = idx ? idx.length / 3 : pos.count / 3;
  for (let i = 0; i < triCount; i++) {
    const i0 = idx ? idx[i * 3] : i * 3;
    const i1 = idx ? idx[i * 3 + 1] : i * 3 + 1;
    const i2 = idx ? idx[i * 3 + 2] : i * 3 + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    cross.crossVectors(b.clone().sub(a), c.clone().sub(a));
    area += cross.length() * 0.5;
  }
  return area;
}

/**
 * Compute total surface area across all geometries.
 */
export function computeTotalSurfaceArea(geometries) {
  return geometries.reduce((sum, geo) => sum + computeSurfaceArea(geo), 0);
}

/**
 * Format a millimeter value for display.
 */
export function formatMM(value) {
  return value < 0.01 ? '< 0.01' : value.toFixed(2);
}

/**
 * Convert mm² to cm².
 */
export function mmSqToCmSq(mmSq) {
  return mmSq / 100;
}

/**
 * Classify edges of a BufferGeometry into cut lines and bend lines.
 *
 * Strategy:
 *  - Boundary edges (only 1 adjacent triangle)  → cut lines (solid)
 *  - Edges shared by a "flat" face (normal ∥ thin axis) and a "side" face
 *    (normal ⊥ thin axis)                         → bend lines (dashed)
 *  - Other sharp interior edges (dihedral > 30°) → also cut lines
 *
 * Returns { cutPts, bendPts } — flat Float32 arrays of XYZ pairs ready
 * to be fed into THREE.BufferGeometry position attributes.
 */
export function classifyEdgesForFlatView(geometry) {
  const pos = geometry.attributes.position;
  const idx = geometry.index ? geometry.index.array : null;
  const triCount = idx ? idx.length / 3 : pos.count / 3;
  if (triCount === 0) return { cutPts: [], bendPts: [] };

  // --- detect flat axis (index of thinnest dimension) ---
  geometry.computeBoundingBox();
  const sz = new THREE.Vector3();
  geometry.boundingBox.getSize(sz);
  const mn = Math.min(sz.x, sz.y, sz.z);
  let axisIdx = 2;
  if (Math.abs(sz.x - mn) <= Math.abs(sz.y - mn) && Math.abs(sz.x - mn) <= Math.abs(sz.z - mn)) axisIdx = 0;
  else if (Math.abs(sz.y - mn) <= Math.abs(sz.z - mn)) axisIdx = 1;
  const flatDir = new THREE.Vector3();
  flatDir.setComponent(axisIdx, 1.0);

  // --- per-triangle face normals (computed from vertex positions, not vertex normals) ---
  const faceNormals = new Array(triCount);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
  const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx[t * 3]     : t * 3;
    const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
    const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
    _a.fromBufferAttribute(pos, i0);
    _b.fromBufferAttribute(pos, i1);
    _c.fromBufferAttribute(pos, i2);
    _e1.subVectors(_b, _a);
    _e2.subVectors(_c, _a);
    faceNormals[t] = new THREE.Vector3().crossVectors(_e1, _e2).normalize();
  }

  // --- build edge → triangle list map ---
  const edgeMap = new Map();
  const eKey = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx[t * 3]     : t * 3;
    const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
    const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
    for (const [va, vb] of [[i0, i1], [i1, i2], [i2, i0]]) {
      const k = eKey(va, vb);
      if (!edgeMap.has(k)) edgeMap.set(k, { va, vb, tris: [] });
      edgeMap.get(k).tris.push(t);
    }
  }

  // --- classify ---
  const cutPts  = [];
  const bendPts = [];
  const pa = new THREE.Vector3(), pb = new THREE.Vector3();

  for (const e of edgeMap.values()) {
    pa.fromBufferAttribute(pos, e.va);
    pb.fromBufferAttribute(pos, e.vb);

    if (e.tris.length === 1) {
      // boundary → cut line
      cutPts.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
    } else if (e.tris.length === 2) {
      const n0 = faceNormals[e.tris[0]];
      const n1 = faceNormals[e.tris[1]];
      const cosA    = Math.max(-1, Math.min(1, n0.dot(n1)));
      const angleDeg = THREE.MathUtils.radToDeg(Math.acos(cosA));

      if (angleDeg > 20) {
        const dot0 = Math.abs(n0.dot(flatDir));
        const dot1 = Math.abs(n1.dot(flatDir));
        const isBend =
          (dot0 > 0.65 && dot1 < 0.35) ||   // flat face ↔ side face
          (dot0 < 0.35 && dot1 > 0.65);
        if (isBend) {
          bendPts.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
        } else if (angleDeg > 30) {
          // other sharp interior edge → treat as cut
          cutPts.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
        }
      }
    }
  }

  return { cutPts, bendPts };
}

/**
 * Unfold a 3D sheet metal part into a flat pattern.
 *
 * Returns { geometry, cutPts, bendPts }
 */
export function unfoldSheetMetal(geometries) {
  // ── 1. Merge into non-indexed triangle soup ──
  const allVerts = [];
  geometries.forEach((geo) => {
    const ni = geo.index ? geo.toNonIndexed() : geo.clone();
    const p = ni.attributes.position.array;
    for (let i = 0; i < p.length; i++) allVerts.push(p[i]);
  });
  const triCount = allVerts.length / 9;
  if (triCount === 0) return { geometry: new THREE.BufferGeometry(), cutPts: [], bendPts: [] };

  // ── 2. Face normals & areas ──
  const normals = new Array(triCount);
  const areas   = new Array(triCount);
  const vAt = (ti, vi) => {
    const o = ti * 9 + vi * 3;
    return new THREE.Vector3(allVerts[o], allVerts[o + 1], allVerts[o + 2]);
  };
  for (let t = 0; t < triCount; t++) {
    const a = vAt(t, 0), b = vAt(t, 1), c = vAt(t, 2);
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    areas[t] = n.length() * 0.5;
    normals[t] = n.normalize();
  }

  // ── 3. Flat axis ──
  const box = new THREE.Box3();
  for (let i = 0; i < allVerts.length; i += 3)
    box.expandByPoint(new THREE.Vector3(allVerts[i], allVerts[i + 1], allVerts[i + 2]));
  const sz = new THREE.Vector3(); box.getSize(sz);
  const mn = Math.min(sz.x, sz.y, sz.z);
  let axIdx = 2;
  if (Math.abs(sz.x - mn) <= Math.abs(sz.y - mn) && Math.abs(sz.x - mn) <= Math.abs(sz.z - mn)) axIdx = 0;
  else if (Math.abs(sz.y - mn) <= Math.abs(sz.z - mn)) axIdx = 1;
  const flatDir = new THREE.Vector3(); flatDir.setComponent(axIdx, 1);

  // ── 4. Edge adjacency (position-based keys) — store vertex OFFSETS ──
  const PREC = 1e3; // lower precision to tolerate floating-point drift after rotations
  const vKey = (ti, vi) => {
    const o = ti * 9 + vi * 3;
    return `${Math.round(allVerts[o] * PREC)},${Math.round(allVerts[o + 1] * PREC)},${Math.round(allVerts[o + 2] * PREC)}`;
  };
  const edgeMap = new Map();
  const eKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (let t = 0; t < triCount; t++) {
    const k0 = vKey(t, 0), k1 = vKey(t, 1), k2 = vKey(t, 2);
    for (const [ka, kb, via, vib] of [[k0, k1, 0, 1], [k1, k2, 1, 2], [k2, k0, 2, 0]]) {
      const ek = eKey(ka, kb);
      if (!edgeMap.has(ek)) edgeMap.set(ek, { tris: [], offA: t * 9 + via * 3, offB: t * 9 + vib * 3 });
      edgeMap.get(ek).tris.push(t);
    }
  }

  // ── 5. Triangle adjacency & face regions (flood-fill, ~20° tolerance) ──
  const triAdj = Array.from({ length: triCount }, () => []);
  for (const e of edgeMap.values()) {
    for (let i = 0; i < e.tris.length; i++)
      for (let j = i + 1; j < e.tris.length; j++) {
        triAdj[e.tris[i]].push(e.tris[j]);
        triAdj[e.tris[j]].push(e.tris[i]);
      }
  }
  const regionOf = new Int32Array(triCount).fill(-1);
  let regionCount = 0;
  const regionNormals = [];
  const regionAreas = [];
  for (let t = 0; t < triCount; t++) {
    if (regionOf[t] >= 0) continue;
    const rid = regionCount++;
    const q = [t]; regionOf[t] = rid;
    let rn = normals[t].clone(), ra = areas[t];
    while (q.length) {
      const cur = q.pop();
      for (const nb of triAdj[cur]) {
        if (regionOf[nb] >= 0) continue;
        if (Math.abs(normals[nb].dot(normals[cur])) > 0.94) { // ~20°
          regionOf[nb] = rid; rn.add(normals[nb]); ra += areas[nb]; q.push(nb);
        }
      }
    }
    regionNormals.push(rn.normalize());
    regionAreas.push(ra);
  }

  // ── 6. Region adjacency — store vertex offsets for live position lookup ──
  const regAdj = new Map();
  for (const e of edgeMap.values()) {
    if (e.tris.length < 2) continue;
    for (let i = 0; i < e.tris.length; i++)
      for (let j = i + 1; j < e.tris.length; j++) {
        const rA = regionOf[e.tris[i]], rB = regionOf[e.tris[j]];
        if (rA === rB) continue;
        const rk = rA < rB ? `${rA},${rB}` : `${rB},${rA}`;
        if (!regAdj.has(rk)) regAdj.set(rk, []);
        regAdj.get(rk).push({ offA: e.offA, offB: e.offB });
      }
  }

  // ── 7. Seed region — largest flat-aligned ──
  let seedRegion = 0, bestScore = -1;
  for (let r = 0; r < regionCount; r++) {
    const score = Math.abs(regionNormals[r].dot(flatDir)) * regionAreas[r];
    if (score > bestScore) { bestScore = score; seedRegion = r; }
  }

  // ── 8. BFS unfold — read CURRENT vertex positions for pivot/axis ──
  const visited = new Uint8Array(regionCount);
  visited[seedRegion] = 1;
  const bfsQ = [seedRegion];
  const curNormals = regionNormals.map(n => n.clone());
  const bendRegionPairs = new Set();

  // Per-region neighbor list
  const regionNbs = Array.from({ length: regionCount }, () => []);
  for (const rk of regAdj.keys()) {
    const [a, b] = rk.split(',').map(Number);
    regionNbs[a].push(b); regionNbs[b].push(a);
  }

  // Helper: compute centroid of all vertices in a region
  const regionCentroid = (rid) => {
    let cx = 0, cy = 0, cz = 0, cnt = 0;
    for (let t = 0; t < triCount; t++) {
      if (regionOf[t] !== rid) continue;
      for (let vi = 0; vi < 3; vi++) {
        const o = t * 9 + vi * 3;
        cx += allVerts[o]; cy += allVerts[o + 1]; cz += allVerts[o + 2];
      }
      cnt += 3;
    }
    return cnt ? new THREE.Vector3(cx / cnt, cy / cnt, cz / cnt) : new THREE.Vector3();
  };

  // Helper: apply quaternion rotation to all vertices of a region around a pivot
  const rotateRegion = (rid, quat, pivot) => {
    for (let t = 0; t < triCount; t++) {
      if (regionOf[t] !== rid) continue;
      for (let vi = 0; vi < 3; vi++) {
        const o = t * 9 + vi * 3;
        const pt = new THREE.Vector3(allVerts[o], allVerts[o + 1], allVerts[o + 2]);
        pt.sub(pivot).applyQuaternion(quat).add(pivot);
        allVerts[o] = pt.x; allVerts[o + 1] = pt.y; allVerts[o + 2] = pt.z;
      }
      normals[t].applyQuaternion(quat);
    }
  };

  while (bfsQ.length) {
    const curR = bfsQ.shift();
    for (const neighbor of regionNbs[curR]) {
      if (visited[neighbor]) continue;
      visited[neighbor] = 1;
      bfsQ.push(neighbor);

      const rk = curR < neighbor ? `${curR},${neighbor}` : `${neighbor},${curR}`;
      const edges = regAdj.get(rk);
      if (!edges || !edges.length) continue;

      const nCur = curNormals[curR], nNb = curNormals[neighbor];
      const angle = Math.acos(Math.max(-1, Math.min(1, nCur.dot(nNb))));
      if (angle < 0.05) continue; // ~3° — already coplanar

      bendRegionPairs.add(rk);

      // Axis & pivot from CURRENT allVerts positions
      let axisDir = new THREE.Vector3();
      for (const e of edges) {
        const a = new THREE.Vector3(allVerts[e.offA], allVerts[e.offA + 1], allVerts[e.offA + 2]);
        const b = new THREE.Vector3(allVerts[e.offB], allVerts[e.offB + 1], allVerts[e.offB + 2]);
        axisDir.add(b.clone().sub(a));
      }
      axisDir.normalize();
      const pivot = new THREE.Vector3(allVerts[edges[0].offA], allVerts[edges[0].offA + 1], allVerts[edges[0].offA + 2]);

      // Projected normals → rotation angle
      const nCP = nCur.clone().sub(axisDir.clone().multiplyScalar(nCur.dot(axisDir))).normalize();
      const nNP = nNb.clone().sub(axisDir.clone().multiplyScalar(nNb.dot(axisDir))).normalize();
      let phi = Math.acos(Math.max(-1, Math.min(1, nCP.dot(nNP))));
      if (new THREE.Vector3().crossVectors(nNP, nCP).dot(axisDir) < 0) phi = -phi;

      // Save pre-rotation state for overlap check
      const centCur = regionCentroid(curR);
      const centNbBefore = regionCentroid(neighbor);
      const distBefore = centNbBefore.distanceTo(centCur);

      // Apply rotation
      const quat = new THREE.Quaternion().setFromAxisAngle(axisDir, phi);
      rotateRegion(neighbor, quat, pivot);
      curNormals[neighbor].applyQuaternion(quat);

      // Overlap check: centroid should move AWAY from curR, not toward it
      const centNbAfter = regionCentroid(neighbor);
      const distAfter = centNbAfter.distanceTo(centCur);

      if (distAfter < distBefore * 0.8) {
        // Undo this rotation
        const quatInv = quat.clone().invert();
        rotateRegion(neighbor, quatInv, pivot);
        curNormals[neighbor].applyQuaternion(quatInv);

        // Apply opposite rotation (flip sign of phi)
        const quatFlip = new THREE.Quaternion().setFromAxisAngle(axisDir, -phi);
        rotateRegion(neighbor, quatFlip, pivot);
        curNormals[neighbor].applyQuaternion(quatFlip);
      }
    }
  }

  // ── 9. Post-unfold: recompute normals from current positions ──
  for (let t = 0; t < triCount; t++) {
    const a = vAt(t, 0), b = vAt(t, 1), c = vAt(t, 2);
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    normals[t] = n.normalize();
  }

  // ── 10. Filter: keep only flat-facing triangles (within ~45° of flat axis) ──
  const keepTri = new Uint8Array(triCount);
  for (let t = 0; t < triCount; t++) {
    if (Math.abs(normals[t].dot(flatDir)) > 0.55) keepTri[t] = 1; // cos(~56°)
  }

  // Build filtered vertex array
  const filtVerts = [];
  const filtTriMap = []; // original tri index for each filtered tri
  for (let t = 0; t < triCount; t++) {
    if (!keepTri[t]) continue;
    const o = t * 9;
    for (let i = 0; i < 9; i++) filtVerts.push(allVerts[o + i]);
    filtTriMap.push(t);
  }
  const filtTriCount = filtTriMap.length;

  const outGeo = new THREE.BufferGeometry();
  outGeo.setAttribute('position', new THREE.Float32BufferAttribute(filtVerts, 3));
  outGeo.computeVertexNormals();

  // ── 11. Classify edges on filtered mesh ──
  const cutPts = [], bendPts = [];
  const vKeyFilt = (fi, vi) => {
    const o = fi * 9 + vi * 3;
    return `${Math.round(filtVerts[o] * PREC)},${Math.round(filtVerts[o + 1] * PREC)},${Math.round(filtVerts[o + 2] * PREC)}`;
  };
  const edgeMap2 = new Map();
  for (let fi = 0; fi < filtTriCount; fi++) {
    const k0 = vKeyFilt(fi, 0), k1 = vKeyFilt(fi, 1), k2 = vKeyFilt(fi, 2);
    for (const [ka, kb, via, vib] of [[k0, k1, 0, 1], [k1, k2, 1, 2], [k2, k0, 2, 0]]) {
      const ek = eKey(ka, kb);
      if (!edgeMap2.has(ek)) {
        const o1 = fi * 9 + via * 3, o2 = fi * 9 + vib * 3;
        edgeMap2.set(ek, { filtTris: [], ax: filtVerts[o1], ay: filtVerts[o1 + 1], az: filtVerts[o1 + 2],
                                          bx: filtVerts[o2], by: filtVerts[o2 + 1], bz: filtVerts[o2 + 2] });
      }
      edgeMap2.get(ek).filtTris.push(fi);
    }
  }

  // Collect bend segments per region pair → merge into clean single lines
  const bendByPair = new Map();
  for (const e of edgeMap2.values()) {
    if (e.filtTris.length === 1) {
      // Boundary of filtered geometry → cut line
      cutPts.push(e.ax, e.ay, e.az, e.bx, e.by, e.bz);
    } else if (e.filtTris.length >= 2) {
      // Check if the two filtered tris come from different original regions
      const r0 = regionOf[filtTriMap[e.filtTris[0]]];
      const r1 = regionOf[filtTriMap[e.filtTris[1]]];
      if (r0 !== r1) {
        const rk = r0 < r1 ? `${r0},${r1}` : `${r1},${r0}`;
        if (bendRegionPairs.has(rk)) {
          if (!bendByPair.has(rk)) bendByPair.set(rk, []);
          bendByPair.get(rk).push(e);
        }
      }
    }
  }

  // Merge each bend's tiny segments into one clean line (farthest-apart endpoints)
  for (const segs of bendByPair.values()) {
    const pts = new Map();
    for (const s of segs) {
      const kA = `${Math.round(s.ax * PREC)},${Math.round(s.ay * PREC)},${Math.round(s.az * PREC)}`;
      const kB = `${Math.round(s.bx * PREC)},${Math.round(s.by * PREC)},${Math.round(s.bz * PREC)}`;
      if (!pts.has(kA)) pts.set(kA, new THREE.Vector3(s.ax, s.ay, s.az));
      if (!pts.has(kB)) pts.set(kB, new THREE.Vector3(s.bx, s.by, s.bz));
    }
    const arr = [...pts.values()];
    if (arr.length < 2) continue;
    let maxD = 0, p1 = arr[0], p2 = arr[1];
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++) {
        const d = arr[i].distanceToSquared(arr[j]);
        if (d > maxD) { maxD = d; p1 = arr[i]; p2 = arr[j]; }
      }
    bendPts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
  }

  return { geometry: outGeo, cutPts, bendPts };
}

/**
 * Get the camera direction for viewing the flat face from above.
 * Returns { position, target, up } relative to the model.
 */
export function getFlatViewCamera(box, dims) {
  const center = new THREE.Vector3();
  box.getCenter(center);
  const axis = detectFlatAxis(dims);
  const offset = Math.max(dims.x, dims.y, dims.z) * 2.5;

  if (axis === 'z') {
    return {
      position: new THREE.Vector3(center.x, center.y, center.z + offset),
      target: center.clone(),
      up: new THREE.Vector3(0, 1, 0),
    };
  } else if (axis === 'y') {
    return {
      position: new THREE.Vector3(center.x, center.y + offset, center.z),
      target: center.clone(),
      up: new THREE.Vector3(0, 0, 1),
    };
  } else {
    return {
      position: new THREE.Vector3(center.x + offset, center.y, center.z),
      target: center.clone(),
      up: new THREE.Vector3(0, 1, 0),
    };
  }
}

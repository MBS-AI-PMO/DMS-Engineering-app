import { parseString, toSVG } from 'dxf';

export function calcDxfTechData(entities, isInch) {
  const toMm = v => isInch ? v * 25.4 : v;
  let totalPerimeter = 0;
  let pierceCount = 0;

  for (const e of entities || []) {
    if (e.type === 'LINE') {
      const dx = (e.end?.x || 0) - (e.start?.x || 0);
      const dy = (e.end?.y || 0) - (e.start?.y || 0);
      totalPerimeter += toMm(Math.sqrt(dx * dx + dy * dy));
    } else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
      const verts = e.vertices || [];
      for (let i = 0; i < verts.length - 1; i++) {
        const dx = verts[i + 1].x - verts[i].x;
        const dy = verts[i + 1].y - verts[i].y;
        totalPerimeter += toMm(Math.sqrt(dx * dx + dy * dy));
      }
      const isClosed = e.closed || (e.flag & 1);
      if (isClosed && verts.length > 1) {
        const dx = verts[0].x - verts[verts.length - 1].x;
        const dy = verts[0].y - verts[verts.length - 1].y;
        totalPerimeter += toMm(Math.sqrt(dx * dx + dy * dy));
        pierceCount++;
      }
    } else if (e.type === 'ARC') {
      let startDeg = e.startAngle || 0;
      let endDeg = e.endAngle || 0;
      if (endDeg <= startDeg) endDeg += 360;
      totalPerimeter += toMm((e.r || 0) * (endDeg - startDeg) * Math.PI / 180);
    } else if (e.type === 'CIRCLE') {
      totalPerimeter += toMm(2 * Math.PI * (e.r || 0));
      pierceCount++;
    } else if (e.type === 'SPLINE') {
      const pts = e.controlPoints || e.fitPoints || [];
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x;
        const dy = pts[i + 1].y - pts[i].y;
        totalPerimeter += toMm(Math.sqrt(dx * dx + dy * dy));
      }
    }
  }

  return { totalPerimeter, pierceCount: Math.max(1, pierceCount) };
}

export function flattenDxfEntities(parsed) {
  const allEntities = [];
  const flatten = (entities, transform = { x: 0, y: 0, scale: 1 }) => {
    (entities || []).forEach(e => {
      if (e.type === 'INSERT') {
        const block = parsed.blocks?.[e.name];
        if (block?.entities) {
          flatten(block.entities, {
            x: transform.x + e.position.x,
            y: transform.y + e.position.y,
            scale: transform.scale * (e.scale?.x || 1)
          });
        }
      } else {
        const cloned = JSON.parse(JSON.stringify(e));
        if (cloned.position) {
          cloned.position.x = transform.x + cloned.position.x * transform.scale;
          cloned.position.y = transform.y + cloned.position.y * transform.scale;
        }
        if (cloned.center) {
          cloned.center.x = transform.x + cloned.center.x * transform.scale;
          cloned.center.y = transform.y + cloned.center.y * transform.scale;
        }
        if (cloned.r) cloned.r *= transform.scale;
        if (cloned.vertices) {
          cloned.vertices.forEach(v => {
            v.x = transform.x + v.x * transform.scale;
            v.y = transform.y + v.y * transform.scale;
          });
        }
        allEntities.push(cloned);
      }
    });
  };

  flatten(parsed.entities || []);
  return allEntities;
}

export function detectDxfHoles(entities, isInch) {
  return (entities || [])
    .filter(e => {
      if (e.type === 'CIRCLE') return true;
      if (e.type === 'LWPOLYLINE') {
        const isClosed = e.shape || e.closed || (e.vertices?.length > 2 && Math.abs(e.vertices[0].x - e.vertices[e.vertices.length - 1].x) < 0.01);
        if (!isClosed) return false;
        let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
        e.vertices.forEach(v => {
          minX = Math.min(minX, v.x);
          maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y);
          maxY = Math.max(maxY, v.y);
        });
        const w = maxX - minX;
        const h = maxY - minY;
        return w > 0.1 && h > 0.1 && Math.abs(w / h - 1) < 0.2 && w < 150;
      }
      return false;
    })
    .map((c, i) => {
      let diam = 0, x = 0, y = 0;
      if (c.type === 'CIRCLE') {
        diam = isInch ? c.r * 2 * 25.4 : c.r * 2;
        x = c.center.x;
        y = c.center.y;
      } else {
        let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
        c.vertices.forEach(v => {
          minX = Math.min(minX, v.x);
          maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y);
          maxY = Math.max(maxY, v.y);
        });
        diam = isInch ? (maxX - minX) * 25.4 : (maxX - minX);
        x = (minX + maxX) / 2;
        y = (minY + maxY) / 2;
      }
      return { id: i, diameterInches: diam / 25.4, diameter_mm: diam, position: [x, y, 0], axis: [0, 0, 1] };
    });
}

export async function analyzeDxfFile(file) {
  const text = await file.text();
  const parsed = parseString(text);
  const svg = toSVG(parsed);
  const header = parsed.header || {};
  const isInch = header.$INSUNITS === 1;
  const toMm = v => isInch ? v * 25.4 : v;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  (parsed.entities || []).forEach(e => {
    const check = (x, y) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };
    if (e.start) check(e.start.x, e.start.y);
    if (e.end) check(e.end.x, e.end.y);
    if (e.center) {
      check(e.center.x - e.r, e.center.y - e.r);
      check(e.center.x + e.r, e.center.y + e.r);
    }
    if (e.vertices) e.vertices.forEach(v => check(v.x, v.y));
  });

  const w = maxX - minX;
  const h = maxY - minY;
  const dimensions = {
    mm: { l: toMm(w).toFixed(2), w: toMm(h).toFixed(2), t: '0.000', volume: '0' },
    inches: { l: (toMm(w) / 25.4).toFixed(3), w: (toMm(h) / 25.4).toFixed(3), t: '0.000', volume: '0' },
    isNativeInches: isInch
  };

  const entities = flattenDxfEntities(parsed);
  return {
    svg,
    dimensions,
    viewBoxData: { minX, minY, width: w, height: h, isNativeInches: isInch },
    techData: calcDxfTechData(entities, isInch),
    holes: detectDxfHoles(entities, isInch)
  };
}

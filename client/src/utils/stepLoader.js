import * as THREE from 'three';
import {
  boxToBounds,
  computeBoundingBox,
  computeBoundingBoxFromPositions,
  computeTotalSurfaceArea,
  getDimensions,
} from './geometryUtils.js';
import { getFormatConfig, getSupportedFormatLabels } from './fileFormats.js';

let occtInstance = null;
let initPromise = null;

const Z_AXIS = new THREE.Vector3(0, 0, 1);

function createTransform(
  position = new THREE.Vector3(),
  scale = new THREE.Vector3(1, 1, 1),
  rotation = 0
) {
  return { position, scale, rotation };
}

function clonePoint(point = {}) {
  return new THREE.Vector3(point.x ?? 0, point.y ?? 0, point.z ?? 0);
}

function normalizeSweep(startAngle, endAngle, fallbackSweep) {
  if (Number.isFinite(fallbackSweep) && Math.abs(fallbackSweep) > 1e-6) {
    return fallbackSweep;
  }

  let sweep = (endAngle ?? startAngle + Math.PI * 2) - startAngle;
  if (sweep <= 0) {
    sweep += Math.PI * 2;
  }
  return sweep;
}

function getCurveStepCount(sweep, minimum = 12) {
  return Math.max(minimum, Math.ceil(Math.abs(sweep) / (Math.PI / 18)));
}

function appendSegment(target, box, start, end) {
  target.push(start.x, start.y, start.z, end.x, end.y, end.z);
  box.expandByPoint(start);
  box.expandByPoint(end);
}

function applyTransform(point, transform) {
  const scaled = point.clone().multiply(transform.scale);
  scaled.applyAxisAngle(Z_AXIS, transform.rotation);
  return scaled.add(transform.position);
}

function composeTransform(parent, child) {
  const position = child.position
    .clone()
    .multiply(parent.scale)
    .applyAxisAngle(Z_AXIS, parent.rotation)
    .add(parent.position);

  return createTransform(
    position,
    parent.scale.clone().multiply(child.scale),
    parent.rotation + child.rotation
  );
}

function buildResult(formatInfo, payload) {
  const geometries = payload.geometries ?? [];
  const colors = payload.colors ?? [];
  const sourceFlatData = payload.sourceFlatData ?? null;

  let box = payload.box ?? null;
  if (!box) {
    if (geometries.length) {
      box = computeBoundingBox(geometries);
    } else if (sourceFlatData?.cutPts?.length) {
      box = computeBoundingBoxFromPositions(sourceFlatData.cutPts);
    }
  }

  if (!box || box.isEmpty()) {
    throw new Error(`No geometry found in the ${formatInfo.label} file.`);
  }

  return {
    formatInfo,
    geometries,
    colors,
    sourceFlatData,
    dims: getDimensions(box),
    area: geometries.length ? computeTotalSurfaceArea(geometries) : null,
  };
}

/**
 * Lazily initialize the occt-import-js WASM module.
 */
async function getOcct() {
  if (occtInstance) {
    return occtInstance;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const mod = await import('occt-import-js');
    const OcctImportJs =
      typeof mod.default === 'function'
        ? mod.default
        : typeof mod.default?.default === 'function'
        ? mod.default.default
        : typeof mod === 'function'
        ? mod
        : null;

    if (typeof OcctImportJs !== 'function') {
      throw new Error(
        `occt-import-js did not export a constructor. Got: ${typeof mod.default}`
      );
    }

    occtInstance = await OcctImportJs({
      locateFile: (name) => (name.endsWith('.wasm') ? `/${name}` : name),
    });

    return occtInstance;
  })();

  return initPromise;
}

function convertOcctMeshes(meshes) {
  const geometries = [];
  const colors = [];

  for (const mesh of meshes) {
    const geometry = new THREE.BufferGeometry();

    if (mesh.attributes?.position?.array) {
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(mesh.attributes.position.array), 3)
      );
    }

    if (mesh.attributes?.normal?.array) {
      geometry.setAttribute(
        'normal',
        new THREE.BufferAttribute(new Float32Array(mesh.attributes.normal.array), 3)
      );
    }

    if (mesh.index?.array) {
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(mesh.index.array), 1));
    }

    if (!geometry.getAttribute('normal')) {
      geometry.computeVertexNormals();
    }

    geometry.computeBoundingBox();
    geometries.push(geometry);

    if (mesh.color && mesh.color.length >= 3) {
      colors.push(new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2]));
    } else {
      colors.push(new THREE.Color(0x8fa0b0));
    }
  }

  return { geometries, colors };
}

async function parseOcctCadFile(arrayBuffer, readMethod, formatInfo) {
  const occt = await getOcct();
  const fileBuffer = new Uint8Array(arrayBuffer);
  const result = occt[readMethod](fileBuffer, null);

  if (!result.success) {
    throw new Error(`Failed to parse ${formatInfo.label} file.`);
  }

  if (!result.meshes?.length) {
    throw new Error(`No geometry found in the ${formatInfo.label} file.`);
  }

  return buildResult(formatInfo, convertOcctMeshes(result.meshes));
}

async function parseStlFile(arrayBuffer, formatInfo) {
  const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
  const loader = new STLLoader();
  const geometry = loader.parse(arrayBuffer);

  if (!geometry.getAttribute('normal')) {
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingBox();

  return buildResult(formatInfo, {
    geometries: [geometry],
    colors: [new THREE.Color(0x8fa0b0)],
  });
}

async function parsePlyFile(arrayBuffer, formatInfo) {
  const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
  const loader = new PLYLoader();
  const geometry = loader.parse(arrayBuffer);

  if (!geometry.getAttribute('normal')) {
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingBox();

  return buildResult(formatInfo, {
    geometries: [geometry],
    colors: [new THREE.Color(0xffffff)],
  });
}

async function parseObjFile(arrayBuffer, formatInfo) {
  const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
  const loader = new OBJLoader();
  const text = new TextDecoder().decode(arrayBuffer);
  const object = loader.parse(text);

  const geometries = [];
  const colors = [];

  object.updateMatrixWorld(true);
  object.traverse((child) => {
    if (!child.isMesh || !child.geometry) {
      return;
    }

    const geometry = child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);

    if (!geometry.getAttribute('normal')) {
      geometry.computeVertexNormals();
    }

    geometry.computeBoundingBox();
    geometries.push(geometry);

    const material = Array.isArray(child.material) ? child.material[0] : child.material;
    colors.push(material?.color?.clone?.() ?? new THREE.Color(0x8fa0b0));
  });

  if (!geometries.length) {
    throw new Error('No mesh geometry found in the OBJ file.');
  }

  return buildResult(formatInfo, { geometries, colors });
}

function appendArcSegments(target, box, center, radius, startAngle, sweep, transform) {
  const stepCount = getCurveStepCount(sweep);

  for (let step = 0; step < stepCount; step += 1) {
    const t0 = step / stepCount;
    const t1 = (step + 1) / stepCount;
    const angle0 = startAngle + sweep * t0;
    const angle1 = startAngle + sweep * t1;
    const start = applyTransform(
      new THREE.Vector3(
        center.x + Math.cos(angle0) * radius,
        center.y + Math.sin(angle0) * radius,
        center.z
      ),
      transform
    );
    const end = applyTransform(
      new THREE.Vector3(
        center.x + Math.cos(angle1) * radius,
        center.y + Math.sin(angle1) * radius,
        center.z
      ),
      transform
    );
    appendSegment(target, box, start, end);
  }
}

function appendEllipseSegments(target, box, entity, transform) {
  const center = clonePoint(entity.center);
  const majorAxis = clonePoint(entity.majorAxisEndPoint);
  const majorLength = majorAxis.length();

  if (!majorLength) {
    return;
  }

  const majorDir = majorAxis.clone().normalize();
  const minorDir = new THREE.Vector3(-majorDir.y, majorDir.x, majorDir.z).normalize();
  const minorLength = majorLength * (entity.axisRatio ?? 1);
  const startAngle = entity.startAngle ?? 0;
  const sweep = normalizeSweep(startAngle, entity.endAngle, entity.endAngle - startAngle);
  const stepCount = getCurveStepCount(sweep);

  for (let step = 0; step < stepCount; step += 1) {
    const t0 = startAngle + (sweep * step) / stepCount;
    const t1 = startAngle + (sweep * (step + 1)) / stepCount;
    const start = center
      .clone()
      .add(majorDir.clone().multiplyScalar(Math.cos(t0) * majorLength))
      .add(minorDir.clone().multiplyScalar(Math.sin(t0) * minorLength));
    const end = center
      .clone()
      .add(majorDir.clone().multiplyScalar(Math.cos(t1) * majorLength))
      .add(minorDir.clone().multiplyScalar(Math.sin(t1) * minorLength));

    appendSegment(target, box, applyTransform(start, transform), applyTransform(end, transform));
  }
}

function appendBulgeSegments(target, box, startVertex, endVertex, bulge, transform) {
  const start = clonePoint(startVertex);
  const end = clonePoint(endVertex);
  const chord = end.clone().sub(start);
  const chordLength = chord.length();

  if (!bulge || chordLength < 1e-6) {
    appendSegment(target, box, applyTransform(start, transform), applyTransform(end, transform));
    return;
  }

  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const leftNormal = new THREE.Vector3(-chord.y, chord.x, 0).normalize();
  const centerOffset = (chordLength * (1 - bulge * bulge)) / (4 * bulge);
  const center = midpoint.clone().add(leftNormal.multiplyScalar(centerOffset));
  const sweep = 4 * Math.atan(bulge);
  const radius = center.distanceTo(start);
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);

  appendArcSegments(target, box, center, radius, startAngle, sweep, transform);
}

function appendPolylineSegments(target, box, vertices, closed, transform) {
  if (!vertices?.length) {
    return;
  }

  const limit = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < limit; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    if (!next) {
      continue;
    }

    if (current.bulge) {
      appendBulgeSegments(target, box, current, next, current.bulge, transform);
      continue;
    }

    appendSegment(
      target,
      box,
      applyTransform(clonePoint(current), transform),
      applyTransform(clonePoint(next), transform)
    );
  }
}

function appendSplineSegments(target, box, entity, transform) {
  const sourcePoints = entity.fitPoints?.length
    ? entity.fitPoints
    : entity.controlPoints?.length
    ? entity.controlPoints
    : [];

  if (sourcePoints.length < 2) {
    return;
  }

  const curve = new THREE.CatmullRomCurve3(
    sourcePoints.map((point) => clonePoint(point)),
    Boolean(entity.closed)
  );
  const divisions = Math.max(24, sourcePoints.length * 12);
  const points = curve.getPoints(divisions);

  appendPolylineSegments(
    target,
    box,
    points.map((point) => ({ x: point.x, y: point.y, z: point.z })),
    Boolean(entity.closed),
    transform
  );
}

function isEntityVisible(document, entity) {
  if (entity.visible === false) {
    return false;
  }

  const layers =
    document.tables?.layer?.layers ??
    document.tables?.layers ??
    document.tables?.LAYER?.layers ??
    {};
  const layerState = entity.layer ? layers[entity.layer] : null;
  return layerState?.visible !== false;
}

function buildInsertTransforms(parentTransform, entity) {
  const baseTransform = createTransform(
    clonePoint(entity.position),
    new THREE.Vector3(entity.xScale ?? 1, entity.yScale ?? 1, entity.zScale ?? 1),
    THREE.MathUtils.degToRad(entity.rotation ?? 0)
  );

  const columnCount = Math.max(1, entity.columnCount ?? 1);
  const rowCount = Math.max(1, entity.rowCount ?? 1);
  const transforms = [];

  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < columnCount; column += 1) {
      const offset = new THREE.Vector3(
        column * (entity.columnSpacing ?? 0),
        row * (entity.rowSpacing ?? 0),
        0
      );

      transforms.push(
        composeTransform(
          parentTransform,
          createTransform(baseTransform.position.clone().add(offset), baseTransform.scale.clone(), baseTransform.rotation)
        )
      );
    }
  }

  return transforms;
}

function appendEntitySegments(document, entity, transform, target, box, depth = 0) {
  if (!entity || !isEntityVisible(document, entity) || depth > 8) {
    return;
  }

  if (entity.type === 'INSERT') {
    const block = document.blocks?.[entity.name];
    if (!block?.entities?.length) {
      return;
    }

    const insertTransforms = buildInsertTransforms(transform, entity);
    for (const instanceTransform of insertTransforms) {
      for (const child of block.entities) {
        appendEntitySegments(document, child, instanceTransform, target, box, depth + 1);
      }
    }
    return;
  }

  switch (entity.type) {
    case 'LINE':
      appendPolylineSegments(target, box, entity.vertices, false, transform);
      break;
    case 'LWPOLYLINE':
    case 'POLYLINE':
      appendPolylineSegments(target, box, entity.vertices, Boolean(entity.shape), transform);
      break;
    case 'CIRCLE':
      appendArcSegments(
        target,
        box,
        clonePoint(entity.center),
        entity.radius,
        entity.startAngle ?? 0,
        Math.PI * 2,
        transform
      );
      break;
    case 'ARC':
      appendArcSegments(
        target,
        box,
        clonePoint(entity.center),
        entity.radius,
        entity.startAngle ?? 0,
        normalizeSweep(entity.startAngle ?? 0, entity.endAngle, entity.angleLength),
        transform
      );
      break;
    case 'ELLIPSE':
      appendEllipseSegments(target, box, entity, transform);
      break;
    case 'SPLINE':
      appendSplineSegments(target, box, entity, transform);
      break;
    case 'SOLID':
    case '3DFACE':
      appendPolylineSegments(target, box, entity.points || entity.vertices, true, transform);
      break;
    default:
      break;
  }
}

async function parseDxfFile(arrayBuffer, formatInfo) {
  const { default: DxfParser } = await import('dxf-parser');
  const parser = new DxfParser();
  const text = new TextDecoder().decode(arrayBuffer);
  const document = parser.parseSync(text);

  if (!document?.entities?.length) {
    throw new Error('No drawing entities found in the DXF file.');
  }

  const cutPts = [];
  const box = new THREE.Box3();
  const rootTransform = createTransform();

  for (const entity of document.entities) {
    appendEntitySegments(document, entity, rootTransform, cutPts, box);
  }

  if (!cutPts.length || box.isEmpty()) {
    throw new Error('No supported DXF geometry found. Supported entities include lines, polylines, circles, arcs, splines, and ellipses.');
  }

  return buildResult(formatInfo, {
    sourceFlatData: {
      cutPts,
      bendPts: [],
      bounds: boxToBounds(box),
    },
    box,
  });
}

/**
 * Parse a supported 3D/2D model file and return geometry plus view metadata.
 *
 * STEP/STP: precise browser CAD meshes plus backend-unfold eligibility
 * IGES/IGS: browser CAD meshes
 * DXF: native 2D vector segments
 * STL/OBJ/PLY: mesh preview support
 */
export async function loadModelFile(fileName, arrayBuffer) {
  const formatInfo = getFormatConfig(fileName);

  if (!formatInfo) {
    throw new Error(
      `Unsupported file type. Supported formats: ${getSupportedFormatLabels().join(', ')}`
    );
  }

  switch (formatInfo.extension) {
    case 'step':
    case 'stp':
      return parseOcctCadFile(arrayBuffer, 'ReadStepFile', formatInfo);
    case 'iges':
    case 'igs':
      return parseOcctCadFile(arrayBuffer, 'ReadIgesFile', formatInfo);
    case 'dxf':
      return parseDxfFile(arrayBuffer, formatInfo);
    case 'stl':
      return parseStlFile(arrayBuffer, formatInfo);
    case 'obj':
      return parseObjFile(arrayBuffer, formatInfo);
    case 'ply':
      return parsePlyFile(arrayBuffer, formatInfo);
    default:
      throw new Error(`Unsupported file type ".${formatInfo.extension}".`);
  }
}

/**
 * Build Three.js Mesh objects from parsed geometry data.
 */
export function buildMeshes(geometries, colors, options = {}) {
  const {
    wireframe = false,
    metalness = 0.3,
    roughness = 0.5,
    envMapIntensity = 0.8,
  } = options;

  return geometries.map((geometry, index) => {
    const color = colors[index] || new THREE.Color(0x7a8fa6);
    const usesVertexColors = geometry.hasAttribute('color');

    const material = new THREE.MeshStandardMaterial({
      color: usesVertexColors ? 0xffffff : color,
      vertexColors: usesVertexColors,
      metalness,
      roughness,
      envMapIntensity,
      wireframe,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  });
}

/**
 * Build edge wireframe meshes for highlighting cut lines.
 */
export function buildEdgeMeshes(geometries, color = 0xf97316) {
  return geometries.map((geometry) => {
    const edges = new THREE.EdgesGeometry(geometry, 15);
    const lineMaterial = new THREE.LineBasicMaterial({
      color,
      linewidth: 1,
    });
    return new THREE.LineSegments(edges, lineMaterial);
  });
}

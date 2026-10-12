import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as OV from 'online-3d-viewer';
import * as THREE from 'three';
import {
  countersinkGeometry,
  hardwareHoleTargetMm,
  hardwareThreadSpec,
  holeDiameterMm,
  holeOuterDiameterMm,
  tapHoleTargetMm,
  tapThreadSpec,
} from '../../utils/holeFeatures';
import { getWrinkleNormalTexture as getWrinkleNormal, getWrinkleGrainTexture as getWrinkleGrain } from '../../utils/wrinkleThreeTextures';
import {
  ZAMYR_AXIS_VIEWS,
  ZAMYR_BODY_HEX,
  ZAMYR_BODY_METALNESS,
  ZAMYR_BODY_ROUGHNESS,
  ZAMYR_EDGE_ANGLE,
  ZAMYR_EDGE_HEX,
  ZAMYR_EDGE_OPACITY,
  ZAMYR_ENV_INTENSITY,
  ZAMYR_FIT_DISTANCE,
  ZAMYR_FIT_FOV,
  ZAMYR_MIN_FIT_DISTANCE,
  VIEW_CUBE_FACES,
  VIEW_CUBE_MARGIN,
  VIEW_CUBE_PX,
  VIEW_SNAP_MS,
  addStudioLights,
  buildViewCube,
  createStudioEnvironment,
  disposeViewCube,
  isInViewCube,
  renderViewCube,
  setViewCubeHover,
  viewCubeHit,
} from './zamyrViewerLook';
import './zamyrViewer.css';

// The configured preview (taps, countersinks, hardware cut in) is drawn in
// the same slate as the bare part, Zamyr's colour.
const PREVIEW_MATTE_HEX = ZAMYR_BODY_HEX;
const VIEWER_MIN_ZOOM_STEP = 0.04;
const VIEWER_MAX_ZOOM_STEP = 0.22;

const makeViewerHostRemovalSafe = (element) => {
  if (!element || element.__dmsRemoveChildSafe) return;

  const nativeRemoveChild = element.removeChild.bind(element);
  element.removeChild = (child) => {
    if (!child || child.parentNode !== element) return child || null;
    return nativeRemoveChild(child);
  };
  element.__dmsRemoveChildSafe = true;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Views and framing from Zamyr's part viewer (zamyrViewerLook.js): Z is up
// and "iso" is the front-right-top view a part opens with. The old table
// looked down Y as if the part were Y-up, so "Top" showed a plate on its edge.
const resolveAxisView = (axis) => ZAMYR_AXIS_VIEWS[axis] || ZAMYR_AXIS_VIEWS.iso;

const toOvCoord = (point) => new OV.Coord3D(point.x, point.y, point.z);

const getSphereCenterVector = (sphere) => {
  const center = sphere?.center;
  return new THREE.Vector3(
    Number(center?.x) || 0,
    Number(center?.y) || 0,
    Number(center?.z) || 0
  );
};

/**
 * Put the camera on one of the named views, framed the way Zamyr frames a
 * part: a 30-degree lens at 3.4 times the part's longest side (never nearer
 * than 120 mm), aimed at the middle of its bounding box. `fit` carries that
 * middle and longest side from the loaded model; without it the viewer's
 * bounding sphere stands in. Anything that is not a known view (null,
 * 'flat') gets the iso view.
 */
const applyAxisCamera = (embeddedViewer, axis, animate = true, fit = null) => {
  if (!embeddedViewer) return;
  const axisView = resolveAxisView(axis);

  try {
    const viewer = embeddedViewer.GetViewer?.();
    const nav = viewer?.navigation;
    if (!viewer || !nav?.GetCamera) return;

    const sphere = viewer.GetBoundingSphere?.(() => true);
    const sphereRadius = Number(sphere?.radius);
    const centerVec = fit?.center ? fit.center.clone() : getSphereCenterVector(sphere);
    const maxDim = Number(fit?.maxDim) > 0
      ? Number(fit.maxDim)
      : (Number.isFinite(sphereRadius) && sphereRadius > 0 ? sphereRadius * 2 : 1);
    const distance = Math.max(maxDim * ZAMYR_FIT_DISTANCE, ZAMYR_MIN_FIT_DISTANCE);
    const direction = axisView.dir.clone().normalize();
    const camera = new OV.Camera(
      toOvCoord(centerVec.clone().add(direction.multiplyScalar(distance))),
      toOvCoord(centerVec),
      toOvCoord(axisView.up),
      ZAMYR_FIT_FOV
    );

    // The viewer sizes its clipping planes from the bounding sphere alone (a
    // part under 10 mm gets a far plane at 100 mm), which would cut away a
    // part framed from 120 mm. Size them from the camera distance instead.
    if (viewer.camera?.isPerspectiveCamera) {
      viewer.camera.near = Math.max(distance / 2000, 0.01);
      viewer.camera.far = distance * 20;
      viewer.camera.updateProjectionMatrix();
    }

    if (typeof nav.MoveCamera === 'function') {
      nav.MoveCamera(camera, animate ? 10 : 0);
    } else if (typeof viewer.SetCamera === 'function') {
      viewer.SetCamera(camera);
    }

    viewer.Render?.();
  } catch (err) {
    console.debug('Axis camera update skipped', err);
  }
};

/**
 * Put Zamyr's look on a loaded online-3d-viewer: colour handling and tone
 * mapping, Zamyr's lights in place of the viewer's head-light, the studio
 * reflections, slate edges, Z as up, and the view cube drawn into the
 * corner of the viewer's canvas after every frame (clicking a face turns
 * the part to that side). Returns a function that takes it all off again.
 */
function applyZamyrStudioLook(embeddedViewer, { viewCube = true } = {}) {
  const v = embeddedViewer?.GetViewer?.();
  if (!v?.scene || !v.renderer) return () => { };
  const disposers = [];

  // online-3d-viewer renders with its own copy of three (0.176) and leaves
  // its output linear; Zamyr's look encodes to sRGB with filmic tone mapping.
  // Colours created with this file's three are already in its linear
  // working space, so they read right under that output.
  v.renderer.outputColorSpace = THREE.SRGBColorSpace;
  v.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  v.renderer.toneMappingExposure = 1.0;
  v.renderer.setClearColor(0xffffff, 1);

  // The viewer's head-light and flat ambient give way to Zamyr's lights.
  if (v.shadingModel?.ambientLight) v.shadingModel.ambientLight.intensity = 0;
  if (v.shadingModel?.directionalLight) v.shadingModel.directionalLight.intensity = 0;
  const lights = addStudioLights(v.scene);
  disposers.push(() => lights.forEach((light) => v.scene.remove(light)));

  try {
    const env = createStudioEnvironment(v.renderer);
    v.scene.environment = env;
    disposers.push(() => {
      if (v.scene.environment === env) v.scene.environment = null;
      env.dispose();
    });
  } catch (err) {
    console.debug('Studio reflections skipped', err);
  }

  // Edges in slate at a third of full strength, as Zamyr draws them. Their
  // materials belong to the viewer's three, which takes colours as given,
  // so the slate is converted to linear here first.
  const edgeLinear = new THREE.Color(ZAMYR_EDGE_HEX);
  v.mainModel?.edgeModel?.rootObject?.traverse?.((obj) => {
    if (!obj.isLineSegments || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      mat.color?.setRGB?.(edgeLinear.r, edgeLinear.g, edgeLinear.b);
      mat.transparent = true;
      mat.opacity = ZAMYR_EDGE_OPACITY;
      mat.needsUpdate = true;
    });
  });

  // CAD files are drawn with Z up; the viewer assumes Y.
  try {
    v.SetUpVector?.(OV.Direction.Z, false);
  } catch (err) {
    console.debug('Up vector unchanged', err);
  }

  const canvas = v.canvas;
  const nav = v.navigation;
  // Small previews (cart, orders) skip the cube: it would cover the part.
  if (viewCube && canvas && nav && typeof v.Render === 'function') {
    const cube = buildViewCube();
    const originalRender = v.Render.bind(v);
    v.Render = () => {
      originalRender();
      try {
        const cam = nav.GetCamera?.();
        if (!cam) return;
        renderViewCube(
          v.renderer,
          cube,
          canvas,
          new THREE.Vector3(cam.eye.x - cam.center.x, cam.eye.y - cam.center.y, cam.eye.z - cam.center.z),
          new THREE.Vector3(cam.up.x, cam.up.y, cam.up.z)
        );
      } catch (err) {
        console.debug('View cube draw skipped', err);
      }
    };

    // Turn the camera to look at a side of the part: same distance, same
    // target, that side's own "up" -- a short eased swing, as in Zamyr.
    let snapFrame = 0;
    const snapTo = (viewKey) => {
      const target = ZAMYR_AXIS_VIEWS[viewKey];
      const start = nav.GetCamera?.();
      if (!target || !start) return;
      const center = new THREE.Vector3(start.center.x, start.center.y, start.center.z);
      const eye = new THREE.Vector3(start.eye.x, start.eye.y, start.eye.z);
      const distance = Math.max(eye.distanceTo(center), 1e-6);
      const fromDir = eye.sub(center).normalize();
      const toDir = target.dir.clone().normalize();
      const turn = new THREE.Quaternion().setFromUnitVectors(fromDir, toDir);
      const startedAt = performance.now();
      window.cancelAnimationFrame(snapFrame);
      const step = () => {
        const raw = Math.min(1, (performance.now() - startedAt) / VIEW_SNAP_MS);
        const eased = 1 - (1 - raw) * (1 - raw);
        const dir = fromDir.clone().applyQuaternion(new THREE.Quaternion().slerp(turn, eased));
        const next = nav.GetCamera().Clone();
        next.center = new OV.Coord3D(center.x, center.y, center.z);
        next.eye = new OV.Coord3D(center.x + dir.x * distance, center.y + dir.y * distance, center.z + dir.z * distance);
        next.up = new OV.Coord3D(target.up.x, target.up.y, target.up.z);
        nav.SetCamera(next);
        v.Render();
        if (raw < 1) snapFrame = window.requestAnimationFrame(step);
      };
      step();
    };

    // A press on the cube belongs to the cube: the viewer must not start an
    // orbit from it, and the page's marker click must not see it.
    const onPointerDown = (ev) => {
      if (!isInViewCube(canvas, ev.clientX, ev.clientY)) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const face = viewCubeHit(cube, canvas, ev.clientX, ev.clientY);
      if (face) snapTo(VIEW_CUBE_FACES[face.userData.faceIndex]?.view);
    };
    const swallowInCube = (ev) => {
      const point = ev.touches?.[0] || ev;
      if (!isInViewCube(canvas, point.clientX, point.clientY)) return;
      ev.stopPropagation();
      ev.stopImmediatePropagation();
    };
    const onMouseMove = (ev) => {
      if (ev.buttons) return;
      const face = viewCubeHit(cube, canvas, ev.clientX, ev.clientY);
      if (setViewCubeHover(cube, face)) {
        canvas.style.cursor = face ? 'pointer' : 'grab';
        v.Render();
      }
    };
    const onMouseLeave = () => {
      if (setViewCubeHover(cube, null)) v.Render();
    };

    canvas.addEventListener('pointerdown', onPointerDown, true);
    canvas.addEventListener('mousedown', swallowInCube, true);
    canvas.addEventListener('touchstart', swallowInCube, { capture: true, passive: true });
    canvas.addEventListener('click', swallowInCube, true);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    disposers.push(() => {
      window.cancelAnimationFrame(snapFrame);
      canvas.removeEventListener('pointerdown', onPointerDown, true);
      canvas.removeEventListener('mousedown', swallowInCube, true);
      canvas.removeEventListener('touchstart', swallowInCube, { capture: true });
      canvas.removeEventListener('click', swallowInCube, true);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      v.Render = originalRender;
      disposeViewCube(cube);
    });
  }

  v.Render?.();
  return () => {
    disposers.splice(0).reverse().forEach((dispose) => {
      try { dispose(); } catch (err) { console.debug('Studio teardown step skipped', err); }
    });
  };
}

// A screw thread for the 3D view: a helix running up the hole's axis
// (local Y), `turns` times round over `height`.
class ThreadHelix extends THREE.Curve {
  constructor(radius, height, turns) {
    super();
    this.radius = radius;
    this.height = height;
    this.turns = turns;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const angle = t * this.turns * Math.PI * 2;
    return target.set(
      Math.cos(angle) * this.radius,
      (t - 0.5) * this.height,
      Math.sin(angle) * this.radius
    );
  }
}

// ── Hardware parts (studs, standoffs, nuts), drawn as SendCutSend draws
// them. Each piece is built along local +Y in "part space": y = 0 is the
// sheet face the part stands on, +Y points away from the sheet, and the
// other face of the sheet is at y = -wall.

/** A solid of revolution from an outline of [radius, y] points. */
const latheOf = (points, segments = 48) => new THREE.LatheGeometry(
  points.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)),
  segments
);

/** A flat outline with a round hole, extruded `height` along +Y from `y0`. */
const prismOf = (outline, holeR, y0, height) => {
  const shape = new THREE.Shape(outline);
  if (holeR > 0) {
    const bore = new THREE.Path();
    bore.absarc(0, 0, holeR, 0, Math.PI * 2, true);
    shape.holes.push(bore);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 28 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y0, 0);
  return geometry;
};

const hexOutline = (r) => Array.from({ length: 6 }, (_, i) => (
  new THREE.Vector2(Math.cos((i * Math.PI) / 3) * r, Math.sin((i * Math.PI) / 3) * r)
));

/** The serrated ring a self-clinching part bites into the sheet with. */
const knurlOutline = (outerR, innerR, teeth = 24) => Array.from({ length: teeth * 2 }, (_, i) => {
  const r = i % 2 === 0 ? outerR : innerR;
  const a = (i * Math.PI) / teeth;
  return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
});

/** A thread's ridges: a helix of `radius`, from y0 to y0 + height. */
const threadOf = (radius, y0, height, pitchMm) => {
  const turns = Math.min(40, Math.max(3, Math.round(height / Math.max(pitchMm, 0.2))));
  const tube = Math.min((height / turns) * 0.3, radius * 0.16);
  const geometry = new THREE.TubeGeometry(new ThreadHelix(radius, height, turns), Math.ceil(turns * 24), tube, 8, false);
  geometry.translate(0, y0 + height / 2, 0);
  return geometry;
};

/** A flat face in part space at height y, facing +Y (up) or -Y (down). */
const flatFace = (shapeOrGeometry, y, up) => {
  const geometry = shapeOrGeometry instanceof THREE.BufferGeometry
    ? shapeOrGeometry
    : new THREE.ShapeGeometry(shapeOrGeometry, 28);
  geometry.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
};

const inchesToMmOrNull = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n * 25.4 : null;
};

/**
 * The pieces of one hardware part in part space, as [geometry, 'body' |
 * 'flush' | 'thread'] pairs. A 'flush' piece is only the single face that
 * lies in the sheet's own face. Sizes come from the admin's row (inches);
 * `holeR` is the hole the part sits in once re-cut, `wall` the sheet there.
 */
const hardwarePieces = (typeId, item, holeR, wall) => {
  const spec = hardwareThreadSpec(item) || { majorMm: holeR * 1.6, pitchMm: holeR * 0.25 };
  const majorR = Math.max(spec.majorMm / 2, 0.2);
  const pitch = spec.pitchMm;
  const lengthMm = inchesToMmOrNull(item?.length);
  const widthMm = inchesToMmOrNull(item?.base_width);
  const proud = 0.02; // flush faces sit a hair proud so they show on the solid
  const pieces = [];

  if (typeId === 1) {
    // Flush stud: a threaded shank standing out of this face, its head
    // pressed flush into the other face. The head shows there as a plain
    // round disc; its serrated ring sits under it, inside the sheet.
    const shankLen = lengthMm || majorR * 6;
    const headR = widthMm ? widthMm / 2 : Math.max(holeR * 1.35, majorR * 1.7);
    const headH = Math.min(Math.max(wall * 0.45, 0.4), 2.2);
    const capH = headH * 0.4;
    pieces.push([latheOf([[0, -wall - proud], [headR, -wall - proud], [headR, -wall + capH], [0, -wall + capH]]), 'body']);
    pieces.push([flatFace(new THREE.CircleGeometry(headR, 48), -wall - proud, false), 'flush']);
    pieces.push([prismOf(knurlOutline(headR * 0.97, headR * 0.9, 30), 0, -wall + capH, headH - capH), 'body']);
    pieces.push([latheOf([[0, -wall + headH], [holeR * 0.985, -wall + headH], [holeR * 0.985, 0], [majorR * 0.84, 0], [majorR * 0.84, shankLen], [0, shankLen]]), 'body']);
    pieces.push([threadOf(majorR * 0.9, 0, shankLen * 0.97, pitch), 'thread']);
  } else if (typeId === 2) {
    // Flush standoff: a round barrel standing out of this face, threaded
    // inside, its hex head pressed flush into the other face.
    const barrelR = Math.max(holeR, majorR * 1.25);
    const boreR = majorR * 0.95;
    const barrelLen = lengthMm || barrelR * 4;
    const hexR = barrelR * 1.5;
    const headH = Math.min(Math.max(wall * 0.55, 0.5), 2.5);
    pieces.push([prismOf(hexOutline(hexR), boreR, -wall - proud, headH + proud), 'body']);
    const hexFace = new THREE.Shape(hexOutline(hexR));
    const hexBore = new THREE.Path();
    hexBore.absarc(0, 0, boreR, 0, Math.PI * 2, true);
    hexFace.holes.push(hexBore);
    pieces.push([flatFace(hexFace, -wall - proud, false), 'flush']);
    pieces.push([latheOf([[boreR, -wall + headH], [barrelR * 0.985, -wall + headH], [barrelR * 0.985, 0], [barrelR, 0], [barrelR, barrelLen], [boreR, barrelLen], [boreR, -wall + headH]]), 'body']);
  } else if (typeId === 3) {
    // Nut: a round body sitting on this face, its shank clinched into the
    // hole. The bore is drawn plain: a thread spiral inside read as a spring.
    const bodyR = widthMm ? widthMm / 2 : Math.max(holeR * 1.9, majorR * 2.4);
    const bodyH = lengthMm || majorR * 1.8;
    const boreR = majorR * 0.92;
    const shankR = Math.max(holeR * 0.985, boreR * 1.12);
    const shankDepth = wall * 0.85;
    // Rounded top edge and a light chamfer into the bore, as SendCutSend
    // draws it.
    const fillet = Math.min(bodyH * 0.35, (bodyR - boreR) * 0.3);
    const chamfer = Math.min(bodyH * 0.15, (bodyR - boreR) * 0.12);
    const outline = [[boreR, -shankDepth], [shankR, -shankDepth], [shankR, 0], [bodyR, 0], [bodyR, bodyH - fillet]];
    for (let k = 1; k <= 6; k += 1) {
      const a = (k / 6) * (Math.PI / 2);
      outline.push([bodyR - fillet + fillet * Math.cos(a), bodyH - fillet + fillet * Math.sin(a)]);
    }
    outline.push([boreR + chamfer, bodyH], [boreR, bodyH - chamfer], [boreR, -shankDepth]);
    pieces.push([latheOf(outline, 64), 'body']);
  } else if (typeId === 4) {
    // Flush nut, as SendCutSend draws it: a dark hex head on this face
    // (like a standoff's head side), standing a little proud, with a plain
    // bore. Its body fills the hole and stops just short of the other
    // face, so nothing comes out there: that side only shows the hole with
    // the nut's end inside it, even when the nut is longer than the sheet.
    const hexR = widthMm ? widthMm / 2 : Math.max(holeR * 1.6, majorR * 2.2);
    const boreR = Math.min(majorR * 0.92, holeR * 0.8);
    const headH = Math.min(Math.max(wall * 0.3, 0.2), 0.6);
    const bodyDepth = wall * 0.85;
    pieces.push([prismOf(hexOutline(hexR), boreR, 0, headH), 'body']);
    pieces.push([latheOf([[boreR, -bodyDepth], [holeR * 0.985, -bodyDepth], [holeR * 0.985, 0], [boreR, 0], [boreR, -bodyDepth]]), 'body']);
  }
  return pieces;
};

const StepModelViewer = ({
  selectedFile,
  detectedHoles = [],
  selectedTaps = {},
  // Which configure drawer is open ('tap' | 'cs' | 'hw' | null), the holes
  // its pointer is over, and what to call when a hole is clicked on the model.
  holeDrawerKind = null,
  highlightHoleIds = null,
  onHolePick = null,
  selectedHardware = {},
  modelUrlOverride = null,
  selectedCountersinks = {},
  showCountersinkMarkers = true,
  activeFinishColor = null,
  isFinishPowderCoating = false,
  isBendingActive = false,
  detectedBends = [],
  selectedThickness = null,
  selectedThicknessMm = null,
  isModelFadedManually = false,
  isAnodizingModalOpen = false,
  activeAxis = null,
  onModelLoaded = () => { },
  onModelLoadFailed = () => { },
  onProgress = () => { },
  onDimensionsExtracted = () => { },
  showViewCube = true,
}) => {
  const containerRef = useRef(null);
  const viewerInstance = useRef(null);
  const modelRef = useRef(null);
  const modelOriginalDataRef = useRef(null);
  // Middle and longest side of the loaded part, for framing it (applyAxisCamera).
  const fitRef = useRef(null);
  const showViewCubeRef = useRef(showViewCube);
  useEffect(() => {
    showViewCubeRef.current = showViewCube;
  }, [showViewCube]);
  const holeMarkersRef = useRef([]);
  const highlightIdsRef = useRef(null);
  const paintHoleHighlight = useCallback(() => {
    const ids = Array.isArray(highlightIdsRef.current) && highlightIdsRef.current.length
      ? new Set(highlightIdsRef.current.map(String))
      : null;
    holeMarkersRef.current.forEach((mesh) => {
      const data = mesh.userData || {};
      if (!data.hiMaterial || !data.baseMaterial) return;
      const next = ids && ids.has(data.holeId) ? data.hiMaterial : data.baseMaterial;
      if (mesh.material !== next) mesh.material = next;
    });
    viewerInstance.current?.GetViewer?.()?.Render?.();
  }, []);
  useEffect(() => {
    highlightIdsRef.current = highlightHoleIds;
    paintHoleHighlight();
  }, [highlightHoleIds, paintHoleHighlight]);
  const activeAxisRef = useRef(activeAxis);
  const [modelLoadCount, setModelLoadCount] = useState(0);
  const selectedThicknessValueMm = useMemo(() => {
    const mm = Number.parseFloat(selectedThicknessMm);
    if (Number.isFinite(mm) && mm > 0) return mm;
    const inches = Number.parseFloat(selectedThickness);
    return Number.isFinite(inches) && inches > 0 ? inches * 25.4 : 0;
  }, [selectedThicknessMm, selectedThickness]);

  // Procedural texture reference
  const wrinkleNormal = useRef(null);
  const wrinkleGrain = useRef(null);

  // Persistent Material Cache to prevent memory leaks and redundant object creation
  const matCache = useRef(new Map());

  const disposeMaterial = (material) => {
    try {
      if (!material) return;
      if (Array.isArray(material)) {
        material.forEach((m) => { if (m?.dispose) m.dispose(); });
      } else if (material.dispose) {
        material.dispose();
      }
    } catch {
      // Ignore disposal issues from already released WebGL resources.
    }
  };

  const resetMarkerMaterialCache = () => {
    matCache.current.forEach((cachedMat) => disposeMaterial(cachedMat));
    matCache.current.clear();
  };

  // --- Procedural Texture (module-cached, generated once per session) ---
  useEffect(() => {
    if (!wrinkleNormal.current) wrinkleNormal.current = getWrinkleNormal();
    if (!wrinkleGrain.current) wrinkleGrain.current = getWrinkleGrain();
  }, []);

  useEffect(() => {
    activeAxisRef.current = activeAxis;
  }, [activeAxis]);

  // --- Core 3D Entry Effect ---
  useEffect(() => {
    if (!selectedFile || !containerRef.current) return;
    const currentRef = containerRef.current;
    makeViewerHostRemovalSafe(currentRef);

    // Cleanup previous instance
    if (viewerInstance.current) {
      try { viewerInstance.current.Destroy(); } catch (e) { console.error("Error destroying viewer:", e); }
      viewerInstance.current = null;
    }
    currentRef.innerHTML = '';

    onProgress(0);
    let syntheticProgress = 0;
    const progressTimer = setInterval(() => {
      syntheticProgress = Math.min(99, syntheticProgress + 0.5);
      onProgress(syntheticProgress);
    }, 100);

    const extractDimensions = (model) => {
      if (!model) return;
      try {
        const bb = OV.GetBoundingBox(model); if (!bb?.min) return;
        const s = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].sort((a, b) => a - b);
        let vol = 0; try { vol = OV.CalculateVolume(model); } catch (e) { console.warn("Error volume:", e); }
        const dims = {
          mm: { l: s[2].toFixed(2), w: s[1].toFixed(2), t: s[0].toFixed(2), volume: vol.toFixed(2) },
          inches: { l: (s[2] / 25.4).toFixed(3), w: (s[1] / 25.4).toFixed(3), t: (s[0] / 25.4).toFixed(3), volume: (vol / 16387).toFixed(3) }
        };
        onDimensionsExtracted(dims);
      } catch (e) { console.error("Error dims:", e); }
    };

    // Zamyr's look (lights, reflections, view cube) goes on once the model is
    // in; this takes it off again when the viewer goes.
    let teardownStudioLook = () => { };

    try {
      const useConfiguredPreviewShading = Boolean(modelUrlOverride);
      const disableEdgesForConfiguredPreview = useConfiguredPreviewShading;
      const viewer = new OV.EmbeddedViewer(currentRef, {
        backgroundColor: new OV.RGBAColor(255, 255, 255, 255),
        // Zamyr's soft edges: only creases sharper than 30 degrees.
        edgeSettings: new OV.EdgeSettings(!disableEdgesForConfiguredPreview, new OV.RGBColor(42, 54, 70), ZAMYR_EDGE_ANGLE),
        onModelLoaded: () => {
          clearInterval(progressTimer); onProgress(100);
          const m = viewer.GetModel();
          modelRef.current = m;
          extractDimensions(m);
          onModelLoaded();

          const v = viewer.GetViewer();
          const bb = OV.GetBoundingBox(m);
          const center = new THREE.Vector3((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2);

          fitRef.current = {
            center: center.clone(),
            maxDim: Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z, 1),
          };
          // Zamyr's lights, reflections, edges and view cube.
          teardownStudioLook();
          teardownStudioLook = applyZamyrStudioLook(viewer, { viewCube: showViewCubeRef.current });

          // Match holes & Initialize Materials
          const colorStr = (typeof activeFinishColor === 'string') ? activeFinishColor : (activeFinishColor?.color || activeFinishColor?.hex || '');
          const finishHex = colorStr ? parseInt(colorStr.replace('#', '0x')) : null;
          const isBaseFallbackFinish = Boolean(activeFinishColor && typeof activeFinishColor === 'object' && activeFinishColor.isBaseMaterialFallback);
          const shouldForceFinishColor = finishHex !== null && !isBaseFallbackFinish;

          v?.scene?.traverse(obj => {
            if (obj.isMesh && obj.material) {
              if (detectedHoles.length > 0) {
                const mBB = new THREE.Box3().setFromObject(obj);
                const mCenter = new THREE.Vector3();
                mBB.getCenter(mCenter);
                const localPos = mCenter.clone().add(center);
                const matchingHole = detectedHoles.find(h => {
                  const holePos = new THREE.Vector3(...h.position);
                  return localPos.distanceTo(holePos) < 1.0;
                });
                if (matchingHole) {
                  obj.userData.nativeHoleId = matchingHole.id;
                  obj.userData.isNativeHole = true;
                }
              }
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach(m => {
                m.roughness = useConfiguredPreviewShading ? 0.5 : 0.62;
                m.metalness = useConfiguredPreviewShading ? 0.16 : 0.08;
                if (m.color && !obj.userData.origColor) {
                  obj.userData.origColor = { r: m.color.r, g: m.color.g, b: m.color.b };
                }
                if (shouldForceFinishColor) m.color.setHex(finishHex);
                else m.color.setHex(ZAMYR_BODY_HEX);
              });
            }
          });

          // Capture root for thickness scaling
          const modelRoot = v?.scene?.children.find(c => c.isGroup);
          if (modelRoot && bb?.min && bb?.max) {
            const axes = [
              { axis: 'x', size: Math.abs(bb.max.x - bb.min.x), localCenter: (bb.min.x + bb.max.x) / 2 },
              { axis: 'y', size: Math.abs(bb.max.y - bb.min.y), localCenter: (bb.min.y + bb.max.y) / 2 },
              { axis: 'z', size: Math.abs(bb.max.z - bb.min.z), localCenter: (bb.min.z + bb.max.z) / 2 },
            ].sort((a, b) => a.size - b.size);
            modelOriginalDataRef.current = {
              root: modelRoot,
              origScale: modelRoot.scale.clone(),
              origPosition: modelRoot.position.clone(),
              thicknessAxis: axes[0].axis,
              origThicknessMM: axes[0].size,
              localCenter: axes[0].localCenter,
            };
          }

          setModelLoadCount(c => c + 1);
          setTimeout(() => {
            try {
              if (typeof viewer.Resize === 'function') viewer.Resize();
              applyAxisCamera(viewer, activeAxisRef.current, false, fitRef.current);
            } catch (e) {
              console.debug('Initial FitToWindow/Resize skipped', e);
            }
          }, 300);
        },
        onModelLoadFailed: () => {
          clearInterval(progressTimer);
          onProgress(100);
          onModelLoadFailed();
        }
      });

      viewerInstance.current = viewer;

      // --- Viewer interaction polish ---
      const vInst = viewer.GetViewer();
      const nav = vInst?.navigation;
      const viewerCanvas = nav?.canvas || vInst?.canvas;
      let cleanupViewerInteraction = () => { };
      if (vInst && vInst.canvas && nav) {
        const canvas = viewerCanvas || vInst.canvas;
        const originalOrbit = typeof nav.Orbit === 'function' ? nav.Orbit.bind(nav) : null;

        // Rotation turns all the way round (free orbit, not locked upright)
        // about the view's centre, which follows wherever the user zoomed.
        if (originalOrbit) {
          nav.Orbit = (angleX, angleY) => {
            originalOrbit(angleX * 0.62, angleY * 0.62);
          };
        }

        if (typeof nav.SetNavigationMode === 'function') {
          if (OV.NavigationMode?.FreeOrbit !== undefined) nav.SetNavigationMode(OV.NavigationMode.FreeOrbit);
          else if (OV.NavigationMode?.FixedUpVector !== undefined) nav.SetNavigationMode(OV.NavigationMode.FixedUpVector);
        }

        canvas.style.cursor = 'grab';
        canvas.style.touchAction = 'none';

        // Zoom toward whatever is under the cursor: the eye and the view's
        // centre both scale about that point, so it stays under the cursor.
        // Off the part, the point is taken on the plane through the view's
        // centre. The clipping planes follow so a close look is never cut.
        const handleWheel = (ev) => {
          ev.preventDefault();
          ev.stopImmediatePropagation();

          const camera = nav.GetCamera?.();
          const viewCamera = vInst.camera;
          if (!camera?.eye || !camera?.center || !viewCamera) return;

          const zoomStep = clamp(Math.abs(ev.deltaY) * 0.0015, VIEWER_MIN_ZOOM_STEP, VIEWER_MAX_ZOOM_STEP);
          let scale = ev.deltaY < 0 ? 1 - zoomStep : 1 / (1 - zoomStep);
          const rect = canvas.getBoundingClientRect();
          const eye = new THREE.Vector3(camera.eye.x, camera.eye.y, camera.eye.z);
          const center = new THREE.Vector3(camera.center.x, camera.center.y, camera.center.z);

          let pivot = null;
          const hit = vInst.GetMeshIntersectionUnderMouse?.(2, { x: ev.clientX - rect.left, y: ev.clientY - rect.top });
          if (hit?.point) pivot = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
          if (!pivot && rect.width > 0 && rect.height > 0) {
            viewCamera.updateMatrixWorld();
            const through = new THREE.Vector3(
              ((ev.clientX - rect.left) / rect.width) * 2 - 1,
              -((ev.clientY - rect.top) / rect.height) * 2 + 1,
              0.5
            ).unproject(viewCamera);
            const ray = through.sub(eye).normalize();
            const forward = center.clone().sub(eye).normalize();
            const facing = ray.dot(forward);
            if (facing > 1e-6) {
              const along = center.clone().sub(eye).dot(forward) / facing;
              if (along > 0) pivot = eye.clone().addScaledVector(ray, along);
            }
          }
          if (!pivot) pivot = center.clone();

          const partSize = fitRef.current?.maxDim || 10;
          const toEye = eye.clone().sub(pivot);
          const gap = toEye.length();
          if (!(gap > 1e-9)) return;
          const nearest = Math.max(partSize * 0.002, 0.05);
          const farthest = Math.max(partSize * ZAMYR_FIT_DISTANCE, ZAMYR_MIN_FIT_DISTANCE) * 6;
          if (gap * scale < nearest) scale = nearest / gap;
          if (gap * scale > farthest) scale = farthest / gap;
          if (Math.abs(scale - 1) < 1e-4) return;

          const nextEye = pivot.clone().addScaledVector(toEye, scale);
          const nextCenter = pivot.clone().addScaledVector(center.clone().sub(pivot), scale);
          camera.eye.x = nextEye.x; camera.eye.y = nextEye.y; camera.eye.z = nextEye.z;
          camera.center.x = nextCenter.x; camera.center.y = nextCenter.y; camera.center.z = nextCenter.z;

          if (viewCamera.isPerspectiveCamera) {
            const span = nextEye.distanceTo(nextCenter);
            viewCamera.near = Math.max(Math.min(span, nextEye.distanceTo(pivot)) / 1000, 0.001);
            viewCamera.far = Math.max(span * 20, partSize * 40);
            viewCamera.updateProjectionMatrix();
          }
          nav.Update();
        };

        const handlePointerDown = () => {
          canvas.style.cursor = 'grabbing';
        };
        const handlePointerUp = () => {
          canvas.style.cursor = 'grab';
        };
        const handlePointerLeave = () => {
          if (!nav?.mouse?.IsButtonDown?.()) {
            canvas.style.cursor = 'grab';
          }
        };

        canvas.addEventListener('wheel', handleWheel, { capture: true, passive: false });
        canvas.addEventListener('mousedown', handlePointerDown);
        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('mouseleave', handlePointerLeave);
        document.addEventListener('mouseup', handlePointerUp);
        document.addEventListener('pointerup', handlePointerUp);

        cleanupViewerInteraction = () => {
          canvas.removeEventListener('wheel', handleWheel, { capture: true });
          canvas.removeEventListener('mousedown', handlePointerDown);
          canvas.removeEventListener('pointerdown', handlePointerDown);
          canvas.removeEventListener('mouseleave', handlePointerLeave);
          document.removeEventListener('mouseup', handlePointerUp);
          document.removeEventListener('pointerup', handlePointerUp);
          if (originalOrbit) nav.Orbit = originalOrbit;
        };
      }
      const modelFile = selectedFile?.file;
      const modelUrl = modelUrlOverride || selectedFile?.url || selectedFile?.path || modelFile?.path || modelFile?.url;
      const isBrowserFile = !modelUrlOverride && (typeof File !== 'undefined') && modelFile instanceof File;

      if (isBrowserFile) {
        viewer.LoadModelFromFileList([modelFile]);
      } else if (modelUrl) {
        viewer.LoadModelFromUrlList([modelUrl]);
      } else {
        throw new Error('No valid STEP source provided to StepModelViewer.');
      }

      const resizeObserver = new ResizeObserver(() => {
        try {
          if (viewerInstance.current) {
            const width = currentRef.clientWidth;
            const height = currentRef.clientHeight;

            // Standard Resize call
            if (typeof viewerInstance.current.Resize === 'function') {
              viewerInstance.current.Resize();
            }

            // Aggressive fallback: manually update internal three.js renderer if possible
            const v = viewerInstance.current.GetViewer?.();
            if (v && v.renderer && v.camera) {
              v.renderer.setSize(width, height);
              v.camera.aspect = width / height;
              v.camera.updateProjectionMatrix();
            }

            setTimeout(() => {
              try {
                applyAxisCamera(viewerInstance.current, activeAxisRef.current, false, fitRef.current);
              } catch { console.debug('Resize FitToWindow skipped'); }
            }, 50);
          }
        } catch (e) {
          console.warn('Resize observer error:', e);
        }
      });
      resizeObserver.observe(currentRef);

      return () => {
        clearInterval(progressTimer);
        resizeObserver.disconnect();
        cleanupViewerInteraction();

        holeMarkersRef.current.forEach((m) => {
          m.parent?.remove(m);
          if (m.geometry?.dispose) m.geometry.dispose();
        });
        holeMarkersRef.current = [];
        resetMarkerMaterialCache();
        teardownStudioLook();

        try { viewer.Destroy(); } catch (e) {
          console.warn('Viewer destroy error:', e);
        }
      };
    } catch (e) {
      clearInterval(progressTimer);
      onProgress(100);
      onModelLoadFailed();
      console.error("StepViewer error:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, modelUrlOverride]);

  useEffect(() => {
    if (!activeAxis || activeAxis === 'flat' || !viewerInstance.current || modelLoadCount === 0) return;
    applyAxisCamera(viewerInstance.current, activeAxis, true, fitRef.current);
  }, [activeAxis, modelLoadCount]);

  // --- Thickness Scaling ---
  useEffect(() => {
    if (!viewerInstance.current || modelLoadCount === 0) return;
    const data = modelOriginalDataRef.current;
    if (!data?.root) return;
    const { root, origScale, origPosition, thicknessAxis, origThicknessMM, localCenter } = data;
    if (!(selectedThicknessValueMm > 0)) {
      root.scale.copy(origScale);
      root.position.copy(origPosition);
    } else {
      const scaleFactor = origThicknessMM > 0 ? selectedThicknessValueMm / origThicknessMM : 1;
      root.scale[thicknessAxis] = origScale[thicknessAxis] * scaleFactor;
      root.position[thicknessAxis] = origPosition[thicknessAxis] + localCenter * (1 - scaleFactor);
    }
    setTimeout(() => {
      try {
        applyAxisCamera(viewerInstance.current, activeAxisRef.current, false, fitRef.current);
      } catch { console.debug('Scale FitToWindow skipped'); }
    }, 50);
  }, [selectedThicknessValueMm, modelLoadCount]);

  // --- Apply Styles / Colors / Fading ---
  useEffect(() => {
    if (!viewerInstance.current || modelLoadCount === 0) return;
    const apply = () => {
      try {
        const v = viewerInstance.current?.GetViewer();
        if (!v?.scene) return;
        const useConfiguredPreviewShading = Boolean(modelUrlOverride);
        const finishColorStr = (typeof activeFinishColor === 'string')
          ? activeFinishColor
          : (activeFinishColor?.color || activeFinishColor?.hex || '');
        const hasForcedFinishColor = Boolean(finishColorStr)
          && !(activeFinishColor && typeof activeFinishColor === 'object' && activeFinishColor.isBaseMaterialFallback);

        v.scene.traverse(obj => {
          if (!obj.isMesh || obj.userData.isHoleMarker || obj.isHardwareMarker) return;

          // Optimized UV generation (one-time per mesh)
          if (!obj.geometry.attributes.uv && obj.geometry.attributes.position && !obj.userData._uvGenerated) {
            const pos = obj.geometry.attributes.position;
            if (!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();
            const norm = obj.geometry.attributes.normal;
            const uvs = new Float32Array(pos.count * 2);
            const scale = 35;
            for (let i = 0; i < pos.count; i++) {
              const nx = Math.abs(norm.getX(i)), ny = Math.abs(norm.getY(i)), nz = Math.abs(norm.getZ(i));
              const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
              if (nx > ny && nx > nz) { uvs[i * 2] = z / scale; uvs[i * 2 + 1] = y / scale; }
              else if (ny > nx && ny > nz) { uvs[i * 2] = x / scale; uvs[i * 2 + 1] = z / scale; }
              else { uvs[i * 2] = x / scale; uvs[i * 2 + 1] = y / scale; }
            }
            obj.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            obj.userData._uvGenerated = true;
          }

          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((mat, idx) => {
            if (!mat?.color) return;

            // Optimized material cloning (surgical update)
            if (!obj.userData._matCloned) {
              const upgrade = (m) => new THREE.MeshStandardMaterial({
                color: m.color, transparent: m.transparent, opacity: m.opacity,
                side: THREE.DoubleSide, roughness: ZAMYR_BODY_ROUGHNESS, metalness: ZAMYR_BODY_METALNESS,
                envMapIntensity: ZAMYR_ENV_INTENSITY,
              });
              obj.material = Array.isArray(obj.material) ? obj.material.map(upgrade) : upgrade(obj.material);
              obj.userData._matCloned = true;
            }
            const fm = Array.isArray(obj.material) ? obj.material[idx] : obj.material;
            if (!obj.userData.origColor) obj.userData.origColor = { r: fm.color.r, g: fm.color.g, b: fm.color.b };

            if (hasForcedFinishColor) {
              fm.color.set(finishColorStr);
              if (!isFinishPowderCoating) {
                fm.emissive.set(finishColorStr);
                fm.emissiveIntensity = useConfiguredPreviewShading ? 0.03 : 0.08;
              }
              else { fm.emissive.set(0x000000); fm.emissiveIntensity = 0; }
            }
            else if (useConfiguredPreviewShading) {
              fm.color.setHex(PREVIEW_MATTE_HEX);
              fm.emissive.set(0x000000);
              fm.emissiveIntensity = 0;
            }
            else {
              // No finish chosen: the bare part in Zamyr's slate, not whatever
              // colour the CAD file happened to carry.
              fm.color.setHex(ZAMYR_BODY_HEX);
              fm.emissive.set(0x000000); fm.emissiveIntensity = 0;
            }

            if (activeFinishColor && isFinishPowderCoating && hasForcedFinishColor) {
              const gloss = activeFinishColor.gloss ?? 35;
              const isWrinkled = !!(activeFinishColor.is_wrinkled || activeFinishColor.name?.toUpperCase().includes('WRINKLED'));
              // Wrinkle: moderately rough base, stronger bump, and a per-pixel
              // grain map so peaks catch light while valleys stay matte —
              // creates the visible speckle real wrinkle-coat shows.
              fm.roughness = isWrinkled ? 0.55 : Math.max(0.32, 0.9 - (gloss / 100));
              fm.metalness = isWrinkled ? 0.18 : 0.1;
              fm.normalMap = isWrinkled ? wrinkleNormal.current : null;
              fm.normalScale = isWrinkled ? new THREE.Vector2(1.8, 1.8) : new THREE.Vector2(0, 0);
              fm.roughnessMap = isWrinkled ? wrinkleGrain.current : null;
            } else if (hasForcedFinishColor) {
              fm.roughness = useConfiguredPreviewShading ? 0.58 : 0.65;
              fm.metalness = useConfiguredPreviewShading ? 0.12 : 0.05;
              fm.normalMap = null;
              fm.roughnessMap = null;
            } else {
              fm.roughness = ZAMYR_BODY_ROUGHNESS;
              fm.metalness = ZAMYR_BODY_METALNESS;
              fm.normalMap = null;
              fm.roughnessMap = null;
            }
            fm.envMapIntensity = ZAMYR_ENV_INTENSITY;

            // See-through while a configure drawer is open, so the holes and
            // what is chosen for them show (and stay clickable) through the part.
            const isConfiguringHoles = Boolean(holeDrawerKind) && !isAnodizingModalOpen;
            const shouldFade = isModelFadedManually || isConfiguringHoles;
            const finalFade = shouldFade && !obj.userData.isNativeHole;
            fm.opacity = finalFade ? (isModelFadedManually ? 0.05 : 0.16) : 1.0;
            fm.transparent = finalFade;
            fm.depthWrite = !finalFade;
            fm.needsUpdate = true;
          });
        });
        v.Render();
      } catch (err) { console.warn('Style application error:', err); }
    };
    apply();
  }, [activeFinishColor, isFinishPowderCoating, modelLoadCount, holeDrawerKind, isAnodizingModalOpen, isModelFadedManually, modelUrlOverride]);

  // --- Live Finish Color Updates ---
  useEffect(() => {
    const v = viewerInstance.current;
    if (!v || modelLoadCount === 0) return;
    const colorStr = (typeof activeFinishColor === 'string') ? activeFinishColor : (activeFinishColor?.color || activeFinishColor?.hex || '');
    const finishHex = colorStr ? parseInt(colorStr.replace('#', '0x')) : null;
    const useConfiguredPreviewShading = Boolean(modelUrlOverride);
    const shouldForceFinishColor = finishHex !== null
      && !(activeFinishColor && typeof activeFinishColor === 'object' && activeFinishColor.isBaseMaterialFallback);

    const viewer = v.GetViewer();
    if (!viewer) return;

    viewer.scene.traverse(obj => {
      if (obj.isMesh && !obj.userData.isHoleMarker && !obj.isHardwareMarker) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
          if (shouldForceFinishColor) {
            m.color.setHex(finishHex);
          } else if (useConfiguredPreviewShading) {
            m.color.setHex(PREVIEW_MATTE_HEX);
          } else {
            m.color.setHex(ZAMYR_BODY_HEX);
          }
        });
      }
    });
    try { v.Render(); } catch { console.debug('Scene update omitted'); }
  }, [activeFinishColor, modelLoadCount, modelUrlOverride]);

  // --- Markers Management (Tapping, Hardware, Countersinks) ---
  useEffect(() => {
    if (!viewerInstance.current || modelLoadCount === 0) return;

    const updateMarkers = () => {
      try {
        const v = viewerInstance.current?.GetViewer();
        if (!v?.scene) return;

        // Cleanup markers
        holeMarkersRef.current.forEach(m => { m.parent?.remove(m); if (m.geometry) m.geometry.dispose(); });
        holeMarkersRef.current = [];
        resetMarkerMaterialCache();

        const hasHwAssigned = Object.keys(selectedHardware).length > 0;
        const hasCSAssigned = Object.keys(selectedCountersinks).length > 0;
        const hasTapsAssigned = Object.keys(selectedTaps).length > 0;
        const shouldShowCountersinks = showCountersinkMarkers && (Boolean(holeDrawerKind) || hasCSAssigned);
        if ((!holeDrawerKind && !hasTapsAssigned && !hasHwAssigned && !shouldShowCountersinks) || detectedHoles.length === 0) { v.Render(); return; }

        const modelData = modelOriginalDataRef.current;
        const modelRoot = modelData?.root || v.scene;
        const scaleFactor = modelData && selectedThicknessValueMm > 0
          ? (selectedThicknessValueMm / modelData.origThicknessMM)
          : 1;
        const _ta = modelData?.thicknessAxis || 'y';
        const origT = modelData?.origThicknessMM || 2.0;
        const getLocalHoleDepthMm = (hole) => {
          const rawDepthMm = Number(hole?.depthMm ?? hole?.depth_mm ?? NaN);
          const rawDepthInches = Number(hole?.depthInches);
          const depthMm = Number.isFinite(rawDepthMm) && rawDepthMm > 0
            ? rawDepthMm
            : (Number.isFinite(rawDepthInches) && rawDepthInches > 0 ? rawDepthInches * 25.4 : NaN);
          const fallback = origT > 0 ? origT : 2.0;
          if (!Number.isFinite(depthMm) || depthMm <= 0) return fallback;

          // Distant coaxial holes on opposite walls can be detected as one long
          // bore. Hardware should sit in the local wall, not bridge the gap.
          const suspiciousLimit = Math.max(fallback * 2.25, fallback + 1.0, 4.0);
          return depthMm > suspiciousLimit ? fallback : depthMm;
        };

        // Shared axis logic
        let hwThicknessVec;
        const _holePositions = detectedHoles.filter(h => h.position);
        if (_holePositions.length >= 2) {
          const _computeVar = (vals) => {
            const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
            return vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
          };
          const _candidates = [
            { vec: new THREE.Vector3(1, 0, 0), v: _computeVar(_holePositions.map(h => h.position[0])) },
            { vec: new THREE.Vector3(0, 1, 0), v: _computeVar(_holePositions.map(h => h.position[1])) },
            { vec: new THREE.Vector3(0, 0, 1), v: _computeVar(_holePositions.map(h => h.position[2])) },
          ];
          _candidates.sort((a, b) => a.v - b.v);
          hwThicknessVec = _candidates[0].vec.clone();
        } else {
          hwThicknessVec = _ta === 'x' ? new THREE.Vector3(1, 0, 0) : _ta === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
        }

        // Reuse Material cache for markers
        const getMarkerMat = (key, creator) => {
          if (!matCache.current.has(key)) matCache.current.set(key, creator());
          return matCache.current.get(key);
        };

        // --- Tapping, countersinking and hardware ---
        // Drawn in world space so they follow the model's stretch to the
        // chosen sheet. While a configure drawer is open the part is
        // see-through and every hole shows, each chosen size as it will be
        // made: the hole at its new size, filled rims (part colour) or widened
        // ones (dark), threads, the countersink cone and the flat-side ring.
        // With the drawer shut only the threads and that ring stay; the cuts
        // themselves come from the real cut model. Hardware parts are real
        // objects, so they show whichever drawer is open, and on the final
        // model too.
        const drawerKind = holeDrawerKind || null;
        const tapsVisible = drawerKind ? drawerKind === 'tap' : hasTapsAssigned;
        const sinksVisible = drawerKind ? drawerKind === 'cs' : shouldShowCountersinks;
        const hardwareVisible = hasHwAssigned || drawerKind === 'hw';
        if (tapsVisible || sinksVisible || hardwareVisible) {
          const featureRoot = modelRoot !== v.scene ? modelRoot : null;
          featureRoot?.updateWorldMatrix(true, false);
          const toWorld = (vec) => (featureRoot ? featureRoot.localToWorld(vec.clone()) : vec.clone());
          const AXIS_Y = new THREE.Vector3(0, 1, 0);
          const AXIS_Z = new THREE.Vector3(0, 0, 1);
          const surfaceMat = (key, color, extra = {}) => getMarkerMat(`hf_${key}`, () => new THREE.MeshStandardMaterial({
            color,
            roughness: 0.42,
            metalness: 0.35,
            side: THREE.DoubleSide,
            ...extra,
          }));
          const flatMat = (key, color, extra = {}) => surfaceMat(key, color, {
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
            ...extra,
          });
          const plainMat = surfaceMat('plain', 0xa3adb8, { roughness: 0.55, metalness: 0.2 });
          const cutMat = surfaceMat('cut', 0xc5ccd4);
          const threadMat = surfaceMat('thread', 0x6f7a87, { roughness: 0.36, metalness: 0.55 });
          const hiMat = surfaceMat('hi', 0x2563eb, { emissive: 0x1d4ed8, emissiveIntensity: 0.25 });
          // Filled and widened areas only show while the part is see-through;
          // half-clear so the thread or cone beneath stays readable.
          const fillMat = flatMat('fill', ZAMYR_BODY_HEX, {
            roughness: ZAMYR_BODY_ROUGHNESS, metalness: ZAMYR_BODY_METALNESS, transparent: true, opacity: 0.5, depthWrite: false,
          });
          const openMat = flatMat('open', 0x111827, { roughness: 0.9, metalness: 0, transparent: true, opacity: 0.6, depthWrite: false });
          const ringMat = flatMat('ring', 0xd5dae0, { roughness: 0.6, metalness: 0.15 });
          // A fine line marking where a hole was filled to fit a smaller part.
          const fillEdgeMat = flatMat('fillEdge', 0x5d6672, { roughness: 0.7, metalness: 0.1 });
          // Every hardware part in one dark, matte charcoal, as SendCutSend
          // shows them; a stud's thread a shade darker so it still reads.
          const partMat = surfaceMat('part', 0x5a6069, { roughness: 0.62, metalness: 0.25 });
          const partThreadMat = surfaceMat('partThread', 0x474c54, { roughness: 0.6, metalness: 0.25 });
          // A flush face lies in the sheet's own face; pulled forward in depth
          // so the two never flicker into blotches (z-fighting).
          const partFlushMat = surfaceMat('partFlush', 0x5a6069, {
            roughness: 0.62, metalness: 0.25, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
            // Seen from its own side only, so it never shows through the sheet.
            side: THREE.FrontSide,
          });

          const frameOf = (hole) => {
            if (!Array.isArray(hole?.position) || hole.position.length < 3) return null;
            const local = new THREE.Vector3(...hole.position);
            const dir = Array.isArray(hole.axis) && hole.axis.length >= 3
              ? new THREE.Vector3(...hole.axis)
              : hwThicknessVec.clone();
            if (dir.lengthSq() < 1e-12) return null;
            dir.normalize();
            // The hole's own measured depth (the engine merges a bore only
            // within one wall). The viewer's model-thickness record is not
            // reliable here, so it is only a fallback.
            const measured = Number(hole.depthMm ?? hole.depth_mm);
            const half = (measured > 0
              ? measured
              : (selectedThicknessValueMm > 0 ? selectedThicknessValueMm : getLocalHoleDepthMm(hole))) / 2;
            const top = toWorld(local.clone().addScaledVector(dir, half));
            const bottom = toWorld(local.clone().addScaledVector(dir, -half));
            const axis = top.clone().sub(bottom);
            const wall = axis.length();
            if (!(wall > 1e-6)) return null;
            axis.divideScalar(wall);
            return { axis, wall, top, bottom, center: top.clone().add(bottom).multiplyScalar(0.5) };
          };
          const place = (geometry, material, hole, role, position, dir, from = AXIS_Y, highlight = false) => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            mesh.quaternion.setFromUnitVectors(from, dir.clone().normalize());
            mesh.userData.isHoleMarker = true;
            mesh.userData.hole = hole;
            mesh.userData.holeId = String(hole.id);
            mesh.userData.role = role;
            if (highlight) {
              mesh.userData.baseMaterial = material;
              mesh.userData.hiMaterial = hiMat;
            }
            v.scene.add(mesh);
            holeMarkersRef.current.push(mesh);
            return mesh;
          };
          // Flat ring lying on a face, just proud of it.
          const faceRing = (hole, inner, outer, material, facePoint, outward, role) => {
            if (!(outer > inner + 0.01)) return;
            place(
              new THREE.RingGeometry(Math.max(inner, 0.01), outer, 56),
              material, hole, role,
              facePoint.clone().addScaledVector(outward, 0.012), outward, AXIS_Z
            );
          };
          // Plain or re-cut hole wall between two points on the axis.
          const bore = (hole, radius, from, to, material, role, highlight) => {
            const span = to.clone().sub(from);
            const length = span.length();
            if (!(length > 0.02) || !(radius > 0.01)) return;
            place(
              new THREE.CylinderGeometry(radius, radius, length, 44, 1, role !== 'plain' && role !== 'core'),
              material, hole, role, from.clone().add(to).multiplyScalar(0.5), span, AXIS_Y, highlight
            );
          };

          detectedHoles.forEach((hole) => {
            const frame = frameOf(hole);
            if (!frame) return;
            const holeR = holeDiameterMm(hole) / 2;
            const outerR = holeOuterDiameterMm(hole) / 2;
            if (!(holeR > 0) || holeR > 100) return;
            const { axis, wall, top, bottom } = frame;
            const down = axis.clone().negate();
            const hw = selectedHardware?.[hole.id]?.item ? selectedHardware[hole.id] : null;

            if (hardwareVisible) {
              if (!hw) {
                if (drawerKind === 'hw') bore(hole, holeR * 0.995, bottom, top, plainMat, 'plain', true);
              } else {
                // The part stands on the chosen face; the hole under it is
                // re-cut to the size the part needs (shown while configuring).
                const typeId = Number(hw.typeId ?? hw.item.hardware_type_id);
                const targetR = (hardwareHoleTargetMm(typeId, hw.item) || holeR * 2) / 2;
                const onBottom = String(hw.face || 'up').toLowerCase() === 'down';
                const out = onBottom ? down : axis;
                const face = onBottom ? bottom : top;
                if (drawerKind === 'hw') {
                  if (outerR > targetR + 0.02) {
                    faceRing(hole, targetR, outerR, fillMat, top, axis, 'fill');
                    faceRing(hole, targetR, outerR, fillMat, bottom, down, 'fill');
                  } else if (holeR < targetR - 0.02) {
                    faceRing(hole, holeR, targetR, openMat, top, axis, 'open');
                    faceRing(hole, holeR, targetR, openMat, bottom, down, 'open');
                  }
                }
                // While configuring, a hole filled to fit a smaller part shows a
                // fine outline of its old edge on both faces. The finished part
                // has none: the fill is flush, so no line is drawn there.
                if (drawerKind === 'hw' && holeR > targetR + 0.05) {
                  const line = Math.min(Math.max(holeR * 0.03, 0.08), 0.25);
                  faceRing(hole, holeR - line, holeR, fillEdgeMat, top, axis, 'fill-edge');
                  faceRing(hole, holeR - line, holeR, fillEdgeMat, bottom, down, 'fill-edge');
                }
                hardwarePieces(typeId, hw.item, targetR, wall).forEach(([geometry, kind]) => {
                  const material = kind === 'thread' ? partThreadMat
                    : kind === 'flush' ? partFlushMat
                      : partMat;
                  place(geometry, material, hole, 'hardware', face, out, AXIS_Y, true);
                });
              }
            }

            if (tapsVisible) {
              const tap = selectedTaps[hole.id];
              if (!tap) {
                if (drawerKind === 'tap' && !hw) bore(hole, holeR * 0.995, bottom, top, plainMat, 'plain', true);
              } else {
                const targetR = tapHoleTargetMm(tap, hole) / 2;
                const spec = tapThreadSpec(tap);
                if (drawerKind === 'tap') {
                  if (outerR > targetR + 0.02) {
                    faceRing(hole, targetR, outerR, fillMat, top, axis, 'fill');
                    faceRing(hole, targetR, outerR, fillMat, bottom, down, 'fill');
                  } else if (holeR < targetR - 0.02) {
                    faceRing(hole, holeR, targetR, openMat, top, axis, 'open');
                    faceRing(hole, holeR, targetR, openMat, bottom, down, 'open');
                  }
                }
                // Drawn the way SendCutSend draws it: 7 to 10 full, chunky
                // turns through the wall whatever the real pitch, so the thread
                // reads on screen. With the drawer open it is a screw (a core
                // plus ridges); on the solid model the ridges sit on the re-cut
                // hole's wall and show as grooves inside it.
                const height = wall * 0.96;
                const turns = Math.min(10, Math.max(7, Math.round(height / Math.max(spec.pitchMm, 0.1))));
                const tube = Math.min((height / turns) * 0.42, targetR * 0.32);
                const ridgeR = drawerKind === 'tap' ? targetR - tube * 0.4 : targetR;
                if (drawerKind === 'tap') {
                  bore(
                    hole, Math.max(ridgeR - tube * 0.55, 0.05),
                    frame.center.clone().addScaledVector(axis, -height / 2),
                    frame.center.clone().addScaledVector(axis, height / 2),
                    threadMat, 'core', true
                  );
                }
                place(
                  new THREE.TubeGeometry(
                    new ThreadHelix(ridgeR, height, turns),
                    Math.ceil(turns * 36), tube, 10, false
                  ),
                  threadMat, hole, 'thread', frame.center, axis, AXIS_Y, true
                );
              }
            }

            if (sinksVisible) {
              const sink = selectedCountersinks[hole.id];
              // A hole carrying hardware shows the part, not a countersink.
              if (!sink) {
                if (drawerKind === 'cs' && !hw) bore(hole, holeR * 0.995, bottom, top, plainMat, 'plain', true);
                return;
              }
              if (hw) return;
              const geo = countersinkGeometry(sink);
              const minorR = geo.minorMm / 2;
              const majorR = geo.majorMm / 2;
              if (!(majorR > minorR) || !(minorR > 0)) return;
              const onBottom = String(sink.face || 'up').toLowerCase() === 'down';
              const out = onBottom ? down : axis;
              const face = onBottom ? bottom : top;
              const back = onBottom ? top : bottom;
              const coneDepth = Math.min(geo.depthMm, wall * 0.95);
              if (drawerKind === 'cs') {
                place(
                  new THREE.CylinderGeometry(majorR, minorR, coneDepth, 56, 1, true),
                  cutMat, hole, 'cone', face.clone().addScaledVector(out, -coneDepth / 2), out, AXIS_Y, true
                );
                bore(hole, minorR, face.clone().addScaledVector(out, -coneDepth), back, cutMat, 'bore', true);
                if (outerR > majorR + 0.02) faceRing(hole, majorR, outerR, fillMat, face, out, 'fill');
                if (outerR > minorR + 0.02) faceRing(hole, minorR, outerR, fillMat, back, out.clone().negate(), 'fill');
                else if (holeR < minorR - 0.02) faceRing(hole, holeR, minorR, openMat, back, out.clone().negate(), 'open');
                // While configuring, the flat side shows where the countersink
                // sits on the other side. The finished part shows a plain hole
                // there, as it really is, so no ring is drawn then.
                place(
                  new THREE.RingGeometry(Math.max(minorR, 0.01), majorR, 56),
                  ringMat, hole, 'ring', back.clone().addScaledVector(out, -0.04), out.clone().negate(), AXIS_Z
                );
              }
            }
          });
        }

        // --- Bending ---
        if (isBendingActive && detectedBends.length > 0 && !modelUrlOverride) {
          const bendMat = getMarkerMat('bend_line', () => new THREE.MeshPhongMaterial({
            color: 0x00f3ff, // Electric Cyan
            emissive: 0x00f3ff,
            emissiveIntensity: 5.5,
            transparent: true,
            opacity: 0.9,
            shininess: 100
          }));

          detectedBends.forEach(bend => {
            const p0 = new THREE.Vector3(...bend.p0);
            const p1 = new THREE.Vector3(...bend.p1);
            const length = p0.distanceTo(p1);
            if (length < 0.1) return;

            const midPoint = new THREE.Vector3().lerpVectors(p0, p1, 0.5);

            // Draw a thin glowing cylinder along the bend line
            const bendRadius = 0.55 / scaleFactor;
            const geo = new THREE.CylinderGeometry(bendRadius, bendRadius, length, 8);

            const mesh = new THREE.Mesh(geo, bendMat);
            mesh.userData.isHoleMarker = true;
            mesh.position.copy(midPoint);

            mesh.lookAt(p1);
            mesh.rotateX(Math.PI / 2);

            modelRoot.add(mesh);
            holeMarkersRef.current.push(mesh);
          });
        }

        paintHoleHighlight();
        v.Render();
      } catch (err) { console.warn('Marker error:', err); }
    };
    updateMarkers();
  }, [detectedHoles, selectedTaps, holeDrawerKind, paintHoleHighlight, selectedHardware, modelLoadCount, modelUrlOverride, selectedThicknessValueMm, selectedCountersinks, showCountersinkMarkers, isBendingActive, detectedBends]);

  // --- Click / Interaction ---
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const onClick = (e) => {
      const v = viewerInstance.current?.GetViewer(); if (!v?.scene || !v?.camera) return;
      const rect = el.getBoundingClientRect();
      const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(mouse, v.camera);
      const intersects = raycaster.intersectObjects(holeMarkersRef.current, true);
      if (intersects.length > 0) {
        const marker = intersects[0].object;
        if (marker.userData.hole && holeDrawerKind && typeof onHolePick === 'function') onHolePick(marker.userData.hole);
      }
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [modelLoadCount, holeDrawerKind, onHolePick]);

  return (
    <div className="dms-step-viewer">
      <div ref={containerRef} className="dms-step-viewer-mount" />
      {modelLoadCount > 0 && showViewCube && (
        <button
          type="button"
          className="dms-viewcube-home"
          style={{ top: VIEW_CUBE_MARGIN - 4, right: VIEW_CUBE_MARGIN + VIEW_CUBE_PX - 6 }}
          title="Back to the default view"
          aria-label="Back to the default view"
          onClick={(event) => {
            event.stopPropagation();
            applyAxisCamera(viewerInstance.current, 'iso', true, fitRef.current);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default React.memo(StepModelViewer);

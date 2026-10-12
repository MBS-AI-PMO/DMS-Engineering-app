import * as THREE from 'three';

/**
 * The look of Zamyr's part viewer (Zamyr: apps/dashboard/src/Zamyr/parts/
 * CadMeshViewer.jsx), shared by the DMS 3D viewer so a part reads the same
 * in both apps: CAD coordinates with Z up, the angled front-right-top view a
 * CAD tool opens with, a studio reflection map, three fixed lights, a slate
 * body with soft edges, and the view cube in the corner.
 *
 * DMS draws its model with online-3d-viewer, which keeps its own renderer,
 * camera and render loop; StepModelViewer applies these pieces to that
 * viewer once a model has loaded.
 */

export const ZAMYR_BODY_HEX = 0x687482;
export const ZAMYR_BODY_ROUGHNESS = 0.52;
export const ZAMYR_BODY_METALNESS = 0.34;
export const ZAMYR_ENV_INTENSITY = 0.48;
export const ZAMYR_EDGE_HEX = 0x2a3646;
export const ZAMYR_EDGE_OPACITY = 0.32;
export const ZAMYR_EDGE_ANGLE = 30;
export const ZAMYR_FIT_FOV = 30;
export const ZAMYR_FIT_DISTANCE = 3.4;
// Never closer than this (mm), so a tiny part is not blown up to fill the view.
export const ZAMYR_MIN_FIT_DISTANCE = 120;

/**
 * Camera directions (from the part towards the eye) and up vectors, Z up.
 *
 * Top and Bottom look straight along Z, the same line as "up". The DMS
 * viewer orbits around the camera's up vector, so up stays Z for every view
 * and those two lean a hair off the axis instead (0.2 degrees): the screen's
 * up then lands on +Y, the way Zamyr's Top shows it, and orbiting afterwards
 * still turns the part around Z.
 */
const POLE_LEAN = 0.0035;
export const ZAMYR_AXIS_VIEWS = {
  iso: { dir: new THREE.Vector3(1, -0.78, 0.66), up: new THREE.Vector3(0, 0, 1) },
  top: { dir: new THREE.Vector3(0, -POLE_LEAN, 1), up: new THREE.Vector3(0, 0, 1) },
  bottom: { dir: new THREE.Vector3(0, POLE_LEAN, -1), up: new THREE.Vector3(0, 0, 1) },
  front: { dir: new THREE.Vector3(0, -1, 0), up: new THREE.Vector3(0, 0, 1) },
  back: { dir: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, 1) },
  side: { dir: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 0, 1) },
  left: { dir: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 0, 1) },
};

/**
 * A blurred equirectangular gradient with two soft "softbox" highlights:
 * MeshStandardMaterial gets real reflections from it -- the difference
 * between flat clay and a shaded metal solid.
 */
export function createStudioEnvironment(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0.0, '#f4f7fc');
  grad.addColorStop(0.42, '#ffffff');
  grad.addColorStop(0.52, '#e9eef5');
  grad.addColorStop(1.0, '#bcc5d1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const softbox = (cx, cy, r, alpha) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
  softbox(canvas.width * 0.34, canvas.height * 0.30, canvas.height * 0.62, 0.9);
  softbox(canvas.width * 0.80, canvas.height * 0.24, canvas.height * 0.46, 0.5);

  const equirect = new THREE.CanvasTexture(canvas);
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  equirect.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envMap = pmrem.fromEquirectangular(equirect).texture;
  equirect.dispose();
  pmrem.dispose();
  return envMap;
}

/** Zamyr's lights, fixed in the world. Returns them so they can be removed. */
export function addStudioLights(scene) {
  const lights = [
    new THREE.AmbientLight(0xf4f7fb, 0.42),
    new THREE.HemisphereLight(0xffffff, 0xaeb7c4, 0.82),
  ];
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.72);
  keyLight.position.set(1.35, -1.55, 2.45);
  const fillLight = new THREE.DirectionalLight(0xdbe6ff, 0.6);
  fillLight.position.set(-2.2, 1.35, 1.25);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.66);
  rimLight.position.set(-0.55, 2.4, 2.2);
  lights.push(keyLight, fillLight, rimLight);
  lights.forEach((light) => {
    light.userData.isStudioLight = true;
    scene.add(light);
  });
  return lights;
}

// ── View cube ────────────────────────────────────────────────────────────
// Faces are named the way the toolbar names its views, and clicking one
// turns the camera to look at that side of the part.

export const VIEW_CUBE_PX = 104;
export const VIEW_CUBE_MARGIN = 14;
export const VIEW_SNAP_MS = 320;
const VIEW_CUBE_FACE = 0xe3e8ef;
const VIEW_CUBE_FACE_HOVER = 0xbdd3f5;
export const VIEW_CUBE_FACES = [
  { label: 'Front', normal: [0, -1, 0], up: [0, 0, 1], view: 'front' },
  { label: 'Back', normal: [0, 1, 0], up: [0, 0, 1], view: 'back' },
  { label: 'Right', normal: [1, 0, 0], up: [0, 0, 1], view: 'side' },
  { label: 'Left', normal: [-1, 0, 0], up: [0, 0, 1], view: 'left' },
  { label: 'Top', normal: [0, 0, 1], up: [0, 1, 0], view: 'top' },
  { label: 'Bottom', normal: [0, 0, -1], up: [0, 1, 0], view: 'bottom' },
];

function viewCubeFaceTexture(label) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const shade = ctx.createRadialGradient(size * 0.45, size * 0.4, size * 0.1, size / 2, size / 2, size * 0.75);
  shade.addColorStop(0, '#ffffff');
  shade.addColorStop(0.7, '#f4f6f9');
  shade.addColorStop(1, '#d9dfe7');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.28)';
  ctx.lineWidth = 3;
  const inset = 10;
  const radius = 14;
  ctx.beginPath();
  ctx.moveTo(inset + radius, inset);
  ctx.arcTo(size - inset, inset, size - inset, size - inset, radius);
  ctx.arcTo(size - inset, size - inset, inset, size - inset, radius);
  ctx.arcTo(inset, size - inset, inset, inset, radius);
  ctx.arcTo(inset, inset, size - inset, inset, radius);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#334155';
  ctx.font = '600 54px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, size / 2, size / 2 + 3);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function buildViewCube() {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  const faces = [];
  VIEW_CUBE_FACES.forEach((face, index) => {
    const normal = new THREE.Vector3().fromArray(face.normal);
    const up = new THREE.Vector3().fromArray(face.up);
    const right = new THREE.Vector3().crossVectors(up, normal);
    const material = new THREE.MeshLambertMaterial({
      map: viewCubeFaceTexture(face.label),
      color: VIEW_CUBE_FACE,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
    mesh.position.copy(normal).multiplyScalar(0.5);
    mesh.userData.faceIndex = index;
    group.add(mesh);
    faces.push(mesh);
  });
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
    new THREE.LineBasicMaterial({ color: 0x94a3b8 }),
  );
  group.add(edges);
  scene.add(group);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3b2, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  return {
    scene,
    camera,
    faces,
    key,
    hovered: null,
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(),
  };
}

export function setViewCubeHover(cube, face) {
  if (!cube || cube.hovered === face) return false;
  if (cube.hovered) cube.hovered.material.color.setHex(VIEW_CUBE_FACE);
  cube.hovered = face;
  if (face) face.material.color.setHex(VIEW_CUBE_FACE_HOVER);
  return true;
}

export function disposeViewCube(cube) {
  if (!cube) return;
  cube.scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    materials.forEach((material) => {
      if (material.map) material.map.dispose();
      material.dispose();
    });
  });
}

/** Where the cube sits on a canvas, in CSS pixels from its top-left corner. */
export function viewCubeRect(canvas) {
  const width = Math.max(canvas.clientWidth, 1);
  return { left: width - VIEW_CUBE_PX - VIEW_CUBE_MARGIN, top: VIEW_CUBE_MARGIN, size: VIEW_CUBE_PX };
}

/** The cube face under a pointer, or null when the pointer is not on the cube. */
export function viewCubeHit(cube, canvas, clientX, clientY) {
  const bounds = canvas.getBoundingClientRect();
  const rect = viewCubeRect(canvas);
  const x = clientX - bounds.left - rect.left;
  const y = clientY - bounds.top - rect.top;
  if (x < 0 || y < 0 || x > rect.size || y > rect.size) return null;
  cube.pointer.set((x / rect.size) * 2 - 1, -(y / rect.size) * 2 + 1);
  cube.raycaster.setFromCamera(cube.pointer, cube.camera);
  const hits = cube.raycaster.intersectObjects(cube.faces, false);
  return hits.length ? hits[0].object : null;
}

/** True when a client point lies inside the cube's square (hit or not). */
export function isInViewCube(canvas, clientX, clientY) {
  const bounds = canvas.getBoundingClientRect();
  const rect = viewCubeRect(canvas);
  const x = clientX - bounds.left - rect.left;
  const y = clientY - bounds.top - rect.top;
  return x >= 0 && y >= 0 && x <= rect.size && y <= rect.size;
}

const TEMP_RIGHT = new THREE.Vector3();

/**
 * Draw the cube into the corner of the viewer's own canvas, seen from where
 * the main camera is, so it turns exactly as the part does. Called right
 * after the viewer has drawn its frame.
 */
export function renderViewCube(renderer, cube, canvas, viewDir, up) {
  const rect = viewCubeRect(canvas);
  const viewWidth = Math.max(canvas.clientWidth, 1);
  const viewHeight = Math.max(canvas.clientHeight, 1);
  cube.camera.position.copy(viewDir).normalize().multiplyScalar(3.4);
  cube.camera.up.copy(up);
  cube.camera.lookAt(0, 0, 0);
  TEMP_RIGHT.crossVectors(cube.camera.position, cube.camera.up).normalize();
  cube.key.position.copy(cube.camera.position)
    .addScaledVector(cube.camera.up, 2.2)
    .addScaledVector(TEMP_RIGHT, -1.4);
  const bottom = viewHeight - rect.top - rect.size;
  const autoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.setViewport(rect.left, bottom, rect.size, rect.size);
  renderer.setScissor(rect.left, bottom, rect.size, rect.size);
  renderer.setScissorTest(true);
  renderer.render(cube.scene, cube.camera);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, viewWidth, viewHeight);
  renderer.autoClear = autoClear;
}

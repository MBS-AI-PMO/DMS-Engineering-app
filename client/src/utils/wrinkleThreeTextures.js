// Three.js CanvasTextures for powder-coat wrinkle finish used by 3D viewers
// (StepModelViewer, DxfModelViewer). Builds two paired textures from a single
// fractal-noise heightfield:
//   • normalMap   — perturbs surface direction so specular highlights form
//                   on the granule peaks.
//   • roughnessMap— per-pixel roughness (peaks shiny, valleys matte) — this
//                   is what makes wrinkle coat read as wrinkled even on a
//                   flat black base where a plain normal map is invisible.
//
// Both textures share the same heightfield so features align perfectly.
// Cached at module level — generated once per session.

import * as THREE from 'three';

let __normalCache = null;
let __grainCache = null;

const buildHeightfield = (size) => {
  const makeOctave = (step) => {
    const cells = Math.ceil(size / step);
    const grid = new Float32Array((cells + 1) * (cells + 1));
    for (let y = 0; y <= cells; y++) {
      for (let x = 0; x <= cells; x++) {
        const gx = x === cells ? 0 : x;
        const gy = y === cells ? 0 : y;
        grid[y * (cells + 1) + x] = grid[gy * (cells + 1) + gx] || Math.random();
      }
    }
    const out = new Float32Array(size * size);
    const smooth = (t) => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) {
      const fy = y / step, iy = Math.floor(fy), ty = smooth(fy - iy);
      for (let x = 0; x < size; x++) {
        const fx = x / step, ix = Math.floor(fx), tx = smooth(fx - ix);
        const a = grid[iy * (cells + 1) + ix];
        const b = grid[iy * (cells + 1) + (ix + 1)];
        const c = grid[(iy + 1) * (cells + 1) + ix];
        const d = grid[(iy + 1) * (cells + 1) + (ix + 1)];
        const top = a + (b - a) * tx, bot = c + (d - c) * tx;
        out[y * size + x] = top + (bot - top) * ty;
      }
    }
    return out;
  };
  const fine = makeOctave(2), mid = makeOctave(5), broad = makeOctave(14);
  const h = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    h[i] = Math.pow(fine[i] * 0.55 + mid[i] * 0.3 + broad[i] * 0.15, 0.85);
  }
  return h;
};

const build = () => {
  const size = 128;
  const heights = buildHeightfield(size);

  // Normal map — stronger xy contribution so bumps are actually visible.
  const nCanvas = document.createElement('canvas');
  nCanvas.width = size; nCanvas.height = size;
  const nCtx = nCanvas.getContext('2d');
  const nImg = nCtx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const hL = heights[y * size + ((x - 1 + size) % size)];
      const hR = heights[y * size + ((x + 1) % size)];
      const hU = heights[((y - 1 + size) % size) * size + x];
      const hD = heights[((y + 1) % size) * size + x];
      const nx = (hL - hR) * 3.5;
      const ny = (hU - hD) * 3.5;
      const nz = 0.4;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nImg.data[idx] = ((nx / len) * 0.5 + 0.5) * 255;
      nImg.data[idx + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      nImg.data[idx + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      nImg.data[idx + 3] = 255;
    }
  }
  nCtx.putImageData(nImg, 0, 0);
  const normalTex = new THREE.CanvasTexture(nCanvas);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(35, 35);

  // Grain map — peaks (high h) = low roughness value = shinier.
  const gCanvas = document.createElement('canvas');
  gCanvas.width = size; gCanvas.height = size;
  const gCtx = gCanvas.getContext('2d');
  const gImg = gCtx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.round(255 - heights[i] * 200);
    const j = i * 4;
    gImg.data[j] = v; gImg.data[j + 1] = v; gImg.data[j + 2] = v; gImg.data[j + 3] = 255;
  }
  gCtx.putImageData(gImg, 0, 0);
  const grainTex = new THREE.CanvasTexture(gCanvas);
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  grainTex.repeat.set(35, 35);

  __normalCache = normalTex;
  __grainCache = grainTex;
};

export const getWrinkleNormalTexture = () => {
  if (!__normalCache) build();
  return __normalCache;
};

export const getWrinkleGrainTexture = () => {
  if (!__grainCache) build();
  return __grainCache;
};

// Generates a tileable grayscale bump texture (data URL) used to overlay on
// powder-coat color swatches so "wrinkle finish" options look visually
// wrinkled in the UI.
//
// Technique: fractal value-noise (three octaves at decreasing tile sizes,
// weighted-summed) — produces a fine, dense, organic grain similar to how
// real wrinkle-coat granules read. Pure Voronoi cells looked too chunky; FBM
// noise gives the speckled "peaks and valleys" look.
//
// Applied to a flat base color via `background-blend-mode: overlay`, the
// mid-gray noise leaves color identity intact while brighter/darker pixels
// lift highlights and deepen shadows — mimicking the bumpy surface.

let __wrinkleDataURLCache = null;

// Tileable value-noise octave: fill a size×size grid with random values at
// spacing `step`, then bilinearly interpolate between them. Edges wrap so the
// result tiles seamlessly.
const makeOctave = (size, step) => {
  const cells = Math.ceil(size / step);
  const grid = new Float32Array((cells + 1) * (cells + 1));
  for (let y = 0; y <= cells; y++) {
    for (let x = 0; x <= cells; x++) {
      // Wrap edge columns/rows to the first for seamless tiling.
      const gx = x === cells ? 0 : x;
      const gy = y === cells ? 0 : y;
      grid[y * (cells + 1) + x] = grid[gy * (cells + 1) + gx] || Math.random();
    }
  }
  const out = new Float32Array(size * size);
  const smoothstep = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const fy = y / step;
    const iy = Math.floor(fy);
    const ty = smoothstep(fy - iy);
    for (let x = 0; x < size; x++) {
      const fx = x / step;
      const ix = Math.floor(fx);
      const tx = smoothstep(fx - ix);
      const a = grid[iy * (cells + 1) + ix];
      const b = grid[iy * (cells + 1) + (ix + 1)];
      const c = grid[(iy + 1) * (cells + 1) + ix];
      const d = grid[(iy + 1) * (cells + 1) + (ix + 1)];
      const top = a + (b - a) * tx;
      const bot = c + (d - c) * tx;
      out[y * size + x] = top + (bot - top) * ty;
    }
  }
  return out;
};

export const getWrinkleBumpDataURL = () => {
  if (__wrinkleDataURLCache) return __wrinkleDataURLCache;

  const size = 128;
  // Three octaves: fine grain + mid clusters + broader shading.
  const fine = makeOctave(size, 2);
  const mid = makeOctave(size, 5);
  const broad = makeOctave(size, 14);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);

  for (let i = 0; i < size * size; i++) {
    // Weighted FBM sum — fine grain dominates, broader shading adds contour.
    let n = fine[i] * 0.55 + mid[i] * 0.3 + broad[i] * 0.15;
    // Contrast pass — steepen peaks/valleys so "overlay" blend reads clearly.
    n = Math.pow(n, 0.85);
    // Map to 70..215 — balanced around 128 (neutral for overlay blend).
    const v = Math.max(0, Math.min(255, Math.round(70 + n * 145)));
    const idx = i * 4;
    imgData.data[idx] = v;
    imgData.data[idx + 1] = v;
    imgData.data[idx + 2] = v;
    imgData.data[idx + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  __wrinkleDataURLCache = canvas.toDataURL('image/png');
  return __wrinkleDataURLCache;
};

// Returns inline style props to paint `color` with a wrinkled overlay when
// `isWrinkled` is true. Falls back to a plain background color otherwise.
// `tileSize` controls how tight the wrinkle grain reads on the swatch —
// smaller = finer-looking granules. ~16–20 px reads like real wrinkle coat
// on a 100 px circle; smaller swatches want proportionally smaller tiles.
export const wrinkleSwatchStyle = (color, isWrinkled, tileSize = 18) => {
  if (!isWrinkled) return { backgroundColor: color };
  const url = getWrinkleBumpDataURL();
  return {
    backgroundColor: color,
    backgroundImage: `url(${url})`,
    backgroundRepeat: 'repeat',
    backgroundSize: `${tileSize}px ${tileSize}px`,
    backgroundBlendMode: 'overlay',
  };
};

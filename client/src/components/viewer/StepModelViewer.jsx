import React, { useEffect, useRef, useState } from 'react';
import * as OV from 'online-3d-viewer';
import * as THREE from 'three';
import { getWrinkleNormalTexture as getWrinkleNormal, getWrinkleGrainTexture as getWrinkleGrain } from '../../utils/wrinkleThreeTextures';

const SCREW_GAUGE_MAJOR_IN = {
  0: 0.060,
  1: 0.073,
  2: 0.086,
  3: 0.099,
  4: 0.112,
  5: 0.125,
  6: 0.138,
  8: 0.164,
  10: 0.190,
  12: 0.216,
};

const parseSizeSpecMajorIn = (sizeSpec) => {
  if (!sizeSpec) return null;
  const normalized = String(sizeSpec).trim().toUpperCase().replace(/\s+/g, '');
  if (!normalized) return null;

  const metric = normalized.match(/^M(\d+(?:\.\d+)?)/);
  if (metric) {
    const mm = Number(metric[1]);
    return Number.isFinite(mm) && mm > 0 ? (mm / 25.4) : null;
  }

  const fractional = normalized.match(/^(\d+)\/(\d+)-\d+/);
  if (fractional) {
    const n = Number(fractional[1]);
    const d = Number(fractional[2]);
    return Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? (n / d) : null;
  }

  const gauge = normalized.match(/^#?(\d+)-\d+/);
  if (gauge) {
    const g = Number(gauge[1]);
    return Number.isFinite(g) ? (SCREW_GAUGE_MAJOR_IN[g] ?? null) : null;
  }

  return null;
};

const parseTapRangeIn = (value) => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value > 2 ? (value / 25.4) : value;
  }

  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;

  const hasMmUnit = raw.includes('mm');
  const cleaned = raw
    .replace(/inches|inch|in|mm|"/g, '')
    .trim();
  if (!cleaned) return null;

  let parsed = null;
  if (cleaned.includes('/')) {
    const [nRaw, dRaw] = cleaned.split('/', 2);
    const n = Number(nRaw);
    const d = Number(dRaw);
    if (Number.isFinite(n) && Number.isFinite(d) && d !== 0) {
      parsed = n / d;
    }
  }
  if (parsed === null) {
    const n = Number(cleaned);
    if (Number.isFinite(n)) parsed = n;
  }
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  if (hasMmUnit || parsed > 2) return parsed / 25.4;
  return parsed;
};

const isTapOptionCompatible = (diaIn, tapOption, toleranceIn = 0.0015) => {
  if (!Number.isFinite(diaIn) || diaIn <= 0 || !tapOption) return false;

  const minRaw = tapOption.min_diameter ?? tapOption.minDiameter ?? tapOption.min;
  const maxRaw = tapOption.max_diameter ?? tapOption.maxDiameter ?? tapOption.max;
  const singleRaw = tapOption.diameter ?? tapOption.size ?? null;

  let minIn = parseTapRangeIn(minRaw);
  let maxIn = parseTapRangeIn(maxRaw);

  if (!Number.isFinite(minIn) && !Number.isFinite(maxIn)) {
    const singleIn = parseTapRangeIn(singleRaw);
    if (!Number.isFinite(singleIn)) return false;
    minIn = singleIn;
    maxIn = singleIn;
  } else if (!Number.isFinite(minIn)) {
    minIn = maxIn;
  } else if (!Number.isFinite(maxIn)) {
    maxIn = minIn;
  }

  const low = Math.min(minIn, maxIn) - toleranceIn;
  const high = Math.max(minIn, maxIn) + toleranceIn;
  return diaIn >= low && diaIn <= high;
};

const resolveNutBoreMm = (item) => {
  const minorDiaIn = item?.minor_dia ? Number(item.minor_dia) : null;
  if (Number.isFinite(minorDiaIn) && minorDiaIn > 0) return minorDiaIn * 25.4;

  const majorDiaIn = item?.major_dia ? Number(item.major_dia) : null;
  if (Number.isFinite(majorDiaIn) && majorDiaIn > 0) return majorDiaIn * 25.4;

  const sizeMajorIn = parseSizeSpecMajorIn(item?.size_spec || item?.name || '');
  if (Number.isFinite(sizeMajorIn) && sizeMajorIn > 0) return sizeMajorIn * 25.4 * 1.02;

  const shankIn = item?.shank ? Number(item.shank) : null;
  if (Number.isFinite(shankIn) && shankIn >= 0.04 && shankIn <= 0.6) return shankIn * 25.4;

  const toolingIn = item?.tooling_diameter ? Number(item.tooling_diameter) : null;
  const baseIn = item?.base_width ? Number(item.base_width) : null;
  if (Number.isFinite(toolingIn) && toolingIn > 0) {
    if (!Number.isFinite(baseIn) || toolingIn < (baseIn * 0.9)) return toolingIn * 25.4;
  }

  return null;
};

const resolveStandoffFitMm = (item) => {
  const toolingIn = item?.tooling_diameter ? Number(item.tooling_diameter) : null;
  if (Number.isFinite(toolingIn) && toolingIn > 0) return toolingIn * 25.4;

  const shankIn = item?.shank ? Number(item.shank) : null;
  if (Number.isFinite(shankIn) && shankIn > 0) return shankIn * 25.4;

  const minorIn = item?.minor_dia ? Number(item.minor_dia) : null;
  if (Number.isFinite(minorIn) && minorIn > 0) return minorIn * 25.4;

  const majorIn = item?.major_dia ? Number(item.major_dia) : null;
  if (Number.isFinite(majorIn) && majorIn > 0) return majorIn * 25.4;

  const sizeMajorIn = parseSizeSpecMajorIn(item?.size_spec || item?.name || '');
  if (Number.isFinite(sizeMajorIn) && sizeMajorIn > 0) return sizeMajorIn * 25.4;

  return null;
};

const resolveStudFitMm = (item) => {
  const shankIn = item?.shank ? Number(item.shank) : null;
  if (Number.isFinite(shankIn) && shankIn > 0) return shankIn * 25.4;

  const toolingIn = item?.tooling_diameter ? Number(item.tooling_diameter) : null;
  if (Number.isFinite(toolingIn) && toolingIn > 0) return toolingIn * 25.4;

  const minorIn = item?.minor_dia ? Number(item.minor_dia) : null;
  if (Number.isFinite(minorIn) && minorIn > 0) return minorIn * 25.4;

  const majorIn = item?.major_dia ? Number(item.major_dia) : null;
  if (Number.isFinite(majorIn) && majorIn > 0) return majorIn * 25.4;

  const sizeMajorIn = parseSizeSpecMajorIn(item?.size_spec || item?.name || '');
  if (Number.isFinite(sizeMajorIn) && sizeMajorIn > 0) return sizeMajorIn * 25.4;

  return null;
};

const PREVIEW_MATTE_HEX = 0x767d86;
const REDUCED_HARDWARE_HEX = 0xC62828;

const StepModelViewer = ({
  selectedFile,
  detectedHoles = [],
  selectedTaps = {},
  activeTapHole = null,
  setActiveTapHole,
  isTappingActive,
  tapOptions = [],
  selectedHardware = {},
  hardwareResizeReport = {},
  isHardwareActive = false,
  hwItemsByType = {},
  modelUrlOverride = null,
  selectedCountersinks = {},
  showCountersinkMarkers = true,
  countersinkMarkerStyle = 'highlight',
  csOptions = [],
  isCountersinkingActive = false,
  activeFinishColor = null,
  isFinishPowderCoating = false,
  isBendingActive = false,
  detectedBends = [],
  selectedThickness = null,
  isModelFadedManually = false,
  isAnodizingModalOpen = false,
  dimensions = null,
  allServices = [],
  backendData = null,
  onModelLoaded = () => { },
  onModelLoadFailed = () => { },
  onProgress = () => { },
  onDimensionsExtracted = () => { },
}) => {
  const containerRef = useRef(null);
  const viewerInstance = useRef(null);
  const modelRef = useRef(null);
  const modelOriginalDataRef = useRef(null);
  const centroidRef = useRef(new THREE.Vector3(0, 0, 0));
  const holeMarkersRef = useRef([]);
  const [modelLoadCount, setModelLoadCount] = useState(0);

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

  const createReducedHardwareMaterial = () => new THREE.MeshStandardMaterial({
    color: REDUCED_HARDWARE_HEX,
    emissive: 0x1a0000,
    emissiveIntensity: 0.08,
    metalness: 0.16,
    roughness: 0.52,
    side: THREE.DoubleSide,
  });

  // --- Procedural Texture (module-cached, generated once per session) ---
  useEffect(() => {
    if (!wrinkleNormal.current) wrinkleNormal.current = getWrinkleNormal();
    if (!wrinkleGrain.current) wrinkleGrain.current = getWrinkleGrain();
  }, []);

  // --- Core 3D Entry Effect ---
  useEffect(() => {
    if (!selectedFile || !containerRef.current) return;
    const currentRef = containerRef.current;

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

    try {
      const useConfiguredPreviewShading = Boolean(modelUrlOverride);
      const disableEdgesForConfiguredPreview = useConfiguredPreviewShading;
      const viewer = new OV.EmbeddedViewer(currentRef, {
        backgroundColor: new OV.RGBAColor(255, 255, 255, 255),
        edgeSettings: new OV.EdgeSettings(!disableEdgesForConfiguredPreview, new OV.RGBColor(0, 0, 0), 1),
        onModelLoaded: () => {
          clearInterval(progressTimer); onProgress(100);
          const m = viewer.GetModel();
          modelRef.current = m;
          extractDimensions(m);
          onModelLoaded();

          const v = viewer.GetViewer();
          const bb = OV.GetBoundingBox(m);
          const center = new THREE.Vector3((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2);
          centroidRef.current.copy(center);

          // Add lighting
          v?.scene?.add(new THREE.HemisphereLight(0xffffff, 0x7b8794, useConfiguredPreviewShading ? 0.4 : 0.84));
          const dl1 = new THREE.DirectionalLight(0xffffff, useConfiguredPreviewShading ? 0.42 : 0.55); dl1.position.set(100, 200, 100); v?.scene?.add(dl1);
          const dl2 = new THREE.DirectionalLight(0xffffff, useConfiguredPreviewShading ? 0.14 : 0.24); dl2.position.set(-100, -200, -100); v?.scene?.add(dl2);

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
                else if (useConfiguredPreviewShading) m.color.setHex(PREVIEW_MATTE_HEX);
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
            try { viewer.FitToWindow(); viewer.Render(); } catch { console.debug('FitToWindow skipped'); }
          }, 200);
        },
        onModelLoadFailed: () => {
          clearInterval(progressTimer);
          onProgress(100);
          onModelLoadFailed();
        }
      });

      viewerInstance.current = viewer;
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
          try { viewer.FitToWindow(); viewer.Render(); } catch { console.debug('Resize FitToWindow skipped'); }
        } catch (e) {
          console.warn('Resize observer error:', e);
        }
      });
      resizeObserver.observe(currentRef);

      return () => {
        clearInterval(progressTimer);
        resizeObserver.disconnect();

        holeMarkersRef.current.forEach((m) => {
          m.parent?.remove(m);
          if (m.geometry?.dispose) m.geometry.dispose();
        });
        holeMarkersRef.current = [];
        resetMarkerMaterialCache();

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

  // --- Thickness Scaling ---
  useEffect(() => {
    if (!viewerInstance.current || modelLoadCount === 0) return;
    const data = modelOriginalDataRef.current;
    if (!data?.root) return;
    const { root, origScale, origPosition, thicknessAxis, origThicknessMM, localCenter } = data;
    if (!selectedThickness) {
      root.scale.copy(origScale);
      root.position.copy(origPosition);
    } else {
      const newThicknessMM = parseFloat(selectedThickness) * 25.4;
      const scaleFactor = origThicknessMM > 0 ? newThicknessMM / origThicknessMM : 1;
      root.scale[thicknessAxis] = origScale[thicknessAxis] * scaleFactor;
      root.position[thicknessAxis] = origPosition[thicknessAxis] + localCenter * (1 - scaleFactor);
    }
    setTimeout(() => {
      try { viewerInstance.current?.FitToWindow(); viewerInstance.current?.Render(); } catch { console.debug('Scale FitToWindow skipped'); }
    }, 50);
  }, [selectedThickness, modelLoadCount]);

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
                side: THREE.DoubleSide, roughness: 0.6, metalness: 0.05
              });
              obj.material = Array.isArray(obj.material) ? obj.material.map(upgrade) : upgrade(obj.material);
              obj.userData._matCloned = true;
            }
            const fm = Array.isArray(obj.material) ? obj.material[idx] : obj.material;
            if (!obj.userData.origColor) obj.userData.origColor = { r: fm.color.r, g: fm.color.g, b: fm.color.b };

            const nativeHoleId = obj.userData.nativeHoleId;
            const isNativeHole = Boolean(obj.userData.isNativeHole) && nativeHoleId !== undefined && nativeHoleId !== null;
            const isTapped = isNativeHole && Boolean(selectedTaps[nativeHoleId]);
            const isNotTappedTapHole = isNativeHole && isTappingActive && !isTapped;

            if (isTapped) { fm.color.set(0x2563eb); fm.emissive.set(0x000000); fm.emissiveIntensity = 0; }
            else if (isNotTappedTapHole) { fm.color.set(0xef4444); fm.emissive.set(0x000000); fm.emissiveIntensity = 0; }
            else if (hasForcedFinishColor) {
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
              const oc = obj.userData.origColor;
              fm.color.setRGB(oc.r, oc.g, oc.b);
              if (useConfiguredPreviewShading) {
                fm.color.multiplyScalar(0.68);
              }
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
              fm.roughness = useConfiguredPreviewShading ? 0.92 : 0.65;
              fm.metalness = useConfiguredPreviewShading ? 0.03 : 0.05;
              fm.normalMap = null;
              fm.roughnessMap = null;
            }

            const shouldFade = isModelFadedManually || (activeTapHole !== null && !isAnodizingModalOpen);
            const finalFade = (shouldFade && !obj.userData.isNativeHole) ? true : false;
            fm.transparent = finalFade || fm.opacity < 1;
            fm.opacity = (shouldFade && !obj.userData.isNativeHole) ? 0.05 : 1.0;
            fm.needsUpdate = true;
          });
        });
        v.Render();
      } catch (err) { console.warn('Style application error:', err); }
    };
    apply();
  }, [activeFinishColor, isFinishPowderCoating, modelLoadCount, activeTapHole, isAnodizingModalOpen, isModelFadedManually, selectedTaps, modelUrlOverride, detectedHoles, isTappingActive]);

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
          } else if (obj.userData.origColor) {
            m.color.setRGB(obj.userData.origColor.r, obj.userData.origColor.g, obj.userData.origColor.b);
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
        const shouldShowCountersinks = showCountersinkMarkers && (isCountersinkingActive || hasCSAssigned);
        if ((!isTappingActive && !hasHwAssigned && !shouldShowCountersinks) || detectedHoles.length === 0) { v.Render(); return; }

        const modelData = modelOriginalDataRef.current;
        const modelRoot = modelData?.root || v.scene;
        const scaleFactor = modelData ? (parseFloat(selectedThickness || 1) * 25.4) / modelData.origThicknessMM : 1;
        const _ta = modelData?.thicknessAxis || 'y';
        const origT = modelData?.origThicknessMM || 2.0;

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

        let panelHex = 0x9ca3af;
        const panelColorWeights = new Map();
        v.scene.traverse(o => {
          if (!o.isMesh || o.userData.isHoleMarker || o.isHardwareMarker || !o.material) return;
          const posCount = o.geometry?.attributes?.position?.count || 1;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (!m?.color) return;
            const hex = m.color.getHex();
            panelColorWeights.set(hex, (panelColorWeights.get(hex) || 0) + posCount);
          });
        });
        if (panelColorWeights.size > 0) {
          panelHex = Array.from(panelColorWeights.entries()).sort((a, b) => b[1] - a[1])[0][0];
        }

        const makeRing = (iR, oR, h) => new THREE.LatheGeometry([new THREE.Vector2(iR, h / 2), new THREE.Vector2(iR, -h / 2), new THREE.Vector2(oR, -h / 2), new THREE.Vector2(oR, h / 2), new THREE.Vector2(iR, h / 2)], 32);

        const addMesh = (geo, mat, p, axis) => {
          const mesh = new THREE.Mesh(geo, mat);
          mesh.userData.isHoleMarker = true; mesh.isHardwareMarker = true;
          mesh.position.copy(p);
          mesh.lookAt(p.clone().add(axis));
          mesh.rotateX(Math.PI / 2);
          if (modelRoot !== v.scene) { mesh.scale.set(1, 1, 1); mesh.scale[_ta] = 1 / scaleFactor; }
          modelRoot.add(mesh);
          holeMarkersRef.current.push(mesh);
          return mesh;
        };

        // Reuse Material cache for markers
        const getMarkerMat = (key, creator) => {
          if (!matCache.current.has(key)) matCache.current.set(key, creator());
          return matCache.current.get(key);
        };

        // --- Tapping ---
        const hasTapsAssigned = Object.keys(selectedTaps).length > 0;
        if (isTappingActive || hasTapsAssigned) {
          const selectedThicknessMm = Number.parseFloat(selectedThickness);
          const selectedThicknessHintMm = Number.isFinite(selectedThicknessMm) && selectedThicknessMm > 0
            ? (selectedThicknessMm * 25.4)
            : null;
          const dimensionsThicknessMm = Number(dimensions?.mm?.t);
          const dimensionThicknessHintMm = Number.isFinite(dimensionsThicknessMm) && dimensionsThicknessMm > 0
            ? dimensionsThicknessMm
            : null;
          const thicknessHintMm = selectedThicknessHintMm || dimensionThicknessHintMm || null;

          detectedHoles.forEach(hole => {
            const diaImm = hole.diameter_mm || (hole.diameter_in ? hole.diameter_in * 25.4 : (hole.diameterInches ? hole.diameterInches * 25.4 : 2.54));
            const mmDia = diaImm; if (mmDia > 200) return;
            const isTapped = !!selectedTaps[hole.id];
            const isConfigured = false;
            const baseColor = isTapped ? 0x2563eb : 0xef4444;
            const mat = getMarkerMat(`tap_${baseColor}_${isTapped}`, () => new THREE.MeshPhongMaterial({
              color: baseColor,
              emissive: baseColor,
              emissiveIntensity: isTapped ? 0.95 : 0.42,
              shininess: 85,
              side: THREE.DoubleSide
            }));

            const depthRawMm = Number(hole.depthMm ?? hole.depth_mm ?? 0);
            let markerHeightMm = Number.isFinite(depthRawMm) && depthRawMm > 0
              ? depthRawMm
              : (thicknessHintMm || origT);
            if (Number.isFinite(thicknessHintMm) && thicknessHintMm > 0) {
              markerHeightMm = Math.min(markerHeightMm, Math.max(0.8, thicknessHintMm * 1.15));
            }
            markerHeightMm = Math.max(0.8, markerHeightMm);

            const markerInsetMm = Math.min(0.14, Math.max(0.04, mmDia * 0.045));
            const markerRadius = Math.max(0.28, (mmDia / 2) - markerInsetMm);
            const geo = new THREE.CylinderGeometry(markerRadius, markerRadius, markerHeightMm, 64, 1, true);
            const m = addMesh(geo, mat, new THREE.Vector3(...hole.position), hole.axis ? new THREE.Vector3(...hole.axis) : hwThicknessVec);
            m.userData.hole = { ...hole, isConfigured };
          });
        }

        // --- Hardware ---
        if (hasHwAssigned) {
          const HW_COLORS = { 1: 0x059669, 2: 0x6366f1, 3: 0xB8860B, 4: 0xDC2626 };
          const boreMat = getMarkerMat('bore', () => new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.4 }));

          Object.entries(selectedHardware).forEach(([holeId, hw]) => {
            const hole = detectedHoles.find(h => h.id.toString() === holeId.toString());
            if (!hole) return;
            const { item, typeId, face } = hw;
            const holeR = (hole.diameter_mm || (hole.diameter_in ? hole.diameter_in * 25.4 : (hole.diameterInches ? hole.diameterInches * 25.4 : 2.54))) / 2;
            const toolingDiaMm = item?.tooling_diameter ? parseFloat(item.tooling_diameter) * 25.4 : null;
            const baseWidthMm = item?.base_width ? parseFloat(item.base_width) * 25.4 : null;
            const lengthMm = item?.length ? parseFloat(item.length) * 25.4 : null;
            const majorDiaMm = item?.major_dia ? parseFloat(item.major_dia) * 25.4 : null;
            const resolvedNutBoreMm = resolveNutBoreMm(item);
            const resolvedStudFitMm = resolveStudFitMm(item);
            const type = Number(typeId) || 3;
            let hwOuterR, hwBoreR;
            if (type === 3) {
              // Nuts: use admin-configured dimensions as the source of truth.
              const configuredOuterMm = baseWidthMm || majorDiaMm || null;
              const configuredBoreMm = resolvedNutBoreMm;
              hwOuterR = configuredOuterMm ? (configuredOuterMm / 2) : (configuredBoreMm ? (configuredBoreMm / 2) * 1.65 : holeR * 1.6);
              hwBoreR = configuredBoreMm ? (configuredBoreMm / 2) : (hwOuterR * 0.55);
            }
            else if (type === 2) { const br = toolingDiaMm ? toolingDiaMm / 2 : holeR; hwOuterR = br * 1.33; hwBoreR = br * 0.6; }
            else if (type === 4) {
              const configuredOuterMm = baseWidthMm || majorDiaMm || null;
              const configuredBoreMm = resolvedNutBoreMm;
              hwOuterR = configuredOuterMm ? (configuredOuterMm / 2) : (configuredBoreMm ? (configuredBoreMm / 2) * 1.7 : holeR * 1.5);
              hwBoreR = configuredBoreMm ? (configuredBoreMm / 2) : (hwOuterR * 0.55);
            }
            else {
              const studFitR = resolvedStudFitMm ? (resolvedStudFitMm / 2) : (toolingDiaMm ? toolingDiaMm / 2 : holeR * 0.9);
              hwOuterR = baseWidthMm ? Math.max(baseWidthMm / 2, studFitR * 1.12) : studFitR * 1.45;
              hwBoreR = studFitR;
            }
            if (type === 3 || type === 4) {
              hwBoreR = Math.min(hwBoreR, hwOuterR * 0.85);
            } else if (type !== 2) {
              hwBoreR = Math.min(hwBoreR, holeR * 0.99, hwOuterR * 0.85);
            }

            const defaultColor = HW_COLORS[type] || 0xB8860B;
            const mat = getMarkerMat(`hw_${defaultColor}`, () => new THREE.MeshStandardMaterial({ color: defaultColor, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }));
            const soMat = getMarkerMat(`so_${defaultColor}`, () => new THREE.MeshStandardMaterial({ color: defaultColor, metalness: 0.75, roughness: 0.25 }));

            let axisVec = hole.axis ? new THREE.Vector3(...hole.axis) : hwThicknessVec.clone();
            if (axisVec.dot(hwThicknessVec) < 0) axisVec.negate();
            const axisNorm = axisVec.clone().normalize();
            const faceSign = face === 'down' ? -1 : 1;
            const shouldUsePhysicalNutResize = Boolean(modelUrlOverride);
            const surfaceLift = Math.max(0.35, origT * 0.08) / Math.max(scaleFactor, 1e-6);
            const thinDiscH = Math.max(0.06, 0.16 / Math.max(scaleFactor, 1e-6));
            const baseCenter = new THREE.Vector3(...hole.position);
            const basePos = baseCenter.clone().add(axisNorm.clone().multiplyScalar(faceSign * (origT * 0.5 + surfaceLift)));
            const backSurfacePos = baseCenter.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT * 0.5 + surfaceLift)));

            const maxAllowedHoleR = item?.max_hole_diameter ? (parseFloat(item.max_hole_diameter) * 25.4 / 2) : null;

            const addHoleAdjustDiscs = (targetR, hardwareOuterR = null, options = {}) => {
              const {
                applyFront = true,
                applyBack = true,
                includeTail = true,
                visibleOuterROverride = null,
                useMaxAllowedLimit = true,
              } = options;

              if (!targetR || targetR <= 0) return false;
              // Absolute tolerance avoids treating near-identical holes as reduced.
              if (holeR <= targetR + 0.03) return false;
              if (useMaxAllowedLimit && maxAllowedHoleR !== null && holeR <= maxAllowedHoleR + 0.03) return false;

              const fillMat = getMarkerMat(`fill_${panelHex}`, () => new THREE.MeshStandardMaterial({ color: panelHex, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
              const innerR = Math.max(0.2, targetR * 0.99);
              // Visible adjustment disc size should be consistent for the same hardware item.
              const visibleOuterR = Math.min(
                holeR * 1.005,
                Math.max(
                  innerR + 0.08,
                  visibleOuterROverride || (hardwareOuterR ? (hardwareOuterR * 1.2) : (targetR * 1.4))
                )
              );

              if (applyFront) addMesh(makeRing(innerR, visibleOuterR, thinDiscH), fillMat, basePos.clone(), axisVec);
              if (applyBack) addMesh(makeRing(innerR, visibleOuterR, thinDiscH), fillMat, backSurfacePos.clone(), axisVec);

              // If detected hole is much larger, add non-prominent filler from visible disc to hole wall.
              if (includeTail && holeR > visibleOuterR * 1.01) {
                const tailOuterR = holeR * 1.01;
                if (applyFront) addMesh(makeRing(visibleOuterR, tailOuterR, thinDiscH * 0.8), fillMat, basePos.clone(), axisVec);
                if (applyBack) addMesh(makeRing(visibleOuterR, tailOuterR, thinDiscH * 0.8), fillMat, backSurfacePos.clone(), axisVec);
              }

              return true;
            };

            const addFrontHoleReducerSleeve = (targetR, options = {}) => {
              const {
                sleeveDepthMm = Math.max(0.45, Math.min(1.4, origT * 0.12)),
                outerROverride = null,
                hardwareOuterR = null,
              } = options;

              if (!targetR || targetR <= 0) return false;
              if (holeR <= targetR + 0.03) return false;

              const fillMat = getMarkerMat(`fill_${panelHex}`, () => new THREE.MeshStandardMaterial({ color: panelHex, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
              const innerR = Math.max(0.2, targetR * 0.995);
              const autoOuterR = Math.max(
                innerR + 0.12,
                hardwareOuterR ? (hardwareOuterR * 1.02) : (innerR * 1.18)
              );
              const outerR = Math.max(innerR + 0.06, Math.min(holeR * 1.005, outerROverride || autoOuterR));
              const sleeveH = Math.min(Math.max(sleeveDepthMm, thinDiscH * 2.0), Math.max(0.6, origT * 0.24));
              const sleeveCenterOffset = Math.max(0.0, (origT * 0.5) - (sleeveH * 0.5) + 0.02);
              const sleevePos = baseCenter.clone().add(axisNorm.clone().multiplyScalar(faceSign * sleeveCenterOffset));
              addMesh(makeRing(innerR, outerR, sleeveH), fillMat, sleevePos, axisVec);
              return true;
            };

            if (type === 3) {
              const reductionTargetR = Math.max(hwBoreR || 0, 0.2);
              const nutInnerR = Math.min(reductionTargetR, hwOuterR * 0.85);

              const needsReduction = holeR > (nutInnerR + 0.03);
              if (!shouldUsePhysicalNutResize) {
                const reducedFaceLip = addHoleAdjustDiscs(nutInnerR, hwOuterR, {
                  applyFront: true,
                  applyBack: false,
                  includeTail: false,
                  visibleOuterROverride: Math.max(nutInnerR + 0.06, nutInnerR * 1.1),
                  useMaxAllowedLimit: false,
                });
                const reducedFaceSleeve = addFrontHoleReducerSleeve(nutInnerR, {
                  sleeveDepthMm: Math.max(0.5, Math.min(1.2, origT * 0.1)),
                  hardwareOuterR: hwOuterR,
                });
                // For non-configured fallback, visual fillers are only meaningful when reducing oversized holes.
                // Keep warning color tied to true fit mismatch in either direction.
                void reducedFaceLip;
                void reducedFaceSleeve;
              }

              const nutColor = needsReduction ? 0xDC2626 : panelHex;
              const nutBodyMat = getMarkerMat(
                `hw_nut_matte_${nutColor}_${needsReduction ? 'reduced' : 'native'}`,
                () => needsReduction
                  ? createReducedHardwareMaterial()
                  : new THREE.MeshStandardMaterial({ color: nutColor, metalness: 0.18, roughness: 0.82, side: THREE.DoubleSide })
              );
              const nutH = item?.length ? parseFloat(item.length) * 25.4 : Math.max(3, origT * 0.6);
              addMesh(makeRing(nutInnerR, hwOuterR, nutH), nutBodyMat, basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * nutH / 2)), axisVec);
            } else if (type === 2) {
              const standoffH = item?.length ? parseFloat(item.length) * 25.4 : origT * 1.8;

              // Make standoff look truly fitted: use tooling diameter as the target hole fit.
              const resizeReportEntry =
                (hardwareResizeReport && typeof hardwareResizeReport === 'object')
                  ? (hardwareResizeReport[String(holeId)] || hardwareResizeReport[String(hole.id)] || null)
                  : null;
              const reportAction = String(resizeReportEntry?.action || '').toLowerCase();
              const reportDirection = String(resizeReportEntry?.direction || '').toLowerCase();

              const standoffFitMm = resolveStandoffFitMm(item);
              const reportTargetDiaMm = Number(resizeReportEntry?.target_dia_mm);
              const effectiveFitMm = Number.isFinite(reportTargetDiaMm) && reportTargetDiaMm > 0
                ? reportTargetDiaMm
                : standoffFitMm;
              const targetFitR = effectiveFitMm ? (effectiveFitMm / 2) : holeR;

              // In configured preview, color must follow backend resize report only.
              const isConfiguredPreview = Boolean(modelUrlOverride);
              const backendDecisionKnown = reportAction === 'resized' || reportAction === 'unchanged';
              const heuristicNeedsReduction = holeR > (targetFitR + 0.05);
              const reportNeedsReduction = reportAction === 'resized' && reportDirection === 'reduced';
              const needsReduction = isConfiguredPreview
                ? (backendDecisionKnown ? reportNeedsReduction : heuristicNeedsReduction)
                : (backendDecisionKnown ? reportNeedsReduction : heuristicNeedsReduction);

              const standoffColor = needsReduction ? 0xDC2626 : panelHex;
              const seamOverlap = Math.max(0.015, 0.03 / Math.max(scaleFactor, 1e-6));
              const shankR = Math.max(0.4, targetFitR + seamOverlap);
              const wallT = Math.max(0.24, shankR * 0.22);
              const boreR = Math.max(0.2, shankR - wallT);

              if (!shouldUsePhysicalNutResize) {
                addHoleAdjustDiscs(shankR, hwOuterR, {
                  applyFront: true,
                  applyBack: false,
                  includeTail: false,
                  visibleOuterROverride: Math.max(shankR + 0.08, shankR * 1.1),
                  useMaxAllowedLimit: false,
                });
              }

              const standoffOuterR = shankR;
              const standoffInnerR = Math.min(Math.max(boreR, 0.2), standoffOuterR * 0.9);
              const flangeH = Math.max(0.8, 1.2 / Math.max(scaleFactor, 1e-6));
              const bodyH = Math.max(0.8, standoffH - flangeH);
              const hexHeadR = Math.max(hwOuterR, standoffOuterR * 1.05);
              const contactInset = Math.max(0.01, 0.03 / Math.max(scaleFactor, 1e-6));
              const selectedSurfaceContact = baseCenter.clone().add(
                axisNorm.clone().multiplyScalar(faceSign * (origT * 0.5 - contactInset))
              );
              const oppositeSurfaceContact = baseCenter.clone().add(
                axisNorm.clone().multiplyScalar(-faceSign * (origT * 0.5 - contactInset))
              );
              const standoffBodyCenter = selectedSurfaceContact.clone().add(
                axisNorm.clone().multiplyScalar(faceSign * (bodyH * 0.5 - contactInset))
              );
              const oppositeHeadPos = oppositeSurfaceContact.clone().add(
                axisNorm.clone().multiplyScalar(-faceSign * (flangeH * 0.5 - contactInset))
              );

              const standoffMat = getMarkerMat(
                `hw_standoff_${standoffColor}_${needsReduction ? 'reduced' : 'native'}`,
                () => needsReduction
                  ? createReducedHardwareMaterial()
                  : new THREE.MeshStandardMaterial({
                    color: standoffColor,
                    metalness: 0.28,
                    roughness: 0.68,
                    side: THREE.DoubleSide
                  })
              );

              // Standoff body contacts the selected face directly (no visible air gap).
              addMesh(
                makeRing(standoffInnerR, standoffOuterR, bodyH),
                standoffMat,
                standoffBodyCenter,
                axisVec
              );

              // Front flange/head as hex profile, kept on the same side as the standoff body.
              const hexShape = new THREE.Shape();
              for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i;
                const x = hexHeadR * Math.cos(a);
                const y = hexHeadR * Math.sin(a);
                if (i === 0) hexShape.moveTo(x, y);
                else hexShape.lineTo(x, y);
              }
              hexShape.closePath();

              const hexHole = new THREE.Path();
              hexHole.absarc(0, 0, standoffInnerR * 1.01, 0, Math.PI * 2, false);
              hexShape.holes.push(hexHole);

              const hexRingGeo = new THREE.ExtrudeGeometry(hexShape, {
                depth: flangeH,
                bevelEnabled: false,
                curveSegments: 32,
              });
              // Center geometry around its extrusion axis for easier placement.
              hexRingGeo.translate(0, 0, -flangeH / 2);

              const hexHeadMesh = new THREE.Mesh(hexRingGeo, standoffMat);
              hexHeadMesh.userData.isHoleMarker = true;
              hexHeadMesh.isHardwareMarker = true;
              hexHeadMesh.position.copy(oppositeHeadPos);
              hexHeadMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axisVec.clone().normalize());
              if (modelRoot !== v.scene) {
                hexHeadMesh.scale.set(1, 1, 1);
                hexHeadMesh.scale[_ta] = 1 / scaleFactor;
              }
              modelRoot.add(hexHeadMesh);
              holeMarkersRef.current.push(hexHeadMesh);
            } else if (type === 4) {
              const resizeReportEntry =
                (hardwareResizeReport && typeof hardwareResizeReport === 'object')
                  ? (hardwareResizeReport[String(holeId)] || hardwareResizeReport[String(hole.id)] || null)
                  : null;
              const reportAction = String(resizeReportEntry?.action || '').toLowerCase();
              const reportDirection = String(resizeReportEntry?.direction || '').toLowerCase();

              const flushNutFitMm = resolveNutBoreMm(item);
              const reportTargetDiaMm = Number(resizeReportEntry?.target_dia_mm);
              const effectiveFitMm = Number.isFinite(reportTargetDiaMm) && reportTargetDiaMm > 0
                ? reportTargetDiaMm
                : flushNutFitMm;
              const targetFitR = effectiveFitMm
                ? (effectiveFitMm / 2)
                : Math.max(0.3, hwBoreR || holeR * 0.75);

              const isConfiguredPreview = Boolean(modelUrlOverride);
              const backendDecisionKnown = reportAction === 'resized' || reportAction === 'unchanged';
              const heuristicNeedsReduction = holeR > (targetFitR + 0.05);
              const reportNeedsReduction = reportAction === 'resized' && reportDirection === 'reduced';
              const needsReduction = isConfiguredPreview
                ? (backendDecisionKnown ? reportNeedsReduction : heuristicNeedsReduction)
                : (backendDecisionKnown ? reportNeedsReduction : heuristicNeedsReduction);

              const flushNutColor = needsReduction ? 0xDC2626 : panelHex;
              const seamOverlap = Math.max(0.015, 0.03 / Math.max(scaleFactor, 1e-6));
              const clinchOuterR = Math.max(targetFitR + seamOverlap, targetFitR + 0.14);
              const clinchInnerR = Math.max(0.2, Math.min(hwBoreR * 0.92, clinchOuterR - 0.14));
              const hexHeadR = Math.max(hwOuterR, clinchOuterR * 1.08);
              const headInnerR = Math.max(0.2, Math.min(clinchInnerR * 1.02, hexHeadR * 0.82));
              const clinchBodyH = Math.max(0.55, Math.min(Math.max(0.95, origT * 0.36), 1.5));
              const hexHeadH = Math.max(0.38, Math.min(0.95, hexHeadR * 0.18));

              if (!shouldUsePhysicalNutResize) {
                addHoleAdjustDiscs(targetFitR, hexHeadR, {
                  applyFront: true,
                  applyBack: false,
                  includeTail: false,
                  visibleOuterROverride: Math.max(targetFitR + 0.08, targetFitR * 1.12),
                  useMaxAllowedLimit: false,
                });
                addFrontHoleReducerSleeve(targetFitR, {
                  sleeveDepthMm: Math.max(0.5, Math.min(1.15, origT * 0.11)),
                  hardwareOuterR: hexHeadR,
                });
              }

              const contactInset = Math.max(0.01, 0.03 / Math.max(scaleFactor, 1e-6));
              const selectedSurfaceContact = baseCenter.clone().add(
                axisNorm.clone().multiplyScalar(faceSign * (origT * 0.5 - contactInset))
              );
              const flushNutBodyPos = selectedSurfaceContact.clone().add(
                axisNorm.clone().multiplyScalar(-faceSign * (clinchBodyH * 0.5 - contactInset * 0.35))
              );
              const flushNutHeadPos = selectedSurfaceContact.clone().add(
                axisNorm.clone().multiplyScalar(faceSign * (hexHeadH * 0.5 - contactInset * 0.15))
              );

              const flushNutMat = getMarkerMat(
                `hw_flush_nut_${flushNutColor}_${needsReduction ? 'reduced' : 'native'}`,
                () => needsReduction
                  ? createReducedHardwareMaterial()
                  : new THREE.MeshStandardMaterial({
                    color: flushNutColor,
                    metalness: 0.24,
                    roughness: 0.62,
                    side: THREE.DoubleSide,
                  })
              );

              // Clinch body is slightly tucked into the selected face hole.
              addMesh(
                makeRing(clinchInnerR, clinchOuterR, clinchBodyH),
                flushNutMat,
                flushNutBodyPos,
                axisVec
              );

              // Visible face is a single hex head on the selected side.
              const hexShape = new THREE.Shape();
              for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i;
                const x = hexHeadR * Math.cos(a);
                const y = hexHeadR * Math.sin(a);
                if (i === 0) hexShape.moveTo(x, y);
                else hexShape.lineTo(x, y);
              }
              hexShape.closePath();

              const hexHole = new THREE.Path();
              hexHole.absarc(0, 0, headInnerR * 1.01, 0, Math.PI * 2, false);
              hexShape.holes.push(hexHole);

              const hexHeadGeo = new THREE.ExtrudeGeometry(hexShape, {
                depth: hexHeadH,
                bevelEnabled: false,
                curveSegments: 32,
              });
              hexHeadGeo.translate(0, 0, -hexHeadH / 2);

              const hexHeadMesh = new THREE.Mesh(hexHeadGeo, flushNutMat);
              hexHeadMesh.userData.isHoleMarker = true;
              hexHeadMesh.isHardwareMarker = true;
              hexHeadMesh.position.copy(flushNutHeadPos);
              hexHeadMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axisVec.clone().normalize());
              if (modelRoot !== v.scene) {
                hexHeadMesh.scale.set(1, 1, 1);
                hexHeadMesh.scale[_ta] = 1 / scaleFactor;
              }
              modelRoot.add(hexHeadMesh);
              holeMarkersRef.current.push(hexHeadMesh);
            } else if (type === 1) {
              // Flush stud follows the same resize/color semantics as other hardware types.
              const resizeReportEntry =
                (hardwareResizeReport && typeof hardwareResizeReport === 'object')
                  ? (hardwareResizeReport[String(holeId)] || hardwareResizeReport[String(hole.id)] || null)
                  : null;
              const reportAction = String(resizeReportEntry?.action || '').toLowerCase();
              const reportDirection = String(resizeReportEntry?.direction || '').toLowerCase();

              const studFitMm = resolveStudFitMm(item);
              const reportTargetDiaMm = Number(resizeReportEntry?.target_dia_mm);
              const effectiveFitMm = Number.isFinite(reportTargetDiaMm) && reportTargetDiaMm > 0
                ? reportTargetDiaMm
                : studFitMm;
              const targetFitR = effectiveFitMm ? (effectiveFitMm / 2) : Math.max(0.35, toolingDiaMm ? toolingDiaMm / 2 : holeR * 0.9);

              const isConfiguredPreview = Boolean(modelUrlOverride);
              const backendDecisionKnown = reportAction === 'resized' || reportAction === 'unchanged';
              const heuristicNeedsReduction = holeR > (targetFitR + 0.05);
              const reportNeedsReduction = reportAction === 'resized' && reportDirection === 'reduced';
              const needsReduction = isConfiguredPreview
                ? (backendDecisionKnown ? reportNeedsReduction : heuristicNeedsReduction)
                : (backendDecisionKnown ? reportNeedsReduction : heuristicNeedsReduction);

              const studColor = needsReduction ? 0xDC2626 : panelHex;
              const seamOverlap = Math.max(0.015, 0.03 / Math.max(scaleFactor, 1e-6));
              const studCoreR = Math.max(0.35, targetFitR + seamOverlap);
              const studThreadR = Math.max(studCoreR + 0.06, studCoreR * 1.08);
              const studH = lengthMm || Math.max(origT * 2.0, 4.0);
              const flushHeadR = baseWidthMm
                ? Math.max(studThreadR * 1.08, baseWidthMm / 2)
                : Math.max(studThreadR * 1.18, studThreadR + 0.35);
              const flushHeadH = Math.max(0.35, Math.min(1.0, flushHeadR * 0.2));

              if (!shouldUsePhysicalNutResize) {
                addHoleAdjustDiscs(studCoreR, flushHeadR, {
                  applyFront: true,
                  applyBack: false,
                  includeTail: false,
                  visibleOuterROverride: Math.max(studCoreR + 0.08, studCoreR * 1.12),
                  useMaxAllowedLimit: false,
                });
                addFrontHoleReducerSleeve(studCoreR, {
                  sleeveDepthMm: Math.max(0.5, Math.min(1.15, origT * 0.1)),
                  hardwareOuterR: flushHeadR,
                });
              }

              const contactInset = Math.max(0.01, 0.03 / Math.max(scaleFactor, 1e-6));
              const selectedSurfaceContact = baseCenter.clone().add(
                axisNorm.clone().multiplyScalar(faceSign * (origT * 0.5 - contactInset))
              );
              const oppositeSurfaceContact = baseCenter.clone().add(
                axisNorm.clone().multiplyScalar(-faceSign * (origT * 0.5 - contactInset))
              );
              const studBodyCenter = selectedSurfaceContact.clone().add(
                axisNorm.clone().multiplyScalar(faceSign * (studH * 0.5 - contactInset))
              );
              const flushHeadPos = oppositeSurfaceContact.clone().add(
                axisNorm.clone().multiplyScalar(-faceSign * (flushHeadH * 0.5 - contactInset))
              );

              const studBodyMat = getMarkerMat(
                `hw_stud_body_${studColor}_${needsReduction ? 'reduced' : 'native'}`,
                () => needsReduction
                  ? createReducedHardwareMaterial()
                  : new THREE.MeshStandardMaterial({
                    color: studColor,
                    metalness: 0.34,
                    roughness: 0.58,
                    side: THREE.DoubleSide,
                  })
              );

              const studHeadMat = getMarkerMat(
                `hw_stud_head_${studColor}_${needsReduction ? 'reduced' : 'native'}`,
                () => needsReduction
                  ? createReducedHardwareMaterial()
                  : new THREE.MeshStandardMaterial({
                    color: studColor,
                    metalness: 0.22,
                    roughness: 0.64,
                    side: THREE.DoubleSide,
                  })
              );

              // Threaded shank on selected side.
              addMesh(
                new THREE.CylinderGeometry(studCoreR, studCoreR * 0.985, studH, 56),
                studBodyMat,
                studBodyCenter,
                axisVec
              );

              // Flush clinch head on opposite side.
              addMesh(
                new THREE.CylinderGeometry(flushHeadR, flushHeadR * 0.985, flushHeadH, 56),
                studHeadMat,
                flushHeadPos,
                axisVec
              );

              // Add thread ridges along shank for realistic stud structure.
              const threadPitch = Math.max(0.45, Math.min(1.15, studThreadR * 0.42));
              const ridgeH = Math.max(0.08, Math.min(0.2, threadPitch * 0.42));
              const ridgeCount = Math.max(4, Math.min(36, Math.floor(studH / threadPitch)));
              for (let i = 0; i < ridgeCount; i++) {
                const axialOffset = (-studH * 0.5) + (threadPitch * 0.5) + (i * threadPitch);
                if (Math.abs(axialOffset) > ((studH * 0.5) - (ridgeH * 0.5))) continue;
                const ridgePos = studBodyCenter.clone().add(axisNorm.clone().multiplyScalar(faceSign * axialOffset));
                addMesh(
                  makeRing(studCoreR * 0.99, studThreadR, ridgeH),
                  studBodyMat,
                  ridgePos,
                  axisVec
                );
              }
            }
          });
        }

        // --- Countersinks ---
        if (showCountersinkMarkers && (isCountersinkingActive || hasCSAssigned)) {
          const useConfiguredPreviewShading = Boolean(modelUrlOverride);
          const panelColor = new THREE.Color(panelHex);
          const csIsCamouflage = countersinkMarkerStyle === 'camouflage';
          const csConeColor = useConfiguredPreviewShading
            ? PREVIEW_MATTE_HEX
            : (csIsCamouflage
              ? panelColor.clone().multiplyScalar(0.84).getHex()
              : 0x7c3aed);
          const csLipColor = useConfiguredPreviewShading
            ? PREVIEW_MATTE_HEX
            : (csIsCamouflage
              ? panelColor.clone().multiplyScalar(0.60).getHex()
              : 0x9d4edd);

          const csConeMat = getMarkerMat(
            `cs_cone_${csIsCamouflage ? 'camouflage' : 'highlight'}_${csConeColor}`,
            () => new THREE.MeshStandardMaterial({
              color: csConeColor,
              metalness: useConfiguredPreviewShading ? 0.03 : (csIsCamouflage ? 0.72 : 0.4),
              roughness: useConfiguredPreviewShading ? 0.92 : (csIsCamouflage ? 0.46 : 0.3),
              side: THREE.DoubleSide,
              emissive: (csIsCamouflage || useConfiguredPreviewShading) ? 0x000000 : 0x4c1d95,
              emissiveIntensity: (csIsCamouflage || useConfiguredPreviewShading) ? 0.0 : 0.35
            })
          );
          const csLipMat = getMarkerMat(
            `cs_lip_${csIsCamouflage ? 'camouflage' : 'highlight'}_${csLipColor}`,
            () => new THREE.MeshStandardMaterial({
              color: csLipColor,
              side: THREE.DoubleSide,
              metalness: useConfiguredPreviewShading ? 0.02 : (csIsCamouflage ? 0.55 : 0.35),
              roughness: useConfiguredPreviewShading ? 0.95 : (csIsCamouflage ? 0.5 : 0.4),
              emissive: (csIsCamouflage || useConfiguredPreviewShading) ? 0x000000 : 0x4c1d95,
              emissiveIntensity: (csIsCamouflage || useConfiguredPreviewShading) ? 0.0 : 0.2
            })
          );

          Object.entries(selectedCountersinks).forEach(([holeId, cs]) => {
            // Hardware fit coloring should remain authoritative on holes with assigned hardware.
            if (selectedHardware && Object.prototype.hasOwnProperty.call(selectedHardware, String(holeId))) return;

            const hole = detectedHoles.find(h => h.id.toString() === holeId.toString());
            if (!hole) return;
            const holeR = (hole.diameter_mm || (hole.diameterInches || 0.1) * 25.4) / 2;
            const csMajorR = cs.major_dia ? parseFloat(cs.major_dia) * 25.4 / 2 : holeR * 1.5;
            const csMinorR = cs.minor_dia ? parseFloat(cs.minor_dia) * 25.4 / 2 : holeR;
            const faceSign = cs.face === 'down' ? -1 : 1;
            const coneH = Math.min(Math.max(csMajorR * 0.6, 2.0), origT * 0.95);
            const axisNorm = hwThicknessVec.clone().normalize();
            const center = new THREE.Vector3(...hole.position);
            const csLift = Math.max(0.45, origT * 0.1) / Math.max(scaleFactor, 1e-6);
            const csDiscH = Math.max(0.08, 0.18 / Math.max(scaleFactor, 1e-6));
            const csBackDiscExtra = Math.max(0.38, 0.58 / Math.max(scaleFactor, 1e-6));
            const csConeInset = Math.max(0.25, coneH * 0.35);
            const basePos = center.clone().add(axisNorm.clone().multiplyScalar(faceSign * (origT * 0.5 + csLift)));
            const backPos = center.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT * 0.5 + csLift)));
            const backDiscPos = backPos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * csBackDiscExtra));

            if (csMajorR < holeR) {
              const fillColor = useConfiguredPreviewShading ? PREVIEW_MATTE_HEX : panelHex;
              const fillMat = getMarkerMat(`fill_${fillColor}`, () => new THREE.MeshStandardMaterial({ color: fillColor, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
              addMesh(makeRing(csMajorR * 0.99, holeR * 1.01, csDiscH), fillMat, basePos.clone(), hwThicknessVec);

              // Add disc to the other side as well (the back side of the hole)
              addMesh(makeRing(csMinorR * 0.99, holeR * 1.01, csDiscH), fillMat, backDiscPos.clone(), hwThicknessVec);
            }

            addMesh(
              new THREE.CylinderGeometry(csMajorR * 0.995, csMinorR * 0.94, coneH, 48, 1, true),
              csConeMat,
              basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * csConeInset)),
              hwThicknessVec
            );

            const lipRing = new THREE.Mesh(
              new THREE.RingGeometry(Math.max(csMinorR, 0.2), Math.max(csMajorR * 1.02, csMinorR + 0.12), 48),
              csLipMat
            );
            lipRing.position.copy(basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * 0.02)));
            lipRing.lookAt(lipRing.position.clone().add(axisNorm.clone().multiplyScalar(faceSign)));
            if (modelRoot !== v.scene) { lipRing.scale.set(1, 1, 1); lipRing.scale[_ta] = 1 / scaleFactor; }
            modelRoot.add(lipRing); holeMarkersRef.current.push(lipRing);

            if (!csIsCamouflage && !useConfiguredPreviewShading) {
              const backRing = new THREE.Mesh(new THREE.RingGeometry(csMinorR, csMinorR * 1.8, 32), csLipMat);
              backRing.position.copy(backDiscPos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (csDiscH * 0.5))));
              backRing.lookAt(backRing.position.clone().add(axisNorm.clone().multiplyScalar(faceSign)));
              if (modelRoot !== v.scene) { backRing.scale.set(1, 1, 1); backRing.scale[_ta] = 1 / scaleFactor; }
              modelRoot.add(backRing); holeMarkersRef.current.push(backRing);
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

        v.Render();
      } catch (err) { console.warn('Marker error:', err); }
    };
    updateMarkers();
  }, [detectedHoles, selectedTaps, activeTapHole, isTappingActive, tapOptions, selectedHardware, hardwareResizeReport, modelLoadCount, selectedThickness, isCountersinkingActive, csOptions, selectedCountersinks, showCountersinkMarkers, countersinkMarkerStyle, isBendingActive, detectedBends]);

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
        if (marker.userData.hole) setActiveTapHole(marker.userData.hole);
      }
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [modelLoadCount, setActiveTapHole]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};

export default React.memo(StepModelViewer);

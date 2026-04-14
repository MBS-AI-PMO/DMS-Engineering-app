import React, { useEffect, useRef, useState } from 'react';
import * as OV from 'online-3d-viewer';
import * as THREE from 'three';

// Module-level cache — generated once per page session, never regenerated on remount.
let __wrinkleNormalCache = null;
const getWrinkleNormal = () => {
  if (__wrinkleNormalCache) return __wrinkleNormalCache;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const pointCount = 120;
  const px = new Float32Array(pointCount);
  const py = new Float32Array(pointCount);
  for (let i = 0; i < pointCount; i++) { px[i] = Math.random() * size; py[i] = Math.random() * size; }
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let minDist = size * size;
      for (let i = 0; i < pointCount; i++) {
        const dx = x - px[i], dy = y - py[i];
        const d = dx * dx + dy * dy;
        if (d < minDist) minDist = d;
      }
      heights[y * size + x] = Math.min(1.0, Math.sqrt(minDist) / 20.0);
    }
  }
  const imgData = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const hL = heights[y * size + (x - 1 + size) % size];
      const hR = heights[y * size + (x + 1) % size];
      const hU = heights[((y - 1 + size) % size) * size + x];
      const hD = heights[((y + 1) % size) * size + x];
      const nx = (hL - hR) * 1.5;
      const ny = (hU - hD) * 1.5;
      const nz = 0.6;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      imgData.data[idx] = ((nx / len) * 0.5 + 0.5) * 255;
      imgData.data[idx + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      imgData.data[idx + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      imgData.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(35, 35);
  __wrinkleNormalCache = tex;
  return tex;
};

const StepModelViewer = ({
  selectedFile,
  detectedHoles = [],
  selectedTaps = {},
  activeTapHole = null,
  setActiveTapHole,
  isTappingActive,
  tapOptions = [],
  selectedHardware = {},
  isHardwareActive = false,
  hwItemsByType = {},
  selectedCountersinks = {},
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

  // Persistent Material Cache to prevent memory leaks and redundant object creation
  const matCache = useRef(new Map());

  // --- Procedural Texture (module-cached, generated once per session) ---
  useEffect(() => {
    if (!wrinkleNormal.current) wrinkleNormal.current = getWrinkleNormal();
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
    const progressTimer = setInterval(() => { onProgress(p => p < 99 ? p + 0.5 : p); }, 100);

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
      const viewer = new OV.EmbeddedViewer(currentRef, {
        backgroundColor: new OV.RGBAColor(255, 255, 255, 255),
        edgeSettings: new OV.EdgeSettings(true, new OV.RGBColor(0, 0, 0), 1),
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
          v?.scene?.add(new THREE.HemisphereLight(0xffffff, 0x999999, 1.2));
          const dl1 = new THREE.DirectionalLight(0xffffff, 0.7); dl1.position.set(100, 200, 100); v?.scene?.add(dl1);
          const dl2 = new THREE.DirectionalLight(0xffffff, 0.4); dl2.position.set(-100, -200, -100); v?.scene?.add(dl2);

          // Match holes & Initialize Materials
          const colorStr = (typeof activeFinishColor === 'string') ? activeFinishColor : (activeFinishColor?.color || activeFinishColor?.hex || '');
          const finishHex = colorStr ? parseInt(colorStr.replace('#', '0x')) : null;

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
                m.roughness = 0.4; m.metalness = 0.7;
                if (m.color && !obj.userData.origColor) {
                  obj.userData.origColor = { r: m.color.r, g: m.color.g, b: m.color.b };
                }
                if (finishHex !== null) m.color.setHex(finishHex);
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
        }
      });

      viewerInstance.current = viewer;
      viewer.LoadModelFromFileList([selectedFile.file]);

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
        try { viewer.Destroy(); } catch (e) {
          console.warn('Viewer destroy error:', e);
        }
      };
    } catch (e) {
      clearInterval(progressTimer);
      console.error("StepViewer error:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

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

            const isTapped = obj.userData.isNativeHole && selectedTaps[obj.userData.nativeHoleId];
            const isActive = obj.userData.isNativeHole && activeTapHole?.id === obj.userData.nativeHoleId;

            if (isTapped) { fm.color.set(0x4169e1); fm.emissive.set(0x000000); fm.emissiveIntensity = 0; }
            else if (isActive) { fm.color.set(0x000000); fm.emissive.set(0x000000); fm.emissiveIntensity = 0; }
            else if (activeFinishColor) {
              fm.color.set(activeFinishColor.color);
              if (!isFinishPowderCoating) { fm.emissive.set(activeFinishColor.color); fm.emissiveIntensity = 0.15; }
              else { fm.emissive.set(0x000000); fm.emissiveIntensity = 0; }
            } else {
              const oc = obj.userData.origColor; fm.color.setRGB(oc.r, oc.g, oc.b);
              fm.emissive.set(0x000000); fm.emissiveIntensity = 0;
            }

            if (activeFinishColor && isFinishPowderCoating) {
              const gloss = activeFinishColor.gloss ?? 35;
              const isWrinkled = !!(activeFinishColor.is_wrinkled || activeFinishColor.name?.toUpperCase().includes('WRINKLED'));
              fm.roughness = isWrinkled ? 0.68 : Math.max(0.32, 0.9 - (gloss / 100));
              fm.metalness = isWrinkled ? 0.15 : 0.1;
              fm.normalMap = isWrinkled ? wrinkleNormal.current : null;
              fm.normalScale = isWrinkled ? new THREE.Vector2(0.6, 0.6) : new THREE.Vector2(0, 0);
            } else {
              fm.roughness = 0.6; fm.metalness = 0.05; fm.normalMap = null;
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
  }, [activeFinishColor, isFinishPowderCoating, modelLoadCount, isTappingActive, activeTapHole, isAnodizingModalOpen, isModelFadedManually, detectedHoles, selectedTaps]);

  // --- Live Finish Color Updates ---
  useEffect(() => {
    const v = viewerInstance.current;
    if (!v || modelLoadCount === 0) return;
    const colorStr = (typeof activeFinishColor === 'string') ? activeFinishColor : (activeFinishColor?.color || activeFinishColor?.hex || '');
    const finishHex = colorStr ? parseInt(colorStr.replace('#', '0x')) : null;

    const viewer = v.GetViewer();
    if (!viewer) return;

    viewer.scene.traverse(obj => {
      if (obj.isMesh && !obj.userData.isHoleMarker && !obj.isHardwareMarker) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
          if (finishHex !== null) {
            m.color.setHex(finishHex);
          } else if (obj.userData.origColor) {
            m.color.setRGB(obj.userData.origColor.r, obj.userData.origColor.g, obj.userData.origColor.b);
          }
        });
      }
    });
    try { v.Render(); } catch { console.debug('Scene update omitted'); }
  }, [activeFinishColor, modelLoadCount]);

  // --- Markers Management (Tapping, Hardware, Countersinks) ---
  useEffect(() => {
    if (!viewerInstance.current || modelLoadCount === 0) return;

    const updateMarkers = () => {
      try {
        const v = viewerInstance.current?.GetViewer();
        if (!v?.scene) return;

        // Cleanup markers
        holeMarkersRef.current.forEach(m => { m.parent?.remove(m); if (m.geometry) m.geometry.dispose(); if (m.material) { if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose()); else m.material.dispose(); } });
        holeMarkersRef.current = [];

        const hasHwAssigned = Object.keys(selectedHardware).length > 0;
        const hasCSAssigned = Object.keys(selectedCountersinks).length > 0;
        if ((!isTappingActive && !hasHwAssigned && !isCountersinkingActive && !hasCSAssigned) || detectedHoles.length === 0) { v.Render(); return; }

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
        v.scene.traverse(o => { if (o.isMesh && !o.userData.isHoleMarker && !o.isHardwareMarker && o.material?.color) panelHex = o.material.color.getHex(); });

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
          detectedHoles.forEach(hole => {
            const diaImm = hole.diameter_mm || (hole.diameter_in ? hole.diameter_in * 25.4 : (hole.diameterInches ? hole.diameterInches * 25.4 : 2.54));
            const diaIn = hole.diameter_in || (hole.diameterInches || diaImm / 25.4);
            const mmDia = diaImm; if (mmDia > 200) return;
            const isConfigured = tapOptions.some(tap => diaIn >= (parseFloat(tap.min_diameter) || 0) && diaIn <= (parseFloat(tap.max_diameter) || 0));
            const isTapped = !!selectedTaps[hole.id]; const isActive = activeTapHole?.id === hole.id;
            const color = isTapped ? 0x4169e1 : (isActive ? 0xe31b23 : (isConfigured ? 0x10b981 : 0xef4444));
            const mat = getMarkerMat(`tap_${color}_${isActive}_${isTapped}`, () => new THREE.MeshPhongMaterial({
              color,
              emissive: color,
              emissiveIntensity: (isActive || isTapped) ? 5.0 : 0.5,
              shininess: 100,
              side: THREE.DoubleSide
            }));
            const markerRadius = (mmDia / 2) - (0.1 / scaleFactor);
            const geo = new THREE.CylinderGeometry(Math.max(markerRadius, 0.4), Math.max(markerRadius, 0.4), origT, 64, 1, true);
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
            const type = typeId || 3;
            let hwOuterR, hwBoreR;
            if (type === 3) { hwOuterR = baseWidthMm ? baseWidthMm / 2 : (toolingDiaMm ? toolingDiaMm * 1.5 : holeR * 1.6); hwBoreR = toolingDiaMm ? toolingDiaMm / 2 : holeR; }
            else if (type === 2) { const br = toolingDiaMm ? toolingDiaMm / 2 : holeR; hwOuterR = br * 1.33; hwBoreR = br * 0.6; }
            else if (type === 4) { hwOuterR = baseWidthMm ? baseWidthMm / 2 : (toolingDiaMm ? toolingDiaMm * 1.5 : holeR * 1.5); hwBoreR = toolingDiaMm ? toolingDiaMm / 2 : holeR; }
            else { hwOuterR = toolingDiaMm ? toolingDiaMm / 2 : holeR * 0.8; hwBoreR = 0; }
            if (type !== 2) hwBoreR = Math.min(hwBoreR, holeR * 0.99, hwOuterR * 0.85);

            const color = HW_COLORS[typeId] || 0xB8860B;
            const mat = getMarkerMat(`hw_${color}`, () => new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }));
            const soMat = getMarkerMat(`so_${color}`, () => new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.25 }));

            let axisVec = hole.axis ? new THREE.Vector3(...hole.axis) : hwThicknessVec.clone();
            if (axisVec.dot(hwThicknessVec) < 0) axisVec.negate();
            const axisNorm = axisVec.clone().normalize();
            const faceSign = face === 'down' ? -1 : 1;
            const basePos = new THREE.Vector3(...hole.position).add(axisNorm.clone().multiplyScalar(faceSign * origT * 0.5));

            if (hwOuterR < holeR) {
              const fillMat = getMarkerMat(`fill_${panelHex}`, () => new THREE.MeshStandardMaterial({ color: panelHex, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
              addMesh(makeRing(hwOuterR * 0.99, holeR * 1.02, 0.001), fillMat, basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * 0.0005)), axisVec);
              addMesh(makeRing(hwOuterR * 0.99, holeR * 1.02, 0.001), fillMat, basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT + 0.0005))), axisVec);
            } if (type === 3) {
              const nutH = item?.length ? parseFloat(item.length) * 25.4 : Math.max(3, origT * 0.6);
              addMesh(makeRing(hwBoreR, hwOuterR, nutH), mat, basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * nutH / 2)), axisVec);
              addMesh(makeRing(hwBoreR, hwOuterR, 0.001 / scaleFactor), mat, basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT + (0.0005 / scaleFactor)))), axisVec);
            } else if (type === 2) {
              const standoffH = item?.length ? parseFloat(item.length) * 25.4 : origT * 1.8;
              addMesh(new THREE.CylinderGeometry(hwOuterR / 1.33, hwOuterR / 1.33, standoffH, 64), soMat, basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * standoffH / 2)), axisVec);
              addMesh(new THREE.CylinderGeometry(hwBoreR, hwBoreR, standoffH + (1.0 / scaleFactor), 64), boreMat, basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * standoffH / 2)), axisVec);
              addMesh(new THREE.CylinderGeometry(hwOuterR, hwOuterR, 1.0 / scaleFactor, 6), soMat, basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT + (0.5 / scaleFactor)))), axisVec);
            } else if (type === 4) {
              addMesh(makeRing(hwBoreR, hwOuterR, 0.001 / scaleFactor), mat, basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * (0.0005 / scaleFactor))), axisVec);
              addMesh(makeRing(hwBoreR, hwOuterR, 0.001 / scaleFactor), mat, basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT + (0.0005 / scaleFactor)))), axisVec);
            } else if (type === 1) {
              const studH = item?.length ? parseFloat(item.length) ? parseFloat(item.length) * 25.4 : origT * 2.2 : origT * 2.2;
              addMesh(new THREE.CylinderGeometry(hwOuterR, hwOuterR * 0.8, studH, 32), soMat, basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * studH / 2)), axisVec);
              addMesh(new THREE.CylinderGeometry(hwOuterR * 1.8, hwOuterR * 1.8, 1.2 / scaleFactor, 64), soMat, basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT + (0.6 / scaleFactor)))), axisVec);
            }
          });
        }

        // --- Countersinks ---
        if (isCountersinkingActive || hasCSAssigned) {
          const csConeMat = getMarkerMat('cs_cone', () => new THREE.MeshStandardMaterial({ color: 0x7c3aed, metalness: 0.4, roughness: 0.3, side: THREE.DoubleSide, emissive: 0x4c1d95, emissiveIntensity: 0.35 }));
          const csBackDiscMat = getMarkerMat('cs_back', () => new THREE.MeshStandardMaterial({ color: 0x9d4edd, side: THREE.DoubleSide, emissive: 0x4c1d95, emissiveIntensity: 0.2 }));

          Object.entries(selectedCountersinks).forEach(([holeId, cs]) => {
            const hole = detectedHoles.find(h => h.id.toString() === holeId.toString());
            if (!hole) return;
            const holeR = (hole.diameter_mm || (hole.diameterInches || 0.1) * 25.4) / 2;
            const csMajorR = cs.major_dia ? parseFloat(cs.major_dia) * 25.4 / 2 : holeR * 1.5;
            const csMinorR = cs.minor_dia ? parseFloat(cs.minor_dia) * 25.4 / 2 : holeR;
            const faceSign = cs.face === 'down' ? -1 : 1;
            const coneH = Math.min(Math.max(csMajorR * 0.6, 2.0), origT * 0.95);
            const axisNorm = hwThicknessVec.clone().normalize();
            const center = new THREE.Vector3(...hole.position);
            const basePos = center.clone().add(axisNorm.clone().multiplyScalar(faceSign * (origT * 0.5 + (0.04 / scaleFactor))));

            if (csMajorR < holeR) {
              const fillMat = getMarkerMat(`fill_${panelHex}`, () => new THREE.MeshStandardMaterial({ color: panelHex, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
              const fillPos = center.clone().add(axisNorm.clone().multiplyScalar(faceSign * (origT * 0.5 + (0.02 / scaleFactor))));
              addMesh(makeRing(csMajorR * 0.99, holeR * 1.01, 0.05 / scaleFactor), fillMat, fillPos, hwThicknessVec);

              // Add disc to the other side as well (the back side of the hole)
              const backFillPos = center.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT * 0.5 + (0.02 / scaleFactor))));
              addMesh(makeRing(csMinorR * 0.99, holeR * 1.01, 0.05 / scaleFactor), fillMat, backFillPos, hwThicknessVec);
            }

            addMesh(new THREE.CylinderGeometry(csMajorR * 0.98, csMinorR * 0.9, coneH, 32, 1, true), csConeMat, basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * coneH / 2)), hwThicknessVec);

            // Indicator ring (purple) - move slightly further out to avoid Z-fighting with filler disc
            const backRing = new THREE.Mesh(new THREE.RingGeometry(csMinorR, csMinorR * 1.8, 32), csBackDiscMat);
            const backRingOffset = (0.06 / scaleFactor);
            backRing.position.copy(center.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT * 0.5 + backRingOffset))));
            backRing.lookAt(backRing.position.clone().add(axisNorm.clone().multiplyScalar(faceSign)));
            if (modelRoot !== v.scene) { backRing.scale.set(1, 1, 1); backRing.scale[_ta] = 1 / scaleFactor; }
            modelRoot.add(backRing); holeMarkersRef.current.push(backRing);
          });
        }

        // --- Bending ---
        if (isBendingActive && detectedBends.length > 0) {
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
  }, [detectedHoles, selectedTaps, activeTapHole, isTappingActive, tapOptions, selectedHardware, isHardwareActive, hwItemsByType, selectedFile, modelLoadCount, allServices, dimensions, selectedThickness, isCountersinkingActive, csOptions, selectedCountersinks, backendData, isBendingActive, detectedBends]);

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
  }, [detectedHoles, modelLoadCount, isTappingActive, setActiveTapHole]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />;
};

export default React.memo(StepModelViewer);

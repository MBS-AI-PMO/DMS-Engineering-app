import React, { useEffect, useRef, useState } from 'react';
import * as OV from 'online-3d-viewer';
import * as THREE from 'three';

// Module-level cache — same as StepModelViewer
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

const ProjectViewer = ({
  file,
  configuration = {},
  onDimensionsExtracted = null,
  isPreview = false
}) => {
  const containerRef = useRef(null);
  const viewerInstance = useRef(null);
  const centroidRef = useRef(new THREE.Vector3(0, 0, 0));
  const thicknessAxisRef = useRef(new THREE.Vector3(0, 1, 0));
  const [modelLoadCount, setModelLoadCount] = useState(0);
  const [measuredThickness, setMeasuredThickness] = useState(3);
  const onDimRef = useRef(onDimensionsExtracted);
  const wrinkleNormal = useRef(null);
  const matCache = useRef(new Map());
  const modelOriginalDataRef = useRef(null);

  useEffect(() => {
    if (!wrinkleNormal.current) wrinkleNormal.current = getWrinkleNormal();
  }, []);

  useEffect(() => {
    onDimRef.current = onDimensionsExtracted;
  }, [onDimensionsExtracted]);

  const isStepFile = (filename) => {
    const name = filename?.toLowerCase() ?? '';
    return name.endsWith('.step') || name.endsWith('.stp');
  };

  // --- Core 3D Entry Effect ---
  useEffect(() => {
    if (!file || !isStepFile(file.name) || !containerRef.current) return;

    const currentContainer = containerRef.current;
    currentContainer.innerHTML = '';

    // Advanced cleanup of previous instances
    if (viewerInstance.current) {
      try {
        viewerInstance.current.Destroy();
      } catch (err) {
        console.warn("ProjectViewer Cleanup Warning:", err);
      }
      viewerInstance.current = null;
    }

    try {
      const viewer = new OV.EmbeddedViewer(currentContainer, {
        backgroundColor: new OV.RGBAColor(255, 255, 255, 255),
        edgeSettings: new OV.EdgeSettings(true, new OV.RGBColor(0, 0, 0), 1),
        onModelLoaded: () => {
          const threeViewer = viewer.GetViewer();

          // NATIVE PRECISION BYPASS: Use THREE.js native Box3 (Stable 0.18.0)
          if (threeViewer?.scene) {
            // 1. DIMENSION EXTRACTION
            const box = new THREE.Box3().setFromObject(threeViewer.scene);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            centroidRef.current.copy(center);

            const dimensions = [size.x, size.y, size.z].sort((a, b) => a - b);
            const t = dimensions[0];
            setMeasuredThickness(t);

            // Determine which world axis corresponds to the sheet thickness
            const axisOptions = [
              { vec: new THREE.Vector3(1, 0, 0), size: size.x },
              { vec: new THREE.Vector3(0, 1, 0), size: size.y },
              { vec: new THREE.Vector3(0, 0, 1), size: size.z },
            ];
            axisOptions.sort((a, b) => a.size - b.size);
            thicknessAxisRef.current = axisOptions[0].vec.clone();

            if (onDimRef.current) {
              onDimRef.current({ l: dimensions[2], w: dimensions[1], t: t });
            }

            // 2. SCENE LIGHTING — Matched to High-Fidelity Rig
            threeViewer.scene.add(new THREE.HemisphereLight(0xffffff, 0x999999, 1.2));
            const light1 = new THREE.DirectionalLight(0xffffff, 0.7);
            light1.position.set(100, 200, 100);
            threeViewer.scene.add(light1);
            const light2 = new THREE.DirectionalLight(0xffffff, 0.4);
            light2.position.set(-100, -200, -100);
            threeViewer.scene.add(light2);

            // CAPTURE ANCHORS for dynamic scaling établissements
            const modelRoot = threeViewer.scene.children.find(c => c.isGroup);
            if (modelRoot) {
              const axes = [
                { axis: 'x', size: size.x, center: center.x },
                { axis: 'y', size: size.y, center: center.y },
                { axis: 'z', size: size.z, center: center.z },
              ].sort((a, b) => a.size - b.size);

              modelOriginalDataRef.current = {
                root: modelRoot,
                origScale: modelRoot.scale.clone(),
                origPosition: modelRoot.position.clone(),
                thicknessAxis: axes[0].axis,
                origThicknessMM: axes[0].size,
                localCenter: axes[0].center,
              };
            }

            // 3. ZOOM TO FIT (Native Three.js Stable Method)
            const sphere = new THREE.Sphere();
            box.getBoundingSphere(sphere);

            // Bypass buggy GetBoundingBox call in the library
            threeViewer.FitSphereToWindow(sphere, false);
            threeViewer.Render();
          }

          setModelLoadCount(c => c + 1);
        },
        onLoadError: (loadError) => {
          console.error("ProjectViewer Load Error:", loadError);
        }
      });

      viewerInstance.current = viewer;

      // Model Loading
      if (file instanceof File) {
        viewer.LoadModelFromFileList([file]);
      } else if (file && (file.name || file.path)) {
        const remoteUrl = file.path || `/uploads/orders/${file.name}`;
        viewer.LoadModelFromUrlList([remoteUrl]);
      }

      // Responsive Observer
      const resizeObserver = new ResizeObserver(() => {
        if (viewerInstance.current) {
          const v = viewerInstance.current.GetViewer();
          if (v?.scene) {
            const box = new THREE.Box3().setFromObject(v.scene);
            const sphere = new THREE.Sphere();
            box.getBoundingSphere(sphere);
            v.FitSphereToWindow(sphere, false);
            v.Render();
          }
        }
      });
      resizeObserver.observe(currentContainer);

      return () => {
        resizeObserver.disconnect();
        // Robust cleanup guard against DOM race conditions
        if (viewerInstance.current && currentContainer.contains(viewerInstance.current.canvas)) {
          try { viewer.Destroy(); } catch (e) {
            console.warn("ProjectViewer Auto-Cleanup suppressed error:", e);
          }
        }
      };
    } catch (err) {
      console.error("ProjectViewer Initialization Error:", err);
    }
  }, [file]);

  // --- Thickness Scaling Effect ---
  useEffect(() => {
    if (!viewerInstance.current || modelLoadCount === 0) return;
    const data = modelOriginalDataRef.current;
    if (!data?.root) return;
    const { root, origScale, origPosition, thicknessAxis, origThicknessMM, localCenter } = data;
    const selectedThickness = configuration.thickness;

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
      try {
        const v = viewerInstance.current.GetViewer();
        const box = new THREE.Box3().setFromObject(v.scene);
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        v.FitSphereToWindow(sphere, false);
        v.Render();
      } catch (e) { console.debug('Scale update skipped'); }
    }, 50);
  }, [configuration.thickness, modelLoadCount]);

  // --- Manufacturing Markers Effect — Matched 1:1 with StepModelViewer ---
  useEffect(() => {
    if (!viewerInstance.current || modelLoadCount === 0) return;

    const updateMarkers = () => {
      try {
        const v = viewerInstance.current?.GetViewer();
        if (!v?.scene) return;

        // --- Model Root Discovery ---
        const modelRoot = v.scene.children.find(c => c.isGroup) || v.scene;
        const data = modelOriginalDataRef.current;
        const thickScale = (data && configuration.thickness) ? (parseFloat(configuration.thickness) * 25.4) / data.origThicknessMM : 1;
        const _ta = data?.thicknessAxis || 'y';

        // Cleanup markers — persistent ref for ProjectViewer
        const existing = [];
        v.scene.traverse(obj => { if (obj.userData.isHoleMarker || obj.isHardwareMarker) existing.push(obj); });
        existing.forEach(m => { m.parent?.remove(m); if (m.geometry) m.geometry.dispose(); if (m.material) { if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose()); else m.material.dispose(); } });

        const selectedTaps = configuration.selectedTaps || {};
        const selectedHardware = configuration.selectedHardware || {};
        const selectedCountersinks = configuration.selectedCountersinks || {};
        const hasHwAssigned = Object.keys(selectedHardware).length > 0;
        const hasCSAssigned = Object.keys(selectedCountersinks).length > 0;
        const hasTapsAssigned = Object.keys(selectedTaps).length > 0;

        if (!hasTapsAssigned && !hasHwAssigned && !hasCSAssigned) {
          // Still need to apply finish colors even if no markers
          modelRoot.traverse(obj => {
            if (!obj.isMesh || obj.userData.isHoleMarker || obj.isHardwareMarker) return;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            const colorStr = (typeof configuration.anodizingColor === 'string') ? configuration.anodizingColor : (configuration.anodizingColor?.color || configuration.anodizingColor?.hex || (configuration.metal?.color || ''));
            const finishHex = colorStr ? parseInt(colorStr.replace('#', '0x')) : 0x9ca3af;
            mats.forEach(m => {
              m.color.setHex(finishHex);
              m.roughness = 0.4; m.metalness = 0.7;
            });
          });
          v.Render();
          return;
        }

        const partT = configuration.thickness ? parseFloat(configuration.thickness) * 25.4 : measuredThickness;

        // --- Axis Detection ---
        let hwThicknessVec;
        const allSelectedHoles = [
          ...Object.values(selectedTaps).map(t => t.hole),
          ...Object.values(selectedHardware).map(h => h.hole),
          ...Object.values(selectedCountersinks).map(c => c.hole)
        ].filter(h => h?.position);

        if (allSelectedHoles.length >= 2) {
          const _computeVar = (vals) => {
            const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
            return vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
          };
          const _candidates = [
            { vec: new THREE.Vector3(1, 0, 0), v: _computeVar(allSelectedHoles.map(h => Array.isArray(h.position) ? h.position[0] : (h.position.x || 0))) },
            { vec: new THREE.Vector3(0, 1, 0), v: _computeVar(allSelectedHoles.map(h => Array.isArray(h.position) ? h.position[1] : (h.position.y || 0))) },
            { vec: new THREE.Vector3(0, 0, 1), v: _computeVar(allSelectedHoles.map(h => Array.isArray(h.position) ? h.position[2] : (h.position.z || 0))) },
          ];
          _candidates.sort((a, b) => a.v - b.v);
          hwThicknessVec = _candidates[0].vec.clone();
        } else {
          hwThicknessVec = thicknessAxisRef.current.clone();
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
          if (data && modelRoot !== v.scene) {
            mesh.scale.set(1, 1, 1);
            mesh.scale[_ta] = 1 / thickScale;
          }
          modelRoot.add(mesh);
          return mesh;
        };

        const getMarkerMat = (key, creator) => {
          if (!matCache.current.has(key)) matCache.current.set(key, creator());
          return matCache.current.get(key);
        };

        // --- Tapping ---
        if (hasTapsAssigned) {
          Object.values(selectedTaps).forEach(tapConfig => {
            const hole = tapConfig.hole; if (!hole) return;
            const mmDia = hole.diameter_mm || (hole.diameterInches || 0.1) * 25.4;
            const color = 0x4169e1; // Electric Blue
            const mat = getMarkerMat(`tap_${color}`, () => new THREE.MeshPhongMaterial({
              color, emissive: color, emissiveIntensity: 5.0, shininess: 100, side: THREE.DoubleSide
            }));
            const markerRadius = (mmDia / 2) - 0.1;
            const geo = new THREE.CylinderGeometry(Math.max(markerRadius, 0.4), Math.max(markerRadius, 0.4), data?.origThicknessMM || 2.0, 64, 1, true);
            const pos = new THREE.Vector3(
              Array.isArray(hole.position) ? hole.position[0] : (hole.position.x || 0),
              Array.isArray(hole.position) ? hole.position[1] : (hole.position.y || 0),
              Array.isArray(hole.position) ? hole.position[2] : (hole.position.z || 0)
            );
            const axis = hole.axis ? new THREE.Vector3(
              Array.isArray(hole.axis) ? hole.axis[0] : (hole.axis.x || 0),
              Array.isArray(hole.axis) ? hole.axis[1] : (hole.axis.y || 0),
              Array.isArray(hole.axis) ? hole.axis[2] : (hole.axis.z || 0)
            ) : hwThicknessVec;
            addMesh(geo, mat, pos, axis);
          });
        }

        // --- Hardware ---
        if (hasHwAssigned) {
          const HW_COLORS = { 1: 0x059669, 2: 0x6366f1, 3: 0xB8860B, 4: 0xDC2626 };
          const boreMat = getMarkerMat('bore', () => new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.4 }));
          const origT = data?.origThicknessMM || partT;

          Object.values(selectedHardware).forEach((hw) => {
            const hole = hw.hole; if (!hole?.position) return;
            const { item, typeId, face } = hw;
            const holeR = (hole.diameter_mm || (hole.diameterInches || 0.1) * 25.4) / 2;
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

            let axisVec = hole.axis ? new THREE.Vector3(
              Array.isArray(hole.axis) ? hole.axis[0] : (hole.axis.x || 0),
              Array.isArray(hole.axis) ? hole.axis[1] : (hole.axis.y || 0),
              Array.isArray(hole.axis) ? hole.axis[2] : (hole.axis.z || 0)
            ) : hwThicknessVec.clone();
            if (axisVec.dot(hwThicknessVec) < 0) axisVec.negate();
            const axisNorm = axisVec.clone().normalize();
            const faceSign = face === 'down' ? -1 : 1;
            const pos = new THREE.Vector3(
              Array.isArray(hole.position) ? hole.position[0] : (hole.position.x || 0),
              Array.isArray(hole.position) ? hole.position[1] : (hole.position.y || 0),
              Array.isArray(hole.position) ? hole.position[2] : (hole.position.z || 0)
            );
            const basePos = pos.clone().add(axisNorm.clone().multiplyScalar(faceSign * origT * 0.5));

            if (hwOuterR < holeR) {
              const fillMat = getMarkerMat(`fill_${panelHex}`, () => new THREE.MeshStandardMaterial({ color: panelHex, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
              addMesh(makeRing(hwOuterR * 0.99, holeR * 1.02, 0.001), fillMat, basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * 0.0005)), axisVec);
              addMesh(makeRing(hwOuterR * 0.99, holeR * 1.02, 0.001), fillMat, basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT + 0.0005))), axisVec);
            }
            if (type === 3) {
              const nutH = item?.length ? parseFloat(item.length) * 25.4 : Math.max(3, origT * 0.6);
              addMesh(makeRing(hwBoreR, hwOuterR, nutH), mat, basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * nutH / 2)), axisVec);
              addMesh(makeRing(hwBoreR, hwOuterR, 0.001), mat, basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT + 0.0005))), axisVec);
            } else if (type === 2) {
              const standoffH = item?.length ? parseFloat(item.length) * 25.4 : origT * 1.8;
              addMesh(new THREE.CylinderGeometry(hwOuterR / 1.33, hwOuterR / 1.33, standoffH, 64), soMat, basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * standoffH / 2)), axisVec);
              addMesh(new THREE.CylinderGeometry(hwBoreR, hwBoreR, standoffH + 1.0, 64), boreMat, basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * standoffH / 2)), axisVec);
              addMesh(new THREE.CylinderGeometry(hwOuterR, hwOuterR, 1.0, 6), soMat, basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT + 0.5))), axisVec);
            } else if (type === 4) {
              addMesh(makeRing(hwBoreR, hwOuterR, 0.001), mat, basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * 0.0005)), axisVec);
              addMesh(makeRing(hwBoreR, hwOuterR, 0.001), mat, basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT + 0.0005))), axisVec);
            } else if (type === 1) {
              const studH = item?.length ? parseFloat(item.length) * 25.4 : origT * 2.2;
              addMesh(new THREE.CylinderGeometry(hwOuterR, hwOuterR * 0.8, studH, 32), soMat, basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * studH / 2)), axisVec);
              addMesh(new THREE.CylinderGeometry(hwOuterR * 1.8, hwOuterR * 1.8, 1.2, 64), soMat, basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT + 0.6))), axisVec);
            }
          });
        }

        // --- Countersinks ---
        if (hasCSAssigned) {
          const csConeMat = getMarkerMat('cs_cone', () => new THREE.MeshStandardMaterial({ color: 0x7c3aed, metalness: 0.4, roughness: 0.3, side: THREE.DoubleSide, emissive: 0x4c1d95, emissiveIntensity: 0.35 }));
          const csBackDiscMat = getMarkerMat('cs_back', () => new THREE.MeshStandardMaterial({ color: 0x9d4edd, side: THREE.DoubleSide, emissive: 0x4c1d95, emissiveIntensity: 0.2 }));
          const origT = data?.origThicknessMM || partT;

          Object.values(selectedCountersinks).forEach(cs => {
            const hole = cs.hole; if (!hole) return;
            const holeR = (hole.diameter_mm || (hole.diameterInches || 0.1) * 25.4) / 2;
            const csMajorR = cs.major_dia ? parseFloat(cs.major_dia) * 25.4 / 2 : holeR * 1.5;
            const csMinorR = cs.minor_dia ? parseFloat(cs.minor_dia) * 25.4 / 2 : holeR;
            const faceSign = cs.face === 'down' ? -1 : 1;
            const coneH = Math.min(Math.max(csMajorR * 0.6, 2.0), origT * 0.95);
            const axisNorm = hwThicknessVec.clone().normalize();
            const pos = new THREE.Vector3(
              Array.isArray(hole.position) ? hole.position[0] : (hole.position.x || 0),
              Array.isArray(hole.position) ? hole.position[1] : (hole.position.y || 0),
              Array.isArray(hole.position) ? hole.position[2] : (hole.position.z || 0)
            );
            const basePos = pos.clone().add(axisNorm.clone().multiplyScalar(faceSign * (origT * 0.5 + 0.04)));

            if (csMajorR < holeR) {
              const fillMat = getMarkerMat(`fill_${panelHex}`, () => new THREE.MeshStandardMaterial({ color: panelHex, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
              const fillPos = pos.clone().add(axisNorm.clone().multiplyScalar(faceSign * (origT * 0.5 + 0.02)));
              addMesh(makeRing(csMajorR * 0.99, holeR * 1.01, 0.05), fillMat, fillPos, hwThicknessVec);
              const backFillPos = pos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT * 0.5 + 0.02)));
              addMesh(makeRing(csMinorR * 0.99, holeR * 1.01, 0.05), fillMat, backFillPos, hwThicknessVec);
            }

            addMesh(new THREE.CylinderGeometry(csMajorR * 0.98, csMinorR * 0.9, coneH, 32, 1, true), csConeMat, basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * coneH / 2)), hwThicknessVec);

            const backRing = new THREE.Mesh(new THREE.RingGeometry(csMinorR, csMinorR * 1.8, 32), csBackDiscMat);
            const backRingOffset = 0.06;
            backRing.position.copy(pos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (origT * 0.5 + backRingOffset))));
            backRing.lookAt(backRing.position.clone().add(axisNorm.clone().multiplyScalar(faceSign)));
            if (data && modelRoot !== v.scene) { backRing.scale.set(1, 1, 1); backRing.scale[_ta] = 1 / thickScale; }
            modelRoot.add(backRing);
          });
        }

        // --- Bending ---
        const detectedBends = configuration.detectedBends || [];
        const isBendingActive = !!(configuration.isBendingActive || detectedBends.length > 0);
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
            const bR = 0.55 / thickScale;
            const geo = new THREE.CylinderGeometry(bR, bR, length, 8);
            const mesh = new THREE.Mesh(geo, bendMat);
            mesh.userData.isHoleMarker = true;
            mesh.position.copy(midPoint);
            mesh.lookAt(p1);
            mesh.rotateX(Math.PI / 2);
            modelRoot.add(mesh);
          });
        }

        // Apply finish colors to the part itself
        v.scene.traverse(obj => {
          if (!obj.isMesh || obj.userData.isHoleMarker || obj.isHardwareMarker) return;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          const colorStr = (typeof configuration.anodizingColor === 'string') ? configuration.anodizingColor : (configuration.anodizingColor?.color || configuration.anodizingColor?.hex || (configuration.metal?.color || ''));
          const finishHex = colorStr ? parseInt(colorStr.replace('#', '0x')) : 0x9ca3af;
          const isWrinkled = !!(configuration.anodizingColor?.name?.toUpperCase().includes('WRINKLED'));

          mats.forEach(m => {
            m.color.setHex(finishHex);
            m.roughness = isWrinkled ? 0.68 : 0.4;
            m.metalness = isWrinkled ? 0.15 : 0.7;
            if (isWrinkled) {
              m.normalMap = wrinkleNormal.current;
              m.normalScale = new THREE.Vector2(0.6, 0.6);
            }
          });
        });

        v.Render();
      } catch (err) { console.warn('Marker error:', err); }
    };

    updateMarkers();
  }, [modelLoadCount, configuration, measuredThickness]);

  return (
    <div
      ref={containerRef}
      className="project-viewer-surface"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: isPreview ? 'none' : 'inset 0 4px 12px rgba(0,0,0,0.05)'
      }}
    />
  );
};

export default ProjectViewer;

import React, { useEffect, useRef, useState } from 'react';
import * as OV from 'online-3d-viewer';
import * as THREE from 'three';

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

            // 2. SCENE LIGHTING
            threeViewer.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
            const light = new THREE.DirectionalLight(0xffffff, 1.0);
            light.position.set(100, 100, 100);
            threeViewer.scene.add(light);

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

  // --- Manufacturing Markers Effect ---
  useEffect(() => {
    if (!viewerInstance.current || modelLoadCount === 0) return;

    const applyManufacturingStyles = () => {
      try {
        const threeViewer = viewerInstance.current.GetViewer();
        if (!threeViewer?.scene) return;

        // Clean Markers
        const existing = [];
        threeViewer.scene.traverse(obj => { if (obj.isTapMarker || obj.isHardwareMarker) existing.push(obj); });
        existing.forEach(m => { if (m.parent) m.parent.remove(m); });

        // Apply Premium Multi-Phase Finishes
        threeViewer.scene.traverse(obj => {
          if (!obj.isMesh || !obj.material || obj.isHardwareMarker || obj.isTapMarker) return;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(mat => {
            if (configuration.anodizingColor?.color) {
              mat.color.set(configuration.anodizingColor.color);
            } else if (configuration.metal?.color) {
              mat.color.set(configuration.metal.color);
            }
            mat.roughness = 0.35;
            mat.metalness = 0.75;
            mat.needsUpdate = true;
          });
        });

        // 1:1 COORDINATE MAPPING (Handles both Array and Object formats)
        if (configuration.selectedTaps) {
          Object.values(configuration.selectedTaps).forEach(tap => {
            if (!tap.hole?.position) return;

            // Robust parsing for [x,y,z] OR {x,y,z}
            const rawPos = tap.hole.position;
            const pos = {
              x: Array.isArray(rawPos) ? rawPos[0] : (rawPos.x || 0),
              y: Array.isArray(rawPos) ? rawPos[1] : (rawPos.y || 0),
              z: Array.isArray(rawPos) ? rawPos[2] : (rawPos.z || 0)
            };

            const mmDia = (tap.hole.diameterInches || 0.1) * 25.4;
            const radius = mmDia / 2;
            const height = configuration.thickness ? parseFloat(configuration.thickness) : measuredThickness;

            const safeRadius = Math.max(radius, 0.5);
            const geometry = new THREE.CylinderGeometry(safeRadius, safeRadius, height, 32, 1, true);
            const material = new THREE.MeshBasicMaterial({
              color: 0x4169E1,
              side: THREE.DoubleSide
            });
            const marker = new THREE.Mesh(geometry, material);
            marker.isTapMarker = true;

            const modelParent = threeViewer.scene.children.find(c => c.isGroup) || threeViewer.scene;
            marker.position.set(pos.x, pos.y, pos.z);
            modelParent.add(marker);

            // Orient along hole axis — identical to InstantPricing sleeve logic
            const rawAxis = tap.hole.axis;
            if (rawAxis) {
              const axisVec = new THREE.Vector3(
                Array.isArray(rawAxis) ? rawAxis[0] : (rawAxis.x || 0),
                Array.isArray(rawAxis) ? rawAxis[1] : (rawAxis.y || 0),
                Array.isArray(rawAxis) ? rawAxis[2] : (rawAxis.z || 0)
              );
              marker.lookAt(new THREE.Vector3(pos.x, pos.y, pos.z).add(axisVec));
            }
            marker.rotateX(Math.PI / 2);
          });
        }

        const _hwPositions = Object.values(configuration.selectedHardware || {})
          .filter(h => h.hole?.position)
          .map(h => {
            const p = h.hole.position;
            return Array.isArray(p) ? [p[0], p[1], p[2]] : [p.x || 0, p.y || 0, p.z || 0];
          });
        const _csPositions = Object.values(configuration.selectedCountersinks || {})
          .filter(cs => cs.hole?.position)
          .map(cs => {
            const p = cs.hole.position;
            return Array.isArray(p) ? [p[0], p[1], p[2]] : [p.x || 0, p.y || 0, p.z || 0];
          });
        const _allPos = [..._hwPositions, ..._csPositions];

        let sharedAxisVec;
        if (_allPos.length >= 2) {
          const _variance = (vals) => {
            const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
            return vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
          };
          const _axes = [
            { vec: new THREE.Vector3(1, 0, 0), v: _variance(_allPos.map(p => p[0])) },
            { vec: new THREE.Vector3(0, 1, 0), v: _variance(_allPos.map(p => p[1])) },
            { vec: new THREE.Vector3(0, 0, 1), v: _variance(_allPos.map(p => p[2])) },
          ];
          _axes.sort((a, b) => a.v - b.v);
          sharedAxisVec = _axes[0].vec.clone();
        } else {
          sharedAxisVec = thicknessAxisRef.current.clone();
        }

        // Hardware markers — distinct geometry per type
        if (configuration.selectedHardware) {
          const HW_COLORS = { 1: 0x059669, 2: 0x6366f1, 3: 0xB8860B, 4: 0xDC2626 };
          const matCache = {};
          const getHwMat = (c) => {
            const k = `hw_${c}`;
            if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial({ color: c, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide });
            return matCache[k];
          };
          const getPolishedMat = (c) => {
            const k = `po_${c}`;
            if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial({ color: c, metalness: 0.75, roughness: 0.25, side: THREE.FrontSide });
            return matCache[k];
          };
          const boreMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.4 });

          // Sample panel surface color once for hole fill rings (Issue 2)
          let panelHex = 0x9ca3af;
          threeViewer.scene.traverse(o => {
            if (o.isMesh && !o.isHardwareMarker && !o.isTapMarker && o.material?.color) {
              panelHex = o.material.color.getHex();
            }
          });

          Object.values(configuration.selectedHardware).forEach(({ item, hole, typeId, face }) => {
            if (!hole?.position) return;
            const rawPos = hole.position;
            const pos = {
              x: Array.isArray(rawPos) ? rawPos[0] : (rawPos.x || 0),
              y: Array.isArray(rawPos) ? rawPos[1] : (rawPos.y || 0),
              z: Array.isArray(rawPos) ? rawPos[2] : (rawPos.z || 0),
            };
            const partT = configuration.thickness ? parseFloat(configuration.thickness) : measuredThickness;
            const holeMmDia = (hole.diameterInches || 0.1) * 25.4;
            const holeR = Math.max(holeMmDia / 2, 0.5);
            const toolingDiaMm = item?.tooling_diameter ? parseFloat(item.tooling_diameter) * 25.4 : null;
            const baseWidthMm = item?.base_width ? parseFloat(item.base_width) * 25.4 : null;

            const type = typeId || 3;

            let hwOuterR, hwBoreR;
            if (type === 3) {
              hwOuterR = baseWidthMm ? baseWidthMm / 2 : (toolingDiaMm ? toolingDiaMm * 1.5 : holeR * 1.6);
              hwBoreR = toolingDiaMm ? toolingDiaMm / 2 : holeR;
            } else if (type === 2) {
              const barrelR = toolingDiaMm ? toolingDiaMm / 2 : holeR;
              hwOuterR = barrelR * 1.33;
              hwBoreR = barrelR * 0.6;
            } else if (type === 4) {
              hwOuterR = baseWidthMm ? baseWidthMm / 2 : (toolingDiaMm ? toolingDiaMm * 1.5 : holeR * 1.5);
              hwBoreR = toolingDiaMm ? toolingDiaMm / 2 : holeR;
            } else {
              hwOuterR = toolingDiaMm ? toolingDiaMm / 2 : holeR * 0.8;
              hwBoreR = 0;
            }

            if (type !== 2) {
              hwBoreR = Math.min(hwBoreR, holeR * 0.99, hwOuterR * 0.85);
            }

            const hwFaceR = hwOuterR;
            const color = HW_COLORS[typeId] || 0xB8860B;
            const mat = getHwMat(color);

            let axisVec = sharedAxisVec.clone();
            const rawAxis = hole.axis && hole.axis.length === 3 ? hole.axis : null;
            if (rawAxis) {
              axisVec = new THREE.Vector3(rawAxis[0], rawAxis[1], rawAxis[2]);
            }
            if (axisVec.dot(sharedAxisVec) < 0) axisVec.negate();

            const axisNorm = axisVec.clone().normalize();
            const faceSign = face === 'down' ? -1 : 1;
            const centerPos = new THREE.Vector3(pos.x, pos.y, pos.z);
            const basePos = centerPos.clone().add(axisNorm.clone().multiplyScalar(faceSign * partT * 0.5));

            const modelParent = threeViewer.scene.children.find(c => c.isGroup) || threeViewer.scene;

            const addHWMesh = (geo, m, center) => {
              const mesh = new THREE.Mesh(geo, m);
              mesh.isHardwareMarker = true;
              mesh.position.copy(center);
              mesh.lookAt(center.clone().add(axisVec));
              mesh.rotateX(Math.PI / 2);
              modelParent.add(mesh);
            };

            const makeRingGeo = (innerR, outerR, h, segs = 32) => {
              const pts = [
                new THREE.Vector2(innerR, h / 2),
                new THREE.Vector2(innerR, -h / 2),
                new THREE.Vector2(outerR, -h / 2),
                new THREE.Vector2(outerR, h / 2),
                new THREE.Vector2(innerR, h / 2),
              ];
              return new THREE.LatheGeometry(pts, segs);
            };

            if (hwFaceR < holeR) {
              const fillMat = new THREE.MeshStandardMaterial({ color: panelHex, metalness: 0.7, roughness: 0.4 });
              addHWMesh(makeRingGeo(hwOuterR * 0.99, holeR * 1.02, partT), fillMat, centerPos);
            }

            if (type === 3) {
              const nutH = item?.length ? parseFloat(item.length) * 25.4 : Math.max(3, partT * 0.6);
              const discH = Math.max(partT * 0.12, 0.8);
              const bodyCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * nutH / 2));
              addHWMesh(makeRingGeo(hwBoreR, hwOuterR, nutH, 32), mat, bodyCenter);
              const discCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (partT + discH / 2)));
              addHWMesh(makeRingGeo(hwBoreR, hwOuterR, discH, 32), mat, discCenter);
            } else if (type === 2) {
              const standoffH = item?.length ? parseFloat(item.length) * 25.4 : partT * 1.8;
              const headH = Math.max(partT * 0.15, 1.0);
              const barrelR = toolingDiaMm ? toolingDiaMm / 2 : holeR;
              const safeBarrelR = Math.min(barrelR, hwOuterR * 0.95);
              const bodyCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * standoffH / 2));
              const soMat = getPolishedMat(color);
              addHWMesh(new THREE.CylinderGeometry(safeBarrelR, safeBarrelR, standoffH, 64, 1, false), soMat, bodyCenter);
              addHWMesh(new THREE.CylinderGeometry(hwBoreR, hwBoreR, standoffH + 1.0, 64, 1, false), boreMat, bodyCenter);
              const headCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (partT + headH / 2)));
              addHWMesh(new THREE.CylinderGeometry(hwOuterR, hwOuterR, headH, 6, 1, false), soMat, headCenter);
            } else if (type === 4) {
              const discH = Math.max(partT * 0.15, 1.0);
              const topCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * discH / 2));
              addHWMesh(makeRingGeo(hwBoreR, hwOuterR, discH, 32), mat, topCenter);
              const botCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (partT + discH / 2)));
              addHWMesh(makeRingGeo(hwBoreR, hwOuterR, discH, 32), mat, botCenter);
            } else if (type === 1) {
              const ridgeR = hwOuterR;
              const shaftR = ridgeR * 0.8;
              const knurlR = ridgeR * 1.05;
              const headR = ridgeR * 1.8;
              const studH = item?.length ? parseFloat(item.length) * 25.4 : partT * 2.2;
              const headH = Math.max(partT * 0.18, 1.2);
              const knurlH = Math.max(partT * 0.4, 1.5);
              const knurlCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (knurlH / 2)));
              const bodyCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * studH / 2));
              const headCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (partT + headH / 2)));
              const soMat = getPolishedMat(color);

              addHWMesh(new THREE.CylinderGeometry(knurlR, knurlR, knurlH, 16, 1, false), soMat, knurlCenter);

              const pitch = Math.max(ridgeR * 0.25, 0.4);
              const numThreads = Math.floor(studH / pitch);
              const threadPts = [];
              threadPts.push(new THREE.Vector2(0, 0));
              threadPts.push(new THREE.Vector2(shaftR, 0));
              for (let i = 0; i < numThreads; i++) {
                const yMid = pitch * (i + 0.5);
                const yEnd = pitch * (i + 1);
                threadPts.push(new THREE.Vector2(ridgeR, yMid));
                threadPts.push(new THREE.Vector2(shaftR, yEnd));
              }
              threadPts.push(new THREE.Vector2(shaftR, studH));
              threadPts.push(new THREE.Vector2(0, studH));

              const threadGeo = new THREE.LatheGeometry(threadPts, 32);
              threadGeo.translate(0, -studH / 2, 0);
              addHWMesh(threadGeo, soMat, bodyCenter);
              addHWMesh(new THREE.CylinderGeometry(headR, headR, headH, 64, 1, false), soMat, headCenter);
            } else {
              const m = new THREE.Mesh(new THREE.CylinderGeometry(hwOuterR, hwOuterR, partT, 16, 1, true), mat);
              m.isHardwareMarker = true;
              m.position.copy(basePos);
              m.lookAt(basePos.clone().add(axisVec));
              m.rotateX(Math.PI / 2);
              modelParent.add(m);
            }
          });
        }

        // Countersink markers from service selections
        if (configuration.selectedCountersinks) {
          const csConeMat = new THREE.MeshStandardMaterial({
            color: 0x7c3aed, metalness: 0.4, roughness: 0.3, side: THREE.DoubleSide,
            emissive: 0x4c1d95, emissiveIntensity: 0.35,
          });
          const csBackDiscMat = new THREE.MeshStandardMaterial({
            color: 0x9d4edd, side: THREE.BackSide,
            emissive: 0x4c1d95, emissiveIntensity: 0.2,
          });
          const modelParent2 = threeViewer.scene.children.find(c => c.isGroup) || threeViewer.scene;

          // Recompute shared axis if we have no hardware (only countersinks selected)
          const _csOnlyPos = Object.values(configuration.selectedCountersinks)
            .filter(cs => cs.hole?.position)
            .map(cs => {
              const p = cs.hole.position;
              return Array.isArray(p) ? [p[0], p[1], p[2]] : [p.x || 0, p.y || 0, p.z || 0];
            });
          let csAxisVec;
          const _hwCount = Object.keys(configuration.selectedHardware || {}).length;
          if (_hwCount > 0) {
            // already computed above as sharedAxisVec
            csAxisVec = sharedAxisVec.clone();
          } else if (_csOnlyPos.length >= 2) {
            const _variance2 = (vals) => {
              const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
              return vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
            };
            const _axes2 = [
              { vec: new THREE.Vector3(1, 0, 0), v: _variance2(_csOnlyPos.map(p => p[0])) },
              { vec: new THREE.Vector3(0, 1, 0), v: _variance2(_csOnlyPos.map(p => p[1])) },
              { vec: new THREE.Vector3(0, 0, 1), v: _variance2(_csOnlyPos.map(p => p[2])) },
            ];
            _axes2.sort((a, b) => a.v - b.v);
            csAxisVec = _axes2[0].vec.clone();
          } else {
            csAxisVec = thicknessAxisRef.current.clone();
          }

          Object.values(configuration.selectedCountersinks).forEach(cs => {
            const hole = cs.hole;
            if (!hole?.position) return;

            const rawPos = hole.position;
            const pos = {
              x: Array.isArray(rawPos) ? rawPos[0] : (rawPos.x || 0),
              y: Array.isArray(rawPos) ? rawPos[1] : (rawPos.y || 0),
              z: Array.isArray(rawPos) ? rawPos[2] : (rawPos.z || 0),
            };
            const partT2 = configuration.thickness ? parseFloat(configuration.thickness) : measuredThickness;
            const holeMmDia2 = (hole.diameterInches || 0.1) * 25.4;
            const holeR2 = holeMmDia2 / 2;

            const axisVec2 = csAxisVec.clone();
            const axisNorm2 = axisVec2.clone().normalize();
            const faceSign2 = cs.face === 'down' ? -1 : 1;
            const centerPos2 = new THREE.Vector3(pos.x, pos.y, pos.z);
            // Pull wide rim 0.5mm outside the surface so the cone is visibly proud
            const basePos2 = centerPos2.clone().add(axisNorm2.clone().multiplyScalar(faceSign2 * (partT2 * 0.5 + 0.5)));

            const csMajorR = cs.major_dia ? parseFloat(cs.major_dia) * 25.4 / 2 : holeR2 * 1.5;
            const csMinorR = cs.minor_dia ? parseFloat(cs.minor_dia) * 25.4 / 2 : holeR2;

            const addCSMarker = (geo, mat, p) => {
              const m = new THREE.Mesh(geo, mat);
              m.isHardwareMarker = true;
              m.position.copy(p);
              m.lookAt(p.clone().add(axisNorm2));
              m.rotateX(Math.PI / 2);
              modelParent2.add(m);
            };

            // Cap cone height to fit within material — wide rim at surface, narrow tip into material
            const coneH2 = Math.min(Math.max(csMajorR * 0.6, 2.0), partT2 * 0.95);
            const coneCenter2 = basePos2.clone().add(axisNorm2.clone().multiplyScalar(-faceSign2 * coneH2 / 2));
            addCSMarker(
              new THREE.CylinderGeometry(csMajorR * 0.98, csMinorR * 0.9, coneH2, 32, 1, true),
              csConeMat, coneCenter2
            );

            // Back nut-ring — sits just outside the opposite face
            // lookAt must be flipped by faceSign2 so BackSide material is visible from outside
            const backPos2 = basePos2.clone().add(axisNorm2.clone().multiplyScalar(-faceSign2 * (partT2 + 1.5)));
            const backRing = new THREE.Mesh(new THREE.RingGeometry(csMinorR, csMinorR * 1.8, 32), csBackDiscMat);
            backRing.isHardwareMarker = true;
            backRing.position.copy(backPos2);
            backRing.lookAt(backPos2.clone().add(axisNorm2.clone().multiplyScalar(faceSign2)));
            modelParent2.add(backRing);
          });
        }

        threeViewer.Render();
      } catch (styleError) {
        console.warn("Marker Precision Error:", styleError);
      }
    };

    applyManufacturingStyles();
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

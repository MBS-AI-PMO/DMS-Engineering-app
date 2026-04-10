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

        // Hardware markers — distinct geometry per type
        if (configuration.selectedHardware) {
          // Shared materials for performance
          const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.4, roughness: 0.6 });
          const goldMat = new THREE.MeshStandardMaterial({ color: 0xB8860B, metalness: 0.7, roughness: 0.3 });
          const blueMat = new THREE.MeshStandardMaterial({ color: 0x6366f1, metalness: 0.7, roughness: 0.3 });
          const greenMat = new THREE.MeshStandardMaterial({ color: 0x059669, metalness: 0.7, roughness: 0.3 });
          const redMat = new THREE.MeshStandardMaterial({ color: 0xDC2626, metalness: 0.7, roughness: 0.3 });

          const HW_MATS = { 1: greenMat, 2: blueMat, 3: goldMat, 4: redMat };

          // Sample panel surface color once for hole fill rings (Issue 2)
          let panelHex = 0x9ca3af;
          threeViewer.scene.traverse(o => {
            if (o.isMesh && !o.isHardwareMarker && !o.isTapMarker && o.material?.color) {
              panelHex = o.material.color.getHex();
            }
          });
          const panelFillMat = new THREE.MeshStandardMaterial({ color: panelHex, metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide });

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
            const r = Math.max(holeMmDia / 2, 0.5);
            const mainMat = HW_MATS[typeId] || goldMat;

            const rawAxis = hole.axis;
            const axisVec = rawAxis ? new THREE.Vector3(
              Array.isArray(rawAxis) ? rawAxis[0] : (rawAxis.x || 0),
              Array.isArray(rawAxis) ? rawAxis[1] : (rawAxis.y || 0),
              Array.isArray(rawAxis) ? rawAxis[2] : (rawAxis.z || 0)
            ) : new THREE.Vector3(0, 1, 0);

            const axisNorm = axisVec.clone().normalize();
            const faceSign = face === 'down' ? -1 : 1;
            const centerPos = new THREE.Vector3(pos.x, pos.y, pos.z);

            const modelParent = threeViewer.scene.children.find(c => c.isGroup) || threeViewer.scene;

            const addMarker = (geo, mat, p) => {
              const m = new THREE.Mesh(geo, mat);
              m.isHardwareMarker = true;
              m.position.copy(p);
              m.lookAt(p.clone().add(axisNorm));
              m.rotateX(Math.PI / 2);
              modelParent.add(m);
            };

            // Surface-anchored base position (matches InstantPricing pattern)
            const holeR = r;
            const toolingDiaMm = item?.tooling_diameter ? parseFloat(item.tooling_diameter) * 25.4 : null;
            const barrelR = toolingDiaMm ? Math.min(toolingDiaMm / 2, holeR) : holeR * 0.9;
            const basePos = centerPos.clone().add(axisNorm.clone().multiplyScalar(faceSign * partT * 0.5));

            // Hole fill rings: visually resize hole to tooling diameter when hardware is smaller
            if (toolingDiaMm && toolingDiaMm < holeMmDia) {
              const backPos = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * partT));
              addMarker(new THREE.RingGeometry(barrelR, holeR, 32), panelFillMat, basePos.clone());
              addMarker(new THREE.RingGeometry(barrelR, holeR, 32), panelFillMat, backPos);
            }

            const type = typeId || 3;

            if (type === 3) {
              // Nut: body above front surface + thin disc on back face
              const hexH = Math.max(3.5, partT * 0.8);
              const discH = 0.3;
              const hexCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * hexH * 0.5));
              const discCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (partT + discH * 0.5)));
              addMarker(new THREE.CylinderGeometry(holeR * 1.5, holeR * 1.5, hexH, 32, 1, true), mainMat, hexCenter);
              addMarker(new THREE.CylinderGeometry(barrelR * 0.45, barrelR * 0.45, hexH, 16), blackMat, hexCenter);
              addMarker(new THREE.RingGeometry(holeR * 0.8, holeR * 1.5, 32), mainMat, discCenter);
            } else if (type === 4) {
              // Flush Nut: thin hollow disc on each face
              const discH = 0.4;
              const center1 = basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * discH * 0.5));
              const center2 = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (partT + discH * 0.5)));
              addMarker(new THREE.RingGeometry(holeR * 0.8, holeR * 1.5, 32), mainMat, center1);
              addMarker(new THREE.RingGeometry(holeR * 0.8, holeR * 1.5, 32), mainMat, center2);
            } else if (type === 2) {
              // Flush Standoff: hollow barrel from front surface + flange on back face
              const standH = item?.length ? parseFloat(item.length) * 25.4 : partT * 2.5;
              const flangeH = Math.max(0.6, partT * 0.04);
              const bodyCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * standH * 0.5));
              const flangeCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (partT + flangeH * 0.5)));
              addMarker(new THREE.CylinderGeometry(barrelR, barrelR, standH, 24, 1, true), mainMat, bodyCenter);
              addMarker(new THREE.CylinderGeometry(barrelR * 0.4, barrelR * 0.4, standH, 16), blackMat, bodyCenter);
              addMarker(new THREE.CylinderGeometry(holeR * 1.5, holeR * 1.5, flangeH, 32), mainMat, flangeCenter);
              addMarker(new THREE.CylinderGeometry(barrelR * 0.4, barrelR * 0.4, flangeH + 0.1, 16), blackMat, flangeCenter);
            } else if (type === 1) {
              // Flush Stud: shaft from front surface + head on back face
              const studH = item?.length ? parseFloat(item.length) * 25.4 : partT * 3;
              const headH = Math.max(0.6, partT * 0.04);
              const studCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * studH * 0.5));
              const headCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (partT + headH * 0.5)));
              addMarker(new THREE.CylinderGeometry(barrelR * 0.8, barrelR * 0.8, studH, 16), mainMat, studCenter);
              addMarker(new THREE.CylinderGeometry(holeR * 1.6, holeR * 1.6, headH, 32), mainMat, headCenter);
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

            const rawAxis = hole.axis;
            const axisVec2 = rawAxis ? new THREE.Vector3(
              Array.isArray(rawAxis) ? rawAxis[0] : (rawAxis.x || 0),
              Array.isArray(rawAxis) ? rawAxis[1] : (rawAxis.y || 0),
              Array.isArray(rawAxis) ? rawAxis[2] : (rawAxis.z || 0)
            ) : new THREE.Vector3(0, 1, 0);
            const axisNorm2 = axisVec2.clone().normalize();
            const centerPos2 = new THREE.Vector3(pos.x, pos.y, pos.z);
            const basePos2 = centerPos2.clone().add(axisNorm2.clone().multiplyScalar(partT2 * 0.5));

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

            const coneH2 = Math.max(csMajorR * 0.6, 2.0);
            const coneCenter2 = basePos2.clone().add(axisNorm2.clone().multiplyScalar(0.5 - coneH2 / 2));
            addCSMarker(
              new THREE.CylinderGeometry(csMajorR * 0.98, csMinorR * 0.9, coneH2, 32, 1, true),
              csConeMat, coneCenter2
            );

            const backPos2 = basePos2.clone().add(axisNorm2.clone().multiplyScalar(-partT2 - 0.4));
            const backRing = new THREE.Mesh(new THREE.RingGeometry(csMinorR, csMinorR * 1.8, 32), csBackDiscMat);
            backRing.isHardwareMarker = true;
            backRing.position.copy(backPos2);
            backRing.lookAt(backPos2.clone().add(axisNorm2)); // RingGeometry face=+Z, lookAt already makes it flat — no rotateX
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

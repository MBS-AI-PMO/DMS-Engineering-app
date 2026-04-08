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
            box.getSize(size);

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
          if (!obj.isMesh || !obj.material) return;
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

            marker.position.set(pos.x, pos.y, pos.z);

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

            threeViewer.scene.add(marker);
          });
        }

        // Hardware markers — distinct geometry per type
        if (configuration.selectedHardware) {
          // typeId→color map  (1=Flush Stud, 2=Flush Standoff, 3=Nut, 4=Flush Nut)
          const HW_COLORS = { 1: 0x059669, 2: 0x6366f1, 3: 0xB8860B, 4: 0xDC2626 };

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
            const toolMmDia = parseFloat(item?.tooling_diameter || 0.1) * 25.4;
            const r = Math.max(Math.min(holeMmDia / 2, toolMmDia / 2), 0.5);
            const color = HW_COLORS[typeId] || 0xB8860B;

            const rawAxis = hole.axis;
            const axisVec = rawAxis ? new THREE.Vector3(
              Array.isArray(rawAxis) ? rawAxis[0] : (rawAxis.x || 0),
              Array.isArray(rawAxis) ? rawAxis[1] : (rawAxis.y || 0),
              Array.isArray(rawAxis) ? rawAxis[2] : (rawAxis.z || 0)
            ) : new THREE.Vector3(0, 1, 0);

            const faceSign = face === 'down' ? -1 : 1;
            const faceOffset = axisVec.clone().normalize().multiplyScalar(faceSign * partT * 0.5);
            const markerPos = new THREE.Vector3(pos.x + faceOffset.x, pos.y + faceOffset.y, pos.z + faceOffset.z);

            const type = typeId || 3;
            const meshesToAdd = [];

            if (type === 3) {
              // Nut — flat hexagonal disk + inner black void to suggest hole
              const outerMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 });
              const outerGeo = new THREE.CylinderGeometry(r * 1.4, r * 1.4, partT * 0.15, 6);
              meshesToAdd.push(new THREE.Mesh(outerGeo, outerMat));
              const innerMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.4 });
              const innerGeo = new THREE.CylinderGeometry(r * 0.55, r * 0.55, partT * 0.2, 16);
              meshesToAdd.push(new THREE.Mesh(innerGeo, innerMat));
            } else if (type === 2) {
              // Flush Standoff — tall cylinder post
              const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 });
              meshesToAdd.push(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, partT * 1.6, 24), mat));
            } else if (type === 4) {
              // Flush Nut — torus ring (washer shape)
              const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 });
              meshesToAdd.push(new THREE.Mesh(new THREE.TorusGeometry(r * 1.1, r * 0.35, 8, 24), mat));
            } else if (type === 1) {
              // Flush Stud — thin elongated pin
              const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 });
              meshesToAdd.push(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, partT * 2.2, 16), mat));
            } else {
              const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4 });
              meshesToAdd.push(new THREE.Mesh(new THREE.CylinderGeometry(r, r, partT, 32, 1, true), mat));
            }

            meshesToAdd.forEach(mesh => {
              mesh.isHardwareMarker = true;
              mesh.position.copy(markerPos);
              mesh.lookAt(markerPos.clone().add(axisVec));
              mesh.rotateX(Math.PI / 2);
              threeViewer.scene.add(mesh);
            });
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

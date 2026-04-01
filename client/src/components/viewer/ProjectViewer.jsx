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
  const onDimRef = useRef(onDimensionsExtracted);

  // Sync ref without triggering re-effects
  useEffect(() => {
    onDimRef.current = onDimensionsExtracted;
  }, [onDimensionsExtracted]);

  // Initial Library Configuration
  useEffect(() => {
    try {
      OV.SetExternalLibLocation('/libs/'); // Ensure workers are loaded correctly
    } catch (e) {
      console.warn("ProjectViewer Lib Config Warning:", e);
    }
  }, []);

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
        console.error("ProjectViewer Cleanup Error:", err);
      }
      viewerInstance.current = null;
    }

    try {
      const viewer = new OV.EmbeddedViewer(currentContainer, {
        backgroundColor: new OV.RGBAColor(248, 249, 250, 255),
        edgeSettings: new OV.EdgeSettings(true, new OV.RGBColor(65, 105, 225), 1),
        onModelLoaded: () => {
          const model = viewer.GetModel();

          // World-class dimension extraction using bounding box logic
          if (onDimRef.current && model) {
            const boundingBox = OV.GetBoundingBox(model);
            const sizes = [
              boundingBox.max.x - boundingBox.min.x,
              boundingBox.max.y - boundingBox.min.y,
              boundingBox.max.z - boundingBox.min.z
            ].sort((a, b) => a - b);

            // Map to standard L/W/T
            onDimRef.current({ l: sizes[2], w: sizes[1], t: sizes[0] });
          }

          // Enhance the viewer scene with premium lighting
          const threeViewer = viewer.GetViewer();
          if (threeViewer?.scene) {
            threeViewer.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
            const spotlight = new THREE.DirectionalLight(0xffffff, 1.0);
            spotlight.position.set(100, 100, 100);
            threeViewer.scene.add(spotlight);
          }

          viewer.FitToWindow();
          viewer.Render();
          setModelLoadCount(c => c + 1);
        },
        onLoadError: (loadError) => {
          console.error("ProjectViewer Load Error:", loadError);
        }
      });

      viewerInstance.current = viewer;

      // Robust file source handling (Local File vs Remote URL persistent session)
      if (file instanceof File) {
        viewer.LoadModelFromFileList([file]);
      } else if (file && (file.name || file.path)) {
        const remoteUrl = file.path || `/uploads/orders/${file.name}`;
        viewer.LoadModelFromUrlList([remoteUrl]);
      }

      // Responsive observer for dashboard layouts
      const resizeObserver = new ResizeObserver(() => {
        if (viewerInstance.current) {
          viewerInstance.current.FitToWindow();
          viewerInstance.current.Render();
        }
      });
      resizeObserver.observe(currentContainer);

      return () => {
        resizeObserver.disconnect();
        try { viewer.Destroy(); } catch (e) { /* ignore */ }
      };
    } catch (err) {
      console.error("ProjectViewer Initialization Error:", err);
    }
  }, [file]); // Only re-run model core if file changes

  // --- Dynamic Styling & Manufacturing Markers Effect ---
  useEffect(() => {
    if (!viewerInstance.current || modelLoadCount === 0) return;

    const applyManufacturingStyles = () => {
      try {
        const threeViewer = viewerInstance.current.GetViewer();
        if (!threeViewer?.scene) return;

        // Thread-safe marker cleanup
        const existingMarkers = [];
        threeViewer.scene.traverse(obj => {
          if (obj.isTapMarker) existingMarkers.push(obj);
        });
        existingMarkers.forEach(m => {
          if (m.parent) m.parent.remove(m);
          if (m.geometry) m.geometry.dispose();
          if (m.material) {
            if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
            else m.material.dispose();
          }
        });

        // Apply Premium Material Finishes
        threeViewer.scene.traverse(obj => {
          if (!obj.isMesh || !obj.material) return;
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];

          materials.forEach(mat => {
            if (!mat) return;
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

        // Render Royal Blue Tap & Hole Markers
        if (configuration.selectedTaps) {
          Object.values(configuration.selectedTaps).forEach(tap => {
            if (!tap.hole?.position) return;
            const pos = tap.hole.position;
            const radius = (tap.hole.diameterInches || 0.1) * 25.4 / 2;

            const geometry = new THREE.CylinderGeometry(radius, radius * 1.05, 3, 32);
            const material = new THREE.MeshStandardMaterial({
              color: 0x4169e1, // Royal Blue High-End Marker
              emissive: 0x4169e1,
              emissiveIntensity: 0.4,
              transparent: true,
              opacity: 0.9
            });
            const marker = new THREE.Mesh(geometry, material);
            marker.isTapMarker = true;
            marker.position.set(pos.x, pos.y, pos.z);
            marker.rotateX(Math.PI / 2);

            threeViewer.scene.add(marker);
          });
        }

        threeViewer.Render();
      } catch (styleError) {
        console.warn("ProjectViewer Sync Error:", styleError);
      }
    };

    applyManufacturingStyles();
    // Re-check after layout stabilization
    const timer = setTimeout(applyManufacturingStyles, 250);
    return () => clearTimeout(timer);
  }, [modelLoadCount, configuration]);

  return (
    <div
      ref={containerRef}
      className="project-viewer-surface"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: isPreview ? 'none' : 'inset 0 4px 12px rgba(0,0,0,0.05)'
      }}
    />
  );
};

export default ProjectViewer;

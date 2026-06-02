import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getWrinkleNormalTexture, getWrinkleGrainTexture } from '../../utils/wrinkleThreeTextures';
import { analyzeDxfFile } from '../../utils/dxfAnalysis';

const DxfModelViewer = ({
  selectedFile,
  viewMode,
  activeFinishColor,
  isFinishPowderCoating,
  selectedThickness,
  onDimensionsExtracted = () => { },
  onTechDataExtracted = () => { },
  onHolesDetected = () => { },
  setIsImporting = () => { },
  setImportProgress = () => { },
}) => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const extrudeMatRef = useRef(null);
  const [dxfSvg, setDxfSvg] = useState(null);
  const [viewBoxData, setViewBoxData] = useState(null);
  const wrinkleNormal = useRef(null);
  const wrinkleGrain = useRef(null);

  // --- Parse DXF ---
  useEffect(() => {
    if (!selectedFile) return;
    const loadDxf = async () => {
      setIsImporting(true);
      setImportProgress(10);
      try {
        setImportProgress(40);
        const analysis = await analyzeDxfFile(selectedFile.file);
        setImportProgress(70);
        setDxfSvg(analysis.svg);
        onDimensionsExtracted(analysis.dimensions);
        setViewBoxData(analysis.viewBoxData);
        onTechDataExtracted(analysis.techData);
        onHolesDetected(analysis.holes);

      } catch (err) {
        console.error('DXF Parsing Error:', err);
      } finally {
        setImportProgress(100);
        setIsImporting(false);
      }
    };
    loadDxf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.id]);

  // --- Wrinkle textures (shared cache across viewers) ---
  useEffect(() => {
    if (!wrinkleNormal.current) wrinkleNormal.current = getWrinkleNormalTexture();
    if (!wrinkleGrain.current) wrinkleGrain.current = getWrinkleGrainTexture();
  }, []);

  // --- Three.js DXF View (Handles both 2D and 3D) ---
  useEffect(() => {
    if (!selectedFile?.id || !dxfSvg || !containerRef.current) return;
    const el = containerRef.current;
    let reqId;

    const init = () => {
      el.innerHTML = '';
      const w = el.clientWidth || 600, h = el.clientHeight || 400;
      const is3D = viewMode === '3d';

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xffffff);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setSize(w, h);
      el.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lights (CAD style)
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const l1 = new THREE.DirectionalLight(0xffffff, 1.0);
      l1.position.set(1000, 1000, 1000);
      scene.add(l1);
      const l2 = new THREE.DirectionalLight(0xffffff, 0.5);
      l2.position.set(-1000, -1000, 500);
      scene.add(l2);

      // Parse SVG into Three.js
      const loader = new SVGLoader();
      const svgData = loader.parse(dxfSvg);
      const group = new THREE.Group();

      const rawThick = selectedThickness ? parseFloat(selectedThickness) : 0;
      const thicknessMM = rawThick > 0 ? rawThick * 25.4 : 2.5;
      const thicknessNative = (viewBoxData?.isNativeInches) ? (thicknessMM / 25.4) : thicknessMM;

      const lineMat = new THREE.LineBasicMaterial({ color: 0x1e293b });
      const extrudeSettings = {
        depth: thicknessNative,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelSegments: 2
      };

      // 1. Stitch segments into closed loops (Fixes the "fragmented lines" bug)
      const segments = [];
      svgData.paths.forEach(p => p.subPaths.forEach(s => {
        const pts = s.getPoints();
        if (pts.length > 1) segments.push({ pts, used: false });
      }));

      const shapes = [];
      const findLoop = () => {
        const start = segments.find(s => !s.used);
        if (!start) return null;
        start.used = true;
        let loop = [...start.pts];
        let changed = true;
        while (changed) {
          changed = false;
          const end = loop[loop.length - 1];
          for (let s of segments) {
            if (s.used) continue;
            const p1 = s.pts[0], p2 = s.pts[s.pts.length - 1];
            if (end.distanceTo(p1) < 0.1) {
              loop.push(...s.pts.slice(1)); s.used = true; changed = true; break;
            } else if (end.distanceTo(p2) < 0.1) {
              loop.push(...[...s.pts].reverse().slice(1)); s.used = true; changed = true; break;
            }
          }
        }
        if (loop.length > 2 && loop[0].distanceTo(loop[loop.length - 1]) < 1.0) {
          const sh = new THREE.Shape();
          sh.moveTo(loop[0].x, loop[0].y);
          for (let i = 1; i < loop.length; i++) sh.lineTo(loop[i].x, loop[i].y);
          return sh;
        }
        return null;
      };

      let nextLoop;
      while ((nextLoop = findLoop())) { shapes.push(nextLoop); }

      // 2. Technical Edges (Always visible)
      svgData.paths.forEach(p => p.subPaths.forEach(s => {
        const pts = s.getPoints();
        if (pts.length > 1) {
          const geom = new THREE.BufferGeometry().setFromPoints(pts);
          const lineT = new THREE.Line(geom, lineMat);
          lineT.position.z = is3D ? thicknessNative + 0.05 : 0.05;
          group.add(lineT);
          if (is3D) {
            const lineB = new THREE.Line(geom, lineMat);
            lineB.position.z = -0.05;
            group.add(lineB);
          }
        }
      }));

      const extrudeMat = new THREE.MeshStandardMaterial({
        color: 0xe5e7eb, roughness: 0.35, metalness: 0.6,
      });
      extrudeMatRef.current = extrudeMat;

      // 3. Robust Hierarchy & Subtraction
      const meta = shapes.map(shape => {
        const pts = shape.getPoints();
        const box = new THREE.Box2().setFromPoints(pts);
        return { shape, box, area: Math.abs(THREE.ShapeUtils.area(pts)), parent: null, depth: 0 };
      });

      meta.sort((a, b) => a.area - b.area);
      for (let i = 0; i < meta.length; i++) {
        const child = meta[i];
        const center = child.box.getCenter(new THREE.Vector2());
        for (let j = i + 1; j < meta.length; j++) {
          const parent = meta[j];
          if (parent.box.clone().expandByScalar(0.1).containsPoint(center)) {
            child.parent = parent; break;
          }
        }
      }
      meta.forEach(m => { let c = m; while (c.parent) { m.depth++; c = c.parent; } });
      meta.forEach(m => { if (m.depth % 2 !== 0 && m.parent) m.parent.shape.holes.push(m.shape); });

      // 4. Render Final Geometry
      meta.forEach(m => {
        if (m.depth % 2 === 0) {
          if (is3D) {
            group.add(new THREE.Mesh(new THREE.ExtrudeGeometry(m.shape, extrudeSettings), extrudeMat));
          } else {
            const mesh = new THREE.Mesh(new THREE.ShapeGeometry(m.shape), new THREE.MeshBasicMaterial({
              color: 0xf1f5f9, side: THREE.DoubleSide, transparent: true, opacity: 0.4
            }));
            mesh.position.z = -0.05;
            group.add(mesh);
          }
        }
      });

      group.scale.y = -1;
      const box = new THREE.Box3().setFromObject(group);
      if (!box.isEmpty()) group.position.sub(box.getCenter(new THREE.Vector3()));
      scene.add(group);

      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 20);

      // Camera & Controls setup based on mode
      let camera;
      if (is3D) {
        camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
        camera.position.set(maxDim, -maxDim, maxDim);
      } else {
        const aspect = w / h;
        const fSize = maxDim * 1.2;
        camera = new THREE.OrthographicCamera(
          fSize * aspect / -2, fSize * aspect / 2,
          fSize / 2, fSize / -2,
          0.1, 10000
        );
        camera.position.set(0, 0, maxDim);
      }

      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 0);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      if (!is3D) {
        controls.enableRotate = false;
        controls.screenSpacePanning = true;
      }
      controlsRef.current = controls;

      // Custom Zoom-to-Cursor logic
      const onWheel = (ev) => {
        ev.preventDefault();
        ev.stopImmediatePropagation();

        const rect = el.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        const ratio = ev.deltaY > 0 ? -0.1 : 0.1;

        if (intersects.length > 0) {
          const p = intersects[0].point;

          if (camera.isOrthographicCamera) {
            camera.zoom *= (1 + ratio);
            camera.position.x += (p.x - camera.position.x) * ratio / (1 + ratio);
            camera.position.y += (p.y - camera.position.y) * ratio / (1 + ratio);
            camera.updateProjectionMatrix();
          } else {
            camera.position.x += (p.x - camera.position.x) * ratio;
            camera.position.y += (p.y - camera.position.y) * ratio;
            camera.position.z += (p.z - camera.position.z) * ratio;

            controls.target.x += (p.x - controls.target.x) * 0.3;
            controls.target.y += (p.y - controls.target.y) * 0.3;
            controls.target.z += (p.z - controls.target.z) * 0.3;
          }
        } else {
          if (camera.isOrthographicCamera) {
            camera.zoom *= (1 + ratio);
            camera.updateProjectionMatrix();
          } else {
            const target = controls.target;
            camera.position.x += (target.x - camera.position.x) * ratio;
            camera.position.y += (target.y - camera.position.y) * ratio;
            camera.position.z += (target.z - camera.position.z) * ratio;
          }
        }
        controls.update();
      };

      renderer.domElement.addEventListener('wheel', onWheel, { capture: true, passive: false });

      const animate = () => {
        reqId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const resizeObserver = new ResizeObserver(() => {
        const width = el.clientWidth;
        const height = el.clientHeight;
        if (width && height) {
          if (camera.isPerspectiveCamera) {
            camera.aspect = width / height;
          } else {
            const aspect = width / height;
            const fSize = maxDim * 1.2;
            camera.left = fSize * aspect / -2;
            camera.right = fSize * aspect / 2;
            camera.top = fSize / 2;
            camera.bottom = fSize / -2;
          }
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      });
      resizeObserver.observe(el);

      return () => {
        resizeObserver.disconnect();
        cancelAnimationFrame(reqId);
        controlsRef.current?.dispose();
        rendererRef.current?.dispose();
        extrudeMatRef.current = null;
        if (el) el.innerHTML = '';
      };
    };

    init();
  }, [selectedFile?.id, viewMode, dxfSvg, selectedThickness, viewBoxData?.isNativeInches]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: '#ffffff' }} />;
};

export default React.memo(DxfModelViewer);

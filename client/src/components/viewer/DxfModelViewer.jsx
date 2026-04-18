import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { parseString, toSVG } from 'dxf';
import { getWrinkleNormalTexture, getWrinkleGrainTexture } from '../../utils/wrinkleThreeTextures';

// ─── DXF Technical Data Extractor ────────────────────────
function calcDxfTechData(entities, isInch) {
  const toMm = v => isInch ? v * 25.4 : v;
  let totalPerimeter = 0;
  let pierceCount = 0;

  for (const e of entities || []) {
    if (e.type === 'LINE') {
      const dx = (e.end?.x || 0) - (e.start?.x || 0);
      const dy = (e.end?.y || 0) - (e.start?.y || 0);
      totalPerimeter += toMm(Math.sqrt(dx * dx + dy * dy));
    } else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
      const verts = e.vertices || [];
      for (let i = 0; i < verts.length - 1; i++) {
        const dx = verts[i + 1].x - verts[i].x;
        const dy = verts[i + 1].y - verts[i].y;
        totalPerimeter += toMm(Math.sqrt(dx * dx + dy * dy));
      }
      const isClosed = e.closed || (e.flag & 1);
      if (isClosed && verts.length > 1) {
        const dx = verts[0].x - verts[verts.length - 1].x;
        const dy = verts[0].y - verts[verts.length - 1].y;
        totalPerimeter += toMm(Math.sqrt(dx * dx + dy * dy));
        pierceCount++;
      }
    } else if (e.type === 'ARC') {
      let startDeg = e.startAngle || 0;
      let endDeg = e.endAngle || 0;
      if (endDeg <= startDeg) endDeg += 360;
      totalPerimeter += toMm((e.r || 0) * (endDeg - startDeg) * Math.PI / 180);
    } else if (e.type === 'CIRCLE') {
      totalPerimeter += toMm(2 * Math.PI * (e.r || 0));
      pierceCount++;
    } else if (e.type === 'SPLINE') {
      const pts = e.controlPoints || e.fitPoints || [];
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x;
        const dy = pts[i + 1].y - pts[i].y;
        totalPerimeter += toMm(Math.sqrt(dx * dx + dy * dy));
      }
    }
  }
  return { totalPerimeter, pierceCount: Math.max(1, pierceCount) };
}

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
        const text = await selectedFile.file.text();
        setImportProgress(40);
        const parsed = parseString(text);
        setImportProgress(70);
        const svg = toSVG(parsed);
        setDxfSvg(svg);

        // Extract dimensions Establichment établissements
        const header = parsed.header || {};
        const isInch = header.$INSUNITS === 1;
        const toMm = v => isInch ? v * 25.4 : v;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        parsed.entities.forEach(e => {
          const check = (x, y) => {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          };
          if (e.start) check(e.start.x, e.start.y);
          if (e.end) check(e.end.x, e.end.y);
          if (e.center) {
            check(e.center.x - e.r, e.center.y - e.r);
            check(e.center.x + e.r, e.center.y + e.r);
          }
          if (e.vertices) e.vertices.forEach(v => check(v.x, v.y));
        });

        const w = maxX - minX, h = maxY - minY;
        const dims = {
          mm: { l: toMm(w).toFixed(2), w: toMm(h).toFixed(2), t: '0.000', volume: '0' },
          inches: { l: (toMm(w) / 25.4).toFixed(3), w: (toMm(h) / 25.4).toFixed(3), t: '0.000', volume: '0' },
          isNativeInches: isInch
        };
        onDimensionsExtracted(dims);
        setViewBoxData({ minX, minY, width: w, height: h });

        // Tech Data
        const techData = calcDxfTechData(parsed.entities, isInch);
        onTechDataExtracted(techData);

        // Detect circle holes for tapping établissements 
        const holes = (parsed.entities || [])
          .filter(e => e.type === 'CIRCLE')
          .map((c, i) => ({
            id: i,
            diameterInches: isInch ? c.r * 2 : (c.r * 2 / 25.4),
            diameter_mm: isInch ? (c.r * 2 * 25.4) : (c.r * 2),
            position: [c.center.x, c.center.y, 0],
            axis: [0, 0, 1]
          }));
        onHolesDetected(holes);

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

  // --- Three.js DXF 3D View ---
  useEffect(() => {
    if (!selectedFile?.id || viewMode !== '3d' || !dxfSvg || !containerRef.current) return;
    const el = containerRef.current;
    let reqId;

    const init = () => {
      el.innerHTML = '';
      const w = el.clientWidth || 600, h = el.clientHeight || 400;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xffffff);
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setSize(w, h);
      el.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controlsRef.current = controls;

      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const light = new THREE.DirectionalLight(0xffffff, 1.5);
      light.position.set(100, 200, 300);
      scene.add(light);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x999999, 1.2));

      const loader = new SVGLoader();
      const svgData = loader.parse(dxfSvg);
      const group = new THREE.Group();
      const thicknessMM = selectedThickness ? parseFloat(selectedThickness) * 25.4 : 2;
      const thicknessNative = (viewBoxData?.isNativeInches) ? (thicknessMM / 25.4) : thicknessMM;
      const lineMat = new THREE.LineBasicMaterial({ color: 0x475569 });
      const extrudeSettings = { depth: thicknessNative, bevelEnabled: false };

      const allShapes = [];
      svgData.paths.forEach((path) => {
        try {
          const shapes = SVGLoader.createShapes(path);
          shapes.forEach(sh => allShapes.push(sh));
        } catch (e) {
          console.warn('Error creating shapes from SVG path:', e);
        }
        path.subPaths.forEach((sub) => {
          const pts = sub.getPoints();
          if (pts && pts.length > 0) {
            const geomTop = new THREE.BufferGeometry().setFromPoints(pts);
            const lineTop = new THREE.Line(geomTop, lineMat);
            lineTop.position.z = thicknessNative + 0.01;
            group.add(lineTop);
            const geomBot = new THREE.BufferGeometry().setFromPoints(pts);
            const lineBot = new THREE.Line(geomBot, lineMat);
            lineBot.position.z = -0.01;
            group.add(lineBot);
          }
        });
      });

      const metaShapes = allShapes.map(shape => {
        const box = new THREE.Box2().setFromPoints(shape.getPoints());
        return { shape, box, area: (box.max.x - box.min.x) * (box.max.y - box.min.y), parent: null, depth: 0 };
      });
      metaShapes.sort((a, b) => a.area - b.area);
      for (let i = 0; i < metaShapes.length; i++) {
        const child = metaShapes[i];
        for (let j = i + 1; j < metaShapes.length; j++) {
          const parent = metaShapes[j];
          if (parent.box.containsPoint(child.box.min) && parent.box.containsPoint(child.box.max)) {
            child.parent = parent; break;
          }
        }
      }
      metaShapes.forEach(m => { let curr = m; while (curr.parent) { m.depth++; curr = curr.parent; } });

      const extrudeMat = new THREE.MeshStandardMaterial({
        color: 0xcecece,
        roughness: 0.6,
        metalness: 0.05,
        emissive: 0x000000,
        emissiveIntensity: 0,
        normalMap: null,
        normalScale: new THREE.Vector2(0, 0)
      });
      extrudeMatRef.current = extrudeMat;

      metaShapes.forEach(m => {
        if (m.depth % 2 === 0) group.add(new THREE.Mesh(new THREE.ExtrudeGeometry(m.shape, extrudeSettings), extrudeMat));
        else if (m.parent) m.parent.shape.holes.push(m.shape);
      });

      group.scale.y = -1;
      const box = new THREE.Box3().setFromObject(group);
      if (!box.isEmpty()) group.position.sub(box.getCenter(new THREE.Vector3()));
      scene.add(group);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, 20);
      camera.position.set(maxDim, -maxDim, maxDim);
      camera.up.set(0, 0, 1); camera.lookAt(0, 0, 0);
      controls.update();

      const animate = () => { reqId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
      animate();
    };

    init();
    return () => {
      cancelAnimationFrame(reqId);
      controlsRef.current?.dispose();
      rendererRef.current?.dispose();
      extrudeMatRef.current = null;
      if (el) el.innerHTML = '';
    };
  }, [selectedFile?.id, viewMode, dxfSvg, selectedThickness, viewBoxData?.isNativeInches]);

  // Live finish updates without rebuilding the whole DXF 3D scene.
  useEffect(() => {
    if (viewMode !== '3d') return;
    const mat = extrudeMatRef.current;
    if (!mat) return;

    const finishHex = activeFinishColor?.color || activeFinishColor?.hex || null;
    const isWrinkled = !!(activeFinishColor?.is_wrinkled || activeFinishColor?.name?.toUpperCase().includes('WRINKLED'));

    if (finishHex) {
      mat.color.set(new THREE.Color(finishHex));
      mat.emissive.set(isFinishPowderCoating ? 0x000000 : new THREE.Color(finishHex));
      mat.emissiveIntensity = isFinishPowderCoating ? 0 : 0.15;
      mat.roughness = isFinishPowderCoating ? (isWrinkled ? 0.55 : Math.max(0.32, 0.9 - ((activeFinishColor?.gloss ?? 35) / 100))) : 0.6;
      mat.metalness = isWrinkled ? 0.18 : 0.05;
      mat.normalMap = isWrinkled ? wrinkleNormal.current : null;
      mat.normalScale = isWrinkled ? new THREE.Vector2(1.8, 1.8) : new THREE.Vector2(0, 0);
      mat.roughnessMap = isWrinkled ? wrinkleGrain.current : null;
    } else {
      mat.color.set(0xcecece);
      mat.emissive.set(0x000000);
      mat.emissiveIntensity = 0;
      mat.roughness = 0.6;
      mat.metalness = 0.05;
      mat.normalMap = null;
      mat.normalScale = new THREE.Vector2(0, 0);
      mat.roughnessMap = null;
    }

    mat.needsUpdate = true;
  }, [activeFinishColor, isFinishPowderCoating, viewMode]);

  if (viewMode === '2d') {
    return (
      <div className="dxf-svg-wrapper h-100 w-100 d-flex align-items-center justify-content-center p-3 position-relative overflow-hidden">
        {dxfSvg ? (
          <div className="position-relative d-flex align-items-center justify-content-center" style={{ width: '100%', height: '100%' }}>
            <style>{`
              .dxf-svg-content { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
              .dxf-svg-content svg { width: 100% !important; height: 100% !important; max-width: 100%; max-height: 100%; }
              .dxf-svg-content svg * {
                fill: ${activeFinishColor ? (activeFinishColor.color || activeFinishColor.hex || 'rgba(0,0,0,0.4)') : 'rgba(0,0,0,0.05)'} !important;
                fill-opacity: ${activeFinishColor ? 0.8 : 0.1} !important;
                stroke: ${activeFinishColor ? (activeFinishColor.color || activeFinishColor.hex) : '#000'} !important;
                stroke-opacity: 1.0 !important;
                stroke-width: 2px !important;
                transition: all 0.3s ease;
              }
            `}</style>
            <div className="dxf-svg-content" dangerouslySetInnerHTML={{ __html: dxfSvg }} />
          </div>
        ) : <div>Parsing...</div>}
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default React.memo(DxfModelViewer);

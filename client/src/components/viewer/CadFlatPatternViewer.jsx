// Copied from Zamyr (apps/dashboard/src/Zamyr/parts/CadFlatPatternViewer.jsx);
// the import paths and the badge dot colour (DMS red) differ, and fitCamera
// fits the part along the screen's own axes (Zamyr's assumes the longest side
// runs across the screen, so a flat drawn upright ran off the top and bottom)
// with room left for the badge above and the legend below.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  buildFlatData,
  flatDataHasGeometry,
  getCadJson,
} from '../../utils/cadFlatPattern.js';
import './zamyrViewer.css';

const DXF_RENDER_CONSOLE_VERSION = 'dxf-outline-v1';

function isDxfAnalysis(cadJson = {}) {
  const source = String(cadJson.source || cadJson.fileType || cadJson.file_type || '').toLowerCase();
  const engine = String(cadJson.analysisEngine || cadJson.analysis_engine || '').toLowerCase();
  return source === 'dxf' || engine.includes('dxf');
}

function countLineSegments(values) {
  if (!Array.isArray(values) || !values.length) return 0;
  if (typeof values[0] === 'number') {
    if (values.length % 6 === 0) return values.length / 6;
    if (values.length % 4 === 0) return values.length / 4;
  }
  return values.length;
}

function sheetMetalMaterial(color = 0xaab2bd, polygonOffsetFactor = 2) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.52,
    roughness: 0.31,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor,
    polygonOffsetUnits: polygonOffsetFactor,
  });
}

function disposeGroup(group) {
  group.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose?.());
    }
  });
}

function getFlatCamera(box, distance) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const dims = [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)];
  const minAxis = dims.indexOf(Math.min(...dims));

  if (minAxis === 0) {
    return {
      position: center.clone().add(new THREE.Vector3(distance, 0, 0)),
      up: new THREE.Vector3(0, 0, 1),
      target: center,
    };
  }
  if (minAxis === 1) {
    return {
      position: center.clone().add(new THREE.Vector3(0, distance, 0)),
      up: new THREE.Vector3(0, 0, 1),
      target: center,
    };
  }
  return {
    position: center.clone().add(new THREE.Vector3(0, 0, distance)),
    up: new THREE.Vector3(0, 1, 0),
    target: center,
  };
}

const BEND_LINE_COLOR = 0x00ced1;

/**
 * Dashes along each crease as quads.
 *
 * A WebGL line is one pixel wide whatever `linewidth` says, so the crease
 * always came out as a hairline. Each dash is a small rectangle in the
 * sheet's own units instead, so the line keeps its weight against the
 * outline at any zoom, the way the shop's drawing draws it. The pattern is
 * centred so a crease begins and ends on a dash, and a crease shorter than
 * one dash is drawn as a single dash of its own length.
 */
function buildDashQuads(positions, dash, gap, weight) {
  const verts = [];
  const half = weight / 2;
  const period = dash + gap;
  for (let i = 0; i + 5 < positions.length; i += 6) {
    const x1 = positions[i];
    const y1 = positions[i + 1];
    const x2 = positions[i + 3];
    const y2 = positions[i + 4];
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length <= 1e-6) continue;
    const ux = (x2 - x1) / length;
    const uy = (y2 - y1) / length;
    const nx = -uy * half;
    const ny = ux * half;
    const count = Math.max(1, Math.floor((length + gap) / period));
    const used = count * period - gap;
    const start = Math.max(0, (length - used) / 2);
    for (let k = 0; k < count; k += 1) {
      const a = start + k * period;
      const b = Math.min(length, a + dash);
      if (b <= a) break;
      const ax = x1 + ux * a;
      const ay = y1 + uy * a;
      const bx = x1 + ux * b;
      const by = y1 + uy * b;
      verts.push(
        ax + nx, ay + ny, 0, ax - nx, ay - ny, 0, bx - nx, by - ny, 0,
        ax + nx, ay + ny, 0, bx - nx, by - ny, 0, bx + nx, by + ny, 0,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return geometry;
}

export default function CadFlatPatternViewer({
  analysis,
  onReanalyze,
  unavailableBody = '',
}) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const frameRef = useRef(0);
  const groupRef = useRef(null);
  const boxRef = useRef(null);
  const baseRef = useRef(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const [renderError, setRenderError] = useState('');

  const cadJson = getCadJson(analysis);
  const isFailed = cadJson.success === false || Boolean(cadJson.error);
  const flatData = useMemo(() => buildFlatData(cadJson), [cadJson]);
  const hasGeometry = flatDataHasGeometry(flatData);
  // Did the CAD analysis succeed with real 3D geometry? Callers can still pass
  // onReanalyze when a manufacturing part should attempt a 2D extraction pass.
  const has3dGeometry = useMemo(() => {
    const meshes = cadJson.faceMeshes;
    if (meshes && typeof meshes === 'object' && Object.values(meshes).some((mesh) => (
      Array.isArray(mesh?.vertices) && mesh.vertices.length >= 9
    ))) return true;
    return Number(cadJson.faceMeshCount) > 0;
  }, [cadJson]);
  const analyzed3dOk = has3dGeometry && !isFailed;

  const updateCamera = useCallback(() => {
    const camera = cameraRef.current;
    const base = baseRef.current;
    if (!camera || !base) return;

    const zoom = zoomRef.current;
    const { x: panX, y: panY } = panRef.current;
    camera.left = base.left * zoom + panX;
    camera.right = base.right * zoom + panX;
    camera.top = base.top * zoom + panY;
    camera.bottom = base.bottom * zoom + panY;
    camera.updateProjectionMatrix();
  }, []);

  const fitCamera = useCallback(() => {
    const mount = mountRef.current;
    const camera = cameraRef.current;
    const box = boxRef.current;
    if (!mount || !camera || !box || box.isEmpty()) return;

    const size = box.getSize(new THREE.Vector3());
    const dims = [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)];
    // getFlatCamera looks along the thinnest axis; these are the world axes
    // that then run across and up the screen.
    const minAxis = dims.indexOf(Math.min(...dims));
    const [acrossAxis, upAxis] = minAxis === 0 ? [1, 2] : minAxis === 1 ? [0, 2] : [0, 1];
    const fitWidth = Math.max(dims[acrossAxis], 1);
    const fitHeight = Math.max(dims[upAxis], 1);
    const aspect = Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1);
    // Room for the "2D Flat View" badge above and the legend pill below.
    const padding = 0.24;

    let halfHeight = (fitHeight / 2) * (1 + padding);
    let halfWidth = halfHeight * aspect;
    if (fitWidth / 2 > halfWidth) {
      halfWidth = (fitWidth / 2) * (1 + padding);
      halfHeight = halfWidth / aspect;
    }

    baseRef.current = {
      left: -halfWidth,
      right: halfWidth,
      top: halfHeight,
      bottom: -halfHeight,
    };
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };

    const maxDim = Math.max(fitWidth, fitHeight, 100);
    const viewCamera = getFlatCamera(box, maxDim * 3);
    camera.position.copy(viewCamera.position);
    camera.up.copy(viewCamera.up);
    camera.lookAt(viewCamera.target);
    camera.near = -maxDim * 10;
    camera.far = maxDim * 10;
    updateCamera();
  }, [updateCamera]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const width = Math.max(mount.clientWidth, 1);
    const height = Math.max(mount.clientHeight, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'cad-flat-canvas';
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8b949e, 1.55));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(0.35, -0.55, 1.4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.85);
    rimLight.position.set(-0.8, 0.55, 0.9);
    scene.add(rimLight);
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10000, 10000);
    cameraRef.current = camera;

    const resizeObserver = new ResizeObserver(() => {
      renderer.setSize(Math.max(mount.clientWidth, 1), Math.max(mount.clientHeight, 1));
      fitCamera();
    });
    resizeObserver.observe(mount);

    const onMouseDown = (event) => {
      draggingRef.current = true;
      lastMouseRef.current = { x: event.clientX, y: event.clientY };
    };
    const onMouseUp = () => {
      draggingRef.current = false;
    };
    const onMouseMove = (event) => {
      const cameraNow = cameraRef.current;
      if (!draggingRef.current || !cameraNow || !baseRef.current) return;

      const deltaX = event.clientX - lastMouseRef.current.x;
      const deltaY = event.clientY - lastMouseRef.current.y;
      const scale = (cameraNow.right - cameraNow.left) / Math.max(mount.clientWidth, 1);
      panRef.current.x -= deltaX * scale;
      panRef.current.y += deltaY * scale;
      lastMouseRef.current = { x: event.clientX, y: event.clientY };
      updateCamera();
    };
    const onWheel = (event) => {
      if (!baseRef.current) return;
      event.preventDefault();

      const rect = mount.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const ny = (event.clientY - rect.top) / Math.max(rect.height, 1);
      const oldZoom = zoomRef.current;
      const newZoom = Math.max(0.05, Math.min(30, oldZoom * (event.deltaY > 0 ? 1.1 : 0.9)));
      const base = baseRef.current;
      const dWidth = (base.right - base.left) * (newZoom - oldZoom);
      const dHeight = (base.top - base.bottom) * (newZoom - oldZoom);

      panRef.current.x -= (nx - 0.5) * dWidth;
      panRef.current.y += (ny - 0.5) * dHeight;
      zoomRef.current = newZoom;
      updateCamera();
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    const animate = () => {
      frameRef.current = window.requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      if (groupRef.current) disposeGroup(groupRef.current);
      renderer.dispose();
      // Explicitly release the WebGL context so it is not held until GC — otherwise
      // remounting the viewer accumulates "too many active WebGL contexts".
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      groupRef.current = null;
      boxRef.current = null;
      baseRef.current = null;
    };
  }, [fitCamera, updateCamera]);

  useEffect(() => {
    if (!isDxfAnalysis(cadJson)) return;
    const diagnostics = cadJson.diagnostics || {};
    const dxf = cadJson.dxf || {};
    console.info('[Zamyr DXF render]', {
      marker: DXF_RENDER_CONSOLE_VERSION,
      analyzerVersion: cadJson.engineVersion || null,
      sourceUnits: cadJson.sourceUnits || cadJson.dxfCoordinateUnits || null,
      scaleToMm: cadJson.dxfScaleToMm || dxf.unitScaleMm || null,
      contourCount: Array.isArray(cadJson.contours) ? cadJson.contours.length : 0,
      cutEdgeCount: countLineSegments(cadJson.cutEdges || cadJson.cut_edges || []),
      detailEdgeCount: countLineSegments(cadJson.dxfDetailEdges || cadJson.dxf_detail_edges || []),
      engravingFillLoopCount: Array.isArray(cadJson.dxfEngravingLoops)
        ? cadJson.dxfEngravingLoops.length
        : Number(dxf.engravingFillLoopCount || 0),
      renderedDetailEdgeCount: countLineSegments(flatData.detailPositions || []),
      fillSource: flatData.fillSource || null,
      material: flatData.hasFilledFace ? 'metallic-sheet' : 'outline',
      nestSheet: Boolean(flatData.nestSheet),
      warnings: Array.isArray(diagnostics.warnings) ? diagnostics.warnings : [],
    });
  }, [cadJson, flatData]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !hasGeometry) return;

    setRenderError('');
    try {
      if (groupRef.current) {
        scene.remove(groupRef.current);
        disposeGroup(groupRef.current);
      }

      const group = new THREE.Group();
      const maxDim = flatData.bounds
        ? Math.max(
          Math.abs(flatData.bounds.max.x - flatData.bounds.min.x),
          Math.abs(flatData.bounds.max.y - flatData.bounds.min.y),
          Math.abs(flatData.bounds.max.z - flatData.bounds.min.z),
          100
        )
        : 100;

      if (flatData.partFills?.length) {
        flatData.partFills.forEach(({ geometry, color }) => {
          group.add(new THREE.Mesh(
            geometry,
            sheetMetalMaterial(color, 1),
          ));
        });
      }

      if (flatData.geometry) {
        group.add(new THREE.Mesh(
          flatData.geometry,
          sheetMetalMaterial(0xaab2bd, 2)
        ));
      }

      if (flatData.detailPositions.length >= 6) {
        const detailGeometry = new THREE.BufferGeometry();
        detailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(flatData.detailPositions, 3));
        const detailMaterial = new THREE.LineBasicMaterial({
          color: 0x111827,
          linewidth: 1,
          depthTest: false,
        });
        const detailLine = new THREE.LineSegments(detailGeometry, detailMaterial);
        detailLine.renderOrder = 3;
        group.add(detailLine);
      }

      if (flatData.cutPositions.length >= 6) {
        const cutGeometry = new THREE.BufferGeometry();
        cutGeometry.setAttribute('position', new THREE.Float32BufferAttribute(flatData.cutPositions, 3));
        const cutLine = new THREE.LineSegments(
          cutGeometry,
          new THREE.LineBasicMaterial({ color: 0x111827, linewidth: 1 })
        );
        cutLine.renderOrder = 2;
        group.add(cutLine);
      }

      if (flatData.bendPositions.length >= 6) {
        const compactBendLines = flatData.bendLineStyle === 'compact';
        const dash = compactBendLines ? Math.max(maxDim * 0.006, 0.6) : maxDim * 0.011;
        const gap = compactBendLines ? Math.max(maxDim * 0.004, 0.35) : maxDim * 0.0035;
        const weight = compactBendLines ? Math.max(maxDim * 0.0015, 0.15) : maxDim * 0.004;
        const bendMesh = new THREE.Mesh(
          buildDashQuads(flatData.bendPositions, dash, gap, weight),
          new THREE.MeshBasicMaterial({
            color: BEND_LINE_COLOR,
            side: THREE.DoubleSide,
            depthTest: false,
          }),
        );
        bendMesh.renderOrder = 4;
        group.add(bendMesh);
      }

      scene.add(group);
      groupRef.current = group;
      boxRef.current = flatData.bounds?.clone?.() || new THREE.Box3().setFromObject(group);
      fitCamera();
    } catch (error) {
      setRenderError(error.message || 'Could not render flat pattern.');
    }
  }, [flatData, fitCamera, hasGeometry]);

  const overlay = (() => {
    if (renderError) return { title: '2D render failed', body: renderError, action: true };
    if (isFailed) return { title: 'CAD analysis failed', body: cadJson.error || 'The analyzer did not return usable flat-pattern geometry.', action: true };
    if (!hasGeometry) {
      return {
        title: '2D flat pattern not available',
        body: unavailableBody || (analyzed3dOk
          ? (onReanalyze
              ? 'This analysis does not include flat-pattern edges. Reanalyze the STEP file to generate the 2D view.'
              : 'This part has no 2D flat pattern.')
          : onReanalyze
            ? 'This analysis does not include flat-pattern edges. Reanalyze the STEP file to generate the 2D view.'
            : 'This analysis does not include flat-pattern edges.'),
        action: Boolean(onReanalyze),
      };
    }
    return null;
  })();

  return (
    <div className="cad-flat-viewer">
      <div ref={mountRef} className="cad-flat-mount" />
      {!overlay && <div className="cad-canvas-badge cad-view-mode-badge"><span style={{ color: '#ef4444' }}>•</span> 2D Flat View</div>}
      {/* Reanalyze used to appear only when the 2D was missing or failed, so a
          part that analyzed *successfully* could never be re-run from the UI --
          the only way to pick up a cad-worker fix was to delete the part and
          upload it again. */}
      {!overlay && onReanalyze && (
        <button
          type="button"
          className="cad-soft-btn cad-reanalyze-btn"
          onClick={onReanalyze}
          title="Re-run the CAD analyzer on this file"
        >
          Reanalyze
        </button>
      )}
      {!overlay && (
        <div className="cad-legend">
          <span><i style={{ display: 'inline-block', width: 34, height: 2, background: '#111827', verticalAlign: 'middle', marginRight: 8 }} />Cut line</span>
          {flatData.bendPositions.length >= 6 && (
            <span><i style={{ display: 'inline-block', width: 34, height: 0, borderTop: '3px dashed #00ced1', verticalAlign: 'middle', marginRight: 8 }} />Bend line</span>
          )}
        </div>
      )}
      {overlay && (
        <div className="cad-viewer-empty">
          <div>
            <strong>{overlay.title}</strong>
            <p>{overlay.body}</p>
            {overlay.action && onReanalyze && (
              <button type="button" className="cad-soft-btn" onClick={onReanalyze}>
                Reanalyze file
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

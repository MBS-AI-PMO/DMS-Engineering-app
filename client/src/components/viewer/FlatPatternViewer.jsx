import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  boundsToBox,
  computeBoundingBox,
  computeBoundingBoxFromPositions,
  getFlatViewCamera,
  unfoldSheetMetal,
} from '../../utils/geometryUtils';

const DEFAULT_OPTIONS = Object.freeze({});

const FlatPatternViewer = forwardRef(function FlatPatternViewer(
  { geometries = [], options = DEFAULT_OPTIONS, backendData, sourceFlatData, formatKind, holes = [], activeHoleId = null },
  ref
) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const frameRef = useRef(null);
  const meshGroupRef = useRef(null);
  const unfoldedBoxRef = useRef(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  const updateCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera || camera._baseLeft === undefined) return;

    const zoom = zoomRef.current;
    const panX = panRef.current.x;
    const panY = panRef.current.y;
    camera.left = camera._baseLeft * zoom + panX;
    camera.right = camera._baseRight * zoom + panX;
    camera.top = camera._baseTop * zoom + panY;
    camera.bottom = camera._baseBottom * zoom + panY;
    camera.updateProjectionMatrix();
  }, []);

  const fitCamera = useCallback(() => {
    if (!cameraRef.current || !mountRef.current) return;

    const box =
      unfoldedBoxRef.current ||
      (geometries.length ? computeBoundingBox(geometries) : null);
    if (!box || box.isEmpty()) return;

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const dims = { x: size.x, y: size.y, z: size.z };

    const camera = cameraRef.current;
    const aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;

    const sorted = [size.x, size.y, size.z].sort((a, b) => b - a);
    const fitWidth = sorted[0];
    const fitHeight = sorted[1];
    const padding = 0.05;
    let halfHeight = (fitHeight / 2) * (1 + padding);
    let halfWidth = halfHeight * aspect;

    if (fitWidth / 2 > halfWidth) {
      halfWidth = (fitWidth / 2) * (1 + padding);
      halfHeight = halfWidth / aspect;
    }

    camera._baseLeft = -halfWidth;
    camera._baseRight = halfWidth;
    camera._baseTop = halfHeight;
    camera._baseBottom = -halfHeight;
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    updateCamera();

    const viewCamera = getFlatViewCamera(box, dims);
    camera.position.copy(viewCamera.position);
    camera.up.copy(viewCamera.up);
    camera.lookAt(viewCamera.target);
    camera.updateProjectionMatrix();
  }, [geometries, updateCamera]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      zoomRef.current *= 0.8;
      updateCamera();
    },
    zoomOut: () => {
      zoomRef.current *= 1.25;
      updateCamera();
    },
    resetView: () => {
      zoomRef.current = 1;
      panRef.current = { x: 0, y: 0 };
      fitCamera();
    },
  }));

  // Initialize Three.js renderer, scene, camera, and event listeners
  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10000, 10000);
    cameraRef.current = camera;

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = mount.clientWidth;
      const nextHeight = mount.clientHeight;
      renderer.setSize(nextWidth, nextHeight);
      fitCamera();
    });
    resizeObserver.observe(mount);

    const onMouseDown = (event) => {
      isDragging.current = true;
      lastMouse.current = { x: event.clientX, y: event.clientY };
    };
    const onMouseUp = () => {
      isDragging.current = false;
    };
    const onMouseMove = (event) => {
      if (!isDragging.current || camera._baseLeft === undefined) return;

      const deltaX = event.clientX - lastMouse.current.x;
      const deltaY = event.clientY - lastMouse.current.y;
      const scale =
        (camera._baseRight - camera._baseLeft) / mount.clientWidth;
      panRef.current.x -= deltaX * scale;
      panRef.current.y += deltaY * scale;
      lastMouse.current = { x: event.clientX, y: event.clientY };
      updateCamera();
    };
    const onWheel = (event) => {
      event.preventDefault();
      zoomRef.current *= event.deltaY > 0 ? 1.1 : 0.9;
      updateCamera();
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    let running = true;
    const animate = () => {
      if (!running) return;
      frameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [fitCamera, updateCamera]);

  // Build geometry from backend data
  const buildFromBackend = useCallback((data) => {
    const flatVertices = new Float32Array(data.flatVertices || []);
    const unfoldedGeometry = new THREE.BufferGeometry();
    if (flatVertices.length > 0) {
      unfoldedGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(flatVertices, 3)
      );
      unfoldedGeometry.computeVertexNormals();
    }
    unfoldedGeometry.computeBoundingBox();

    // Check for both camelCase and snake_case backend names
    const bendPts = data.bendEdges || data.bend_edges || [];
    const cutPts = data.cutEdges || data.cut_edges || [];

    // Technical projection layers
    const topEdges = data.topEdges || [];
    const topBendEdges = data.topBendEdges || [];
    const frontEdges = data.frontEdges || [];
    const sideEdges = data.sideEdges || [];

    return {
      unfoldedGeometry,
      cutPts,
      bendPts,
      topEdges,
      topBendEdges,
      frontEdges,
      sideEdges,
      bounds: unfoldedGeometry.boundingBox.clone(),
      hasFilledFace: true,
      mode: 'backend',
    };
  }, []);

  // Build geometry from source flat data (e.g. DXF)
  const buildFromSource = useCallback((data) => {
    // Check for both camelCase and snake_case
    const bendPts = data.bendPts || data.bend_edges || [];
    const cutPts = data.cutPts || data.cut_edges || [];

    const bounds =
      boundsToBox(data.bounds) ||
      computeBoundingBoxFromPositions(cutPts || []);

    return {
      unfoldedGeometry: null,
      cutPts,
      bendPts,
      bounds,
      hasFilledFace: false,
      mode: 'source',
    };
  }, []);

  // Build geometry from client-side fallback unfolding
  const buildFromFallback = useCallback((loadedGeometries) => {
    const {
      geometry: unfoldedGeometry,
      cutPts,
      bendPts,
    } = unfoldSheetMetal(loadedGeometries);
    unfoldedGeometry.computeBoundingBox();

    return {
      unfoldedGeometry,
      cutPts,
      bendPts,
      bounds: unfoldedGeometry.boundingBox.clone(),
      hasFilledFace: true,
      mode: 'fallback',
    };
  }, []);

  // Build and display flat pattern geometry
  const highlightBends = !!options?.highlightBends;
  const gridEnabled = !!options?.grid;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (meshGroupRef.current) {
      scene.remove(meshGroupRef.current);
      meshGroupRef.current = null;
    }

    const hasBackendGeometry = Boolean(
      (backendData?.flatVertices && backendData.flatVertices.length > 0) ||
      (backendData?.cutEdges && backendData.cutEdges.length > 0) ||
      (backendData?.cut_edges && backendData.cut_edges.length > 0)
    );
    const hasSourceGeometry = Boolean(sourceFlatData?.cutPts?.length || sourceFlatData?.cut_edges?.length);

    if (!geometries.length && !hasBackendGeometry && !hasSourceGeometry)
      return;

    let viewData;
    if (hasBackendGeometry) {
      viewData = buildFromBackend(backendData);
    } else if (hasSourceGeometry) {
      viewData = buildFromSource(sourceFlatData);
    } else {
      viewData = buildFromFallback(geometries);
    }

    unfoldedBoxRef.current = viewData.bounds?.clone?.() || null;

    const group = new THREE.Group();
    const maxDim = viewData.bounds
      ? Math.max(
        viewData.bounds.max.x - viewData.bounds.min.x,
        viewData.bounds.max.y - viewData.bounds.min.y,
        viewData.bounds.max.z - viewData.bounds.min.z,
        100
      )
      : 100;

    // Filled face mesh
    if (viewData.hasFilledFace && viewData.unfoldedGeometry) {
      group.add(
        new THREE.Mesh(
          viewData.unfoldedGeometry,
          new THREE.MeshBasicMaterial({
            color: 0xd4d8de,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: 2,
            polygonOffsetUnits: 2,
          })
        )
      );

      if (viewData.mode === 'fallback') {
        const indexedGeometry = mergeVertices(
          viewData.unfoldedGeometry,
          0.001
        );
        indexedGeometry.computeVertexNormals();
        const edgesGeometry = new THREE.EdgesGeometry(indexedGeometry, 15);
        group.add(
          new THREE.LineSegments(
            edgesGeometry,
            new THREE.LineBasicMaterial({ color: 0x1f2937, linewidth: 1 })
          )
        );
      }
    }

    // Cut lines (solid)
    const activeCutPts = viewData.cutPts;

    if (activeCutPts.length >= 6) {
      const cutGeometry = new THREE.BufferGeometry();
      cutGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(activeCutPts, 3)
      );
      group.add(
        new THREE.LineSegments(
          cutGeometry,
          new THREE.LineBasicMaterial({ color: 0x111827, linewidth: 1 })
        )
      );
    }

    // Bend lines (dashed)
    const activeBendPts = viewData.bendPts;

    if (activeBendPts.length >= 6) {
      const bendGeometry = new THREE.BufferGeometry();
      bendGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(activeBendPts, 3)
      );

      // Professional Cyan (0x0ed6e6) for all bend lines
      const bendColor = highlightBends ? 0xff0000 : 0x0ed6e6;

      const bendLine = new THREE.LineSegments(
        bendGeometry,
        new THREE.LineDashedMaterial({
          color: bendColor,
          dashSize: maxDim * (highlightBends ? 0.05 : 0.018),
          gapSize: maxDim * (highlightBends ? 0.02 : 0.012),
          linewidth: highlightBends ? 4 : 2,
        })
      );
      bendLine.computeLineDistances();
      group.add(bendLine);
    }

    // Optional grid
    if (gridEnabled && viewData.bounds) {
      const center = new THREE.Vector3();
      viewData.bounds.getCenter(center);
      const grid = new THREE.GridHelper(maxDim * 3, 30, 0xd1d5db, 0xe5e7eb);
      grid.rotation.x = Math.PI / 2;
      grid.position.copy(center);
      group.add(grid);
    }

    // Holes (if any)
    if (holes && holes.length > 0) {
      holes.forEach(hole => {
        const isActive = hole.id === activeHoleId;
        const radius = (hole.diameterInches || 0.1) * 0.5 * 25.4; // assume model in mm

        const curve = new THREE.EllipseCurve(
          hole.position.x, hole.position.y,
          radius, radius,
          0, 2 * Math.PI,
          false,
          0
        );

        const points = curve.getPoints(32);
        const circleGeometry = new THREE.BufferGeometry().setFromPoints(points);

        const circle = new THREE.LineLoop(
          circleGeometry,
          new THREE.LineBasicMaterial({
            color: isActive ? 0xff0000 : 0x4b5563,
            linewidth: isActive ? 4 : 2,
            transparent: true,
            opacity: isActive ? 1 : 0.8
          })
        );

        // Ensure circles are slightly above the face to avoid z-fighting
        circle.position.z = 0.5;
        group.add(circle);
      });
    }

    scene.add(group);
    meshGroupRef.current = group;
    fitCamera();
  }, [
    geometries,
    highlightBends,
    gridEnabled,
    backendData,
    sourceFlatData,
    holes,
    activeHoleId,
    formatKind,
    fitCamera,
    buildFromBackend,
    buildFromSource,
    buildFromFallback,
  ]);

  const showBendLegend = formatKind !== 'drawing';

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: '100%',
        height: '100%',
        flex: 1,
        backgroundColor: '#ffffff',
        minHeight: 0,
      }}
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* View mode indicator */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: 6,
          border: '1px solid #d1d5db',
          backgroundColor: '#ffffff',
          padding: '4px 10px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: '#3b82f6',
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: '#4b5563',
          }}
        >
          {formatKind === 'drawing' ? '2D Drawing View' : '2D Flat View'}
        </span>
      </div>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          borderRadius: 9999,
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          padding: '8px 16px',
          fontSize: 12,
          color: '#4b5563',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          userSelect: 'none',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-block',
              height: 2,
              width: 28,
              borderRadius: 1,
              backgroundColor: '#1f2937',
            }}
          />
          Cut line
        </span>
        {showBendLegend && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="28" height="4" style={{ overflow: 'visible' }}>
              <line
                x1="0"
                y1="2"
                x2="28"
                y2="2"
                stroke="#111827"
                strokeWidth="2"
                strokeDasharray="5,4"
              />
            </svg>
            Bend line
          </span>
        )}
      </div>

    </div>
  );
});

export default FlatPatternViewer;

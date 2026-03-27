import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Info, ArrowRight, FileCode, Layers, Grid3x3, Box, Square, Monitor, Maximize2, Ruler } from 'lucide-react';
import * as OV from 'online-3d-viewer';
import { parseString, toSVG } from 'dxf';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import FlatPatternViewer from '../components/viewer/FlatPatternViewer';

const BACKEND_URL = 'http://localhost:8000';

const is2DFile = (filename) => {
  const name = filename?.toLowerCase() ?? '';
  return name.endsWith('.dxf') || name.endsWith('.dwg');
};

const isStepFile = (filename) => {
  const name = filename?.toLowerCase() ?? '';
  return name.endsWith('.step') || name.endsWith('.stp');
};

// ─── Component ──────────────────────────────────────────
const InstantPricing = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [viewMode, setViewMode] = useState('3d');
  const [activeAxis, setActiveAxis] = useState('top');
  const [unit, setUnit] = useState('mm');
  const [dxfSvg, setDxfSvg] = useState(null);
  const [dxfError, setDxfError] = useState(null);
  const [backendData, setBackendData] = useState(null);
  const [backendError, setBackendError] = useState(null);
  const [isLoadingUnfold, setIsLoadingUnfold] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showEdges, setShowEdges] = useState(true);

  const stepViewerRef = useRef(null);
  const dxfViewerRef = useRef(null);
  const viewerInstance = useRef(null);
  const dxfViewerInstance = useRef(null);
  const dimensionsRef = useRef(null);
  const modelRef = useRef(null);

  const navigate = useNavigate();

  // ── Check backend availability on mount ───────────────
  useEffect(() => {
    fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(300000) })
      .catch(() => { /* Backend is handled per-request */ });
  }, []);

  useEffect(() => {
    document.body.classList.add('light-mode');
    return () => document.body.classList.remove('light-mode');
  }, []);

  const onDrop = useCallback(acceptedFiles => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      preview: URL.createObjectURL(file)
    }));
    setFiles(prev => [...prev, ...newFiles]);
    if (newFiles.length > 0) {
      setSelectedFile(newFiles[0]);
      setViewMode(is2DFile(newFiles[0].file.name) ? '2d' : '3d');
      setActiveAxis('top');
      setBackendData(null);
      setBackendError(null);
      modelRef.current = null;
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'model/step': ['.step', '.stp'],
      'application/x-dxf': ['.dxf'],
      'application/octet-stream': ['.dxf', '.dwg'],
      'text/plain': ['.dxf'],
    },
    maxFiles: 10
  });

  const removeFile = (id) => {
    const fileToRemove = files.find(f => f.id === id);
    if (fileToRemove) URL.revokeObjectURL(fileToRemove.preview);
    setFiles(prev => prev.filter(f => f.id !== id));
    if (selectedFile?.id === id) {
      setSelectedFile(null); setDimensions(null);
      setDxfSvg(null);
      modelRef.current = null;
    }
  };

  // ─── DXF Effect ───────────────────────────────────────
  useEffect(() => {
    if (!selectedFile || !is2DFile(selectedFile.file.name)) return;

    // Reset DXF state
    setDxfSvg(null);
    setDxfError(null);
    setDimensions(null);

    const loadDxf = async () => {
      setIsImporting(true);
      setImportProgress(0);
      const timer = setInterval(() => {
        setImportProgress(p => p < 90 ? p + 5 : p);
      }, 50);

      try {
        const text = await selectedFile.file.text();
        const parsed = parseString(text);
        const svgStr = toSVG(parsed);
        setDxfSvg(svgStr);
        const h = parsed?.header ?? {};
        let w = Math.abs((h.$EXTMAX?.x ?? 0) - (h.$EXTMIN?.x ?? 0));
        let ht = Math.abs((h.$EXTMAX?.y ?? 0) - (h.$EXTMIN?.y ?? 0));

        let isInch = true; // Most US drawings without units are Imperial
        if (h.$INSUNITS === 4 || h.$MEASUREMENT === 1) isInch = false;

        if (w === 0 || ht === 0) {
          const match = svgStr.match(/viewBox="[^"]*?\s+[^"]*?\s+([-\d.]+)\s+([-\d.]+)"/);
          if (match) {
            w = parseFloat(match[1]);
            ht = parseFloat(match[2]);
          }
        }

        if (w > 0 || ht > 0) {
          const w_in = isInch ? w : w / 25.4;
          const h_in = isInch ? ht : ht / 25.4;
          const w_mm = isInch ? w * 25.4 : w;
          const h_mm = isInch ? ht * 25.4 : ht;

          const dimsObj = {
            is2D: false,
            isNativeInches: isInch,
            mm: { width: w_mm.toFixed(2), height: h_mm.toFixed(2), thickness: '2.00', volume: '0.00' },
            inches: { width: w_in.toFixed(3), height: h_in.toFixed(3), thickness: (2 / 25.4).toFixed(3), volume: '0.000' }
          };
          dimensionsRef.current = dimsObj;
          setDimensions(dimsObj);
        }
        clearInterval(timer);
        setImportProgress(100);
        setTimeout(() => setIsImporting(false), 400);
      } catch (error) {
        clearInterval(timer);
        setIsImporting(false);
        setDxfError('Failed to parse DXF file.');
        console.error('DXF Load Error:', error);
      }
    };
    loadDxf();
  }, [selectedFile]);

  /*
  // ─── Automated 2D Fetch Effect (for Top/Front/Side/Flat) ──
  useEffect(() => {
    // Only auto-fetch if we have a STEP file and no data yet
    if (selectedFile && isStepFile(selectedFile.file.name) && !backendData && !isLoadingUnfold && !backendError) {
      handleUnfold();
    }
  }, [selectedFile, backendData, isLoadingUnfold, backendError, handleUnfold]);
  */

  // ─── DXF 3D Viewer Effect (Three JS Native) ────────────
  useEffect(() => {
    if (!selectedFile || !is2DFile(selectedFile.file.name)) return;
    if (!dxfViewerRef.current) return;
    if (viewMode !== '3d') return;
    if (!dxfSvg) return;

    let reqId;
    let renderer, controls;
    const currentRef = dxfViewerRef.current;

    const initViewer = () => {
      try {
        currentRef.innerHTML = '';
        const w = currentRef.clientWidth || 600;
        const h = currentRef.clientHeight || 400;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xfcfcfc);

        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(w, h);
        currentRef.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableRotate = true;
        controls.enableDamping = true;

        const light = new THREE.DirectionalLight(0xffffff, 1.5);
        light.position.set(100, 200, 300);
        scene.add(light);

        const backLight = new THREE.DirectionalLight(0xffffff, 1.2);
        backLight.position.set(-100, -200, -300);
        scene.add(backLight);

        scene.add(new THREE.AmbientLight(0xffffff, 0.8));

        const loader = new SVGLoader();
        const svgData = loader.parse(dxfSvg);
        const group = new THREE.Group();

        const dims = dimensionsRef.current;
        const isInch = dims?.isNativeInches ?? false;
        const thicknessNative = isInch ? (2 / 25.4) : 2;

        const lineMat = new THREE.LineBasicMaterial({ color: 0x475569 });
        const extrudeMat = new THREE.MeshStandardMaterial({
          color: 0x9ca3af,
          roughness: 0.5,
          metalness: 0.2,
          side: THREE.DoubleSide
        });
        const extrudeSettings = { depth: thicknessNative, bevelEnabled: false };

        const allShapes = [];
        svgData.paths.forEach((path) => {
          try {
            const shapes = SVGLoader.createShapes(path);
            shapes.forEach(sh => allShapes.push(sh));
          } catch (error) {
            console.warn('SVG Shape Error:', error);
          }

          path.subPaths.forEach((sub) => {
            const points = sub.getPoints();
            if (points && points.length > 0) {
              // Top edges
              const geomTop = new THREE.BufferGeometry().setFromPoints(points);
              const lineTop = new THREE.Line(geomTop, lineMat);
              lineTop.position.z = thicknessNative + 0.01;
              group.add(lineTop);

              // Bottom edges
              const geomBot = new THREE.BufferGeometry().setFromPoints(points);
              const lineBot = new THREE.Line(geomBot, lineMat);
              lineBot.position.z = -0.01;
              group.add(lineBot);
            }
          });
        });

        // 1. Map bounding data
        const metaShapes = allShapes.map(shape => {
          const points = shape.getPoints();
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          });
          const area = (maxX - minX) * (maxY - minY);
          return { shape, points, minX, minY, maxX, maxY, area, parent: null, depth: 0 };
        });

        // 2. Sort from smallest to largest to find immediate parents
        metaShapes.sort((a, b) => a.area - b.area);

        for (let i = 0; i < metaShapes.length; i++) {
          const child = metaShapes[i];
          for (let j = i + 1; j < metaShapes.length; j++) {
            const parent = metaShapes[j];
            if (child.minX >= parent.minX && child.maxX <= parent.maxX &&
              child.minY >= parent.minY && child.maxY <= parent.maxY) {

              let isInside = true;
              if (THREE.ShapeUtils?.isPointInPolygon) {
                isInside = THREE.ShapeUtils.isPointInPolygon(child.points[0], parent.points);
                if (!isInside && child.points.length > 2) {
                  isInside = THREE.ShapeUtils.isPointInPolygon(child.points[Math.floor(child.points.length / 2)], parent.points);
                }
              }
              if (isInside) {
                child.parent = parent;
                break;
              }
            }
          }
        }

        // 3. Extrude based on nesting depth (Odd = Hole)
        const topLevelShapes = [];
        metaShapes.forEach(m => {
          let curr = m;
          while (curr.parent) { m.depth++; curr = curr.parent; }
        });

        metaShapes.forEach(m => {
          if (m.depth % 2 === 0) topLevelShapes.push(m.shape);
          else m.parent.shape.holes.push(m.shape);
        });

        topLevelShapes.forEach((shape) => {
          try {
            const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            group.add(new THREE.Mesh(geom, extrudeMat));
          } catch {
            const geom = new THREE.ShapeGeometry(shape);
            group.add(new THREE.Mesh(geom, extrudeMat));
          }
        });

        let totalAreaNative = 0;
        topLevelShapes.forEach(shape => {
          let area = 0;
          try { area = Math.abs(THREE.ShapeUtils.area(shape.getPoints())); } catch (error) { console.warn("Error calculating shape area:", error); }
          shape.holes.forEach(h => {
            try { area -= Math.abs(THREE.ShapeUtils.area(h.getPoints())); } catch { /* Ignore hole area error */ }
          });
          totalAreaNative += area;
        });

        if (dims) {
          const volNative = totalAreaNative * thicknessNative;
          const volMm3 = isInch ? volNative * Math.pow(25.4, 3) : volNative;
          const volIn3 = isInch ? volNative : volNative / Math.pow(25.4, 3);
          dims.mm.volume = (volMm3 / 1000).toFixed(2);
          dims.inches.volume = volIn3.toFixed(3);
          setDimensions({ ...dims });
        }

        group.scale.y = -1; // SVG coordinates down, ThreeJS up

        const box = new THREE.Box3().setFromObject(group);
        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3());
          group.position.sub(center);
        }
        scene.add(group);

        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 20);
        const viewDist = maxDim * 1.5;

        // Initial perspective view - Isometric
        camera.position.set(viewDist * 0.7, -viewDist * 0.7, viewDist * 0.7);
        camera.up.set(0, 0, 1);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();

        dxfViewerInstance.current = { camera, controls, extents: viewDist };

        const animate = () => {
          reqId = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

      } catch (err) {
        console.error('Failed to load DXF in 3D:', err);
      }
    };
    initViewer();

    return () => {
      cancelAnimationFrame(reqId);
      controls?.dispose();
      renderer?.dispose();
      if (currentRef) currentRef.innerHTML = '';
      if (dxfViewerInstance.current?.camera === renderer?.camera) dxfViewerInstance.current = null;
    };
  }, [selectedFile, viewMode, dxfSvg]);

  // ─── STEP 3D Viewer Effect ────────────────────────────
  useEffect(() => {
    if (!selectedFile || !isStepFile(selectedFile.file.name)) return;
    if (!stepViewerRef.current) return;

    stepViewerRef.current.innerHTML = '';

    if (viewerInstance.current) {
      try { viewerInstance.current.Destroy(); } catch (error) { console.warn("Error destroying previous viewer instance:", error); }
      viewerInstance.current = null;
    }

    setIsImporting(true);
    setImportProgress(0);

    const progressTimer = setInterval(() => {
      setImportProgress(p => {
        if (p < 50) return p + 3;
        if (p < 80) return p + 0.8;
        if (p < 95) return p + 0.2;
        if (p < 99) return p + 0.05;
        return p;
      });
    }, 100);

    let checkInterval = null, localViewer = null;

    const extractDimensions = (model) => {
      if (dimensionsRef.current || !model) return;
      try {
        const bb = OV.GetBoundingBox(model);
        if (!bb?.min || !bb?.max) return;
        const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y, d = bb.max.z - bb.min.z;
        let vol = 0; try { vol = OV.CalculateVolume(model); } catch (error) { console.warn("Error calculating model volume:", error); }
        dimensionsRef.current = {
          is2D: false,
          mm: { width: w.toFixed(2), height: h.toFixed(2), thickness: d.toFixed(2), volume: (vol / 1000).toFixed(2) },
          inches: { width: (w / 25.4).toFixed(3), height: (h / 25.4).toFixed(3), thickness: (d / 25.4).toFixed(3), volume: (vol / 16387.064).toFixed(3) }
        };
        setDimensions(dimensionsRef.current);
        if (checkInterval) clearInterval(checkInterval);
      } catch (error) { console.error("Error extracting dimensions:", error); }
    };

    try {
      const viewer = new OV.EmbeddedViewer(stepViewerRef.current, {
        backgroundColor: new OV.RGBAColor(252, 252, 252, 255),
        edgeSettings: new OV.EdgeSettings(true, new OV.RGBColor(0, 0, 0), 1),
        environmentSettings: new OV.EnvironmentSettings([], true),
        onModelLoaded: () => {
          clearInterval(progressTimer);
          setImportProgress(100);
          setTimeout(() => setIsImporting(false), 800);

          const model = viewer.GetModel();
          modelRef.current = model;
          extractDimensions(model);

          // Apply Metallic Material Override with Interaction Stability
          const v = viewer.GetViewer();
          if (v && v.scene) {
            const metalMat = new THREE.MeshStandardMaterial({
              color: 0x9ca3af,
              roughness: 0.5,
              metalness: 0.2,
              envMap: v.scene.environment || null,
              side: THREE.DoubleSide
            });

            const applyMetallicGlobal = () => {
              v.scene.traverse((child) => {
                if (child.isMesh) child.material = metalMat;
              });
              try { v.Render(); } catch { /* silent fail */ }
            };

            applyMetallicGlobal();

            // Intercept interaction events to re-apply (since OV resets on mouse events)
            const container = stepViewerRef.current;
            if (container) {
              container.addEventListener('mousedown', applyMetallicGlobal);
              container.addEventListener('mouseup', applyMetallicGlobal);
              container.addEventListener('mousemove', (ev) => {
                if (ev.buttons > 0) applyMetallicGlobal();
              });
            }

            // Add extra lights to help with the metallic look
            const light1 = new THREE.DirectionalLight(0xffffff, 1.8);
            light1.position.set(1000, 1000, 1000);
            v.scene.add(light1);

            const light2 = new THREE.DirectionalLight(0xffffff, 1.5);
            light2.position.set(-1000, -1000, -1000);
            v.scene.add(light2);

            const amb = new THREE.AmbientLight(0xffffff, 0.9);
            v.scene.add(amb);
          }

          if (viewer && typeof viewer.GetViewer === 'function' && viewer.GetViewer()) {
            viewer.GetViewer().FitToWindow();
          }
        },
        onModelLoadFailed: () => {
          clearInterval(progressTimer);
          setIsImporting(false);
          console.error('Model load failed');
        }
      });
      localViewer = viewer;
      viewerInstance.current = viewer;
      viewer.LoadModelFromFileList([selectedFile.file]);
      checkInterval = setInterval(() => {
        if (dimensionsRef.current) { clearInterval(checkInterval); return; }
        const m = viewer.GetModel(); if (m) extractDimensions(m);
      }, 2000);
    } catch (e) {
      clearInterval(progressTimer);
      setIsImporting(false);
      console.error('Viewer init error:', e);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      try { localViewer?.Destroy(); } catch (error) { console.warn("Error destroying local viewer:", error); }
      if (viewerInstance.current === localViewer) viewerInstance.current = null;
    };
  }, [selectedFile, viewMode, dxfSvg]);

  const handleUnfold = useCallback(async () => {
    if (!selectedFile) return;
    if (is2DFile(selectedFile.file.name)) {
      setBackendData(null);
      setViewMode('2d');
      setActiveAxis('flat');
      return;
    }
    if (!isStepFile(selectedFile.file.name)) return;

    if (backendData) {
      setActiveAxis('flat');
      return;
    }

    setIsLoadingUnfold(true);
    setBackendError(null);

    const formData = new FormData();
    formData.append('file', selectedFile.file);

    try {
      const response = await fetch(`${BACKEND_URL}/unfold`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Failed to unfold model');
      }

      const data = await response.json();
      if (data.flatVertices && data.flatVertices.length > 0) {
        setBackendData(data);
        // Only set axis to flat if it was explicitly clicked (not during auto-fetch)
        // However, we'll let the click handler handle axis setting.
      } else {
        throw new Error('No flat geometry data returned');
      }
    } catch (err) {
      console.error('Unfold error:', err);
      setBackendError(err.message || 'Error connecting to backend for flattening.');
    } finally {
      setIsLoadingUnfold(false);
    }
  }, [selectedFile, backendData]);

  const setAxisCamera = (axis) => {
    if (viewerInstance.current) {
      const v = viewerInstance.current.GetViewer();
      if (!v) return;
      const c = { top: { eye: [0, 1000, 0], up: [0, 0, -1] }, front: { eye: [0, 0, 1000], up: [0, 1, 0] }, side: { eye: [1000, 0, 0], up: [0, 1, 0] } }[axis];
      v.SetCamera(new OV.Camera(new OV.Coord3D(...c.eye), new OV.Coord3D(0, 0, 0), new OV.Coord3D(...c.up), 45));
      if (viewMode === '2d') {
        v.SetProjectionMode(OV.ProjectionMode.Orthographic);
      }
      viewerInstance.current.FitToWindow();
    } else if (dxfViewerInstance.current) {
      const { camera, controls, extents } = dxfViewerInstance.current;
      const dist = extents;
      const c = {
        top: { pos: [0, 0, dist], up: [0, 1, 0] },
        front: { pos: [0, -dist, 0], up: [0, 0, 1] },
        side: { pos: [dist, 0, 0], up: [0, 0, 1] }
      }[axis];
      if (c) {
        camera.position.set(...c.pos);
        camera.up.set(...c.up);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
      }
    }
  };

  // ─── Toggle edge mesh (black outlines) on the 3D model ──
  const toggleEdges = useCallback(() => {
    setShowEdges(prev => {
      const next = !prev;
      const v = viewerInstance.current?.GetViewer?.();
      if (v?.scene) {
        v.scene.traverse((child) => {
          if (child.isLineSegments) {
            child.visible = next;
          }
        });
        try { v.Render(); } catch { /* silent */ }
      }
      return next;
    });
  }, []);

  const toggleView = (mode) => {
    setViewMode(mode);
    if (!isStepFile(selectedFile?.file?.name ?? '')) return;
    if (!viewerInstance.current) return;
    try {
      const vObj = viewerInstance.current.GetViewer();
      if (mode === '2d') {
        vObj.SetProjectionMode(OV.ProjectionMode.Orthographic);
        setActiveAxis('top');
        // Small delay to let OV update projection before setting camera
        setTimeout(() => setAxisCamera('top'), 50);
      } else {
        vObj.SetProjectionMode(OV.ProjectionMode.Perspective);
        viewerInstance.current.FitToWindow();
      }
    } catch (e) { console.error("Error toggling view mode:", e); }
  };


  const axisButtons = [
    { label: 'TOP', key: 'top' },
    { label: 'FRONT', key: 'front' },
    { label: 'SIDE', key: 'side' },
    { label: 'FLAT', key: 'flat' }
  ];
  const currentIsDxf = is2DFile(selectedFile?.file?.name ?? '');
  const currentIsStep = isStepFile(selectedFile?.file?.name ?? '');
  const showViewer = currentIsStep || currentIsDxf;

  return (
    <div className="instant-pricing-container">
      <header className="pricing-header">
        <h1>Get Instant Pricing</h1>
        <p>Upload your CAD files to get an immediate quote for your project.</p>
      </header>

      {files.length === 0 ? (
        <div className="upload-section">
          <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            <div className="file-icons-row">
              {['.dxf', '.dwg', '.step', '.stp'].map(ext => (
                <div key={ext} className={`file-icon-item ${ext.replace('.', '')}`}><span>{ext}</span></div>
              ))}
            </div>
            <h2>Drop files here to get started</h2>
            <p>or</p>
            <button className="btn-browse">BROWSE FILES</button>
          </div>
        </div>
      ) : (
        <div className="viewer-layout">

          {/* ── Sidebar ── */}
          <div className="sidebar">
            <div className="sidebar-header">
              <h3>Uploaded Files</h3>
              <button onClick={() => { setFiles([]); setSelectedFile(null); setDxfSvg(null); setBackendData(null); setBackendError(null); modelRef.current = null; }} className="btn-clear">
                Clear all
              </button>
            </div>
            <div className="file-list">
              {files.map((f, index) => (
                <div key={f.id} className={`file-item ${selectedFile?.id === f.id ? 'selected' : ''}`}
                  onClick={() => { setSelectedFile(f); setViewMode(is2DFile(f.file.name) ? '2d' : '3d'); setActiveAxis('top'); modelRef.current = null; }}
                  style={{ '--i': index }}>
                  <FileCode size={20} />
                  <span className="file-name">{f.file.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} className="btn-remove"><X size={16} /></button>
                </div>
              ))}
            </div>
            <div {...getRootProps()} className="add-more">
              <input {...getInputProps()} /><Upload size={18} /><span>Add more files</span>
            </div>
          </div>

          {/* ── Main Viewer ── */}
          <div className="main-viewer-area">
            <div className="viewer-controls">
              {showViewer && (
                <div className="view-toggles">
                  <button className={viewMode === '3d' ? 'active' : ''} onClick={() => toggleView('3d')}>
                    <Box size={16} />
                    <span>3D VIEW</span>
                  </button>
                  <button className={viewMode === '2d' ? 'active' : ''} onClick={() => toggleView('2d')}>
                    <Square size={16} />
                    <span>2D VIEW</span>
                  </button>
                </div>
              )}
              {showViewer && (
                <div className="view-axis-toggles">
                  {axisButtons.map(({ label, key }) => (
                    <button key={key} className={activeAxis === key ? 'active' : ''}
                      onClick={() => {
                        if (key === 'flat') {
                          handleUnfold();
                        } else {
                          setActiveAxis(key);
                          setAxisCamera(key);
                        }
                      }}>
                      {key === 'flat' ? <Maximize2 size={14} /> : <Monitor size={14} />}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="viewer-actions">
                {showViewer && currentIsStep && (
                  <button
                    className={`btn-wireframe ${showEdges ? 'active' : ''}`}
                    onClick={toggleEdges}
                    title={showEdges ? 'Hide edge mesh' : 'Show edge mesh'}
                  >
                    <Grid3x3 size={20} />
                    <span>Highlight Bends</span>
                  </button>
                )}
                <div className="unit-switch-container">
                  <span className={`label mm ${unit === 'mm' ? 'active' : ''}`}>MM</span>
                  <label className="switch">
                    <input type="checkbox" checked={unit === 'inch'} onChange={() => setUnit(p => p === 'mm' ? 'inch' : 'mm')} />
                    <span className="slider round"></span>
                  </label>
                  <span className={`label inch ${unit === 'inch' ? 'active' : ''}`}>INCH</span>
                </div>
              </div>
            </div>

            <div className="viewer-container">
              {isLoadingUnfold ? (
                <div className="viewer-placeholder">
                  <div className="flat-loading-spinner" />
                  Drawing flat pattern...
                </div>
              ) : viewMode === '2d' ? (
                // In 2D mode, we ALWAYS want the FlatPatternViewer (or loading state)
                backendData ? (
                  <FlatPatternViewer
                    geometries={[]}
                    options={{}}
                    backendData={activeAxis === 'flat' ? backendData : {
                      flatVertices: [],
                      cutEdges: activeAxis === 'top' ? backendData.topEdges :
                        activeAxis === 'front' ? backendData.frontEdges :
                          activeAxis === 'side' ? backendData.sideEdges : [],
                      bendEdges: []
                    }}
                    sourceFlatData={null}
                    formatKind="drawing"
                  />
                ) : (
                  <div className="viewer-placeholder">
                    <div className="flat-loading-spinner" />
                    Preparing 2D views...
                  </div>
                )
              ) : activeAxis === 'flat' && backendError ? (
                <div className="viewer-error">
                  {backendError}
                  <button className="btn-retry" onClick={handleUnfold} style={{ marginTop: '12px', padding: '6px 12px', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Retry Flattening
                  </button>
                </div>
              ) : (
                <>
                  {currentIsStep && (
                    <div ref={stepViewerRef} style={{ width: '100%', height: '100%' }} />
                  )}

                  {currentIsDxf && viewMode === '3d' && (
                    <div ref={dxfViewerRef} style={{ width: '100%', height: '100%' }} />
                  )}

                  {currentIsDxf && viewMode === '2d' && (
                    <div className="dxf-svg-wrapper">
                      {dxfError ? <div className="viewer-error">{dxfError}</div>
                        : dxfSvg ? <div className="dxf-svg-content" dangerouslySetInnerHTML={{ __html: dxfSvg }} />
                          : <div className="viewer-placeholder">Parsing DXF file...</div>}
                    </div>
                  )}
                </>
              )}

              {/* 2D View Mode Indicator */}
              {viewMode === '2d' && activeAxis !== 'flat' && currentIsStep && (
                <div style={{
                  position: 'absolute', left: 12, top: 12, display: 'flex', alignItems: 'center', gap: 6,
                  borderRadius: 6, border: '1px solid #d1d5db', backgroundColor: '#fff',
                  padding: '4px 10px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', zIndex: 10,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#4b5563' }}>
                    2D {activeAxis.charAt(0).toUpperCase() + activeAxis.slice(1)} View
                  </span>
                </div>
              )}

              {!selectedFile && <div className="viewer-placeholder">Select a file to view</div>}

              {/* ── Loading Overlay ── */}
              {isImporting && (
                <div className="import-loading-overlay">
                  <h2 className="import-status-text">Importing the model</h2>
                  <div className="progress-circle-container">
                    <svg className="progress-circle-svg" viewBox="0 0 200 200">
                      <circle className="progress-circle-bg" cx="100" cy="100" r="90" />
                      <circle
                        className="progress-circle-bar"
                        cx="100"
                        cy="100"
                        r="90"
                        strokeDasharray="565.48"
                        strokeDashoffset={565.48 - (importProgress / 100) * 565.48}
                      />
                    </svg>
                    <div className="progress-percentage">
                      {Math.round(importProgress)}<span>%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Dimensions Panel ── */}
          <div className="dimensions-panel">
            <div className="panel-header"><Info size={18} /><h3>Model Dimensions</h3></div>
            {dimensions ? (
              <div className="dimensions-content">
                <div className="dimension-group">
                  <h4>{unit === 'mm' ? 'Metric (mm)' : 'Imperial (inches)'}</h4>
                  {unit === 'mm' ? (
                    <>
                      <div className="dim-row"><span>Width:</span>  <strong>{dimensions.mm.width} mm</strong></div>
                      <div className="dim-row"><span>Height:</span> <strong>{dimensions.mm.height} mm</strong></div>
                      {!dimensions.is2D && <>
                        <div className="dim-row"><span>Thickness:</span> <strong>{dimensions.mm.thickness} mm</strong></div>
                        <div className="dim-row"><span>Volume:</span> <strong>{dimensions.mm.volume} cm³</strong></div>
                      </>}
                    </>
                  ) : (
                    <>
                      <div className="dim-row"><span>Width:</span>  <strong>{dimensions.inches.width} in</strong></div>
                      <div className="dim-row"><span>Height:</span> <strong>{dimensions.inches.height} in</strong></div>
                      {!dimensions.is2D && <>
                        <div className="dim-row"><span>Thickness:</span> <strong>{dimensions.inches.thickness} in</strong></div>
                        <div className="dim-row"><span>Volume:</span> <strong>{dimensions.inches.volume} in³</strong></div>
                      </>}
                    </>
                  )}
                </div>
                <div className="pricing-summary">
                  <div className="summary-row total"><span>Estimated Price:</span><strong>TBD</strong></div>
                  <button className="btn-get-quote" onClick={() => navigate('/quote')}>
                    PROCEED TO QUOTE <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="no-dimensions">
                <Layers size={40} />
                <p>{selectedFile ? 'Loading model data...' : 'Select a file to view'}</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default InstantPricing;

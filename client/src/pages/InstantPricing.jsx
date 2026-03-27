import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, Info, ArrowRight, FileCode, Layers, Grid3x3, Box, Square,
  Monitor, Maximize2, Ruler, Boxes, Wrench, Scissors, ChevronLeft,
  ChevronRight, AlertCircle, Loader2, Check, Shield
} from 'lucide-react';
import * as OV from 'online-3d-viewer';
import { parseString, toSVG } from 'dxf';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import FlatPatternViewer from '../components/viewer/FlatPatternViewer';
import { fetchServices, fetchMetals } from '../utils/api';

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
  const [showMesh, setShowMesh] = useState(false);
  const [isQuoteFlowActive, setIsQuoteFlowActive] = useState(false);

  // Dynamic data from DB
  const [allServices, setAllServices] = useState([]);
  const [allMetals, setAllMetals] = useState([]);
  const [selectedProductionService, setSelectedProductionService] = useState(null);
  const [selectedMetal, setSelectedMetal] = useState(null);
  const [selectedAdditionalServices, setSelectedAdditionalServices] = useState([]);
  const [selectedAnodizingColor, setSelectedAnodizingColor] = useState(null);

  const modelBaseThicknessRef = useRef(null);
  const stepViewerRef = useRef(null);
  const dxfViewerRef = useRef(null);
  const viewerInstance = useRef(null);
  const dimensionsRef = useRef(null);
  const modelRef = useRef(null);
  const gridHelperRef = useRef(null);
  const pendingAxisRef = useRef(null);

  const navigate = useNavigate();

  // ── Fetch dynamic services + metals on mount ───────────
  useEffect(() => {
    const loadAppData = async () => {
      try {
        const [svcs, mtls] = await Promise.all([fetchServices(), fetchMetals()]);
        setAllServices(svcs || []);
        setAllMetals(mtls || []);
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
      }
    };
    loadAppData();
  }, []);

  // ── Check backend availability on mount ───────────────
  useEffect(() => {
    fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(300000) })
      .catch(() => { /* Backend is handled per-request */ });
  }, []);

  // ── Reset quoting flow when file changes ──────────────
  useEffect(() => {
    setIsQuoteFlowActive(false);
    setSelectedProductionService(null);
    setSelectedMetal(null);
    setSelectedAdditionalServices([]);
    setSelectedAnodizingColor(null);
    modelBaseThicknessRef.current = null;
  }, [selectedFile]);

  useEffect(() => {
    document.body.classList.add('light-mode');
    return () => document.body.classList.remove('light-mode');
  }, []);

  // ── Dimension Validation Helper ────────────────────────
  const validateServiceDimensions = (svc, dims) => {
    if (!dims) return { valid: true, errorMsg: null };

    // Normalization: Model dims are in MM. Service limits are in svc.dimensions_unit.
    const unit = svc.dimensions_unit?.toLowerCase() || 'mm';
    const toSvcUnit = unit === 'mm' ? 1.0 : (1 / 25.4);

    const modelL = (parseFloat(dims.mm.l) || 0) * toSvcUnit;     // Largest Axis in Svc Unit
    const modelW = (parseFloat(dims.mm.w) || 0) * toSvcUnit;    // Middle Axis in Svc Unit
    const modelT = (parseFloat(dims.mm.t) || 0) * toSvcUnit;    // Smallest Axis (Thickness) in Svc Unit

    const sMaxL = parseFloat(svc.max_length) || 0;
    const sMaxW = parseFloat(svc.max_width) || 0;
    const sMaxH = parseFloat(svc.max_height) || 0;

    const sMinL = parseFloat(svc.min_length) || 0;
    const sMinW = parseFloat(svc.min_width) || 0;
    const sMinH = parseFloat(svc.min_height) || 0;

    // Check Thickness (T) against Height (H) capacity rigidly
    const hTooLarge = sMaxH > 0 && modelT > sMaxH;
    const hTooSmall = sMinH > 0 && modelT < sMinH;
    const hValid = !hTooLarge && !hTooSmall;

    // Check Footprint (L/W) allowing for rotation
    // Part fits if (L <= limit1 && W <= limit2) OR (L <= limit2 && W <= limit1)
    const fitNormal = (sMaxL === 0 || modelL <= sMaxL) && (sMaxW === 0 || modelW <= sMaxW);
    const fitRotated = (sMaxL === 0 || modelW <= sMaxL) && (sMaxW === 0 || modelL <= sMaxW);
    const footprintMaxValid = fitNormal || fitRotated;

    // For Min limits, it's a bit trickier but usually min is small enough that any direction fits.
    // We'll just check if it meets the minimums in either orientation.
    const minNormal = (modelL >= sMinL && modelW >= sMinW);
    const minRotated = (modelW >= sMinL && modelL >= sMinW);
    const footprintMinValid = (sMinL === 0 && sMinW === 0) || minNormal || minRotated;

    const isCnc = svc.title?.toLowerCase().includes('cnc machining');
    const isValid = footprintMaxValid && footprintMinValid && (isCnc || hValid);

    let errorMsg = null;
    if (!isValid) {
      if (!footprintMaxValid) errorMsg = 'Part Too Large';
      else if (!footprintMinValid) errorMsg = 'Part Too Small';
      else if (!isCnc && hTooLarge) errorMsg = 'Too Thick';
      else if (!isCnc && hTooSmall) errorMsg = 'Too Thin';
      else errorMsg = 'Size Mismatch';
    }

    if (!isValid) {
      console.log(`Validation Failed for "${svc.title}" [ID: ${svc.id}]:`, {
        reason: errorMsg,
        svc_unit: unit,
        model_svc_units: { L: modelL.toFixed(4), W: modelW.toFixed(4), T: modelT.toFixed(4) },
        svc_limits: {
          max: { L: sMaxL, W: sMaxW, H: sMaxH },
          min: { L: sMinL, W: sMinW, H: sMinH }
        },
        raw_svc: svc
      });
    }

    return { valid: isValid, errorMsg };
  };

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
        let isInch = true;
        if (h.$INSUNITS === 4 || h.$MEASUREMENT === 1) isInch = false;
        if (w === 0 || ht === 0) {
          const match = svgStr.match(/viewBox="[^"]*?\s+[^"]*?\s+([-\d.]+)\s+([-\d.]+)"/);
          if (match) { w = parseFloat(match[1]); ht = parseFloat(match[2]); }
        }
        if (w > 0 || ht > 0) {
          const w_raw = Math.max(w, ht);
          const h_raw = Math.min(w, ht);
          const w_mm = isInch ? w_raw * 25.4 : w_raw;
          const h_mm = isInch ? h_raw * 25.4 : h_raw;

          const dimsObj = {
            is2D: false,
            isNativeInches: isInch,
            mm: { l: w_mm.toFixed(2), w: h_mm.toFixed(2), t: '2.00', volume: '0.00' },
            inches: { l: (w_mm / 25.4).toFixed(3), w: (h_mm / 25.4).toFixed(3), t: (2.00 / 25.4).toFixed(3), volume: '0.000' }
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
        const thicknessNative = dimensionsRef.current?.isNativeInches ? (2 / 25.4) : 2;
        const lineMat = new THREE.LineBasicMaterial({ color: 0x475569 });
        const extrudeSettings = { depth: thicknessNative, bevelEnabled: false };

        const allShapes = [];
        svgData.paths.forEach((path) => {
          try {
            const shapes = SVGLoader.createShapes(path);
            shapes.forEach(sh => allShapes.push(sh));
          } catch (error) { console.warn('SVG Shape Error:', error); }
          path.subPaths.forEach((sub) => {
            const points = sub.getPoints();
            if (points && points.length > 0) {
              const geomTop = new THREE.BufferGeometry().setFromPoints(points);
              const lineTop = new THREE.Line(geomTop, lineMat);
              lineTop.position.z = thicknessNative + 0.01;
              group.add(lineTop);
              const geomBot = new THREE.BufferGeometry().setFromPoints(points);
              const lineBot = new THREE.Line(geomBot, lineMat);
              lineBot.position.z = -0.01;
              group.add(lineBot);
            }
          });
        });

        const metaShapes = allShapes.map(shape => {
          let mlnX = Infinity, mlnY = Infinity, mxX = -Infinity, mxY = -Infinity;
          shape.getPoints().forEach(p => {
            if (p.x < mlnX) mlnX = p.x; if (p.x > mxX) mxX = p.x;
            if (p.y < mlnY) mlnY = p.y; if (p.y > mxY) mxY = p.y;
          });
          return { shape, minX: mlnX, minY: mlnY, maxX: mxX, maxY: mxY, area: (mxX - mlnX) * (mxY - mlnY), parent: null, depth: 0 };
        });

        metaShapes.sort((a, b) => a.area - b.area);
        for (let i = 0; i < metaShapes.length; i++) {
          const child = metaShapes[i];
          for (let j = i + 1; j < metaShapes.length; j++) {
            const parent = metaShapes[j];
            if (child.minX >= parent.minX && child.maxX <= parent.maxX && child.minY >= parent.minY && child.maxY >= parent.maxY) {
              child.parent = parent; break;
            }
          }
        }
        metaShapes.forEach(m => { let curr = m; while (curr.parent) { m.depth++; curr = curr.parent; } });
        const extrudeMat = new THREE.MeshStandardMaterial({
          color: selectedAnodizingColor ? new THREE.Color(selectedAnodizingColor.color) : 0xcecece,
          roughness: 0.4,
          metalness: 0.7
        });

        metaShapes.forEach(m => { if (m.depth % 2 === 0) group.add(new THREE.Mesh(new THREE.ExtrudeGeometry(m.shape, extrudeSettings), extrudeMat)); else m.parent.shape.holes.push(m.shape); });

        group.scale.y = -1;
        const box = new THREE.Box3().setFromObject(group);
        if (!box.isEmpty()) group.position.sub(box.getCenter(new THREE.Vector3()));
        scene.add(group);
        const maxDim = Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).y, 20);
        camera.position.set(maxDim, -maxDim, maxDim);
        camera.up.set(0, 0, 1);
        camera.lookAt(0, 0, 0);
        controls.update();

        const animate = () => { reqId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
        animate();
      } catch (err) { console.error('DXF 3D Error:', err); }
    };
    initViewer();
    return () => { cancelAnimationFrame(reqId); controls?.dispose(); renderer?.dispose(); if (currentRef) currentRef.innerHTML = ''; };
  }, [selectedFile, viewMode, dxfSvg, selectedAnodizingColor]);

  // ─── STEP 3D Viewer Effect ────────────────────────────
  useEffect(() => {
    if (!selectedFile || !isStepFile(selectedFile.file.name)) return;
    if (!stepViewerRef.current) return;
    stepViewerRef.current.innerHTML = '';
    if (viewerInstance.current) { try { viewerInstance.current.Destroy(); } catch (e) { console.error("Error destroying viewer instance:", e); } viewerInstance.current = null; }
    setIsImporting(true); setImportProgress(0);
    const progressTimer = setInterval(() => { setImportProgress(p => p < 99 ? p + 0.5 : p); }, 100);
    let checkInterval = null, localViewer = null;

    const extractDimensions = (model) => {
      if (dimensionsRef.current || !model) return;
      try {
        const bb = OV.GetBoundingBox(model); if (!bb?.min) return;
        const s = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].sort((a, b) => a - b);
        let vol = 0; try { vol = OV.CalculateVolume(model); } catch (e) { console.warn("Error calculating volume:", e); }
        dimensionsRef.current = {
          mm: { l: s[2].toFixed(2), w: s[1].toFixed(2), t: s[0].toFixed(2), volume: (vol / 1000).toFixed(2) },
          inches: { l: (s[2] / 25.4).toFixed(3), w: (s[1] / 25.4).toFixed(3), t: (s[0] / 25.4).toFixed(3), volume: (vol / 16387).toFixed(3) }
        };
        setDimensions(dimensionsRef.current);
        if (checkInterval) clearInterval(checkInterval);
      } catch (e) { console.error("Error extracting dimensions:", e); }
    };

    try {
      const viewer = new OV.EmbeddedViewer(stepViewerRef.current, {
        backgroundColor: new OV.RGBAColor(252, 252, 252, 255),
        edgeSettings: new OV.EdgeSettings(true, new OV.RGBColor(0, 0, 0), 1),
        onModelLoaded: () => {
          clearInterval(progressTimer); setImportProgress(100); setTimeout(() => setIsImporting(false), 800);
          const m = viewer.GetModel(); modelRef.current = m; extractDimensions(m);
          if (pendingAxisRef.current) { const a = pendingAxisRef.current; pendingAxisRef.current = null; setTimeout(() => setAxisCamera(a), 100); }
        }
      });
      localViewer = viewer; viewerInstance.current = viewer; viewer.LoadModelFromFileList([selectedFile.file]);
      checkInterval = setInterval(() => { if (dimensionsRef.current) clearInterval(checkInterval); else { const m = viewer.GetModel(); if (m) extractDimensions(m); } }, 2000);
    } catch (e) { clearInterval(progressTimer); setIsImporting(false); console.error("Error initializing STEP viewer:", e); }
    return () => { if (checkInterval) clearInterval(checkInterval); try { localViewer?.Destroy(); } catch (e) { console.error("Error destroying local viewer:", e); } };
  }, [selectedFile, viewMode, isQuoteFlowActive]);

  // Handle STEP model color changes dynamically
  useEffect(() => {
    if (!viewerInstance.current || !selectedAnodizingColor || !isStepFile(selectedFile?.file?.name)) return;
    try {
      const hex = selectedAnodizingColor.color;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);

      viewerInstance.current.EnumerateMeshes((mesh) => {
        mesh.material.color = new OV.RGBColor(r, g, b);
      });
      viewerInstance.current.Render();
    } catch (e) {
      console.warn("Error updating STEP material color:", e);
    }
  }, [selectedAnodizingColor, selectedFile?.file?.name]);

  const handleUnfold = useCallback(async () => {
    if (!selectedFile || is2DFile(selectedFile.file.name) || !isStepFile(selectedFile.file.name) || backendData) { if (is2DFile(selectedFile?.file?.name)) { setViewMode('2d'); setActiveAxis('flat'); } return; }
    setIsLoadingUnfold(true); setBackendError(null);
    const fd = new FormData(); fd.append('file', selectedFile.file);
    try {
      const r = await fetch(`${BACKEND_URL}/unfold`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error('Unfold failed');
      const d = await r.json(); if (d.flatVertices?.length) { setBackendData(d); setViewMode('2d'); }
    } catch (err) {
      console.warn('Error during unfold stage:', err);
      setBackendError(err.message);
    } finally { setIsLoadingUnfold(false); }
  }, [selectedFile, backendData]);

  const setAxisCamera = (axis) => {
    const v = viewerInstance.current?.GetViewer(); if (!v) return;
    const c = { top: { eye: [0, 1000, 0], up: [0, 0, -1] }, front: { eye: [0, 0, 1000], up: [0, 1, 0] }, side: { eye: [1000, 0, 0], up: [0, 1, 0] } }[axis];
    if (c) {
      v.SetCamera(new OV.Camera(new OV.Coord3D(...c.eye), new OV.Coord3D(0, 0, 0), new OV.Coord3D(...c.up), 45));
      v.SetProjectionMode(OV.ProjectionMode.Orthographic); v.FitToWindow();
    }
  };

  const toggleEdges = useCallback(() => { setShowEdges(p => { const n = !p; const v = viewerInstance.current?.GetViewer(); if (v?.scene) { v.scene.traverse(c => { if (c.isLineSegments) c.visible = n; }); v.Render(); } return n; }); }, []);
  const toggleMesh = useCallback(() => { setShowMesh(p => { const n = !p; const v = viewerInstance.current?.GetViewer(); if (v?.scene) { if (n) { if (!gridHelperRef.current) { gridHelperRef.current = new THREE.GridHelper(2000, 30, 0xaaaaaa, 0xcccccc); v.scene.add(gridHelperRef.current); } else gridHelperRef.current.visible = true; } else if (gridHelperRef.current) gridHelperRef.current.visible = false; v.Render(); } return n; }); }, []);
  const toggleView = (m) => { setViewMode(m); if (m === '2d' && isStepFile(selectedFile?.file?.name)) { setActiveAxis('flat'); handleUnfold(); } };

  const axisButtons = [{ label: 'TOP', key: 'top' }, { label: 'FRONT', key: 'front' }, { label: 'SIDE', key: 'side' }, { label: 'FLAT', key: 'flat' }];
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
        <div className={`viewer-layout ${isQuoteFlowActive ? 'quote-flow-layout' : ''}`}>

          {/* SIDEBAR (Files) */}
          {!isQuoteFlowActive && (
            <div className="sidebar">
              <div className="sidebar-header">
                <h3>Uploaded Files</h3>
                <button onClick={() => { setFiles([]); setSelectedFile(null); setDxfSvg(null); setBackendData(null); setBackendError(null); modelRef.current = null; }} className="btn-clear">Clear all</button>
              </div>
              <div className="file-list">
                {files.map((f, i) => (
                  <div key={f.id} className={`file-item ${selectedFile?.id === f.id ? 'selected' : ''}`} onClick={() => setSelectedFile(f)} style={{ '--i': i }}>
                    <FileCode size={20} />
                    <span className="file-name">{f.file.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} className="btn-remove"><X size={16} /></button>
                  </div>
                ))}
              </div>
              <div {...getRootProps()} className="add-more"><input {...getInputProps()} /><Upload size={18} /><span>Add more files</span></div>
            </div>
          )}

          {/* QUOTE FLOW (Split View) */}
          {isQuoteFlowActive ? (
            <div className="quote-flow-step-container">
              <div className="qf-top-nav">
                <button className="qf-nav-btn" onClick={() => setIsQuoteFlowActive(false)} title="Close"><X size={20} /></button>
                <div className="qf-nav-right">
                  <button className="qf-nav-btn" onClick={() => setAxisCamera('top')} title="Reset"><Box size={20} /></button>
                  <button className="qf-nav-btn" onClick={() => { if (selectedAdditionalServices.length > 0) setSelectedAdditionalServices([]); else if (selectedMetal) setSelectedMetal(null); else if (selectedProductionService) setSelectedProductionService(null); else setIsQuoteFlowActive(false); }} title="Back"><ChevronLeft size={24} /></button>
                </div>
              </div>

              <div className="qf-split-content">
                <div className="qf-left-side">
                  <div className="qf-model-box">
                    <div className="qf-viewer-wrapper">
                      {viewMode === '3d' && currentIsStep && <div ref={stepViewerRef} style={{ width: '100%', height: '100%' }} />}
                      {viewMode === '2d' && currentIsStep && (backendData ? <FlatPatternViewer geometries={[]} options={{}} backendData={backendData} sourceFlatData={null} formatKind="drawing" /> : <div className="qf-loading-viewer"><div className="flat-loading-spinner" />Preparing flat model...</div>)}
                      {currentIsDxf && <div className="dxf-svg-wrapper">{dxfSvg ? <div className="dxf-svg-content" dangerouslySetInnerHTML={{ __html: dxfSvg }} /> : <div>Parsing...</div>}</div>}
                    </div>
                    <div className="qf-view-toggles-simple">
                      <button className={viewMode === '3d' ? 'active' : ''} onClick={() => setViewMode('3d')}>3D</button>
                      <button className={viewMode === '2d' ? 'active' : ''} onClick={() => { setViewMode('2d'); handleUnfold(); }}>2D (Flat)</button>
                    </div>
                  </div>
                  {dimensions && (
                    <div className="qf-dimensions-simple">
                      <h4>{unit === 'mm' ? 'Metric (mm)' : 'Imperial (inches)'}</h4>
                      <div className="qf-dim-grid">
                        <div className="dim-row"><span>Length (L):</span> <strong>{unit === 'mm' ? dimensions.mm.l : dimensions.inches.l} {unit}</strong></div>
                        <div className="dim-row"><span>Width (W):</span> <strong>{unit === 'mm' ? dimensions.mm.w : dimensions.inches.w} {unit}</strong></div>
                        <div className="dim-row"><span>Thickness (T):</span> <strong>{unit === 'mm' ? dimensions.mm.t : dimensions.inches.t} {unit}</strong></div>
                        <div className="dim-row"><span>Volume:</span> <strong>{unit === 'mm' ? dimensions.mm.volume : dimensions.inches.volume} {unit}³</strong></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="qf-right-side">
                  <div className="qf-selection-panel">
                    {!selectedProductionService && (
                      <div className="qf-step-fade-in">
                        <h2 className="qf-panel-title">Select production method:</h2>
                        <div className="qf-large-buttons">
                          {allServices.filter(s => s.is_production).map(svc => {
                            const { valid, errorMsg } = validateServiceDimensions(svc, dimensions);
                            return (
                              <button key={svc.id} className={`qf-large-service-card ${!valid ? 'disabled' : ''}`} onClick={() => valid && setSelectedProductionService(svc)} disabled={!valid}>
                                <div className="qf-card-main">
                                  <strong>{svc.title}</strong>
                                  <span>{svc.description}</span>
                                </div>
                                {!valid ? (
                                  <div className="qf-card-status error"><Shield size={16} />{errorMsg}</div>
                                ) : (
                                  <div className="qf-card-status price">Select Material <ChevronRight size={16} /></div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {selectedProductionService && !selectedMetal && (
                      <div className="qf-step-fade-in">
                        <h2 className="qf-panel-title">Select Material</h2>
                        <div className="qf-metal-grid">
                          {allMetals.filter(m => m.services?.includes(selectedProductionService.id)).map(metal => (
                            <button key={metal.id} className="qf-metal-card" onClick={() => setSelectedMetal(metal)}>
                              {metal.image_path && <img src={metal.image_path} alt={metal.name} className="qf-metal-img" />}
                              <div className="qf-metal-name-overlay"><span>{metal.name}</span></div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedProductionService && selectedMetal && (
                      <div className="qf-step-fade-in">
                        <div className="qf-selection-summary-bar"><div><strong>Method:</strong> {selectedProductionService.title}</div><div><strong>Material:</strong> {selectedMetal.name}</div></div>
                        <h2 className="qf-panel-title">Additional Services</h2>
                        <p className="qf-panel-subtitle">Select extra processes for your part</p>
                        <div className="qf-services-grid-v2">
                          {allServices.filter(s => s.parent_id === selectedProductionService.id).map(svc => {
                            const isSelected = selectedAdditionalServices.some(s => s.id === svc.id);
                            const hasOptions = Array.isArray(svc.service_options) && svc.service_options.length > 0;

                            return (
                              <div key={svc.id} className="qf-additional-service-wrapper">
                                <button
                                  className={`qf-service-option ${isSelected ? 'active' : ''}`}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedAdditionalServices(prev => prev.filter(s => s.id !== svc.id));
                                      if (svc.title.toLowerCase().includes('anodizing')) setSelectedAnodizingColor(null);
                                    } else {
                                      setSelectedAdditionalServices(prev => [...prev, svc]);
                                    }
                                  }}
                                >
                                  <div className={`qf-checkbox ${isSelected ? 'checked' : ''}`}>
                                    {isSelected && <Check size={14} />}
                                  </div>
                                  <div className="qf-service-info">
                                    <strong>{svc.title}</strong>
                                    <p>{svc.description}</p>
                                  </div>
                                </button>

                                {isSelected && hasOptions && (
                                  <motion.div
                                    className="qf-service-options-panel"
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                  >
                                    <label>Select {svc.title} Option:</label>
                                    <div className="qf-options-grid">
                                      {svc.service_options.map((opt, i) => (
                                        <button
                                          key={i}
                                          className={`qf-option-swatch ${selectedAnodizingColor?.name === opt.name ? 'active' : ''}`}
                                          onClick={() => {
                                            if (svc.title.toLowerCase().includes('anodizing')) {
                                              setSelectedAnodizingColor(opt);
                                            }
                                          }}
                                          title={opt.name}
                                        >
                                          <div className="swatch-circle" style={{ backgroundColor: opt.color }} />
                                          <span>{opt.name}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="qf-cta-container">
                          <button className="qf-primary-btn" onClick={() => navigate('/checkout')}>PROCEED TO FINAL QUOTE <ChevronRight size={20} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="main-viewer-area">
                <div className="viewer-controls">
                  {showViewer && <div className="view-toggles"><button className={viewMode === '3d' ? 'active' : ''} onClick={() => toggleView('3d')}><Box size={16} /><span>3D VIEW</span></button><button className={viewMode === '2d' ? 'active' : ''} onClick={() => toggleView('2d')}><Square size={16} /><span>2D VIEW</span></button></div>}
                  {showViewer && <div className="view-axis-toggles">{axisButtons.map(({ label, key }) => (
                    <button key={key} className={activeAxis === key ? 'active' : ''} onClick={() => { if (key === 'flat') { setActiveAxis('flat'); setViewMode('2d'); handleUnfold(); } else { setActiveAxis(key); if (currentIsStep && viewMode === '2d') { pendingAxisRef.current = key; setViewMode('3d'); } else setAxisCamera(key); } }}>
                      {key === 'flat' ? <Maximize2 size={14} /> : <Monitor size={14} />}<span>{label}</span>
                    </button>
                  ))}</div>}
                  <div className="viewer-actions">
                    {showViewer && currentIsStep && viewMode === '3d' && <button className={`btn-wireframe ${showMesh ? 'active' : ''}`} onClick={toggleMesh}><Boxes size={20} /><span>Show Mesh</span></button>}
                    {showViewer && currentIsStep && <button className={`btn-wireframe ${showEdges ? 'active' : ''}`} onClick={toggleEdges}><Grid3x3 size={20} /><span>Highlight Bends</span></button>}
                    <div className="unit-switch-container"><span className={unit === 'mm' ? 'active' : ''}>MM</span><label className="switch"><input type="checkbox" checked={unit === 'inch'} onChange={() => setUnit(p => p === 'mm' ? 'inch' : 'mm')} /><span className="slider round"></span></label><span className={unit === 'inch' ? 'active' : ''}>INCH</span></div>
                  </div>
                </div>
                <div className="viewer-container">
                  {isLoadingUnfold ? <div className="viewer-placeholder"><div className="flat-loading-spinner" />Drawing...</div>
                    : backendError ? <div className="viewer-error">{backendError} <button className="btn-retry" onClick={handleUnfold}>Retry</button></div>
                      : viewMode === '2d' ? (backendData ? <FlatPatternViewer geometries={[]} options={{}} backendData={activeAxis === 'flat' ? backendData : { flatVertices: [], cutEdges: activeAxis === 'top' ? backendData.topEdges : activeAxis === 'front' ? backendData.frontEdges : backendData.sideEdges, bendEdges: [] }} formatKind="drawing" /> : <div className="viewer-placeholder">Preparing 2D...</div>) : (
                        <> {currentIsStep && <div ref={stepViewerRef} style={{ width: '100%', height: '100%' }} />}
                          {currentIsDxf && viewMode === '3d' && <div ref={dxfViewerRef} style={{ width: '100%', height: '100%' }} />}
                          {currentIsDxf && viewMode === '2d' && <div className="dxf-svg-wrapper">
                            {dxfError ? <div className="viewer-error">{dxfError}</div>
                              : dxfSvg ? <div className="dxf-svg-content" dangerouslySetInnerHTML={{ __html: dxfSvg }} />
                                : <div className="viewer-placeholder">Parsing...</div>}
                          </div>}
                        </>
                      )}
                  {isImporting && <div className="import-loading-overlay"><h2>Importing...</h2><div className="progress-percentage">{Math.round(importProgress)}%</div></div>}
                </div>
              </div>
              <div className="dimensions-panel">
                <div className="panel-header"><Info size={18} /><h3>Model Dimensions</h3></div>
                {dimensions ? (<div className="dimensions-content">
                  <div className="dimension-group"><h4>{unit === 'mm' ? 'Metric (mm)' : 'Imperial (inches)'}</h4>
                    <div className="dim-row"><span>Length (L):</span> <strong>{unit === 'mm' ? dimensions.mm.l : dimensions.inches.l} {unit}</strong></div>
                    <div className="dim-row"><span>Width (W):</span> <strong>{unit === 'mm' ? dimensions.mm.w : dimensions.inches.w} {unit}</strong></div>
                    <div className="dim-row"><span>Thickness (T):</span> <strong>{unit === 'mm' ? dimensions.mm.t : dimensions.inches.t} {unit}</strong></div>
                    <div className="dim-row"><span>Volume:</span> <strong>{unit === 'mm' ? dimensions.mm.volume : dimensions.inches.volume} {unit}³</strong></div>
                  </div>
                  <div className="qf-cta-container">
                    <p className="qf-cta-label">Ready to get a formal quote?</p>
                    <button className="btn-get-quote" onClick={() => setIsQuoteFlowActive(true)}>PROCEED TOWARD QUOTE <ArrowRight size={18} /></button>
                  </div>
                </div>) : <div className="no-dimensions"><Layers size={40} /><p>Select a file</p></div>}
              </div>
            </>
          )}
        </div>
      )}
      <StyleTag />
    </div>
  );
};

const styles = `
.quote-flow-layout {
  height: calc(100vh - 120px) !important;
  max-width: 1440px;
  margin: 0 auto;
  gap: 0 !important;
}

.quote-flow-step-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0,0,0,0.08);
  border: 1px solid #f1f5f9;
}

.qf-top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #f1f5f9;
  background: #fff;
  z-index: 10;
}

.qf-nav-right {
  display: flex;
  gap: 12px;
}

.qf-nav-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.qf-nav-btn:hover {
  background: #f8fafc;
  color: #0f172a;
  border-color: #cbd5e1;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.qf-split-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.qf-left-side {
  flex: 0 0 45%;
  background: #f8fafc;
  border-right: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  padding: 32px;
  overflow-y: auto;
}

.qf-right-side {
  flex: 1;
  padding: 40px;
  overflow-y: auto;
  background: white;
  display: flex;
  flex-direction: column;
}

.qf-model-box {
  flex: 0 0 400px;
  background: white;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  position: relative;
  overflow: hidden;
  margin-bottom: 32px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.03), inset 0 2px 4px rgba(0,0,0,0.02);
}

.qf-viewer-wrapper {
  width: 100%;
  height: 100%;
}

.qf-view-toggles-simple {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(12px);
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 6px;
  gap: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  z-index: 5;
}

.qf-view-toggles-simple button {
  padding: 8px 20px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.qf-view-toggles-simple button.active {
  background: #0f172a;
  color: white;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
}

.qf-dimensions-simple {
  background: white;
  padding: 24px;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.02);
}

.qf-dimensions-simple h4 {
  margin: 0 0 20px 0;
  font-size: 14px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
}

.qf-dim-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.dim-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dim-row span {
  font-size: 13px;
  color: #64748b;
}

.dim-row strong {
  font-size: 18px;
  color: #0f172a;
  font-weight: 700;
}

/* Right Side Selection Panel */
.qf-selection-panel {
  max-width: 680px;
  margin: 0 auto;
  width: 100%;
}

.qf-step-fade-in {
  animation: qfSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes qfSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.qf-panel-title {
  font-size: 32px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 12px;
  letter-spacing: -0.02em;
}

.qf-panel-subtitle {
  font-size: 16px;
  color: #64748b;
  margin-bottom: 40px;
  line-height: 1.5;
}

/* Large Service Cards */
.qf-large-buttons {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.qf-large-service-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32px;
  background: white;
  border: 2px solid #f1f5f9;
  border-radius: 24px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  width: 100%;
  position: relative;
  box-shadow: 0 4px 6px rgba(0,0,0,0.01);
}

.qf-large-service-card:hover:not(.disabled) {
  border-color: #0f172a;
  transform: scale(1.01);
  box-shadow: 0 20px 40px rgba(0,0,0,0.06);
}

.qf-large-service-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f8fafc;
  border-style: dashed;
}

.qf-card-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qf-card-main strong {
  font-size: 22px;
  color: #0f172a;
  font-weight: 800;
}

.qf-card-main span {
  font-size: 15px;
  color: #64748b;
  max-width: 320px;
}

.qf-card-status {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 700;
  padding: 10px 20px;
  border-radius: 14px;
  transition: all 0.2s;
}

.qf-card-status.price {
  background: #f1f5f9;
  color: #0f172a;
}

.qf-large-service-card:hover .qf-card-status.price {
  background: #0f172a;
  color: white;
}

.qf-card-status.error {
  background: #fff1f2;
  color: #e11d48;
}

/* Metal Grid */
.qf-metal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
}

.qf-metal-card {
  aspect-ratio: 1;
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  border: 2px solid #f1f5f9;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
}

.qf-metal-card:hover {
  border-color: #0f172a;
  transform: scale(1.05);
  z-index: 2;
  box-shadow: 0 15px 30px rgba(0,0,0,0.1);
}

.qf-metal-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.qf-metal-name-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20px 12px 12px;
  background: linear-gradient(transparent, rgba(15, 23, 42, 0.9));
  color: white;
  text-align: center;
}

.qf-metal-name-overlay span {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* Summary Bar */
.qf-selection-summary-bar {
  display: flex;
  gap: 24px;
  margin-bottom: 32px;
  padding: 16px 24px;
  background: #f8fafc;
  border-radius: 16px;
  border: 1px solid #f1f5f9;
}

.qf-summary-item {
  font-size: 14px;
  color: #64748b;
}

.qf-summary-item strong {
  color: #0f172a;
  margin-right: 4px;
}

/* Sub Services Grid */
.qf-services-grid-v2 {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 40px;
}

.qf-additional-service-wrapper {
  display: flex;
  flex-direction: column;
}

.qf-service-option {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 24px;
  background: white;
  border: 2px solid #f1f5f9;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.25s ease;
  text-align: left;
  width: 100%;
}
.qf-service-option:hover {
  border-color: #0f172a;
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05);
}

.qf-service-option.active {
  border-color: #0f172a;
  background: #f8fafc;
}

.qf-checkbox {
  width: 24px;
  height: 24px;
  border: 2px solid #cbd5e1;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1);
  flex-shrink: 0;
}

.qf-checkbox.checked {
  background: #0f172a;
  border-color: #0f172a;
  color: white;
}

.qf-service-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.qf-service-info strong {
  font-size: 16px;
  color: #0f172a;
  font-weight: 800;
}

.qf-service-info p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  line-height: 1.4;
}

.qf-service-options-panel {
  margin-top: -12px;
  margin-bottom: 24px;
  padding: 28px 24px 24px 72px;
  background: #f8fafc;
  border: 2px solid #0f172a;
  border-top: none;
  border-radius: 0 0 24px 24px;
  position: relative;
  z-index: 1;
}

.qf-service-options-panel label {
  display: block;
  font-size: 11px;
  font-weight: 800;
  color: #94a3b8;
  margin-bottom: 16px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.qf-options-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.qf-option-swatch {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1);
  font-size: 14px;
  font-weight: 700;
  color: #334155;
}

.qf-option-swatch:hover {
  border-color: #cbd5e1;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.qf-option-swatch.active {
  border-color: #0f172a;
  background: #0f172a;
  color: white;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.15);
}

.swatch-circle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.1);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
}

/* Original qf-opt-check and qf-opt-content rules removed as per instruction */

.qf-no-services-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px;
  background: #f8fafc;
  border-radius: 24px;
  color: #94a3b8;
  gap: 16px;
  border: 2px dashed #e2e8f0;
}

/* Final Button */
.qf-final-btn {
  width: 100%;
  padding: 20px;
  background: #0f172a;
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 18px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  letter-spacing: 0.02em;
}

.qf-final-btn:hover {
  background: #000;
  transform: translateY(-3px);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
}

.qf-loading-viewer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #64748b;
  font-size: 14px;
}

.flat-loading-spinner {
  width: 44px;
  height: 44px;
  border: 3px solid rgba(0, 0, 0, 0.05);
  border-top-color: #3b82f6; 
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.qf-cta-container {
  margin-top: 32px;
  padding-top: 32px;
  border-top: 2px solid #f1f5f9;
}

.qf-cta-label {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 16px;
  font-weight: 500;
}

.import-loading-overlay {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
}

.progress-percentage {
  font-size: 48px;
  font-weight: 800;
  color: #0f172a;
}
`;

const StyleTag = () => <style dangerouslySetInnerHTML={{ __html: styles }} />;

export default InstantPricing;

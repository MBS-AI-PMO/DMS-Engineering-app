import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import {
  Upload, X, Info, ArrowRight, FileCode, Layers, Grid3x3, Box, Square,
  Monitor, Maximize2, Boxes, ChevronLeft,
  ChevronRight, AlertCircle, AlertTriangle, Loader2, Check, Shield, Calculator,
  Minus, Plus, Zap, TrendingDown, FileText, Settings, Grid
} from 'lucide-react';
import * as OV from 'online-3d-viewer';
import { parseString, toSVG } from 'dxf';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import FlatPatternViewer from '../components/viewer/FlatPatternViewer';
import { fetchServices, fetchMetals, calculatePrice, fetchPublicDiscounts } from '../utils/api';

const BACKEND_URL = import.meta.env.VITE_PYTHON_API_URL;

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
  const [unit, setUnit] = useState('mm'); // mm or inch
  const [dxfSvg, setDxfSvg] = useState(null);
  const [dxfError, setDxfError] = useState(null);
  const [backendData, setBackendData] = useState(null);
  const [backendError, setBackendError] = useState(null);
  const [isLoadingUnfold, setIsLoadingUnfold] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isQuoteFlowActive, setIsQuoteFlowActive] = useState(false);
  const [modelLoadCount, setModelLoadCount] = useState(0);

  // Dynamic data from DB
  const [allServices, setAllServices] = useState([]);
  const [allMetals, setAllMetals] = useState([]);
  const [selectedProductionService, setSelectedProductionService] = useState(null);
  const [selectedMetal, setSelectedMetal] = useState(null);
  const [selectedAdditionalServices, setSelectedAdditionalServices] = useState([]);
  const [selectedAnodizingColor, setSelectedAnodizingColor] = useState(null);
  const [isAnodizingModalOpen, setIsAnodizingModalOpen] = useState(false);
  const [selectedTaps, setSelectedTaps] = useState({});
  const [activeTapHole, setActiveTapHole] = useState(null);
  const [isDetectingHoles, setIsDetectingHoles] = useState(false);
  const [highlightBends, setHighlightBends] = useState(false);
  const [holeDetectionError, setHoleDetectionError] = useState(null);
  const [detectedHoles, setDetectedHoles] = useState([]);
  const [allDiscounts, setAllDiscounts] = useState([]);
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [priceBreakdown, setPriceBreakdown] = useState(null);
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const parsedDxfRef = useRef(null);
  const stepHolesDetectedRef = useRef(false);
  const stepViewerRef = useRef(null);
  const dxfViewerRef = useRef(null);
  const viewerInstance = useRef(null);
  const dimensionsRef = useRef(null);
  const modelRef = useRef(null);
  const pendingAxisRef = useRef(null);
  const holeMarkersRef = useRef([]);


  // ── File Selection Handler ──────────
  useEffect(() => {
    if (files.length > 0) {
      if (!selectedFile) setSelectedFile(files[0]);
    }
  }, [files, selectedFile]);

  // ── Toggle Body Class for Full-Page Flow ──────────
  useEffect(() => {
    document.body.classList.add('light-mode');
    const isActive = isQuoteFlowActive || files.length > 0;
    if (isActive) {
      document.body.classList.add('qf-active');
      document.documentElement.classList.add('qf-active');
    } else {
      document.body.classList.remove('qf-active');
      document.documentElement.classList.remove('qf-active');
    }
    return () => {
      document.body.classList.remove('qf-active');
      document.documentElement.classList.remove('qf-active');
    };
  }, [isQuoteFlowActive, files.length]);

  // ── Fetch dynamic services + metals on mount ───────────
  useEffect(() => {
    const loadAppData = async () => {
      try {
        const results = await Promise.allSettled([
          fetchServices(),
          fetchMetals(),
          fetchPublicDiscounts()
        ]);

        const svcs = results[0].status === 'fulfilled' ? results[0].value : [];
        const mtls = results[1].status === 'fulfilled' ? results[1].value : [];
        const disc = results[2].status === 'fulfilled' ? results[2].value : [];

        setAllServices(svcs || []);
        setAllMetals(mtls || []);
        setAllDiscounts(disc || []);
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
    setSelectedProductionService(null);
    setSelectedMetal(null);
    setQuantity(1);
    setSelectedAdditionalServices([]);
    setSelectedAnodizingColor(null);
    setDetectedHoles([]);
    setIsDetectingHoles(false);
    setHighlightBends(false);
    parsedDxfRef.current = null;
    stepHolesDetectedRef.current = false;
  }, [selectedFile]);

  // ── STEP Hole Detection for Tapping ──────────────────
  useEffect(() => {
    const hasTapping = selectedAdditionalServices.some(s => s.title.toLowerCase().includes('tap'));
    if (!hasTapping || !selectedFile || !isStepFile(selectedFile.file.name)) return;
    if (stepHolesDetectedRef.current || isDetectingHoles) return;

    const detect = async () => {
      setIsDetectingHoles(true);
      setHoleDetectionError(null);
      const fd = new FormData();
      fd.append('file', selectedFile.file);
      try {
        const r = await fetch(`${BACKEND_URL}/detect-holes`, { method: 'POST', body: fd });
        if (!r.ok) throw new Error(`Server responded with ${r.status}`);
        const d = await r.json();
        const depthIn = dimensions?.mm?.t ? parseFloat(dimensions.mm.t) / 25.4 : 2 / 25.4;
        setDetectedHoles((d.holes || []).map((h, idx) => ({
          id: idx,
          diameterInches: h.diameter_in,
          depthInches: depthIn,
          position: h.position,
        })));
        stepHolesDetectedRef.current = true;
      } catch (err) {
        setHoleDetectionError('Could not detect holes: ' + err.message);
        stepHolesDetectedRef.current = true;
      } finally {
        setIsDetectingHoles(false);
      }
    };
    detect();
  }, [selectedAdditionalServices, selectedFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-Time Price Calculation ───────────────────────
  useEffect(() => {
    if (!selectedMetal || !selectedProductionService || !dimensions) {
      setPriceEstimate(null);
    }

    const getEstimate = async () => {
      setIsCalculatingPrice(true);
      try {
        const payload = {
          metal_id: selectedMetal.id,
          service_id: selectedProductionService.id,
          thickness_value: dimensions.inches.t,
          length_in: dimensions.inches.l,
          height_in: dimensions.inches.w,
          quantity: quantity
        };
        const data = await calculatePrice(payload);
        setPriceEstimate(data.total_price);
        setPriceBreakdown(data.breakdown);
      } catch (err) {
        console.error('Price calculation failed:', err);
        setPriceEstimate(null);
      } finally {
        setIsCalculatingPrice(false);
      }
    };

    const timeoutId = setTimeout(getEstimate, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [selectedMetal, selectedProductionService, dimensions, quantity]);


  // ── Dimension Validation Helper ────────────────────────

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

        // Extract holes from CIRCLE entities
        const circles = parsed.entities?.filter(e => e.type === 'CIRCLE') || [];
        const defaultDepthIn = 2 / 25.4; // default 2mm material thickness
        setDetectedHoles(circles.map((c, idx) => ({
          id: idx,
          diameterInches: isInch ? c.r * 2 : (c.r * 2) / 25.4,
          depthInches: defaultDepthIn
        })));
        parsedDxfRef.current = parsed;

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
        scene.background = new THREE.Color(0xffffff);
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
            if (child.minX >= parent.minX && child.maxX <= parent.maxX && child.minY >= parent.minY && child.maxY <= parent.maxY) {
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
        backgroundColor: new OV.RGBAColor(255, 255, 255, 255),
        edgeSettings: new OV.EdgeSettings(true, new OV.RGBColor(0, 0, 0), 1),
        onModelLoaded: () => {
          clearInterval(progressTimer); setImportProgress(100); setTimeout(() => setIsImporting(false), 800);
          const m = viewer.GetModel(); modelRef.current = m; extractDimensions(m);
          if (pendingAxisRef.current) { const a = pendingAxisRef.current; pendingAxisRef.current = null; setTimeout(() => setAxisCamera(a), 100); }
          else { setTimeout(() => { viewer.FitToWindow(); viewer.Render(); }, 150); }
          try {
            viewer.GetViewer()?.scene?.traverse(obj => {
              if (obj.isMesh && obj.material?.color && !obj.userData.origColor) {
                obj.userData.origColor = { r: obj.material.color.r, g: obj.material.color.g, b: obj.material.color.b };
              }
            });
          } catch { /* ignore */ }
          setModelLoadCount(c => c + 1);
        }
      });
      localViewer = viewer; viewerInstance.current = viewer; viewer.LoadModelFromFileList([selectedFile.file]);

      const resizeObserver = new ResizeObserver(() => {
        if (viewerInstance.current) {
          try {
            viewerInstance.current.FitToWindow();
            viewerInstance.current.Render();
          } catch { /* ignore */ }
        }
      });
      if (stepViewerRef.current) resizeObserver.observe(stepViewerRef.current);

      checkInterval = setInterval(() => { if (dimensionsRef.current) clearInterval(checkInterval); else { const m = viewer.GetModel(); if (m) extractDimensions(m); } }, 2000);
      return () => {
        if (checkInterval) clearInterval(checkInterval);
        resizeObserver.disconnect();
        try { localViewer?.Destroy(); } catch (err) { console.error("Error destroying local viewer:", err); }
      };
    } catch (err) { clearInterval(progressTimer); setIsImporting(false); console.error("Error initializing STEP viewer:", err); }
  }, [selectedFile, viewMode, isQuoteFlowActive]);

  const isTappingActive = selectedAdditionalServices.some(s => s.title.toLowerCase().includes('tap'));

  useEffect(() => {
    if (!viewerInstance.current || !isStepFile(selectedFile?.file?.name)) return;
    if (modelLoadCount === 0) return;
    const apply = () => {
      try {
        const v = viewerInstance.current?.GetViewer();
        if (!v?.scene) return;
        v.scene.traverse(obj => {
          if (!obj.isMesh) return;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((mat, idx) => {
            if (!mat?.color) return;
            if (!obj.userData._matCloned) {
              obj.material = Array.isArray(obj.material) ? obj.material.map(m => m.clone()) : obj.material.clone();
              obj.userData._matCloned = true;
            }
            const fm = Array.isArray(obj.material) ? obj.material[idx] : obj.material;
            if (!obj.userData.origColor) obj.userData.origColor = { r: fm.color.r, g: fm.color.g, b: fm.color.b };
            if (selectedAnodizingColor) fm.color.set(selectedAnodizingColor.color);
            else { const oc = obj.userData.origColor; fm.color.setRGB(oc.r, oc.g, oc.b); }
            fm.needsUpdate = true;
          });
        });
        try { v.Render(); } catch { /* silent render error */ }
      } catch (err) { console.warn('Anodizing color error:', err); }
    };
    apply();
    const tid = setTimeout(apply, 200);
    return () => clearTimeout(tid);
  }, [selectedAnodizingColor, selectedFile?.file?.name, modelLoadCount]);

  useEffect(() => {
    if (!viewerInstance.current || !isStepFile(selectedFile?.file?.name)) return;
    if (modelLoadCount === 0) return;

    const updateMarkers = () => {
      try {
        const v = viewerInstance.current?.GetViewer();
        if (!v?.scene) return;

        let modelParent = v.scene;
        for (const child of v.scene.children) {
          if (child.isGroup && child.userData?.isModelGroup !== false) {
            modelParent = child;
            break;
          }
        }

        holeMarkersRef.current.forEach(m => { m.parent?.remove(m); m.geometry?.dispose(); m.material?.dispose(); });
        holeMarkersRef.current = [];

        if (!isTappingActive || detectedHoles.length === 0) { try { v.Render(); } catch { /* silent render error */ } return; }

        detectedHoles.forEach(hole => {
          if (!hole.position) return;
          const isTapped = !!selectedTaps[hole.id];
          const isActive = activeTapHole?.id === hole.id;
          const color = isActive ? 0x2563eb : isTapped ? 0x3b82f6 : 0xf59e0b;
          const radius = (hole.diameterInches * 25.4) / 2;
          const markerRadius = Math.max(radius * 1.3, 2);
          const tube = Math.max(markerRadius * 0.2, 0.5);
          const geo = new THREE.TorusGeometry(markerRadius, tube, 12, 32);
          const mat = new THREE.MeshStandardMaterial({
            color,
            transparent: true,
            opacity: 0.85,
            depthTest: false,
            metalness: 0.5,
            roughness: 0.3
          });
          const ring = new THREE.Mesh(geo, mat);
          ring.position.set(hole.position[0], hole.position[1], hole.position[2]);
          if (hole.axis) {
            const axisVec = new THREE.Vector3(hole.axis[0], hole.axis[1], hole.axis[2]).normalize();
            const up = new THREE.Vector3(0, 0, 1);
            ring.quaternion.setFromUnitVectors(up, axisVec);
          } else {
            ring.lookAt(hole.position[0], hole.position[1], hole.position[2] + 100);
          }
          ring.renderOrder = 999;
          ring.userData = { isHoleMarker: true, hole: hole };
          modelParent.add(ring);
          holeMarkersRef.current.push(ring);
        });
        try { v.Render(); } catch { /* silent render error */ }
      } catch (err) { console.warn('Hole marker error:', err); }
    };

    updateMarkers();
    const viewerEl = stepViewerRef.current;
    if (!viewerEl) return;

    const onViewerClick = (event) => {
      const v = viewerInstance.current?.GetViewer();
      if (!v?.scene || !v?.camera) return;
      const rect = viewerEl.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, v.camera);
      const intersects = raycaster.intersectObjects(holeMarkersRef.current);
      if (intersects.length > 0) {
        const clickedMarker = intersects[0].object;
        if (clickedMarker.userData.hole) {
          setActiveTapHole(clickedMarker.userData.hole);
        }
      }
    };

    viewerEl.addEventListener('click', onViewerClick);
    const tid = setTimeout(updateMarkers, 300);
    return () => {
      clearTimeout(tid);
      viewerEl.removeEventListener('click', onViewerClick);
    };
  }, [detectedHoles, selectedTaps, activeTapHole, isTappingActive, selectedFile?.file?.name, modelLoadCount]);

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
    const v = viewerInstance.current?.GetViewer();
    if (!v) return;
    const model = viewerInstance.current.GetModel();
    let distance = 500;
    if (model) {
      const box = OV.GetBoundingBox(model);
      if (box && box.min && box.max) {
        const size = [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z];
        distance = Math.max(...size) * 2;
      }
    }
    const configs = {
      top: { eye: [0, distance, 0], up: [0, 0, -1] },
      front: { eye: [0, 0, distance], up: [0, 1, 0] },
      side: { eye: [distance, 0, 0], up: [0, 1, 0] },
      flat: { eye: [0, distance, 0], up: [0, 0, -1] }
    };
    const c = configs[axis];
    if (c) {
      v.SetCamera(new OV.Camera(
        new OV.Coord3D(...c.eye),
        new OV.Coord3D(0, 0, 0),
        new OV.Coord3D(...c.up),
        45
      ));
      v.SetProjectionMode(OV.ProjectionMode.Orthographic);
      setTimeout(() => v.FitToWindow(), 10);
      setTimeout(() => { v.FitToWindow(); v.Render(); }, 150);
    }
  };

  useEffect(() => {
    if (viewerInstance.current) {
      const timer = setTimeout(() => {
        try {
          const v = viewerInstance.current.GetViewer();
          if (v) {
            v.FitToWindow();
            v.Render();
          }
        } catch { /* ignore */ }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [viewMode, selectedFile, modelLoadCount, isQuoteFlowActive]);

  const currentIsDxf = is2DFile(selectedFile?.file?.name ?? '');
  const currentIsStep = isStepFile(selectedFile?.file?.name ?? '');

  return (
    <div className={`instant-pricing-container ${isQuoteFlowActive || files.length > 0 ? 'ip-fullpage qf-active' : ''}`}>
      <style>{`
        * { box-shadow: none !important; border-color: transparent !important; }
        .qf-active, .qf-active .app-container, .qf-active .main-content, .qf-active #root, .qf-active .instant-pricing-container { background-color: #ffffff !important; background: #ffffff !important; box-shadow: none !important; border: none !important; }
        .qf-main-canvas, .qf-viewer-panel, .qf-viewer-panel > div, .qf-main-canvas > div { background-color: #ffffff !important; border: none !important; box-shadow: none !important; }
        .row, .col-lg-3, .col-lg-4, .col-lg-5, .col-lg-6, .col-lg-9 { margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
        .bg-light, .bg-light-subtle { background-color: #ffffff !important; }
        .border-light-subtle, .border-bottom, .border-end, .border-top { border: none !important; }
      `}</style>
      {!isQuoteFlowActive && (
        <header className="pricing-header text-center py-5">
          <h1 className="fw-bold h2 text-uppercase letter-spacing-1">Get Instant Pricing</h1>
          {files.length === 0 && <p className="text-muted">Upload your CAD files to get an immediate quote for your project.</p>}
        </header>
      )}

      {files.length === 0 ? (
        <div className="upload-section py-5">
          <div {...getRootProps()} className={`dropzone mx-auto rounded-5 border-2 border-dashed p-5 text-center ${isDragActive ? 'bg-light border-primary' : 'bg-white border-secondary'}`} style={{ maxWidth: '800px', cursor: 'pointer' }}>
            <input {...getInputProps()} />
            <div className="file-icons-row d-flex justify-content-center gap-3 mb-4">
              {['.dxf', '.dwg', '.step', '.stp'].map(ext => (
                <div key={ext} className="file-icon-item p-3 border rounded-3 bg-light"><span className="fw-bold small">{ext}</span></div>
              ))}
            </div>
            <h2 className="h3 fw-bold">Drop files here to get started</h2>
            <p className="text-muted fs-5">or</p>
            <button className="btn btn-danger btn-lg px-5 rounded-pill shadow-sm">BROWSE FILES</button>
          </div>
        </div>
      ) : (
        <div className="qf-preview-container container-fluid p-0 h-100">
          {!isQuoteFlowActive ? (
            <div className="row g-0 h-100 overflow-hidden m-0 position-relative border-0 shadow-none">
              <div className="col-lg-3 h-100 p-4 d-flex flex-column bg-white">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <span className="fw-bold text-uppercase small text-muted letter-spacing-1">Uploaded Files</span>
                  <button className="btn btn-link btn-sm text-danger text-decoration-none fw-bold p-0" onClick={() => { setFiles([]); setIsQuoteFlowActive(false); }}>Clear all</button>
                </div>
                <div className="file-list-preview overflow-auto flex-grow-1 pe-2">
                  {files.map(f => (
                    <div
                      key={f.id}
                      className={`qf-mini-file-card p-3 rounded-4 d-flex align-items-center justify-content-between mb-3 cursor-pointer transition-all border-2 ${selectedFile?.id === f.id ? 'bg-danger bg-opacity-10 border-danger border-opacity-25' : 'bg-light border-transparent hover-bg-white hover-border-light'}`}
                      onClick={() => setSelectedFile(f)}
                    >
                      <div className="d-flex align-items-center gap-2 overflow-hidden">
                        <FileText size={18} className="text-danger flex-shrink-0" />
                        <span className="text-dark fw-bold small text-truncate">{f.file.name}</span>
                      </div>
                      <X size={16} className="text-muted opacity-50 hover-opacity-100 flex-shrink-0" onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} />
                    </div>
                  ))}
                </div>
                <button className="btn btn-light w-100 rounded-4 py-3 small fw-bold mt-3 transition-all d-flex align-items-center justify-content-center gap-2" {...getRootProps()}>
                  <Plus size={16} className="text-muted" /> Add more files
                </button>
              </div>
              <div className="col-lg-6 h-100 position-relative p-0 d-flex flex-column bg-white">
                <div className="qf-viewer-toolbar p-3 d-flex justify-content-between align-items-center gap-3 bg-transparent">
                  <div className="d-flex gap-2">
                    <div className="btn-group p-1 rounded-4 bg-white">
                      <button className={`btn btn-sm px-4 py-2 rounded-3 fw-bold transition-all border-0 ${viewMode === '3d' ? 'bg-black text-white' : 'bg-transparent text-muted'}`} onClick={() => setViewMode('3d')}>3D VIEW</button>
                      <button className={`btn btn-sm px-4 py-2 rounded-3 fw-bold transition-all border-0 ${viewMode === '2d' ? 'bg-black text-white' : 'bg-transparent text-muted'}`} onClick={() => { setViewMode('2d'); handleUnfold(); }}>2D VIEW</button>
                    </div>
                    <div className="btn-group p-1 rounded-4 bg-white">
                      {['top', 'front', 'side', 'flat'].map(ax => (
                        <button key={ax} className={`btn btn-sm px-3 py-2 text-uppercase fw-bold transition-all rounded-3 d-flex align-items-center gap-1 border-0 ${activeAxis === ax ? 'bg-danger text-white' : 'bg-transparent text-muted hover-bg-light'}`}
                          onClick={() => { setActiveAxis(ax); setAxisCamera(ax); }}>
                          {ax}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="btn-group p-1 rounded-4 bg-white shadow-sm border border-black border-opacity-5">
                    <button className={`btn btn-sm px-3 py-2 fw-bold transition-all rounded-3 border-0 ${unit === 'mm' ? 'bg-black text-white' : 'bg-transparent text-muted hover-bg-light'}`} onClick={() => setUnit('mm')}>MM</button>
                    <button className={`btn btn-sm px-3 py-2 fw-bold transition-all rounded-3 border-0 ${unit === 'inch' ? 'bg-black text-white' : 'bg-transparent text-muted hover-bg-light'}`} onClick={() => setUnit('inch')}>INCH</button>
                  </div>
                </div>
                <div className="qf-main-canvas flex-grow-1 position-relative bg-white">
                  {(isImporting || isCalculatingPrice || isDetectingHoles || isLoadingUnfold) && (
                    <div className="position-absolute top-50 start-50 translate-middle z-3 text-center">
                      <Loader2 className="spinner-border animate-spin text-danger mb-2 border-0" />
                      <div className="fw-bold small text-muted">
                        {isImporting ? `IMPORTING MODEL (${importProgress.toFixed(0)}%)` :
                          isLoadingUnfold ? 'PREPARING FLAT PATTERN...' :
                            isCalculatingPrice ? 'CALCULATING PRICE...' : 'DETECTING FEATURES...'}
                      </div>
                    </div>
                  )}
                  {(dxfError || backendError || holeDetectionError) && (
                    <div className="position-absolute top-0 start-50 translate-middle-x mt-4 z-3 bg-danger bg-opacity-10 text-danger px-4 py-2 rounded-pill small fw-bold border border-danger border-opacity-25">
                      <AlertTriangle size={14} className="me-2" />
                      {dxfError || backendError || holeDetectionError}
                    </div>
                  )}
                  {viewMode === '3d' && currentIsStep && <div ref={stepViewerRef} className="w-100 h-100" />}
                  {viewMode === '2d' && currentIsStep && (backendData ? <FlatPatternViewer geometries={[]} options={{ highlightBends }} backendData={backendData} sourceFlatData={null} formatKind="drawing" /> : <div className="p-5 text-center text-muted">Preparing Pattern...</div>)}
                  {currentIsDxf && <div className="dxf-svg-wrapper h-100 d-flex align-items-center justify-content-center p-5">{dxfSvg ? <div className="dxf-svg-content" dangerouslySetInnerHTML={{ __html: dxfSvg }} /> : <div>Parsing...</div>}</div>}
                </div>
              </div>

              {/* RIGHT PANEL: Dimensions & Proceed */}
              <div className="col-lg-3 h-100 bg-white p-4">
                <div className="qf-info-panel h-100 d-flex flex-column">
                  <div className="mb-4 d-flex align-items-center gap-2">
                    <Info size={18} className="text-secondary" />
                    <h2 className="fs-6 fw-bold m-0 letter-spacing-1">MODEL DIMENSIONS</h2>
                  </div>

                  {dimensions ? (
                    <>
                      <div className="flex-grow-1">
                        <div className="mb-5">
                          <label className="d-block text-muted small fw-bold mb-3 text-uppercase">{unit === 'mm' ? 'METRIC (MM)' : 'IMPERIAL (INCH)'}</label>
                          <div className="d-flex flex-column gap-4">
                            <div className="dim-row pb-2">
                              <span className="small text-muted d-block mb-1 fw-bold">Length (L):</span>
                              <strong className="fs-4 d-block text-dark">{unit === 'mm' ? dimensions.mm.l : dimensions.inches.l} {unit}</strong>
                            </div>
                            <div className="dim-row pb-2">
                              <span className="small text-muted d-block mb-1 fw-bold">Width (W):</span>
                              <strong className="fs-4 d-block text-dark">{unit === 'mm' ? dimensions.mm.w : dimensions.inches.w} {unit}</strong>
                            </div>
                            <div className="dim-row pb-2">
                              <span className="small text-muted d-block mb-1 fw-bold">Thickness (T):</span>
                              <strong className="fs-4 text-danger d-block">{unit === 'mm' ? dimensions.mm.t : dimensions.inches.t} {unit}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto pt-4">
                        <button className="btn btn-danger btn-lg w-100 py-3 rounded-4 fw-bold d-flex align-items-center justify-content-center hover-scale transition-all border-0 shadow-none" onClick={() => setIsQuoteFlowActive(true)}>
                          PROCEED TOWARD QUOTE <ChevronRight size={20} className="ms-2" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-5 my-auto">
                      <Loader2 className="spinner-border animate-spin text-danger mb-3 border-0" />
                      <div className="text-muted small fw-bold mt-2">CALCULATING DIMENSIONS...</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="row g-0 h-100 w-100 m-0">
              <div className="col-lg-5 h-100 bg-white d-flex flex-column overflow-hidden">
                <div className="qf-viewer-panel flex-grow-1 position-relative" style={{ height: '75%' }}>
                  {viewMode === '3d' && currentIsStep && <div ref={stepViewerRef} className="w-100 h-100" />}
                  {viewMode === '2d' && currentIsStep && (backendData ? <FlatPatternViewer geometries={[]} options={{ highlightBends }} backendData={backendData} sourceFlatData={null} formatKind="drawing" /> : <div className="p-5 text-center">Preparing...</div>)}
                  {currentIsDxf && <div className="dxf-svg-wrapper h-100 w-100 d-flex align-items-center justify-content-center p-3">{dxfSvg ? <div className="dxf-svg-content" dangerouslySetInnerHTML={{ __html: dxfSvg }} /> : <div>Parsing...</div>}</div>}
                  <div className="qf-view-toggles-simple position-absolute bottom-0 start-50 translate-middle-x mb-3 bg-white p-1 rounded-pill d-flex gap-1 border shadow-sm">
                    <button className={`btn btn-sm rounded-pill px-4 fw-bold ${viewMode === '3d' ? 'btn-dark' : 'btn-link text-dark text-decoration-none'}`} onClick={() => setViewMode('3d')}>3D</button>
                    <button className={`btn btn-sm rounded-pill px-4 fw-bold ${viewMode === '2d' ? 'btn-dark' : 'btn-link text-dark text-decoration-none'}`} onClick={() => { setViewMode('2d'); handleUnfold(); }}>2D (Flat)</button>
                  </div>
                </div>
                {dimensions && (
                  <div className="qf-quick-dims p-5 border-top" style={{ height: '25%' }}>
                    <h4 className="fs-6 fw-bold mb-4 text-uppercase text-muted letter-spacing-1">{unit === 'mm' ? 'Metric Dims' : 'Imperial Dims'}</h4>
                    <div className="row g-4">
                      <div className="col-6">
                        <span className="text-muted d-block small mb-1 fw-bold">Length (L):</span>
                        <strong className="fs-4 d-block text-dark fw-extrabold">{unit === 'mm' ? dimensions.mm.l : dimensions.inches.l} {unit}</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block small mb-1 fw-bold">Width (W):</span>
                        <strong className="fs-4 d-block text-dark fw-extrabold">{unit === 'mm' ? dimensions.mm.w : dimensions.inches.w} {unit}</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block small mb-1 fw-bold text-danger">Thickness (T):</span>
                        <strong className="fs-4 d-block text-danger fw-extrabold">{unit === 'mm' ? dimensions.mm.t : dimensions.inches.t} {unit}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="col-lg-4 h-100 bg-white overflow-auto p-5 border-start">
                {!selectedProductionService ? (
                  <div className="animate-fade-in p-2">
                    <div className="d-flex justify-content-between align-items-center mb-5">
                      <h2 className="fs-4 fw-bold m-0">Select production method:</h2>
                      <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-10 rounded-pill px-3 py-1 fw-normal text-uppercase letter-spacing-1" style={{ fontSize: '10px' }}>
                        {allServices.filter(s => !!s.is_production || s.is_production == "1").length} active
                      </span>
                    </div>
                    <div className="d-flex flex-column gap-4">
                      {allServices.filter(s => !!s.is_production || s.is_production == "1").map(svc => {
                        const { fits, reason } = (() => {
                          if (!dimensions) return { fits: true };
                          const { l, w, t } = dimensions.mm;
                          const unitRatio = svc.dimensions_unit === 'in' ? 25.4 : 1;
                          const maxL = (parseFloat(svc.max_length) || 0) * unitRatio;
                          const maxW = (parseFloat(svc.max_width) || 0) * unitRatio;
                          const maxH = (parseFloat(svc.max_height) || 0) * unitRatio;
                          const partMax = Math.max(l, w);
                          const partMin = Math.min(l, w);
                          const svcMax = Math.max(maxL, maxW);
                          const svcMin = Math.min(maxL, maxW);
                          const fitsMaxL = svcMax === 0 || partMax <= svcMax;
                          const fitsMaxW = svcMin === 0 || partMin <= svcMin;
                          const fitsMaxH = maxH === 0 || t <= maxH;
                          if (!fitsMaxL || !fitsMaxW) return { fits: false, reason: `Exceeds max dimensions (${Math.round(svcMax)}x${Math.round(svcMin)}mm)` };
                          if (!fitsMaxH) return { fits: false, reason: `Exceeds max thickness (${Math.round(maxH)}mm)` };
                          return { fits: true };
                        })();
                        return (
                          <button key={svc.id} disabled={!fits} className={`btn text-start p-5 rounded-5 border transition-all d-flex flex-column gap-2 position-relative ${fits ? 'btn-white hover-shadow-sm border-light' : 'bg-light opacity-50 cursor-not-allowed grayscale'}`} onClick={() => setSelectedProductionService(svc)}>
                            <div className="d-flex justify-content-between align-items-start w-100">
                              <strong className={`fs-4 d-block ${fits ? 'text-dark' : 'text-muted'}`}>{svc.title}</strong>
                              {!fits && <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 rounded-pill px-3 py-2 small fw-bold">CAPACITY EXCEEDED</span>}
                            </div>
                            <span className="small text-muted opacity-75 fw-medium leading-relaxed">{svc.description}</span>
                            {!fits && <span className="mt-auto pt-2 text-danger small fw-bold d-flex align-items-center gap-2"><AlertCircle size={14} /> {reason}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : !selectedMetal ? (
                  <div className="animate-fade-in">
                    <div className="mb-4 d-flex align-items-center gap-3 bg-light p-3 rounded-4 small fw-bold">
                      <span className="text-muted text-uppercase letter-spacing-1">METHOD:</span> <span>{selectedProductionService.title}</span>
                      <button className="btn btn-link text-danger text-decoration-none p-0 ms-auto small fw-bold" onClick={() => setSelectedProductionService(null)}>CHANGE</button>
                    </div>
                    <h2 className="h4 fw-bold mb-4">Select Material</h2>
                    <div className="d-grid gap-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                      {allMetals.filter(m => m.services?.includes(selectedProductionService.id)).map(metal => (
                        <button key={metal.id} className="btn border-0 rounded-4 p-0 overflow-hidden transition-all position-relative shadow-sm hover-translate-y" style={{ aspectRatio: '1/1' }} onClick={() => setSelectedMetal(metal)}>
                          {metal.image_path ? <img src={metal.image_path} alt={metal.name} className="w-100 h-100 object-fit-cover" /> : <div className="bg-white h-100 w-100 border" />}
                          <div className="position-absolute bottom-0 w-100 bg-dark bg-opacity-75 text-white p-3 text-center small fw-bold text-uppercase letter-spacing-1">{metal.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="animate-fade-in">
                    <div className="mb-4 bg-light p-4 rounded-4 small fw-bold d-flex flex-column gap-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <div><span className="text-muted text-uppercase letter-spacing-1 me-2">Method:</span> <span className="text-dark">{selectedProductionService.title}</span></div>
                        <button className="btn btn-link text-danger p-0 text-decoration-none small fw-bold" onClick={() => { setSelectedProductionService(null); setSelectedMetal(null); }}>CHANGE</button>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <div><span className="text-muted text-uppercase letter-spacing-1 me-2">Metal:</span> <span className="text-dark">{selectedMetal.name}</span></div>
                        <button className="btn btn-link text-danger p-0 text-decoration-none small fw-bold" onClick={() => setSelectedMetal(null)}>CHANGE</button>
                      </div>
                    </div>
                    <h2 className="h4 fw-bold mb-2">Additional Services</h2>
                    <p className="text-muted small mb-4">Enhance your part with extra processes</p>
                    <div className="d-flex flex-column gap-3">
                      {allServices.filter(s => s.parent_id === selectedProductionService.id).map(svc => {
                        const isSelected = selectedAdditionalServices.some(s => s.id === svc.id);
                        return (
                          <button key={svc.id} className={`btn text-start p-4 rounded-4 border-2 d-flex align-items-center gap-3 transition-all ${isSelected ? 'border-danger bg-danger bg-opacity-5' : 'border-light bg-white hover-bg-light shadow-none'}`} onClick={() => {
                            const title = svc.title.toLowerCase();
                            if (title.includes('anodiz')) {
                              if (!isSelected) { setSelectedAdditionalServices(p => [...p, svc]); setIsAnodizingModalOpen(true); }
                              else { setSelectedAdditionalServices(p => p.filter(x => x.id !== svc.id)); setSelectedAnodizingColor(null); }
                            } else if (title.includes('tap')) {
                              if (!isSelected) { setSelectedAdditionalServices(p => [...p, svc]); }
                              else { setSelectedAdditionalServices(p => p.filter(x => x.id !== svc.id)); }
                            } else {
                              setSelectedAdditionalServices(p => isSelected ? p.filter(x => x.id !== svc.id) : [...p, svc]);
                            }
                          }}>
                            <div className={`rounded-circle border d-flex align-items-center justify-content-center ${isSelected ? 'bg-danger border-danger text-white' : 'bg-white border-secondary border-opacity-25'}`} style={{ width: '22px', height: '22px', flexShrink: 0 }}>
                              {isSelected && <Check size={14} />}
                            </div>
                            <div className="flex-grow-1 overflow-hidden">
                              <strong className="d-block small fw-bold text-dark">{svc.title}</strong>
                              <p className="m-0 text-muted text-truncate" style={{ fontSize: '11px' }}>{svc.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="col-lg-3 h-100 p-5 overflow-auto bg-white border-start">
                {selectedMetal ? (
                  <div className="animate-fade-in">
                    <div className="bg-white p-4 rounded-4 mb-4 border border-light shadow-none">
                      <label className="d-block fw-bold text-muted small text-uppercase mb-3 letter-spacing-1">Order Quantity</label>
                      <div className="d-flex align-items-center bg-light-subtle rounded-4 p-2 overflow-hidden border">
                        <button className="btn btn-white border-0 rounded-3 shadow-none" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button>
                        <input type="number" className="form-control text-center fw-bold fs-4 border-0 bg-transparent shadow-none" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
                        <button className="btn btn-white border-0 rounded-3 shadow-none" onClick={() => setQuantity(quantity + 1)}><Plus size={16} /></button>
                      </div>
                    </div>
                    {allDiscounts.length > 0 && (
                      <div className="mb-4">
                        <span className="small text-muted d-block mb-3 fw-bold text-uppercase letter-spacing-1">Volume Discounts</span>
                        <div className="d-flex flex-wrap gap-2">
                          {allDiscounts.map(d => (
                            <div key={d.id} className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-10 rounded-pill px-3 py-2 small fw-bold">
                              {d.min_quantity}+ units: {d.discount_percent}% OFF
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="bg-danger text-white p-5 rounded-5 shadow-lg position-relative overflow-hidden mb-4">
                      <div className="position-absolute top-0 end-0 p-5 opacity-10"><Zap size={120} /></div>
                      <div className="position-relative z-1">
                        <div className="d-flex justify-content-between align-items-center mb-5">
                          <div><span className="small text-white opacity-75 d-block mb-1 fw-bold text-uppercase letter-spacing-1">Unit Price</span><strong className="fs-2 d-block opacity-90">${parseFloat(priceBreakdown?.unit_total || 0).toFixed(2)}</strong></div>
                          <div className="text-end"><span className="small text-white opacity-75 d-block mb-1 fw-bold text-uppercase letter-spacing-1">Total Estimate</span><strong className="fs-1 d-block fw-extrabold">${parseFloat(priceEstimate || 0).toFixed(2)}</strong></div>
                        </div>
                        <button className="btn btn-white w-100 py-4 rounded-4 fw-bold fs-5 text-danger shadow-sm border-0 transition-all hover-translate-y d-flex align-items-center justify-content-center gap-2">
                          PROCEED TO REVIEW <ArrowRight size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-100 d-flex flex-column align-items-center justify-content-center px-4">
                    <div className="bg-white p-5 rounded-circle border border-light mb-5 d-flex align-items-center justify-content-center shadow-none" style={{ width: '120px', height: '120px' }}>
                      <Calculator size={60} className="text-danger opacity-25" />
                    </div>
                    <h3 className="fw-bold fs-4 mb-2 text-dark">Quote Summary</h3>
                    <p className="text-muted mb-5 small text-center text-uppercase letter-spacing-1">Configuration Progress</p>
                    <div className="w-100 d-flex flex-column gap-3 max-w-sm">
                      <div className={`p-4 rounded-4 d-flex align-items-center gap-3 transition-all ${selectedProductionService ? 'bg-danger bg-opacity-5 border border-danger border-opacity-25' : 'bg-light border border-light shadow-none'}`}>
                        <div className={`rounded-circle d-flex align-items-center justify-content-center ${selectedProductionService ? 'bg-danger text-white' : 'bg-white border'}`} style={{ width: '24px', height: '24px' }}>
                          <Check size={14} />
                        </div>
                        <span className={`fw-bold small ${selectedProductionService ? 'text-danger' : 'text-muted'}`}>Choose Method</span>
                      </div>
                      <div className={`p-4 rounded-4 d-flex align-items-center gap-3 transition-all ${selectedMetal ? 'bg-danger bg-opacity-5 border border-danger border-opacity-25' : 'bg-light border border-light shadow-none'}`}>
                        <div className={`rounded-circle d-flex align-items-center justify-content-center ${selectedMetal ? 'bg-danger text-white' : 'bg-white border'}`} style={{ width: '24px', height: '24px' }}>
                          <Check size={14} />
                        </div>
                        <span className={`fw-bold small ${selectedMetal ? 'text-danger' : 'text-muted'}`}>Choose Material</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <StyleTag />

      <AnimatePresence>
        {activeTapHole && (
          <motion.div key="tap-modal" className="position-fixed inset-0 bg-dark bg-opacity-75 d-flex align-items-center justify-content-center z-9999" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-5 shadow-2xl overflow-hidden w-100 mx-4" style={{ maxWidth: '900px', maxHeight: '90vh' }} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
              <div className="p-4 border-bottom d-flex justify-content-between align-items-center">
                <div><h3 className="fw-extrabold m-0">Assign Tap - Hole #{activeTapHole.id + 1}</h3><p className="small text-muted m-0 text-uppercase letter-spacing-1 mt-1">Diameter: &#8960;{Number(activeTapHole.diameterInches || 0).toFixed(4)}&quot;</p></div>
                <button className="btn-close shadow-none" onClick={() => setActiveTapHole(null)} />
              </div>
              <div className="d-flex" style={{ height: '550px' }}>
                <div className="border-end bg-light-subtle p-3 overflow-auto" style={{ width: '250px' }}>
                  {detectedHoles.map((hole, i) => (
                    <div key={hole.id} className={`p-4 rounded-4 mb-2 cursor-pointer border transition-all ${activeTapHole?.id === hole.id ? 'bg-danger text-white border-danger shadow-sm' : 'bg-white border-light hover-bg-light shadow-none'}`} onClick={() => setActiveTapHole(hole)}>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="fw-bold small">Hole #{i + 1}</span>
                        {selectedTaps[hole.id] ? <Check size={14} /> : <div className="rounded-circle bg-warning" style={{ width: '8px', height: '8px' }} />}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex-grow-1 p-5 overflow-auto bg-white">
                  {(() => {
                    const svc = selectedAdditionalServices.find(s => s.title.toLowerCase().includes('tap'));
                    if (!svc) return <div className="text-center py-5 text-danger fw-bold">Tapping service not added to selection</div>;
                    const assigned = selectedTaps[activeTapHole.id];
                    const dia = activeTapHole.diameterInches || 0;
                    return (
                      <div className="d-grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                        {(svc.service_options || []).map((tap, idx) => {
                          const minD = parseFloat(tap.min_diameter) || 0;
                          const maxD = parseFloat(tap.max_diameter) || 0;
                          const incompatible = dia > maxD || dia < minD;
                          const isChosen = assigned?.name === tap.name;
                          return (
                            <button key={idx} className={`btn border-2 rounded-5 p-4 text-start transition-all ${isChosen ? 'border-danger bg-danger bg-opacity-5' : incompatible ? 'border-warning bg-warning bg-opacity-5' : 'bg-white border-light hover-bg-light shadow-none'}`} onClick={() => setSelectedTaps(prev => ({ ...prev, [activeTapHole.id]: tap }))}>
                              <div className="d-flex justify-content-between mb-3">{isChosen ? <Check size={16} className="text-danger" /> : incompatible ? <AlertTriangle size={16} className="text-warning" /> : <div />}</div>
                              <strong className="d-block small fw-extrabold text-dark">{tap.name}</strong>
                              <div className="small text-muted mt-2 opacity-75">{minD.toFixed(3)}&quot; - {maxD.toFixed(3)}&quot;</div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="p-4 border-top bg-white text-end"><button className="btn btn-dark px-5 rounded-pill small fw-extrabold shadow-none" onClick={() => setActiveTapHole(null)}>DONE</button></div>
            </motion.div>
          </motion.div>
        )}

        {isAnodizingModalOpen && (
          <motion.div key="anodizing-modal" className="position-fixed inset-0 bg-dark bg-opacity-75 d-flex align-items-center justify-content-center z-9999" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-5 shadow-2xl p-5 w-100 mx-4" style={{ maxWidth: '700px' }} initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
              <div className="d-flex justify-content-between align-items-center mb-5">
                <div><h3 className="fw-extrabold m-0">Select Finish Color</h3><p className="small text-muted m-0 text-uppercase letter-spacing-1 mt-1">Available Premium Options</p></div>
                <button className="btn-close shadow-none" onClick={() => setIsAnodizingModalOpen(false)} />
              </div>
              <div className="d-grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                {(() => {
                  const svc = selectedAdditionalServices.find(s => s.title.toLowerCase().includes('anodiz'));
                  return (svc?.service_options || []).map((opt, i) => (
                    <button key={i} className={`btn border-2 rounded-5 p-4 d-flex flex-column align-items-center gap-3 transition-all ${selectedAnodizingColor?.name === opt.name ? 'border-danger bg-danger bg-opacity-5' : 'bg-white border-light hover-bg-light shadow-none'}`} onClick={() => { setSelectedAnodizingColor(opt); setIsAnodizingModalOpen(false); }}>
                      <div className="rounded-circle shadow-lg border border-white border-4" style={{ backgroundColor: opt.color, width: '60px', height: '60px' }} />
                      <span className="small fw-extrabold text-dark text-uppercase letter-spacing-1">{opt.name}</span>
                    </button>
                  ));
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StyleTag = () => {
  const styles = `
    .instant-pricing-container { background: #ffffff; min-height: 100vh; width: 100%; padding-bottom: 50px; }
    .qf-preview-container { height: 100vh !important; }
    .letter-spacing-1 { letter-spacing: 0.05em; }
    canvas { background: #ffffff !important; }
    .animate-spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `;
  return <style dangerouslySetInnerHTML={{ __html: styles }} />;
};

export default InstantPricing;

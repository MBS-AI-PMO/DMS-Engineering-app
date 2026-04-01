import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
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
import { useCart } from '../context/CartContext.js';
import { useAuth } from '../context/AuthContext';

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
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleProceedToReview = () => {
    if (!selectedFile || !selectedMetal || !dimensions) return;

    const totalBatch = parseFloat(priceEstimate || 0) +
      Object.values(selectedTaps).reduce((acc, t) => acc + (parseFloat(t.price) || 0), 0) +
      (selectedAnodizingColor ? parseFloat(selectedAdditionalServices.find(s => s.title.toLowerCase().includes('anodiz'))?.base_price || 15) : 0);

    const unitPrice = totalBatch / quantity;

    const config = {
      productionService: selectedProductionService,
      metal: selectedMetal,
      thickness: dimensions.mm.t,
      anodizingColor: selectedAnodizingColor,
      selectedTaps,
      additionalServices: selectedAdditionalServices,
      dimensions: dimensions,
      dxfSvg: dxfSvg
    };

    addToCart({
      fileName: selectedFile.file.name,
      file: selectedFile.file,
      tempPath: selectedFile.tempPath,
      configuration: config,
      pricing: {
        base: parseFloat(priceEstimate || 0) / quantity,
        taps: Object.values(selectedTaps).reduce((acc, t) => acc + (parseFloat(t.price) || 0), 0) / quantity,
        finish: (selectedAnodizingColor ? parseFloat(selectedAdditionalServices.find(s => s.title.toLowerCase().includes('anodiz'))?.base_price || 15) : 0) / quantity,
        total: unitPrice
      },
      quantity: quantity
    });

    if (user) {
      navigate('/checkout');
    } else {
      navigate('/cart');
    }
  };
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
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isModelFadedManually, setIsModelFadedManually] = useState(false);

  const parsedDxfRef = useRef(null);
  const stepHolesDetectedRef = useRef(false);
  const stepViewerRef = useRef(null);
  const dxfViewerRef = useRef(null);
  const [viewBoxData, setViewBoxData] = useState(null);
  const viewerInstance = useRef(null);
  const dimensionsRef = useRef(null);
  const modelRef = useRef(null);
  const pendingAxisRef = useRef(null);


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
      return; // High-fidelity pricing guard établissements
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

  const onDrop = useCallback(async acceptedFiles => {
    setIsImporting(true);
    setImportProgress(0);

    const newFiles = await Promise.all(acceptedFiles.map(async file => {
      let tempPath = '';
      try {
        const fd = new FormData();
        fd.append('file', file);
        // Ensure we upload to the NODE API for world-class persistence Establishment
        const res = await fetch('/api/upload-asset', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) tempPath = data.tempPath;
      } catch (err) {
        console.error('File ingestion failed Establishment établissements:', err);
      }

      return {
        file,
        id: Math.random().toString(36).substr(2, 9),
        preview: URL.createObjectURL(file),
        tempPath: tempPath // Essential for world-class order finalization
      };
    }));

    setFiles(prev => [...prev, ...newFiles]);
    if (newFiles.length > 0) {
      setSelectedFile(newFiles[0]);
      setViewMode(is2DFile(newFiles[0].file.name) ? '2d' : '3d');
      setBackendData(null);
      setBackendError(null);
      modelRef.current = null;
    }
    setIsImporting(false);
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
          depthInches: defaultDepthIn,
          position: [c.x, c.y, c.z || 0]
        })));
        parsedDxfRef.current = parsed;

        // Always extract viewBox from SVG string if possible to ensure overlay alignment
        const match = svgStr.match(/viewBox="([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)"/);
        if (match) {
          const minX = parseFloat(match[1]);
          const minY = parseFloat(match[2]);
          const vbW = parseFloat(match[3]);
          const vbH = parseFloat(match[4]);
          setViewBoxData({ minX, minY, width: vbW, height: vbH });
          if (w === 0) w = vbW;
          if (ht === 0) ht = vbH;
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

        scene.add(new THREE.AmbientLight(0xffffff, 0.3));
        scene.add(new THREE.DirectionalLight(0xffffff, 1.0));

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
          else {
            setTimeout(() => {
              if (viewer && typeof viewer.FitToWindow === 'function') {
                viewer.FitToWindow();
                viewer.Render();
              }
            }, 150);
          }
          try {
            const v = viewer.GetViewer();
            const bb = OV.GetBoundingBox(m);
            const center = new THREE.Vector3((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2);

            v?.scene?.add(new THREE.AmbientLight(0xffffff, 0.3));
            v?.scene?.traverse(obj => {
              if (obj.isMesh && obj.material) {
                // Identify Native Hole Geometry
                // We check if the mesh's center (relative to model center) matches a detected hole
                if (detectedHoles.length > 0) {
                  const mBB = new THREE.Box3().setFromObject(obj);
                  const mCenter = new THREE.Vector3();
                  mBB.getCenter(mCenter);

                  // Convert mesh center in scene back to model local coordinates
                  const localPos = mCenter.clone().add(center);

                  const matchingHole = detectedHoles.find(h => {
                    const holePos = new THREE.Vector3(...h.position);
                    return localPos.distanceTo(holePos) < 1.0; // 1mm tolerance
                  });

                  if (matchingHole) {
                    obj.userData.nativeHoleId = matchingHole.id;
                    obj.userData.isNativeHole = true;
                  }
                }

                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                mats.forEach(m => {
                  m.roughness = 0.4;
                  m.metalness = 0.7;
                  if (m.color && !obj.userData.origColor) {
                    obj.userData.origColor = { r: m.color.r, g: m.color.g, b: m.color.b };
                  }
                });
              }
            });
          } catch { /* ignored */ }
          setModelLoadCount(c => c + 1);
          setTimeout(() => {
            if (viewer && typeof viewer.FitToWindow === 'function') {
              viewer.FitToWindow();
              viewer.Render();
            }
          }, 200);
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
  }, [selectedFile, viewMode, isQuoteFlowActive, detectedHoles]);

  const isTappingActive = selectedAdditionalServices.some(s => s.title.toLowerCase().includes('tap'));

  useEffect(() => {
    if (!viewerInstance.current || !isStepFile(selectedFile?.file?.name)) return;
    if (modelLoadCount === 0) return;
    const apply = () => {
      try {
        const v = viewerInstance.current?.GetViewer();
        if (!v?.scene) return;
        v.scene.traverse(obj => {
          if (!obj.isMesh || obj.userData.isHoleMarker) return;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((mat, idx) => {
            if (!mat?.color) return;
            if (!obj.userData._matCloned) {
              obj.material = Array.isArray(obj.material) ? obj.material.map(m => m.clone()) : obj.material.clone();
              obj.userData._matCloned = true;
            }
            const fm = Array.isArray(obj.material) ? obj.material[idx] : obj.material;
            if (!obj.userData.origColor) obj.userData.origColor = { r: fm.color.r, g: fm.color.g, b: fm.color.b };

            // Set base color (Tapping vs Anodizing vs Original)
            const isTapped = obj.userData.isNativeHole && selectedTaps[obj.userData.nativeHoleId];
            const isActive = obj.userData.isNativeHole && activeTapHole?.id === obj.userData.nativeHoleId;

            if (isTapped) {
              fm.color.set(0x4169e1); // Professional Royal Blue for tapped holes
              fm.emissive.set(0x000000);
              fm.emissiveIntensity = 0;
            } else if (isActive) {
              fm.color.set(0x000000); // Black for active hole
              fm.emissive.set(0x000000);
              fm.emissiveIntensity = 0;
            } else if (selectedAnodizingColor) {
              fm.color.set(selectedAnodizingColor.color);
              fm.emissive.set(0x000000);
              fm.emissiveIntensity = 0;
            } else {
              const oc = obj.userData.origColor;
              fm.color.setRGB(oc.r, oc.g, oc.b);
              fm.emissive.set(0x000000);
              fm.emissiveIntensity = 0;
            }

            // Standard Material properties
            fm.roughness = 0.4;
            fm.metalness = 0.7;

            // Fade logic: ONLY ghost when manually toggled OR actively configuring a specific hole
            const shouldFade = isModelFadedManually || (activeTapHole !== null && !isAnodizingModalOpen);

            // EXCEPTION: Native holes remain solid when the model is faded
            const finalFade = (shouldFade && !obj.userData.isNativeHole) ? true : false;

            fm.transparent = finalFade || fm.opacity < 1;
            fm.opacity = (shouldFade && !obj.userData.isNativeHole) ? 0.05 : 1.0;

            fm.needsUpdate = true;
          });
        });
        try { v.Render(); } catch { /* silent render error */ }
      } catch (err) { console.warn('Anodizing color error:', err); }
    };
    apply();
    const tid = setTimeout(apply, 200);
    return () => clearTimeout(tid);
  }, [selectedAnodizingColor, selectedFile?.file?.name, modelLoadCount, isTappingActive, activeTapHole, isAnodizingModalOpen, isModelFadedManually, detectedHoles, selectedTaps]);

  const holeMarkersRef = useRef([]);
  useEffect(() => {
    if (!viewerInstance.current || !isStepFile(selectedFile?.file?.name)) return;
    if (modelLoadCount === 0) return;

    const updateMarkers = () => {
      try {
        const v = viewerInstance.current?.GetViewer();
        if (!v?.scene) return;

        let modelParent = v.scene;
        for (const child of v.scene.children) {
          if (child.isGroup) { modelParent = child; break; }
        }

        holeMarkersRef.current.forEach(m => { m.parent?.remove(m); m.geometry?.dispose(); m.material?.dispose(); });
        holeMarkersRef.current = [];

        if (!isTappingActive || detectedHoles.length === 0) { try { v.Render(); } catch { /* silent render error */ } return; }

        const tapSvc = allServices.find(s => s.title.toLowerCase().includes('tap'));
        const tapOptions = tapSvc?.service_options || [];

        detectedHoles.forEach(hole => {
          if (!hole.position) return;
          const dia = hole.diameter_mm ? hole.diameter_mm / 25.4 : (hole.diameterInches || 0.1);
          const mmDia = dia * 25.4;

          // Safety Cap: Filter out accidental large features
          if (mmDia > 100.0) return;
          const isConfigured = tapOptions.some(tap => dia >= (parseFloat(tap.min_diameter) || 0) && dia <= (parseFloat(tap.max_diameter) || 0));
          const isTapped = !!selectedTaps[hole.id];
          const isActive = activeTapHole?.id === hole.id;

          let color = isConfigured ? 0x10b981 : 0xef4444;
          if (isTapped) color = 0x4169e1;
          if (isActive) color = 0xe31b23;

          const radius = mmDia / 2;

          // Unified "Hollow Tube" Geometry - Capped at EXACT part thickness
          const partT = dimensions?.mm?.t ? (parseFloat(dimensions.mm.t) || 2.0) : 2.0;
          let height = partT;

          // Use Open-Ended cylinder with DoubleSide material for "Hollow" look
          const safeRadius = Math.max(radius, 0.5);
          const geo = new THREE.CylinderGeometry(safeRadius, safeRadius, height, 32, 1, true);

          let mat;
          if (isTapped) {
            mat = new THREE.MeshBasicMaterial({ color, transparent: false, side: THREE.DoubleSide });
          } else {
            mat = new THREE.MeshPhongMaterial({
              color,
              emissive: isActive ? color : 0x000000,
              emissiveIntensity: isActive ? 4.0 : 0,
              shininess: 80,
              side: THREE.DoubleSide,
              transparent: false
            });
          }

          const sleeve = new THREE.Mesh(geo, mat);
          sleeve.position.set(hole.position[0], hole.position[1], hole.position[2]);

          if (hole.axis) {
            const pos = new THREE.Vector3(...hole.position);
            const axis = new THREE.Vector3(...hole.axis);
            sleeve.lookAt(pos.clone().add(axis));
            sleeve.rotateX(Math.PI / 2);
          } else {
            sleeve.rotateX(Math.PI / 2);
          }

          sleeve.userData = { isHoleMarker: true, hole: { ...hole, isConfigured } };
          modelParent.add(sleeve);
          holeMarkersRef.current.push(sleeve);
        });
        v.Render();
      } catch (err) { console.warn('Hole marker error:', err); }
    };

    updateMarkers();
    const tid = setTimeout(updateMarkers, 500);
    return () => clearTimeout(tid);
  }, [detectedHoles, selectedTaps, activeTapHole, isTappingActive, selectedFile?.file?.name, modelLoadCount, allServices, dimensions]);

  useEffect(() => {
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
      const intersects = raycaster.intersectObjects(holeMarkersRef.current, true);
      if (intersects.length > 0) {
        const clickedMarker = intersects[0].object;
        if (clickedMarker.userData.hole) {
          setActiveTapHole(clickedMarker.userData.hole);
        }
      }
    };

    viewerEl.addEventListener('click', onViewerClick);
    return () => {
      viewerEl.removeEventListener('click', onViewerClick);
    };
  }, [detectedHoles, activeTapHole, modelLoadCount, isTappingActive]);

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
        .row, .col-lg-3, .col-lg-4, .col-lg-5, .col-lg-6, .col-lg-9 { border: none !important; box-shadow: none !important; }
        .bg-light, .bg-light-subtle { background-color: #ffffff !important; }
        .border-light-subtle, .border-bottom, .border-end, .border-top { border: none !important; }
      `}</style>
      {!isQuoteFlowActive && (
        <header className="pricing-header text-center pt-4 pb-0 mb-0">
          <h1 className="fw-bold h2 text-uppercase letter-spacing-1">Get Instant Pricing</h1>
          {files.length === 0 && <p className="text-muted">Upload your CAD files to get an immediate quote for your project.</p>}
        </header>
      )}

      {files.length === 0 ? (
        <div className="upload-section pt-0 pb-5 mt-0">
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
                <div className="file-list-preview overflow-auto flex-grow-1 pe-2 py-2">
                  <AnimatePresence mode="popLayout">
                    {files.map(f => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        key={f.id}
                        className={`qf-mini-file-card p-3 rounded-4 d-flex align-items-center justify-content-between mb-3 cursor-pointer transition-all border-2 ${selectedFile?.id === f.id ? 'bg-white border-danger shadow-sm' : 'bg-white border-light-subtle hover-border-light shadow-xs'}`}
                        onClick={() => setSelectedFile(f)}
                        style={{ border: selectedFile?.id === f.id ? '2px solid #ef4444' : '2px solid #f1f5f9' }}
                      >
                        <div className="d-flex align-items-center gap-3 overflow-hidden">
                          <div className={`p-2 rounded-3 ${selectedFile?.id === f.id ? 'bg-danger text-white' : 'bg-light text-secondary'}`}>
                            <FileText size={18} />
                          </div>
                          <div className="d-flex flex-column overflow-hidden">
                            <span className="text-dark fw-bold small text-truncate">{f.file.name}</span>
                            <span className="text-muted" style={{ fontSize: '10px' }}>CAD MODEL</span>
                          </div>
                        </div>
                        {selectedFile?.id === f.id ? (
                          <div className="bg-danger rounded-circle p-1 text-white"><Check size={12} /></div>
                        ) : (
                          <X size={16} className="text-muted opacity-50 hover-opacity-100 flex-shrink-0" onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} />
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <button className="btn btn-light w-100 rounded-4 py-3 small fw-bold mt-3 transition-all d-flex align-items-center justify-content-center gap-2" {...getRootProps()}>
                  <Plus size={16} className="text-muted" /> Add more files
                </button>
              </div>
              <div className="col-lg-6 h-100 position-relative p-0 d-flex flex-column bg-white">
                <div className="qf-viewer-toolbar p-3 d-flex justify-content-between align-items-center gap-3 bg-transparent">
                  <div className="d-flex gap-2">
                    <div className="pill-toggle-container d-flex p-1 rounded-4 bg-white border shadow-xs" style={{ minWidth: '180px', position: 'relative' }}>
                      <motion.div
                        className="position-absolute bg-black rounded-3"
                        initial={false}
                        animate={{ x: viewMode === '3d' ? 0 : 85 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        style={{ width: '85px', height: 'calc(100% - 8px)', top: 4, left: 4 }}
                      />
                      <button className={`btn btn-sm px-0 py-2 flex-grow-1 fw-bold transition-all border-0 position-relative z-1 ${viewMode === '3d' ? 'text-white' : 'text-muted'}`} onClick={() => setViewMode('3d')}>3D VIEW</button>
                      <button className={`btn btn-sm px-0 py-2 flex-grow-1 fw-bold transition-all border-0 position-relative z-1 ${viewMode === '2d' ? 'text-white' : 'text-muted'}`} onClick={() => { setViewMode('2d'); handleUnfold(); }}>2D VIEW</button>
                    </div>
                    <div className="btn-group p-1 rounded-4 bg-white border shadow-xs">
                      {['top', 'front', 'side', 'flat'].map(ax => (
                        <button key={ax} className={`btn btn-sm px-3 py-2 text-uppercase fw-bold transition-all rounded-3 d-flex align-items-center gap-1 border-0 ${activeAxis === ax ? 'bg-danger text-white' : 'bg-transparent text-muted hover-bg-light'}`}
                          onClick={() => { setActiveAxis(ax); setAxisCamera(ax); }}>
                          {ax}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pill-toggle-container d-flex p-1 rounded-4 bg-white shadow-sm border border-black border-opacity-5" style={{ minWidth: '110px', position: 'relative' }}>
                    <motion.div
                      className="position-absolute bg-black rounded-3"
                      initial={false}
                      animate={{ x: unit === 'mm' ? 0 : 50 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      style={{ width: '50px', height: 'calc(100% - 8px)', top: 4, left: 4 }}
                    />
                    <button className={`btn btn-sm px-0 py-2 flex-grow-1 fw-bold transition-all border-0 position-relative z-1 ${unit === 'mm' ? 'text-white' : 'text-muted'}`} onClick={() => setUnit('mm')}>MM</button>
                    <button className={`btn btn-sm px-0 py-2 flex-grow-1 fw-bold transition-all border-0 position-relative z-1 ${unit === 'inch' ? 'text-white' : 'text-muted'}`} onClick={() => setUnit('inch')}>INCH</button>
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
              <div className="col-lg-3 h-100 p-4 d-flex flex-column bg-white border-end">
                <div className="qf-info-panel h-100 d-flex flex-column">
                  <div className="mb-4 d-flex align-items-center gap-2">
                    <Info size={18} className="text-secondary" />
                    <h2 className="fs-6 fw-bold m-0 letter-spacing-1">MODEL DIMENSIONS</h2>
                  </div>

                  {dimensions ? (
                    <>
                      <div className="flex-grow-1 pe-2">
                        <div className="mb-4">
                          <div className="d-flex align-items-center gap-2 mb-3">
                            <span className="text-muted fw-black text-uppercase letter-spacing-2" style={{ fontSize: '10px' }}>{unit === 'mm' ? 'Metric Dims' : 'Imperial Dims'}</span>
                            <div className="flex-grow-1 border-bottom border-light-subtle opacity-50" />
                          </div>
                          <div className="d-flex flex-column gap-1">
                            {[
                              { label: 'Length', symbol: '(L)', key: 'l', color: 'dark' },
                              { label: 'Width', symbol: '(W)', key: 'w', color: 'dark' },
                              { label: 'Thickness', symbol: '(T)', key: 't', color: 'danger' }
                            ].map(item => (
                              <div key={item.key} className="d-flex justify-content-between align-items-end py-2 border-bottom border-light-subtle border-opacity-50">
                                <div className="d-flex flex-column">
                                  <span className="text-muted fw-black text-uppercase letter-spacing-1 text-xxs">{item.label}</span>
                                  <span className="text-secondary fw-bold text-xxs opacity-75">{item.symbol}</span>
                                </div>
                                <div className="text-end">
                                  <span className={`fs-4 fw-black text-${item.color} d-block line-height-1`}>
                                    {unit === 'mm' ? dimensions.mm[item.key] : dimensions.inches[item.key]}
                                  </span>
                                  <span className="text-muted fw-bold text-uppercase text-xxs">{unit}</span>
                                </div>
                              </div>
                            ))}
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

                  {/* Premium Vibrant Legend */}
                  {isTappingActive && currentIsStep && (
                    <div
                      className="position-absolute p-2 rounded-3 border"
                      style={{
                        top: '12px',
                        right: '12px',
                        zIndex: 20,
                        background: 'rgba(255, 255, 255, 0.7)',
                        backdropFilter: 'blur(8px)',
                        borderColor: 'rgba(0, 0, 0, 0.05)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        width: 'max-content'
                      }}
                    >
                      <div className="d-flex flex-column gap-1">
                        <div className="d-flex align-items-center gap-2 small fw-bold">
                          <div className="rounded-circle" style={{ width: '10px', height: '10px', background: '#4169e1' }} />
                          <span style={{ fontSize: '10px', letterSpacing: '0.5px' }}>TAPPED</span>
                        </div>
                        <div className="d-flex align-items-center gap-2 small fw-bold">
                          <div className="rounded-circle" style={{ width: '10px', height: '10px', background: '#10b981' }} />
                          <span style={{ fontSize: '10px', letterSpacing: '0.5px' }}>COMPATIBLE</span>
                        </div>
                        <div className="d-flex align-items-center gap-2 small fw-bold">
                          <div className="rounded-circle" style={{ width: '10px', height: '10px', background: '#ef4444' }} />
                          <span style={{ fontSize: '10px', letterSpacing: '0.5px' }}>INELIGIBLE</span>
                        </div>
                        <div className="d-flex align-items-center gap-2 small fw-bold">
                          <div className="rounded-circle" style={{ width: '10px', height: '10px', background: '#000000' }} />
                          <span style={{ fontSize: '10px', letterSpacing: '0.5px' }}>SELECTED</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {viewMode === '2d' && currentIsStep && (backendData ? <FlatPatternViewer geometries={[]} options={{ highlightBends }} backendData={backendData} sourceFlatData={null} formatKind="drawing" holes={detectedHoles} activeHoleId={activeTapHole?.id} /> : <div className="p-5 text-center">Preparing...</div>)}
                  {currentIsDxf && (
                    <div className="dxf-svg-wrapper h-100 w-100 d-flex align-items-center justify-content-center p-3 position-relative overflow-hidden">
                      {dxfSvg ? (
                        <div className="position-relative d-flex align-items-center justify-content-center" style={{ width: '100%', height: '100%' }}>
                          <style>{`
                            .dxf-svg-content { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
                            .dxf-svg-content svg { width: 100% !important; height: 100% !important; max-width: 100%; max-height: 100%; }
                            .dxf-svg-content svg * {
                              fill: ${selectedAnodizingColor ? (selectedAnodizingColor.color || selectedAnodizingColor.hex || 'rgba(0,0,0,0.4)') : 'rgba(0,0,0,0.05)'} !important;
                              fill-opacity: ${(isModelFadedManually || (activeTapHole !== null && !isAnodizingModalOpen)) ? 0.05 : (selectedAnodizingColor ? 0.8 : 0.1)} !important;
                              stroke: ${selectedAnodizingColor ? (selectedAnodizingColor.color || selectedAnodizingColor.hex) : '#000'} !important;
                              stroke-opacity: ${(isModelFadedManually || (activeTapHole !== null && !isAnodizingModalOpen)) ? 0.1 : 1.0} !important;
                              stroke-width: 2px !important;
                              transition: all 0.3s ease;
                            }
                            /* Native Hole Highlighting */
                            ${detectedHoles.map(hole => {
                            const isTapped = !!selectedTaps[hole.id];
                            const isActive = activeTapHole?.id === hole.id;
                            if (!isTapped && !isActive) return '';

                            // Target native SVG circles by proximity/attributes if possible, 
                            // or use the overlay approach but pinned perfectly.
                            // Since DXF SVGs can be complex, we'll keep the overlay but 
                            // remove its 'Marker' feel to make it look native.
                            return '';
                          }).join('')}
                          `}</style>

                          <div className="dxf-svg-content" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: dxfSvg }} />

                          {/* 2D Tapping Markers Overlay */}
                          {viewBoxData && (
                            <svg
                              viewBox={`${viewBoxData.minX} ${viewBoxData.minY} ${viewBoxData.width} ${viewBoxData.height}`}
                              className="position-absolute inset-0 pointer-events-none"
                              style={{ width: '100%', height: '100%', zIndex: 10, left: 0, top: 0 }}
                            >
                              <defs>
                                <radialGradient id="neonGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                                  <stop offset="0%" style={{ stopColor: '#006064', stopOpacity: 1 }} />
                                  <stop offset="70%" style={{ stopColor: '#00b8d4', stopOpacity: 1 }} />
                                  <stop offset="100%" style={{ stopColor: '#00f2ff', stopOpacity: 0.9 }} />
                                </radialGradient>
                              </defs>
                              <g transform={`translate(0, ${viewBoxData.minY * 2 + viewBoxData.height}) scale(1, -1)`}>
                                {detectedHoles.map(hole => {
                                  const mmDia = (hole.diameterInches || 0.1) * 25.4;
                                  if (mmDia > 100.0) return null;
                                  const isTapped = !!selectedTaps[hole.id];
                                  const isActive = activeTapHole?.id === hole.id;

                                  if (!isTapped && !isActive) return null;

                                  let color = isTapped ? 'url(#neonGradient)' : '#000000';

                                  return (
                                    <circle
                                      key={hole.id}
                                      cx={hole.position[0]}
                                      cy={hole.position[1]}
                                      r={(mmDia / 2) * 1.02}
                                      fill={color}
                                      fillOpacity={1.0}
                                      stroke="none"
                                      style={{
                                        transition: 'all 0.3s ease',
                                        cursor: 'pointer',
                                        pointerEvents: 'auto',
                                        filter: isTapped ? 'drop-shadow(0 0 2px rgba(0, 255, 234, 0.4))' : 'none'
                                      }}
                                      onClick={() => setActiveTapHole(hole)}
                                    />
                                  );
                                })}
                              </g>
                            </svg>
                          )}

                        </div>
                      ) : <div>Parsing...</div>}
                    </div>
                  )}
                  <div className="qf-view-toggles-simple position-absolute bottom-0 start-50 translate-middle-x mb-4 bg-white p-2 rounded-pill d-flex gap-1 border shadow-sm z-3" style={{ minWidth: '360px' }}>
                    <button
                      className="btn btn-sm rounded-pill flex-grow-1 py-2 fw-bold transition-all border-0"
                      style={{ backgroundColor: viewMode === '3d' ? '#000' : 'transparent', color: viewMode === '3d' ? '#fff' : '#666' }}
                      onClick={() => setViewMode('3d')}
                    >
                      3D VIEW
                    </button>
                    <button
                      className="btn btn-sm rounded-pill flex-grow-1 py-2 fw-bold transition-all border-0"
                      style={{ backgroundColor: viewMode === '2d' ? '#000' : 'transparent', color: viewMode === '2d' ? '#fff' : '#666' }}
                      onClick={() => { setViewMode('2d'); handleUnfold(); }}
                    >
                      2D FLAT
                    </button>
                    <div className="vr mx-1 my-1" style={{ width: '1px', opacity: 0.2 }}></div>
                    <button
                      className="btn btn-sm rounded-pill flex-grow-1 py-2 fw-bold transition-all border-0 px-3 text-uppercase"
                      style={{
                        backgroundColor: isModelFadedManually ? '#ef4444' : 'transparent',
                        color: isModelFadedManually ? '#fff' : '#666',
                        fontSize: '10px'
                      }}
                      onClick={() => setIsModelFadedManually(!isModelFadedManually)}
                    >
                      {isModelFadedManually ? 'Unfade Model' : 'Fade Model'}
                    </button>
                  </div>
                </div>
                {dimensions && (
                  <div className="qf-quick-dims p-5 border-top bg-light-subtle" style={{ minHeight: '25%' }}>
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <h4 className="fs-6 fw-bold m-0 text-uppercase text-muted letter-spacing-1">{unit === 'mm' ? 'Metric Dims' : 'Imperial Dims'}</h4>
                      <div className="btn-group p-1 rounded-3 bg-white shadow-sm border border-black border-opacity-5">
                        <button className={`btn btn-xs px-2 py-1 fw-bold transition-all rounded-2 border-0 ${unit === 'mm' ? 'bg-black text-white' : 'bg-transparent text-muted hover-bg-light'}`} style={{ fontSize: '9px' }} onClick={() => setUnit('mm')}>MM</button>
                        <button className={`btn btn-xs px-2 py-1 fw-bold transition-all rounded-2 border-0 ${unit === 'inch' ? 'bg-black text-white' : 'bg-transparent text-muted hover-bg-light'}`} style={{ fontSize: '9px' }} onClick={() => setUnit('inch')}>INCH</button>
                      </div>
                    </div>
                    <div className="row g-3">
                      <div className="col-6">
                        <span className="text-muted d-block small mb-0 fw-bold">Length (L):</span>
                        <strong className="fs-5 d-block text-dark fw-extrabold">{unit === 'mm' ? dimensions.mm.l : dimensions.inches.l} {unit}</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block small mb-0 fw-bold">Width (W):</span>
                        <strong className="fs-5 d-block text-dark fw-extrabold">{unit === 'mm' ? dimensions.mm.w : dimensions.inches.w} {unit}</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block small mb-0 fw-bold text-danger">Thickness (T):</span>
                        <strong className="fs-5 d-block text-danger fw-extrabold">{unit === 'mm' ? dimensions.mm.t : dimensions.inches.t} {unit}</strong>
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
                          <button
                            key={svc.id}
                            disabled={!fits}
                            className={`btn text-start p-5 rounded-5 border-2 transition-all d-flex flex-column gap-3 position-relative ${fits
                              ? 'bg-white border-light-subtle shadow-sm hover-shadow hover-translate-y'
                              : 'bg-light opacity-50 cursor-not-allowed grayscale'
                              }`}
                            style={{
                              border: fits ? '2px solid #f8f9fa' : '2px solid transparent',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            onClick={() => setSelectedProductionService(svc)}
                          >
                            <div className="d-flex justify-content-between align-items-center w-100">
                              <div className="d-flex align-items-center gap-3">
                                <div className={`p-3 rounded-4 ${fits ? 'bg-danger bg-opacity-10 text-danger' : 'bg-secondary bg-opacity-10 text-muted'}`}>
                                  {svc.title.toLowerCase().includes('cnc') ? <Box size={24} /> : <Zap size={24} />}
                                </div>
                                <strong className={`fs-3 d-block m-0 ${fits ? 'text-dark' : 'text-muted'}`}>{svc.title}</strong>
                              </div>
                              {!fits && (
                                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 rounded-pill px-3 py-2 small fw-bold">
                                  CAPACITY EXCEEDED
                                </span>
                              )}
                              {fits && (
                                <div className="text-danger opacity-0 hover-opacity-100 transition-all">
                                  <ArrowRight size={20} />
                                </div>
                              )}
                            </div>
                            <span className="fs-6 text-muted opacity-75 fw-medium leading-relaxed max-w-md">
                              {svc.description}
                            </span>
                            {!fits && (
                              <span className="mt-auto pt-2 text-danger small fw-bold d-flex align-items-center gap-2">
                                <AlertCircle size={14} /> {reason}
                              </span>
                            )}
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
                    <div className="d-flex flex-column gap-2">
                      {allMetals.filter(m => m.services?.includes(selectedProductionService.id)).map(metal => (
                        <button
                          key={metal.id}
                          className="btn btn-white text-dark text-start p-4 rounded-4 border-2 transition-all d-flex align-items-center justify-content-between hover-shadow-sm group border-light-subtle hover-border-danger bg-white"
                          style={{ transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}
                          onClick={() => setSelectedMetal(metal)}
                        >
                          <div className="d-flex align-items-center gap-3">
                            <div className="p-3 bg-light rounded-4 group-hover-bg-danger group-hover-bg-opacity-10 transition-all border border-transparent group-hover-border-danger group-hover-border-opacity-10">
                              <Shield size={20} className="text-secondary group-hover-text-danger transition-all opacity-75" />
                            </div>
                            <div className="d-flex flex-column">
                              <span className="fw-extrabold text-uppercase letter-spacing-1 small d-block mb-1">{metal.name}</span>
                              <div className="d-flex align-items-center gap-2">
                                <span className="bg-light px-2 py-0.5 rounded text-muted font-monospace" style={{ fontSize: '9px', letterSpacing: '0.5px' }}>PREMIUM GRADE</span>
                                <div className="rounded-circle bg-success" style={{ width: '6px', height: '6px' }} />
                                <span className="text-muted" style={{ fontSize: '9px' }}>IN STOCK</span>
                              </div>
                            </div>
                          </div>
                          <div className="opacity-0 group-hover-opacity-100 transition-all text-danger translate-x-1 group-hover-translate-x-0 me-2">
                            <ArrowRight size={20} />
                          </div>
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
                        const isTap = svc.title.toLowerCase().includes('tap');
                        const isAnodiz = svc.title.toLowerCase().includes('anodiz');

                        return (
                          <div key={svc.id} className={`position-relative rounded-4 border-2 p-4 transition-all ${isSelected ? 'border-danger bg-danger bg-opacity-5' : 'border-light bg-white hover-bg-light shadow-none'}`}>
                            <div className="d-flex align-items-center gap-3 cursor-pointer" onClick={() => {
                              const title = svc.title.toLowerCase();
                              if (title.includes('anodiz')) {
                                if (!isSelected) { setSelectedAdditionalServices(p => [...p, svc]); setIsAnodizingModalOpen(true); }
                                else { setSelectedAdditionalServices(p => p.filter(x => x.id !== svc.id)); setSelectedAnodizingColor(null); }
                              } else if (title.includes('tap')) {
                                if (!isSelected) {
                                  setSelectedAdditionalServices(p => [...p, svc]);
                                  if (detectedHoles.length > 0) setActiveTapHole(detectedHoles[0]);
                                } else {
                                  setSelectedAdditionalServices(p => p.filter(x => x.id !== svc.id)); setSelectedTaps({}); setActiveTapHole(null);
                                }
                              } else {
                                setSelectedAdditionalServices(p => isSelected ? p.filter(x => x.id !== svc.id) : [...p, svc]);
                              }
                            }}>
                              <div className={`rounded-circle border d-flex align-items-center justify-content-center ${isSelected ? 'bg-white border-white text-danger' : 'bg-white border-secondary border-opacity-25'}`} style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                                {isSelected ? <Check size={16} strokeWidth={4} /> : <div />}
                              </div>
                              <div className="flex-grow-1 overflow-hidden">
                                <strong className={`d-block fs-5 fw-black ${isSelected ? 'text-white' : 'text-dark'}`}>{svc.title}</strong>
                                <p className={`m-0 text-truncate ${isSelected ? 'text-white opacity-80' : 'text-muted'}`} style={{ fontSize: '12px' }}>{svc.description || 'Premium process'}</p>
                              </div>
                            </div>

                            {isSelected && isTap && detectedHoles.length > 0 && (
                              <div className="mt-4 pt-3 border-top border-white border-opacity-20 d-flex justify-content-between align-items-center animate-fade-in">
                                <div className="d-flex gap-5">
                                  <div className="d-flex flex-column">
                                    <span className="text-white opacity-60 fw-bold" style={{ fontSize: '10px', letterSpacing: '1px' }}>HOLES</span>
                                    <span className="fw-black text-white fs-4">{detectedHoles.length}</span>
                                  </div>
                                  <div className="d-flex flex-column">
                                    <span className="text-white opacity-60 fw-bold" style={{ fontSize: '10px', letterSpacing: '1px' }}>TAPPED</span>
                                    <span className={`fw-black fs-4 ${Object.keys(selectedTaps).length === detectedHoles.length ? 'text-white' : 'text-white'}`}>
                                      {Object.keys(selectedTaps).length}
                                    </span>
                                  </div>
                                </div>
                                <button className="btn btn-white btn-sm rounded-pill px-4 fw-black shadow-sm text-danger h-auto py-2" style={{ fontSize: '12px', background: 'white', border: 'none' }} onClick={(e) => { e.stopPropagation(); setActiveTapHole(detectedHoles[0]); }}>
                                  MANAGE
                                </button>
                              </div>
                            )}

                            {isSelected && isAnodiz && selectedAnodizingColor && (
                              <div className="mt-4 pt-3 border-top border-white border-opacity-20 d-flex justify-content-between align-items-center animate-fade-in">
                                <div className="d-flex align-items-center gap-3">
                                  <div className="rounded-circle shadow-lg" style={{ backgroundColor: selectedAnodizingColor.color, width: '24px', height: '24px', border: '3px solid white' }} />
                                  <span className="fw-black text-white fs-6">{selectedAnodizingColor.name.toUpperCase()}</span>
                                </div>
                                <button className="btn btn-link text-white p-0 text-decoration-none small fw-black fs-6" onClick={(e) => { e.stopPropagation(); setIsAnodizingModalOpen(true); }}>CHANGE</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="col-lg-3 h-100 p-4 overflow-hidden bg-white border-start">
                {selectedMetal ? (
                  <div className="animate-fade-in d-flex flex-column h-100">
                    <div className="bg-white p-3 rounded-4 mb-2 border border-light shadow-none">
                      <label className="d-block fw-bold text-muted small text-uppercase mb-2 letter-spacing-1">Order Quantity</label>
                      <div className="d-flex align-items-center bg-light-subtle rounded-4 p-1 overflow-hidden border">
                        <button className="btn btn-white border-0 rounded-3 shadow-none p-2" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={14} /></button>
                        <input type="number" className="form-control text-center fw-bold fs-5 border-0 bg-transparent shadow-none" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
                        <button className="btn btn-white border-0 rounded-3 shadow-none p-2" onClick={() => setQuantity(quantity + 1)}><Plus size={14} /></button>
                      </div>
                    </div>

                    <div className="flex-grow-1 overflow-auto hide-scrollbar pe-1">
                      {allDiscounts.length > 0 && (
                        <div className="mb-3">
                          <span className="text-muted d-block mb-2 fw-black text-uppercase letter-spacing-2" style={{ fontSize: '11px' }}>Volume Discounts</span>
                          <div className="d-flex flex-column gap-1">
                            {(() => {
                              const targetQuantities = [2, 10, 50, 100, 1000];
                              const activeTiers = targetQuantities.filter(q =>
                                allDiscounts.some(d => (d.quantities || []).some(trigger => trigger <= q))
                              );

                              if (activeTiers.length === 0) {
                                return <span className="text-muted small italic">No active discounts</span>;
                              }

                              return activeTiers.map(qty => {
                                const applicableTiers = allDiscounts.filter(d => (d.quantities || []).some(q => q <= qty));
                                if (applicableTiers.length === 0) return null;
                                const bestTier = applicableTiers.reduce((prev, current) =>
                                  (prev.discount_percent > current.discount_percent) ? prev : current
                                );

                                return (
                                  <div key={qty} className="bg-light px-3 py-2 rounded-3 border border-light-subtle d-flex justify-content-between align-items-center">
                                    <span className="small fw-bold text-dark">{qty}+ UNITS</span>
                                    <span className="small fw-black text-danger">{bestTier.discount_percent}% OFF</span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-dark text-white p-4 pb-5 rounded-5 shadow-22xl position-relative overflow-hidden mb-3 mt-auto" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
                      <div className="position-relative z-1">
                        <div className="mb-4">
                          <span className="small text-white opacity-50 fw-bold text-uppercase letter-spacing-1 d-block mb-3">Project Breakdown</span>
                          <div className="d-flex flex-column gap-3 mb-4 p-4 rounded-4 border border-white border-opacity-10" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                            <div className="d-flex justify-content-between align-items-center">
                              <div className="d-flex flex-column">
                                <span className="opacity-70 small">Fabrication Total</span>
                                <span className="text-white-50" style={{ fontSize: '10px' }}>Base manufacturing cost</span>
                              </div>
                              <span className="fw-black fs-5">${(parseFloat(priceEstimate || 0)).toFixed(2)}</span>
                            </div>

                            {Object.keys(selectedTaps).length > 0 && (
                              <div className="d-flex justify-content-between align-items-center pt-2 border-top border-white border-opacity-10 text-danger">
                                <div className="d-flex flex-column">
                                  <span className="opacity-90 fw-bold small">Tapping ({Object.keys(selectedTaps).length} holes)</span>
                                  <span className="opacity-50" style={{ fontSize: '10px' }}>Flat-rate processing fee</span>
                                </div>
                                <span className="fw-black fs-5">+${(Object.values(selectedTaps).reduce((acc, t) => acc + (parseFloat(t.price) || 0), 0)).toFixed(2)}</span>
                              </div>
                            )}

                            {(() => {
                              const anoSvc = selectedAdditionalServices.find(s => s.title.toLowerCase().includes('anodiz'));
                              const anoPrice = parseFloat(anoSvc?.base_price || 15);
                              if (!selectedAnodizingColor) return null;
                              return (
                                <div className="d-flex justify-content-between align-items-center pt-2 border-top border-white border-opacity-10 text-info">
                                  <div className="d-flex flex-column">
                                    <span className="opacity-90 fw-bold small">Anodizing Finish</span>
                                    <span className="opacity-50" style={{ fontSize: '10px' }}>Flat-rate batch treatment</span>
                                  </div>
                                  <span className="fw-black fs-5">+${(anoPrice).toFixed(2)}</span>
                                </div>
                              );
                            })()}
                          </div>

                          <div className="text-center">
                            <span className="small text-white fw-bold text-uppercase letter-spacing-1 d-block mb-1">Total Project Estimate</span>
                            <div className="d-flex align-items-baseline justify-content-center gap-2">
                              <span className="fs-4 text-danger fw-black">$</span>
                              <strong className="fs-huge fw-black text-danger">
                                {(
                                  parseFloat(priceEstimate || 0) +
                                  Object.values(selectedTaps).reduce((acc, t) => acc + (parseFloat(t.price) || 0), 0) +
                                  (selectedAnodizingColor ? parseFloat(selectedAdditionalServices.find(s => s.title.toLowerCase().includes('anodiz'))?.base_price || 15) : 0)
                                ).toFixed(2)}
                              </strong>
                            </div>
                          </div>
                        </div>
                        <button
                          className="btn btn-danger w-100 py-3 rounded-4 fw-bold fs-6 shadow-lg border-0 transition-all hover-translate-y d-flex align-items-center justify-content-center gap-2 hover-bg-danger-dark"
                          onClick={handleProceedToReview}
                          disabled={isImporting || !selectedFile?.tempPath}
                        >
                          {isImporting ? (
                            <><Loader2 size={18} className="animate-spin" /> UPLOADING ASSET...</>
                          ) : (
                            <>{selectedFile?.tempPath ? 'PROCEED TO REVIEW' : 'WAITING FOR UPLOAD...'}<ArrowRight size={18} className="opacity-75" /></>
                          )}
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
                    <div className="w-100 d-flex flex-column gap-0 max-w-sm position-relative">
                      <div className="position-absolute border-start border-2 border-light-subtle h-100" style={{ left: '12px', top: '10px', zIndex: 0 }} />
                      <div className="d-flex align-items-center gap-3 mb-4 position-relative z-1">
                        <div className={`rounded-circle d-flex align-items-center justify-content-center shadow-sm ${selectedProductionService ? 'bg-success text-white' : 'bg-white border-2 border-light-subtle'}`} style={{ width: '26px', height: '26px' }}>
                          {selectedProductionService ? <Check size={14} /> : <div className="rounded-circle bg-light" style={{ width: '8px', height: '8px' }} />}
                        </div>
                        <div className="d-flex flex-column">
                          <span className={`fw-bold small ${selectedProductionService ? 'text-dark' : 'text-muted'}`}>Production Method</span>
                          <span className="text-muted" style={{ fontSize: '10px' }}>{selectedProductionService ? selectedProductionService.title : 'Pending Selection'}</span>
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-3 position-relative z-1">
                        <div className={`rounded-circle d-flex align-items-center justify-content-center shadow-sm ${selectedMetal ? 'bg-success text-white' : 'bg-white border-2 border-light-subtle'}`} style={{ width: '26px', height: '26px' }}>
                          {selectedMetal ? <Check size={14} /> : <div className="rounded-circle bg-light" style={{ width: '8px', height: '8px' }} />}
                        </div>
                        <div className="d-flex flex-column">
                          <span className={`fw-bold small ${selectedMetal ? 'text-dark' : 'text-muted'}`}>Material Selection</span>
                          <span className="text-muted" style={{ fontSize: '10px' }}>{selectedMetal ? selectedMetal.name : 'Pending Selection'}</span>
                        </div>
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
          <motion.div key="tap-modal" className="position-fixed inset-0 bg-black-80 d-flex align-items-center justify-content-center z-10000" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ backdropFilter: 'blur(12px)' }}>
            <motion.div className="bg-white rounded-5 shadow-22xl overflow-hidden d-flex flex-column" style={{ width: '90%', maxWidth: '1100px', height: '85vh', border: '1px solid rgba(0,0,0,0.05)', position: 'relative', zIndex: 10001 }} initial={{ scale: 0.95, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 30, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
              <div className="p-5 border-bottom d-flex justify-content-between align-items-center bg-white">
                <div>
                  <h3 className="fw-black fs-2 m-0 text-dark letter-spacing-1">HOLE THREADING CONFIG</h3>
                  <div className="d-flex align-items-center gap-3 mt-2">
                    <span className="badge bg-danger bg-opacity-10 text-danger rounded-pill px-3 py-1 fw-bold small">HOLE #{activeTapHole.id + 1}</span>
                    <span className="text-muted small fw-bold text-uppercase letter-spacing-2">Diameter: {Number(activeTapHole.diameterInches || 0).toFixed(4)}&quot; ({Number((activeTapHole.diameterInches || 0) * 25.4).toFixed(3)} mm)</span>
                  </div>
                </div>
                <button className="btn-close action-btn-hover p-3 rounded-circle shadow-none" onClick={() => setActiveTapHole(null)} />
              </div>

              <div className="flex-grow-1 d-flex overflow-hidden bg-white">
                <div className="border-end bg-light-subtle bg-opacity-20 p-4 overflow-auto hide-scrollbar" style={{ width: '320px' }}>
                  <div className="mb-4 px-2 d-flex justify-content-between align-items-center">
                    <h4 className="small fw-black text-muted text-uppercase letter-spacing-2 m-0">Detected Holes</h4>
                    <span className="badge bg-white border text-muted rounded-pill px-2 py-1 fw-bold" style={{ fontSize: '9px' }}>{detectedHoles.length}</span>
                  </div>
                  {detectedHoles.map((hole, i) => {
                    const isTapped = !!selectedTaps[hole.id];
                    const isActive = activeTapHole?.id === hole.id;
                    const tapSvc = allServices.find(s => s.title.toLowerCase().includes('tap'));
                    const isConfigured = (tapSvc?.service_options || []).some(tap => (hole.diameterInches || 0) >= (parseFloat(tap.min_diameter) || 0) && (hole.diameterInches || 0) <= (parseFloat(tap.max_diameter) || 0));

                    return (
                      <motion.div key={hole.id} layout className={`p-4 rounded-4 mb-2 cursor-pointer border-2 transition-all d-flex align-items-center justify-content-between ${isActive ? 'border-danger bg-danger text-white shadow-md' : 'border-transparent bg-white hover-bg-light shadow-xs'}`} onClick={() => setActiveTapHole(hole)} whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
                        <div className="d-flex align-items-center gap-3">
                          <div className={`rounded-circle d-flex align-items-center justify-content-center ${isActive ? 'bg-white text-danger' : isTapped ? 'bg-success text-white' : 'bg-light text-muted'}`} style={{ width: '32px', height: '32px' }}>
                            <span className="fw-black" style={{ fontSize: '12px' }}>{i + 1}</span>
                          </div>
                          <div className="d-flex flex-column">
                            <span className={`fw-black text-truncate ${isActive ? 'text-white' : 'text-dark'}`} style={{ fontSize: '13px', maxWidth: '180px' }}>{isTapped ? selectedTaps[hole.id].name : 'Not Tapped'}</span>
                            <span className={`${isActive ? 'text-white' : 'text-muted'} fw-bold`} style={{ fontSize: '11px' }}>DIA: {Number(hole.diameterInches || 0).toFixed(3)}&quot;</span>
                          </div>
                        </div>
                        {isTapped && !isActive && <Check size={16} className="text-success" strokeWidth={3} />}
                        {!isConfigured && !isTapped && <AlertCircle size={16} className={isActive ? 'text-white ripple-infinite' : 'text-danger opacity-60'} />}
                      </motion.div>
                    );
                  })}
                </div>

                <div className="flex-grow-1 p-5 overflow-auto bg-white hide-scrollbar">
                  {(() => {
                    const svc = selectedAdditionalServices.find(s => s.title.toLowerCase().includes('tap'));
                    if (!svc) return <div className="text-center py-5 text-danger fw-bold fs-5">Tapping service not added to selection</div>;
                    const assigned = selectedTaps[activeTapHole.id];
                    const dia = activeTapHole.diameterInches || 0;
                    const options = svc.service_options || [];
                    const compatible = options.filter(tap => dia >= (parseFloat(tap.min_diameter) || 0) && dia <= (parseFloat(tap.max_diameter) || 0));
                    const incompatible = options.filter(tap => !compatible.includes(tap));

                    return (
                      <div className="animate-fade-in">
                        {compatible.length > 0 && (
                          <div className="mb-5">
                            <h4 className="fw-black text-muted mb-4 d-flex align-items-center gap-2" style={{ fontSize: '11px', letterSpacing: '2px' }}><Check size={14} className="text-success" /> RECOMMENDED TAPS</h4>
                            <div className="d-grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                              {compatible.map((tap, idx) => {
                                const isChosen = assigned?.name === tap.name;
                                return (
                                  <motion.button key={idx} className={`btn text-start p-4 rounded-4 border-2 transition-all d-flex align-items-center gap-3 ${isChosen ? 'border-danger bg-danger text-white shadow-danger' : 'bg-white border-light-subtle shadow-xs tap-option-card-hover'}`} onClick={() => setSelectedTaps(prev => ({ ...prev, [activeTapHole.id]: { ...tap, hole: activeTapHole } }))} whileTap={{ scale: 0.98 }}>
                                    <div className={`p-3 rounded-4 ${isChosen ? 'bg-white text-danger' : 'bg-light text-muted'}`}>
                                      <Settings size={20} className={isChosen ? 'animate-spin-slow' : ''} />
                                    </div>
                                    <div className="flex-grow-1">
                                      <div className="d-flex justify-content-between align-items-start">
                                        <strong className={`d-block fs-6 fw-black mb-1 ${isChosen ? 'text-white' : 'text-dark'}`}>{tap.name}</strong>
                                        {isChosen && <div className="bg-success rounded-circle p-1 text-white shadow-sm d-flex align-items-center justify-content-center" style={{ width: '22px', height: '22px' }}><Check size={12} strokeWidth={4} /></div>}
                                      </div>
                                      <div className="d-flex align-items-center gap-2">
                                        <span className={`fw-bold font-monospace ${isChosen ? 'text-white opacity-80' : 'text-muted'}`} style={{ fontSize: '10px' }}>{tap.min_diameter}&quot; - {tap.max_diameter}&quot;</span>
                                        <div className={`rounded-circle ${isChosen ? 'bg-white opacity-40' : 'bg-light-subtle'}`} style={{ width: '3px', height: '3px' }} />
                                        <span className={`fw-black ${isChosen ? 'text-white ripple-infinite' : 'text-danger'}`} style={{ fontSize: '11px' }}>+${tap.price || '0.00'}/HOLE</span>
                                      </div>
                                    </div>
                                  </motion.button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {incompatible.length > 0 && (
                          <div>
                            <h4 className="fw-black text-muted fs-6 mb-4 d-flex align-items-center gap-2 opacity-50" style={{ letterSpacing: '2px' }}><AlertTriangle size={18} /> INCOMPATIBLE TAP SIZES (SELECTABLE WITH WARNING)</h4>
                            <div className="d-grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                              {incompatible.map((tap, idx) => {
                                const isChosen = assigned?.name === tap.name;
                                return (
                                  <motion.button key={idx} className={`btn text-start p-4 rounded-4 border-2 transition-all d-flex align-items-center gap-3 ${isChosen ? 'border-warning bg-warning shadow-warning' : 'bg-white border-light-subtle shadow-xs op-hover-100'}`} onClick={() => setSelectedTaps(prev => ({ ...prev, [activeTapHole.id]: { ...tap, hole: activeTapHole } }))} whileTap={{ scale: 0.98 }}>
                                    <div className={`p-3 rounded-4 ${isChosen ? 'bg-white text-warning' : 'bg-light text-muted'}`}>
                                      <AlertCircle size={20} />
                                    </div>
                                    <div className="flex-grow-1">
                                      <strong className={`d-block fw-black mb-1 ${isChosen ? 'text-white' : 'text-muted'}`} style={{ fontSize: '13px' }}>{tap.name}</strong>
                                      <span className={`fw-bold d-block ${isChosen ? 'text-white opacity-80' : 'text-danger'}`} style={{ fontSize: '10px' }}>Requires {tap.min_diameter}&quot; - {tap.max_diameter}&quot;</span>
                                      <span className={`small ${isChosen ? 'text-white' : 'text-muted'}`} style={{ fontSize: '11px' }}>+${tap.price || '0.00'}/HOLE</span>
                                    </div>
                                  </motion.button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {options.length === 0 && (
                          <div className="h-100 d-flex flex-column align-items-center justify-content-center text-center py-5">
                            <AlertCircle size={48} className="text-muted opacity-20 mb-3" />
                            <h3 className="fw-bold text-muted">No Taps Configured</h3>
                            <p className="text-muted small max-w-xs">Contact support for custom threading requirements or check your dashboard configuration.</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="p-5 border-top bg-white d-flex justify-content-between align-items-center">
                <button className="btn btn-link text-muted text-decoration-none fw-bold small hover-text-dark transition-all" onClick={() => setSelectedTaps(p => { const n = { ...p }; delete n[activeTapHole.id]; return n; })}>CLEAR SELECTION</button>
                <button className="btn btn-dark px-5 py-3 rounded-pill fw-black shadow-lg hover-translate-y transition-all border-0" onClick={() => setActiveTapHole(null)}>DISMISS CONFIGURATOR</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isAnodizingModalOpen && (
          <motion.div key="anodizing-modal" className="position-fixed inset-0 bg-black-80 d-flex align-items-center justify-content-center z-10000" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ backdropFilter: 'blur(12px)' }}>
            <motion.div className="bg-white rounded-5 shadow-22xl p-0 overflow-hidden w-100 mx-4" style={{ maxWidth: '850px', border: '1px solid rgba(0,0,0,0.05)', position: 'relative', zIndex: 10001 }} initial={{ scale: 0.9, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 30, opacity: 0 }} transition={{ type: 'spring', damping: 25 }}>
              <div className="p-5 bg-white border-bottom d-flex justify-content-between align-items-center">
                <div>
                  <h3 className="fw-black fs-2 m-0 text-dark letter-spacing-1">PREMIUM FINISH COLOR</h3>
                  <p className="small text-muted fw-bold text-uppercase letter-spacing-2 mt-2">Selected metal will be treated with the chosen anodizing process</p>
                </div>
                <button className="btn-close action-btn-hover p-3 rounded-circle shadow-none" onClick={() => setIsAnodizingModalOpen(false)} />
              </div>
              <div className="p-5 bg-light-subtle bg-opacity-30">
                <div className="d-grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                  {(() => {
                    const svc = selectedAdditionalServices.find(s => s.title.toLowerCase().includes('anodiz'));
                    const options = svc?.service_options || [];
                    return options.map((opt, i) => {
                      const isActive = selectedAnodizingColor?.name === opt.name;
                      return (
                        <motion.button key={i} className={`group btn border-0 p-3 rounded-5 d-flex flex-column align-items-center gap-4 transition-all bg-transparent`} onClick={() => { setSelectedAnodizingColor(opt); setIsAnodizingModalOpen(false); }} whileHover={{ y: -10 }}>
                          <div className="position-relative">
                            <div className={`rounded-circle shadow-2xl transition-all ${isActive ? 'scale-110' : 'group-hover-scale-105'}`} style={{ backgroundColor: opt.color, width: '100px', height: '100px', border: isActive ? '6px solid #ef4444' : '6px solid white', boxShadow: isActive ? '0 20px 40px -10px rgba(239, 68, 68, 0.4)' : '0 15px 30px -10px rgba(0,0,0,0.1)' }} />
                            {isActive && <div className="position-absolute top-0 end-0 bg-danger text-white rounded-circle p-2 shadow-lg" style={{ transform: 'translate(30%, -30%)' }}><Check size={16} strokeWidth={4} /></div>}
                          </div>
                          <div className="text-center">
                            <span className={`d-block fs-6 fw-black transition-all ${isActive ? 'text-danger' : 'text-dark group-hover-text-dark opacity-80'}`}>{opt.name.toUpperCase()}</span>
                            <span className="small text-muted fw-bold opacity-50 letter-spacing-1 font-monospace mt-1 d-block">{opt.color.toUpperCase()}</span>
                          </div>
                        </motion.button>
                      );
                    });
                  })()}
                </div>

                {(!selectedAdditionalServices.find(s => s.title.toLowerCase().includes('anodiz'))?.service_options?.length) && (
                  <div className="py-5 text-center">
                    <Shield size={48} className="text-muted opacity-20 mb-3" />
                    <p className="text-muted fw-bold small">NO PREMIUM FINISHES CONFIGURED IN DASHBOARD</p>
                  </div>
                )}
              </div>
              <div className="p-4 bg-white border-top text-center">
                <button className="btn btn-link text-muted text-decoration-none fw-bold small hover-text-dark" onClick={() => { setSelectedAnodizingColor(null); setIsAnodizingModalOpen(false); }}>SKIP ANODIZING</button>
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
                .instant-pricing-container {background: #ffffff; min-height: 100vh; width: 100%; padding-bottom: 50px; }
                .qf-preview-container {height: 100vh !important; }
                .letter-spacing-1 {letter - spacing: 0.05em; }
                .letter-spacing-2 {letter - spacing: 0.1em; }
                .inset-0 {top: 0; left: 0; right: 0; bottom: 0; }
                .z-9999 {z - index: 9999; }
                .shadow-2xl {box - shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
                .shadow-xs {box - shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
                .action-btn-hover {transition: all 0.2s; }
                .action-btn-hover:hover {background - color: rgba(0,0,0,0.05); transform: rotate(90deg); }
                .hover-translate-y:hover {transform: translateY(-2px); }
                .animate-spin {animation: spin 1s linear infinite; }
                @keyframes spin {from {transform: rotate(0deg); } to {transform: rotate(360deg); } }
                .animate-spin-slow {animation: spin 3s linear infinite; }
                .fw-black {font - weight: 900; }
                .grayscale {filter: grayscale(1); }
                .hide-scrollbar::-webkit-scrollbar {width: 0 !important; display: none !important; }
                .hide-scrollbar {-ms - overflow - style: none !important; scrollbar-width: none !important; }
                .tap-option-card-hover:hover {border - color: #ef4444 !important; background-color: #fff !important; transform: translateY(-2px); }
                .op-hover-100:hover {opacity: 1 !important; border-color: #ffc107 !important; }
                .ripple-infinite {animation: ripple 2s infinite; }
                @keyframes ripple {0 % { opacity: 0.4; transform: scale(0.8); } 50% {opacity: 1; transform: scale(1.1); } 100% {opacity: 0.4; transform: scale(0.8); } }
                .shadow-md {box - shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
                .shadow-danger {box - shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.3); }
                .shadow-warning {box - shadow: 0 10px 15px -3px rgba(255, 193, 7, 0.3); }
                .shadow-22xl {box - shadow: 0 35px 60px -15px rgba(0, 0, 0, 0.1); }
                .z-10000 { z-index: 10000 !important; }
                .bg-black-80 { background-color: rgba(0,0,0,0.8) !important; }
                .bg-dark {background - color: #1a1a1a !important; }
                .fs-huge {font - size: 2.2rem; }
                .fs-plus {font - size: 1.1rem; }
                .discount-label {font - size: 0.95rem; font-weight: 800; color: #4b5563; }
                .discount-value {font - size: 1.15rem; font-weight: 900; color: #ef4444; }
                .line-height-1 { line-height: 1; }
                .text-xxs { font-size: 0.65rem; }
                .text-xs-plus { font-size: 0.75rem; }
                `;
  return <style dangerouslySetInnerHTML={{ __html: styles }} />;
};

export default InstantPricing;

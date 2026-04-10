import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import {
  Upload, X, Info, ArrowRight, FileCode, Layers, Grid3x3, Box, Square,
  Monitor, Maximize2, Boxes, ChevronLeft,
  ChevronRight, ChevronDown, AlertCircle, AlertTriangle, Loader2, Check, Shield, Calculator,
  Minus, Plus, Zap, TrendingDown, FileText, Settings, Grid
} from 'lucide-react';
import * as OV from 'online-3d-viewer';
import { parseString, toSVG } from 'dxf';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import FlatPatternViewer from '../components/viewer/FlatPatternViewer';
import { fetchServices, fetchMetals, calculatePrice, fetchPublicDiscounts, fetchCategories, fetchHardwareItemsByType } from '../utils/api';
import { useCart } from '../context/CartContext.js';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const BACKEND_URL = import.meta.env.VITE_PYTHON_API_URL;

const HW_TYPES = [
  { id: 3, label: 'Nut', color: '#B8860B', specs: (item) => [item.length && `T ${item.length}"`, item.base_width && `E ${item.base_width}"`] },
  { id: 2, label: 'Flush Standoff', color: '#6366f1', specs: (item) => [item.length && `L ${item.length}"`] },
  { id: 1, label: 'Flush Stud', color: '#059669', specs: (item) => [item.length && `L ${item.length}"`] },
  { id: 4, label: 'Flush Nut', color: '#DC2626', specs: (item) => [item.length && `A ${item.length}"`, item.base_width && `H ${item.base_width}"`, item.shank && `Shank ${item.shank}"`] },
];

const is2DFile = (filename) => {
  const name = filename?.toLowerCase() ?? '';
  return name.endsWith('.dxf') || name.endsWith('.dwg');
};

const isStepFile = (filename) => {
  const name = filename?.toLowerCase() ?? '';
  return name.endsWith('.step') || name.endsWith('.stp');
};

// ─── Child Components ─────────────────────────────────────
const PriceSkeleton = ({ width = '80px', height = '24px', className = '' }) => (
  <div className={`skeleton-price ${className}`} style={{ width, height, display: 'inline-block', verticalAlign: 'middle' }} />
);

// ─── DXF Technical Data Extractor ────────────────────────
// Walks DXF entities and computes totalPerimeter (mm) + pierceCount
// needed by the laser pricing engine.
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
      // Close the loop if flagged closed
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

// ─── Component ──────────────────────────────────────────
const InstantPricing = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [viewMode, setViewMode] = useState('3d');
  const [activeAxis, setActiveAxis] = useState('top');
  const [unit, setUnit] = useState('mm'); // mm or inch
  const [prodUnit, setProdUnit] = useState('mm');
  const [dxfSvg, setDxfSvg] = useState(null);
  const [dxfError, setDxfError] = useState(null);
  const [backendData, setBackendData] = useState(null);
  const [dxfTechData, setDxfTechData] = useState(null);
  const [backendError, setBackendError] = useState(null);
  const [isLoadingUnfold, setIsLoadingUnfold] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isQuoteFlowActive, setIsQuoteFlowActive] = useState(false);
  const [modelLoadCount, setModelLoadCount] = useState(0);

  // Dynamic data from DB
  const [allServices, setAllServices] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [allMetals, setAllMetals] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [selectedProductionService, setSelectedProductionService] = useState(null);
  const [selectedMetal, setSelectedMetal] = useState(null);
  const [selectedThickness, setSelectedThickness] = useState(null);
  const [selectedAdditionalServices, setSelectedAdditionalServices] = useState([]);
  const [selectedFinishColors, setSelectedFinishColors] = useState({});
  const [activeFinishSvcId, setActiveFinishSvcId] = useState(null);
  const [isAnodizingModalOpen, setIsAnodizingModalOpen] = useState(false);
  const activeFinishKey = Object.keys(selectedFinishColors || {})[0];
  const activeFinishColor = selectedFinishColors?.[activeFinishKey] || null;
  const isFinishPowderCoating = selectedAdditionalServices.find(s => s.id?.toString() === activeFinishKey?.toString())?.title?.toLowerCase().includes('powder coat');
  const [selectedTaps, setSelectedTaps] = useState({});
  const [activeTapHole, setActiveTapHole] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [selectedHardware, setSelectedHardware] = useState({});
  const [activeHwHole, setActiveHwHole] = useState(null);
  const [hwItemsByType, setHwItemsByType] = useState({});
  const [activeHwType, setActiveHwType] = useState(3);
  const [expandedHwGroups, setExpandedHwGroups] = useState(new Set());
  const [selectedCountersinks, setSelectedCountersinks] = useState({});
  const [activeCSHole, setActiveCSHole] = useState(null);
  const [expandedCSGroups, setExpandedCSGroups] = useState(new Set());
  const [isDetectingHoles, setIsDetectingHoles] = useState(false);
  const [highlightBends, setHighlightBends] = useState(false);
  const [holeDetectionError, setHoleDetectionError] = useState(null);
  const [detectedHoles, setDetectedHoles] = useState([]);
  const [allDiscounts, setAllDiscounts] = useState([]);
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isModelFadedManually, setIsModelFadedManually] = useState(false);
  const [metalSearch, setMetalSearch] = useState('');

  const parsedDxfRef = useRef(null);
  const stepHolesDetectedRef = useRef(false);
  const stepViewerRef = useRef(null);
  const dxfViewerRef = useRef(null);
  const [viewBoxData, setViewBoxData] = useState(null);
  const viewerInstance = useRef(null);
  const dimensionsRef = useRef(null);
  const modelRef = useRef(null);
  const pendingAxisRef = useRef(null);
  const modelOriginalDataRef = useRef(null);
  const centroidRef = useRef(new THREE.Vector3(0, 0, 0));
  const qty1PriceRef = useRef(null);
  const wrinkleTexture = useRef(null);

  // ── Procedural textures for 'Wrinkled' finish & cellular grain ─────────
  const wrinkleNormal = useRef(null);
  useEffect(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Generate Cellular (Voronoi) Height Map
    const points = Array.from({ length: 1800 }, () => ({ x: Math.random() * size, y: Math.random() * size }));
    const heights = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let minDist = size;
        for (let p of points) {
          const dx = x - p.x, dy = y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < minDist) minDist = d;
        }
        heights[y * size + x] = Math.min(1.0, minDist / 20.0);
      }
    }

    // Convert Cellular Map to Normal Map
    const imgData = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const hL = heights[y * size + (x - 1 + size) % size];
        const hR = heights[y * size + (x + 1) % size];
        const hU = heights[((y - 1 + size) % size) * size + x];
        const hD = heights[((y + 1) % size) * size + x];

        const nx = (hL - hR) * 1.5;
        const ny = (hU - hD) * 1.5;
        const nz = 0.6;

        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        imgData.data[idx] = ((nx / len) * 0.5 + 0.5) * 255;
        imgData.data[idx + 1] = ((ny / len) * 0.5 + 0.5) * 255;
        imgData.data[idx + 2] = ((nz / len) * 0.5 + 0.5) * 255;
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(35, 35);
    wrinkleNormal.current = tex;
    wrinkleTexture.current = tex;
  }, []);

  const holeGroups = useMemo(() => {
    const groups = {};
    detectedHoles.forEach(hole => {
      const key = Number(hole.diameterInches || 0).toFixed(3);
      if (!groups[key]) groups[key] = { dia: key, holes: [] };
      groups[key].holes.push(hole);
    });
    return Object.values(groups).sort((a, b) => parseFloat(a.dia) - parseFloat(b.dia));
  }, [detectedHoles]);

  const isCNC = selectedProductionService?.title?.toLowerCase()?.includes('cnc');
  const selectedThicknessMM = useMemo(
    () => selectedThickness ? parseFloat(selectedThickness) * 25.4 : null,
    [selectedThickness]
  );
  const handleProceedToReview = () => {
    if (!selectedFile || !selectedMetal || !dimensions) return;

    // priceEstimate.total_price already includes anodizing (sent via additional_services to API)
    // so only taps and hardware need to be added separately (they are not included in the backend total)
    const tapCost = Object.values(selectedTaps).reduce((acc, t) => acc + (parseFloat(t.price) || 0), 0);
    const hardwareCost = Object.values(selectedHardware).reduce((acc, { item }) => acc + (parseFloat(item?.price) || 0), 0);
    const csCost = Object.values(selectedCountersinks).reduce((acc, cs) => acc + (parseFloat(cs.price) || 0), 0);
    const totalBatch = parseFloat(priceEstimate?.total_price || 0) + tapCost + hardwareCost + csCost;

    // Use anchored Qty 1 price if available, otherwise fallback to current unit price
    const baseUnitPrice = (qty1PriceRef.current !== null ? qty1PriceRef.current : (totalBatch / quantity)) + (tapCost / quantity) + (hardwareCost / quantity) + (csCost / quantity);

    const config = {
      productionService: selectedProductionService,
      metal: selectedMetal,
      thickness: dimensions.mm.t,
      selectedThickness: selectedThickness, // Store string value for Laser établissements
      anodizingColor: activeFinishColor,
      selectedTaps,
      selectedHardware,
      selectedCountersinks,
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
        baseUnit: baseUnitPrice, // Robust anchor for long-term checkout transparency établissements
        taps: tapCost / quantity,
        hardware: hardwareCost / quantity,
        finish: 0,
        // Using the requested linear model: BasePrice * (1 - DiscountTablePercent)
        total: baseUnitPrice * (1 - (parseFloat(priceEstimate?.breakdown?.discount_percent || 0) / 100))
      },
      quantity: quantity
    });

    if (user) {
      navigate('/checkout');
    } else {
      navigate('/cart');
    }
  };

  // ── Fetch all hardware types when hardware service is selected ──────────
  useEffect(() => {
    const hwSvc = selectedAdditionalServices.find(s => s.title.toLowerCase().includes('hardware'));
    if (!hwSvc) return;
    HW_TYPES.forEach(({ id }) => {
      if (hwItemsByType[id] !== undefined) return;
      fetchHardwareItemsByType(id)
        .then(items => setHwItemsByType(prev => ({ ...prev, [id]: items || [] })))
        .catch(() => setHwItemsByType(prev => ({ ...prev, [id]: [] })));
    });
  }, [selectedAdditionalServices]); // eslint-disable-line react-hooks/exhaustive-deps

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
          fetchPublicDiscounts(),
          fetchCategories()
        ]);

        const svcs = results[0].status === 'fulfilled' ? results[0].value : [];
        const mtls = results[1].status === 'fulfilled' ? results[1].value : [];
        const disc = results[2].status === 'fulfilled' ? results[2].value : [];
        const cats = results[3].status === 'fulfilled' ? results[3].value : [];

        setAllServices(svcs || []);
        setAllMetals(mtls || []);
        setAllDiscounts(disc || []);
        setAllCategories(cats || []);
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
    setSelectedCategory(null);
    setSelectedMetal(null);
    setQuantity(1);
    setSelectedAdditionalServices([]);
    setSelectedFinishColors({});
    setActiveFinishSvcId(null);
    setDetectedHoles([]);
    setIsDetectingHoles(false);
    setSelectedThickness(null);
    setDxfTechData(null);
    setHighlightBends(false);
    parsedDxfRef.current = null;
    stepHolesDetectedRef.current = false;
    modelOriginalDataRef.current = null;
    qty1PriceRef.current = null;
  }, [selectedFile]);

  // ── STEP Hole Detection for Tapping & Hardware ───────
  useEffect(() => {
    const hasTapping = selectedAdditionalServices.some(s => s.title.toLowerCase().includes('tap'));
    const hasHardware = selectedAdditionalServices.some(s => s.title.toLowerCase().includes('hardware'));
    const hasCountersinkingSvc = selectedAdditionalServices.some(s => s.title.toLowerCase().includes('countersink'));
    if ((!hasTapping && !hasHardware && !hasCountersinkingSvc) || !selectedFile || !isStepFile(selectedFile.file.name)) return;
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
          depthMm: h.depth_mm || 0,
          depthInches: h.depth_mm ? h.depth_mm / 25.4 : depthIn,
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

  // ── Auto-open modals once holes are detected ──────────
  useEffect(() => {
    if (detectedHoles.length === 0) return;
    const hasTapping = selectedAdditionalServices.some(s => s.title.toLowerCase().includes('tap'));
    const hasHardware = selectedAdditionalServices.some(s => s.title.toLowerCase().includes('hardware'));
    const hasCountersinking = selectedAdditionalServices.some(s => s.title.toLowerCase().includes('countersink'));
    if (hasTapping && !activeTapHole && !activeHwHole) setActiveTapHole(detectedHoles[0]);
    else if (hasHardware && !activeHwHole && !activeTapHole) setActiveHwHole(detectedHoles[0]);
    else if (hasCountersinking && !activeCSHole && !activeTapHole && !activeHwHole) setActiveCSHole(detectedHoles[0]);
  }, [detectedHoles, selectedAdditionalServices]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-Time Price Calculation ───────────────────────
  useEffect(() => {
    // Guard: Need dimensions and at least one selection
    if (!dimensions || (!selectedMetal && !selectedProductionService)) {
      setPriceEstimate(null);
      return;
    }

    const getEstimate = async () => {
      setIsCalculatingPrice(true);
      try {
        const payload = {
          metal_id: selectedMetal.id,
          service_id: selectedProductionService.id,
          thickness_value: selectedThickness,
          length_in: dimensions.inches.l,
          height_in: dimensions.inches.w,
          quantity: quantity,
          additional_services: selectedAdditionalServices.map(s => {
            const opt = selectedFinishColors[s.id];
            return { id: s.id, option_id: opt?.id ?? opt?.index ?? null };
          }),
          taps: Object.values(selectedTaps).map(t => ({ name: t.name, price: t.price })),
          technical_data: backendData ? {
            totalPerimeter: backendData.totalPerimeter,
            pierceCount: backendData.pierceCount,
            bends: backendData.bends
          } : dxfTechData ? {
            totalPerimeter: dxfTechData.totalPerimeter,
            pierceCount: dxfTechData.pierceCount,
            bends: []
          } : null
        };
        const res = await calculatePrice(payload);
        if (res.success) {
          setPriceEstimate(res);
          // Anchor the Qty 1 price for cart subtotal transparency établissements
          if (quantity === 1) {
            qty1PriceRef.current = res.breakdown?.final_unit_price || 0;
          }
        } else {
          // If backend says not configured
          if (res.error?.includes('not configured')) {
            toast(res.error, 'error');
          }
          setPriceEstimate(null);
        }
      } catch (err) {
        console.error('Price calculation failed:', err);
        setPriceEstimate(null);
      } finally {
        setIsCalculatingPrice(false);
      }
    };

    const timeoutId = setTimeout(getEstimate, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [selectedMetal, selectedProductionService, selectedThickness, selectedAdditionalServices, selectedTaps, selectedFinishColors, dimensions, quantity, toast, isCNC, backendData, dxfTechData]);


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
        // Extract perimeter + pierce count for laser pricing engine
        setDxfTechData(calcDxfTechData(parsed.entities, isInch));

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
        const selectedThicknessMM = selectedThickness ? parseFloat(selectedThickness) * 25.4 : 2;
        const thicknessNative = dimensionsRef.current?.isNativeInches ? (selectedThicknessMM / 25.4) : selectedThicknessMM;
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

        const applyGloss = !!(activeFinishColor && isFinishPowderCoating);
        const isWrinkled = !!(activeFinishColor?.is_wrinkled || activeFinishColor?.name?.toUpperCase().includes('WRINKLED'));

        const extrudeMat = new THREE.MeshStandardMaterial({
          color: activeFinishColor ? new THREE.Color(activeFinishColor.color) : 0xcecece,
          roughness: applyGloss ? (isWrinkled ? 0.68 : Math.max(0.32, 0.9 - ((activeFinishColor?.gloss ?? 35) / 100))) : 0.6,
          metalness: isWrinkled ? 0.15 : 0.05,
          emissive: (activeFinishColor && !isFinishPowderCoating) ? new THREE.Color(activeFinishColor.color) : 0x000000,
          emissiveIntensity: (activeFinishColor && !isFinishPowderCoating) ? 0.15 : 0,
          normalMap: isWrinkled ? wrinkleNormal.current : null,
          normalScale: isWrinkled ? new THREE.Vector2(3, 3) : new THREE.Vector2(0, 0),
          bumpScale: isWrinkled ? 2.5 : 0
        });
        extrudeMat.needsUpdate = true;

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

        scene.add(new THREE.HemisphereLight(0xffffff, 0x999999, 1.2));
        const dl = new THREE.DirectionalLight(0xffffff, 0.7);
        dl.position.set(100, 200, 100);
        scene.add(dl);

        const animate = () => { reqId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
        animate();
      } catch (err) { console.error('DXF 3D Error:', err); }
    };
    initViewer();
    return () => { cancelAnimationFrame(reqId); controls?.dispose(); renderer?.dispose(); if (currentRef) currentRef.innerHTML = ''; };
  }, [selectedFile, viewMode, dxfSvg, selectedFinishColors, activeFinishColor, isFinishPowderCoating, selectedThickness]);

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
          mm: { l: s[2].toFixed(2), w: s[1].toFixed(2), t: s[0].toFixed(2), volume: vol.toFixed(2) },
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
            centroidRef.current.copy(center);

            v?.scene?.add(new THREE.HemisphereLight(0xffffff, 0x999999, 1.2));
            const dl1 = new THREE.DirectionalLight(0xffffff, 0.7); dl1.position.set(100, 200, 100); v?.scene?.add(dl1);
            const dl2 = new THREE.DirectionalLight(0xffffff, 0.4); dl2.position.set(-100, -200, -100); v?.scene?.add(dl2);
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

            // Capture root group for thickness-scaling (scale group, not individual meshes)
            const modelRoot = v?.scene?.children.find(c => c.isGroup);
            if (modelRoot && bb?.min && bb?.max) {
              const axes = [
                { axis: 'x', size: Math.abs(bb.max.x - bb.min.x), localCenter: (bb.min.x + bb.max.x) / 2 },
                { axis: 'y', size: Math.abs(bb.max.y - bb.min.y), localCenter: (bb.min.y + bb.max.y) / 2 },
                { axis: 'z', size: Math.abs(bb.max.z - bb.min.z), localCenter: (bb.min.z + bb.max.z) / 2 },
              ].sort((a, b) => a.size - b.size);
              modelOriginalDataRef.current = {
                root: modelRoot,
                origScale: modelRoot.scale.clone(),
                origPosition: modelRoot.position.clone(),
                thicknessAxis: axes[0].axis,
                origThicknessMM: axes[0].size,
                localCenter: axes[0].localCenter,
              };
            }
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

  // ── Apply selected thickness scaling to STEP model ───────
  useEffect(() => {
    if (!viewerInstance.current || !isStepFile(selectedFile?.file?.name)) return;
    if (modelLoadCount === 0) return;
    const data = modelOriginalDataRef.current;
    if (!data?.root) return;

    try {
      const { root, origScale, origPosition, thicknessAxis, origThicknessMM, localCenter } = data;

      if (!selectedThickness) {
        root.scale.copy(origScale);
        root.position.copy(origPosition);
      } else {
        const newThicknessMM = parseFloat(selectedThickness) * 25.4;
        const scaleFactor = origThicknessMM > 0 ? newThicknessMM / origThicknessMM : 1;
        root.scale[thicknessAxis] = origScale[thicknessAxis] * scaleFactor;
        // Re-center: newPos = origPos + localCenter × (1 - scaleFactor)
        root.position[thicknessAxis] = origPosition[thicknessAxis] + localCenter * (1 - scaleFactor);
      }

      setTimeout(() => {
        try {
          const v = viewerInstance.current?.GetViewer();
          if (v) { v.FitToWindow(); v.Render(); }
        } catch { /* ignore */ }
      }, 50);
    } catch (e) {
      console.warn('Thickness scale error:', e);
    }
  }, [selectedThickness, selectedFile, modelLoadCount]);

  const isTappingActive = selectedAdditionalServices.some(s => s.title.toLowerCase().includes('tap'));
  const isCountersinkingActive = selectedAdditionalServices.some(s => s.title.toLowerCase().includes('countersink'));

  useEffect(() => {
    if (!viewerInstance.current || !isStepFile(selectedFile?.file?.name)) return;
    if (modelLoadCount === 0) return;
    const apply = () => {
      try {
        const v = viewerInstance.current?.GetViewer();
        if (!v?.scene) return;
        v.scene.traverse(obj => {
          if (!obj.isMesh || obj.userData.isHoleMarker || obj.isHardwareMarker) return;

          if (!obj.geometry.attributes.uv && obj.geometry.attributes.position) {
            const pos = obj.geometry.attributes.position;
            if (!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();
            const norm = obj.geometry.attributes.normal;
            const uvs = new Float32Array(pos.count * 2);
            const scale = 35; // Calibrated for industrial micro-grain
            for (let i = 0; i < pos.count; i++) {
              const nx = Math.abs(norm.getX(i)), ny = Math.abs(norm.getY(i)), nz = Math.abs(norm.getZ(i));
              const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
              if (nx > ny && nx > nz) { uvs[i * 2] = z / scale; uvs[i * 2 + 1] = y / scale; }
              else if (ny > nx && ny > nz) { uvs[i * 2] = x / scale; uvs[i * 2 + 1] = z / scale; }
              else { uvs[i * 2] = x / scale; uvs[i * 2 + 1] = y / scale; }
            }
            obj.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            obj.geometry.attributes.uv.needsUpdate = true;
          }

          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((mat, idx) => {
            if (!mat?.color) return;
            if (!obj.userData._matCloned) {
              const upgrade = (m) => new THREE.MeshStandardMaterial({ color: m.color, transparent: m.transparent, opacity: m.opacity, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.05 });
              obj.material = Array.isArray(obj.material) ? obj.material.map(upgrade) : upgrade(obj.material);
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
            } else if (activeFinishColor) {
              fm.color.set(activeFinishColor.color);
              if (!isFinishPowderCoating) {
                // Anodizing: Make it vibrant and light without adding gloss
                fm.emissive.set(activeFinishColor.color);
                fm.emissiveIntensity = 0.15;
              } else {
                fm.emissive.set(0x000000);
                fm.emissiveIntensity = 0;
              }
            } else {
              const oc = obj.userData.origColor;
              fm.color.setRGB(oc.r, oc.g, oc.b);
              fm.emissive.set(0x000000);
              fm.emissiveIntensity = 0;
            }

            // Standard Material properties - Dynamic gloss & wrinkle from Admin
            if (activeFinishColor && isFinishPowderCoating) {
              const gloss = activeFinishColor.gloss ?? 35;
              const isWrinkled = !!(activeFinishColor.is_wrinkled || activeFinishColor.name?.toUpperCase().includes('WRINKLED'));
              fm.roughness = isWrinkled ? 0.68 : Math.max(0.32, 0.9 - (gloss / 100));
              fm.metalness = isWrinkled ? 0.15 : 0.1;
              fm.normalMap = isWrinkled ? wrinkleNormal.current : null;
              fm.normalScale = isWrinkled ? new THREE.Vector2(0.6, 0.6) : new THREE.Vector2(0, 0);
              fm.needsUpdate = true;
            } else {
              fm.roughness = 0.6; // Standard/Anodized Light Matte
              fm.metalness = 0.05;
              fm.normalMap = null;
              fm.normalScale = new THREE.Vector2(0, 0);
              fm.needsUpdate = true;
            }
            if (fm.bumpMap) fm.bumpMap.needsUpdate = true;

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
  }, [selectedFinishColors, activeFinishColor, isFinishPowderCoating, selectedFile?.file?.name, modelLoadCount, isTappingActive, activeTapHole, isAnodizingModalOpen, isModelFadedManually, detectedHoles, selectedTaps]);

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

        const hasHwAssigned = Object.keys(selectedHardware).length > 0;
        const hasCSAssigned = Object.keys(selectedCountersinks).length > 0;
        if ((!isTappingActive && !hasHwAssigned && !isCountersinkingActive && !hasCSAssigned) || detectedHoles.length === 0) { try { v.Render(); } catch { /* silent render error */ } return; }

        const partT = dimensions?.mm?.t ? (parseFloat(dimensions.mm.t) || 2.0) : 2.0;

        // ── Tapping markers ──────────────────────────────────────────────
        if (isTappingActive) {
          const tapSvc = allServices.find(s => s.title.toLowerCase().includes('tap'));
          const tapOptions = tapSvc?.service_options || [];

          detectedHoles.forEach(hole => {
            if (!hole.position) return;
            const dia = hole.diameter_mm ? hole.diameter_mm / 25.4 : (hole.diameterInches || 0.1);
            const mmDia = dia * 25.4;
            if (mmDia > 100.0) return;

            const isConfigured = tapOptions.some(tap => dia >= (parseFloat(tap.min_diameter) || 0) && dia <= (parseFloat(tap.max_diameter) || 0));
            const isTapped = !!selectedTaps[hole.id];
            const isActive = activeTapHole?.id === hole.id;

            let color = isConfigured ? 0x10b981 : 0xef4444;
            if (isTapped) color = 0x4169e1;
            if (isActive) color = 0xe31b23;

            const safeRadius = Math.max(mmDia / 2, 0.5);
            const geo = new THREE.CylinderGeometry(safeRadius, safeRadius, partT, 32, 1, true);
            const mat = isTapped
              ? new THREE.MeshBasicMaterial({ color, transparent: false, side: THREE.DoubleSide })
              : new THREE.MeshPhongMaterial({ color, emissive: isActive ? color : 0x000000, emissiveIntensity: isActive ? 4.0 : 0, shininess: 80, side: THREE.DoubleSide, transparent: false });

            const sleeve = new THREE.Mesh(geo, mat);
            sleeve.position.set(hole.position[0], hole.position[1], hole.position[2]);
            modelParent.add(sleeve);
            if (hole.axis) {
              const pos = new THREE.Vector3(...hole.position);
              sleeve.lookAt(pos.clone().add(new THREE.Vector3(...hole.axis)));
              sleeve.rotateX(Math.PI / 2);
            } else {
              sleeve.rotateX(Math.PI / 2);
            }
            sleeve.userData = { isHoleMarker: true, hole: { ...hole, isConfigured } };
            modelParent.add(sleeve);
            holeMarkersRef.current.push(sleeve);
          });
        }

        // ── Hardware markers ─────────────────────────────────────────────
        if (hasHwAssigned) {
          const HW_COLORS = { 1: 0x059669, 2: 0x6366f1, 3: 0xB8860B, 4: 0xDC2626 };

          // Shared materials — created once, reused for all holes
          const matCache = {};
          const getHwMat = (c) => {
            const k = `hw_${c}`;
            if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial({ color: c, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide });
            return matCache[k];
          };
          const boreMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.4 });

          // Sample panel surface color once for hole fill rings
          let panelHex = 0x9ca3af;
          v.scene.traverse(o => {
            if (o.isMesh && !o.isHardwareMarker && !o.isTapMarker && o.material?.color) {
              panelHex = o.material.color.getHex();
            }
          });
          const panelFillMat = new THREE.MeshStandardMaterial({ color: panelHex, metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide });

          detectedHoles.forEach(hole => {
            if (!hole.position) return;
            const hw = selectedHardware[hole.id];
            if (!hw) return;

            const { item, typeId, face } = hw;
            const holeMmDia = hole.diameter_mm || (hole.diameterInches || 0.1) * 25.4;
            const edgeMm = item?.min_edge_distance ? parseFloat(item.min_edge_distance) * 25.4 : null;
            const r = Math.max(edgeMm ? edgeMm / 2 : holeMmDia / 2, 0.5);
            const holeR = holeMmDia / 2;
            const toolingDiaMm = item?.tooling_diameter ? parseFloat(item.tooling_diameter) * 25.4 : null;
            const barrelR = toolingDiaMm ? Math.min(toolingDiaMm / 2, holeR) : r;
            const color = HW_COLORS[typeId] || 0xB8860B;
            const mat = getHwMat(color);

            const axisVec = hole.axis ? new THREE.Vector3(...hole.axis) : new THREE.Vector3(0, 1, 0);
            const axisNorm = axisVec.clone().normalize();
            const faceSign = face === 'down' ? -1 : 1;
            const faceOffset = axisNorm.clone().multiplyScalar(faceSign * partT * 0.5);
            const basePos = new THREE.Vector3(hole.position[0], hole.position[1], hole.position[2])
              .add(faceOffset);

            const type = typeId || 3;

            const addHWMesh = (geo, m, center) => {
              const mesh = new THREE.Mesh(geo, m);
              mesh.isHardwareMarker = true;
              mesh.position.copy(center);
              mesh.lookAt(center.clone().add(axisVec));
              mesh.rotateX(Math.PI / 2);
              modelParent.add(mesh);
              holeMarkersRef.current.push(mesh);
            };

            // Hole fill rings: visually resize hole to tooling diameter when hardware is smaller
            if (toolingDiaMm && toolingDiaMm < holeMmDia) {
              const backPos = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * partT));
              addHWMesh(new THREE.RingGeometry(barrelR, holeR, 32), panelFillMat, basePos.clone());
              addHWMesh(new THREE.RingGeometry(barrelR, holeR, 32), panelFillMat, backPos);
            }

            if (type === 3) {
              // Nut — round body + thin hollow disc on opposite face
              const nutH = item?.length ? parseFloat(item.length) * 25.4 : Math.max(3, partT * 0.5);
              const outerR = r * 1.4;
              const boreR = r * 0.5;
              const discH = Math.max(0.3, Math.min(0.5, partT * 0.03));
              const bodyCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * nutH / 2));
              addHWMesh(new THREE.CylinderGeometry(outerR, outerR, nutH, 16), mat, bodyCenter);
              addHWMesh(new THREE.CylinderGeometry(boreR, boreR, nutH + 0.1, 12), boreMat, bodyCenter);
              const discCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (partT + discH / 2)));
              addHWMesh(new THREE.CylinderGeometry(outerR, outerR, discH, 16), mat, discCenter);
              addHWMesh(new THREE.CylinderGeometry(boreR, boreR, discH + 0.1, 12), boreMat, discCenter);
            } else if (type === 2) {
              // Flush Standoff — hollow tube + thin hex flange
              const standoffH = item?.length ? parseFloat(item.length) * 25.4 : partT * 1.6;
              const bodyCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * standoffH / 2));
              const flangeH = Math.max(0.6, Math.min(0.8, partT * 0.04));
              const flangeCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (partT + flangeH / 2)));
              addHWMesh(new THREE.CylinderGeometry(barrelR, barrelR, standoffH, 16, 1, true), mat, bodyCenter);
              addHWMesh(new THREE.CylinderGeometry(barrelR * 0.45, barrelR * 0.45, standoffH, 12), boreMat, bodyCenter);
              addHWMesh(new THREE.CylinderGeometry(holeR * 1.4, holeR * 1.4, flangeH, 6), mat, flangeCenter);
              addHWMesh(new THREE.CylinderGeometry(barrelR * 0.45, barrelR * 0.45, flangeH + 0.1, 12), boreMat, flangeCenter);
            } else if (type === 4) {
              // Flush Nut — thin hollow disc each face
              const discH = Math.max(0.3, Math.min(0.5, partT * 0.03));
              const outerR = r * 1.35;
              const innerR = r * 0.5;
              const topCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * (discH / 2)));
              addHWMesh(new THREE.CylinderGeometry(outerR, outerR, discH, 16), mat, topCenter);
              addHWMesh(new THREE.CylinderGeometry(innerR, innerR, discH + 0.1, 12), boreMat, topCenter);
              const botCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (partT + discH / 2)));
              addHWMesh(new THREE.CylinderGeometry(outerR, outerR, discH, 16), mat, botCenter);
              addHWMesh(new THREE.CylinderGeometry(innerR, innerR, discH + 0.1, 12), boreMat, botCenter);
            } else if (type === 1) {
              // Flush Stud — shaft + simplified threads + head
              const studH = item?.length ? parseFloat(item.length) * 25.4 : partT * 2.2;
              const bodyCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(faceSign * studH / 2));
              const headH = Math.max(0.6, Math.min(0.8, partT * 0.04));
              const headCenter = basePos.clone().add(axisNorm.clone().multiplyScalar(-faceSign * (partT + headH / 2)));
              const shaftR = barrelR * 0.4;
              const headR = holeR * 1.1;
              addHWMesh(new THREE.CylinderGeometry(shaftR, shaftR, studH, 10), mat, bodyCenter);
              // Simplified thread — fewer coils, lower resolution
              const numCoils = Math.max(4, Math.round(studH / 3.5));
              const helixPts = [];
              for (let i = 0; i <= numCoils * 8; i++) {
                const t = i / (numCoils * 8);
                const angle = t * numCoils * Math.PI * 2;
                helixPts.push(new THREE.Vector3(Math.cos(angle) * shaftR * 1.3, (t - 0.5) * studH, Math.sin(angle) * shaftR * 1.3));
              }
              addHWMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPts), numCoils * 8, shaftR * 0.15, 3, false), mat, bodyCenter);
              addHWMesh(new THREE.CylinderGeometry(headR, headR, headH, 6), mat, headCenter);
              // Dome
              const domeCenter = headCenter.clone().add(axisNorm.clone().multiplyScalar(-faceSign * headH * 0.4));
              addHWMesh(new THREE.SphereGeometry(headR * 0.75, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat, domeCenter);
              // Cross slot
              const slotLen = headR * 0.65;
              const slotH2 = headH * 0.3;
              const slotW = shaftR * 0.15;
              const slotCenter = headCenter.clone().add(axisNorm.clone().multiplyScalar(-faceSign * headH * 0.55));
              addHWMesh(new THREE.BoxGeometry(slotLen * 2, slotH2, slotW * 2), boreMat, slotCenter);
              addHWMesh(new THREE.BoxGeometry(slotW * 2, slotH2, slotLen * 2), boreMat, slotCenter);
            } else {
              const m = new THREE.Mesh(
                new THREE.CylinderGeometry(r, r, partT, 16, 1, true),
                mat
              );
              m.isHardwareMarker = true;
              m.position.copy(basePos);
              m.lookAt(basePos.clone().add(axisVec));
              m.rotateX(Math.PI / 2);
              modelParent.add(m);
              holeMarkersRef.current.push(m);
            }
          });
        }

        // ── Countersink markers ──────────────────────────────────────────────
        if (isCountersinkingActive || hasCSAssigned) {
          const csConeMat = new THREE.MeshStandardMaterial({
            color: 0x7c3aed, metalness: 0.4, roughness: 0.3, side: THREE.DoubleSide,
            emissive: 0x4c1d95, emissiveIntensity: 0.35,
          });
          const csBackDiscMat = new THREE.MeshStandardMaterial({
            color: 0x9d4edd, side: THREE.BackSide,
            emissive: 0x4c1d95, emissiveIntensity: 0.2,
          });

          detectedHoles.forEach(hole => {
            if (!hole.position) return;
            const cs = selectedCountersinks[hole.id];
            if (!cs) return;

            const holeMmDia = hole.diameter_mm || (hole.diameterInches || 0.1) * 25.4;
            const holeR2 = holeMmDia / 2;
            const csMajorR = cs.major_dia ? parseFloat(cs.major_dia) * 25.4 / 2 : holeR2 * 1.5;
            const csMinorR = cs.minor_dia ? parseFloat(cs.minor_dia) * 25.4 / 2 : holeR2;

            const axisVec2 = hole.axis ? new THREE.Vector3(...hole.axis) : new THREE.Vector3(0, 1, 0);
            const axisNorm2 = axisVec2.clone().normalize();
            const faceSign = cs.face === 'down' ? -1 : 1;
            // Pull wide rim 0.5mm outside the surface so the cone is visibly proud
            const basePos2 = new THREE.Vector3(hole.position[0], hole.position[1], hole.position[2])
              .add(axisNorm2.clone().multiplyScalar(faceSign * (partT * 0.5 + 0.5)));

            const addCSMesh = (geo, m, center) => {
              const mesh = new THREE.Mesh(geo, m);
              mesh.isHardwareMarker = true;
              mesh.position.copy(center);
              mesh.lookAt(center.clone().add(axisVec2));
              mesh.rotateX(Math.PI / 2);
              modelParent.add(mesh);
              holeMarkersRef.current.push(mesh);
            };

            // Cap cone height to fit within material — wide rim at surface, narrow tip into material
            const coneH = Math.min(Math.max(csMajorR * 0.6, 2.0), partT * 0.95);
            const coneCenter = basePos2.clone().add(axisNorm2.clone().multiplyScalar(-faceSign * coneH / 2));
            addCSMesh(
              new THREE.CylinderGeometry(csMajorR * 0.98, csMinorR * 0.9, coneH, 32, 1, true),
              csConeMat, coneCenter
            );

            // Back nut-ring — sits just outside the opposite face
            // lookAt must point away from viewer (faceSign) so BackSide material is visible from outside
            const backPos2 = basePos2.clone().add(axisNorm2.clone().multiplyScalar(-faceSign * (partT + 1.5)));
            const backRing = new THREE.Mesh(new THREE.RingGeometry(csMinorR, csMinorR * 1.8, 32), csBackDiscMat);
            backRing.isHardwareMarker = true;
            backRing.position.copy(backPos2);
            backRing.lookAt(backPos2.clone().add(axisNorm2.clone().multiplyScalar(faceSign)));
            modelParent.add(backRing);
            holeMarkersRef.current.push(backRing);
          });
        }

        v.Render();
      } catch (err) { console.warn('Hole marker error:', err); }
    };

    updateMarkers();
  }, [detectedHoles, selectedTaps, activeTapHole, isTappingActive, selectedHardware, activeHwHole, selectedFile?.file?.name, modelLoadCount, allServices, dimensions, isCountersinkingActive, selectedCountersinks, activeCSHole]);

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
      const d = await r.json(); if (d.flatVertices?.length) { setBackendData(d); }
    } catch (err) {
      console.warn('Error during unfold stage:', err);
      setBackendError(err.message);
    } finally { setIsLoadingUnfold(false); }
  }, [selectedFile, backendData]);

  // ── Auto-unfold STEP files when Laser Cutting is the production service ───
  // The laser engine needs totalPerimeter + pierceCount which only come from the
  // Python unfold. Trigger it automatically instead of waiting for manual click.
  useEffect(() => {
    if (!selectedFile || !isStepFile(selectedFile.file.name)) return;
    if (!selectedProductionService) return;
    if (!selectedProductionService.title?.toLowerCase().includes('laser')) return;
    if (backendData || isLoadingUnfold) return;
    handleUnfold();
  }, [selectedProductionService, selectedFile]); // eslint-disable-line react-hooks/exhaustive-deps

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
        .qf-active, .qf-active .app-container, .qf-active .main-content, .qf-active #root, .qf-active .instant-pricing-container { background-color: #ffffff !important; background: #ffffff !important; }
        .qf-main-canvas > div { background-color: #ffffff !important; }
        .qf-preview-container { height: 0 !important; }
        .ip-left-panel { width: 200px; min-width: 200px; background: #ffffff; border-right: 1.5px solid #e8eaed; display: flex; flex-direction: column; padding: 14px 12px; overflow: hidden; }
        .ip-center-panel { flex: 1; display: flex; flex-direction: column; background: #ffffff; min-width: 0; min-height: 0; overflow: hidden; }
        .ip-right-panel { width: 290px; min-width: 290px; background: #ffffff; border-left: 1.5px solid #e8eaed; display: flex; flex-direction: column; padding: 18px 16px; overflow-y: auto; }
        /* Desktop: floating card with padding from edges */
        .ip-panel-layout { display: flex; position: fixed; top: 48px; left: 48px; right: 48px; bottom: 48px; z-index: 50; overflow: hidden; border-radius: 20px; box-shadow: 0 8px 40px rgba(0,0,0,0.12); border: 1.5px solid #e2e6ea; }
        body.qf-active { overflow: hidden !important; background: #e8eaed !important; }
        /* Tablet + Mobile: switch to scrollable vertical stack */
        @media (max-width: 1024px) {
          .ip-panel-layout { position: static; flex-direction: column; height: auto; min-height: unset; overflow: visible; border-radius: 0; box-shadow: none; border: none; top: auto; left: auto; right: auto; bottom: auto; }
          .qf-preview-container { height: auto !important; overflow: visible !important; }
          html.qf-active, body.qf-active { overflow-y: auto !important; overflow-x: hidden !important; background: #f4f5f7 !important; }
          .ip-left-panel { width: 100% !important; min-width: unset !important; border-right: none !important; border-bottom: 1.5px solid #e8eaed; flex-direction: row; flex-wrap: wrap; align-items: center; padding: 8px 12px; gap: 6px; overflow: visible !important; height: auto !important; }
          .ip-center-panel { height: 55vw; min-height: 300px; max-height: 480px; flex-shrink: 0; overflow: hidden; }
          .ip-right-panel { width: 100% !important; min-width: unset !important; border-left: none !important; border-top: 1.5px solid #e8eaed; height: auto; overflow-y: visible; padding-bottom: 24px; }
          .ip-proceed-btn { margin-top: 16px; }
        }
        /* Mobile */
        @media (max-width: 640px) {
          .ip-center-panel { height: 65vw; min-height: 240px; }
          .ip-toolbar { flex-wrap: wrap; gap: 4px; padding: 8px 10px; }
          .ip-right-panel { padding: 14px 12px 28px; }
          .ip-dim-row { padding: 8px 10px; }
          .ip-section-title { margin-top: 12px; }
        }
        .ip-file-card { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; border:1.5px solid #e8eaed; background:#ffffff; cursor:pointer; margin-bottom:6px; transition:all 0.15s; }
        .ip-file-card:hover { border-color:#cbd5e1; background:#fafafa; }
        .ip-file-card.active { border-color:#ef4444; background:#fff5f5; }
        .ip-file-icon { width:28px; height:28px; border-radius:6px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ip-file-icon.active { background:#ef4444; color:#fff; }
        .ip-file-icon.inactive { background:#f1f5f9; color:#64748b; }
        .ip-dim-row { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-radius:8px; border:1px solid #e8eaed; background:#fafafa; margin-bottom:8px; }
        .ip-dim-label { font-size:10px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#94a3b8; }
        .ip-dim-value { font-size:18px; font-weight:900; line-height:1; font-family:monospace; }
        .ip-dim-icon { width:30px; height:30px; border-radius:7px; display:flex; align-items:center; justify-content:center; }
        .ip-section-title { font-size:10px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; color:#94a3b8; margin-bottom:10px; display:flex; align-items:center; gap:6px; }
        .ip-section-title::after { content:''; flex:1; height:1px; background:#e8eaed; }
        .ip-viewer-frame { flex:1; margin:0; border-radius:0; overflow:hidden; border:none; background:#ffffff; position:relative; }
        .ip-toolbar { padding:10px 12px; display:flex; justify-content:space-between; align-items:center; gap:8px; background:#ffffff; border-bottom:1.5px solid #e8eaed; }
        .ip-pill-toggle { display:flex; padding:3px; border-radius:8px; background:#f1f5f9; border:1px solid #e2e6ea; gap:2px; }
        .ip-pill-btn { border:none; background:transparent; border-radius:6px; padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer; color:#64748b; transition:all 0.15s; letter-spacing:0.5px; }
        .ip-pill-btn.active { background:#1a1a2e; color:#ffffff; }
        .ip-axis-btn { border:none; background:transparent; border-radius:6px; padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer; color:#64748b; transition:all 0.15s; letter-spacing:0.5px; text-transform:uppercase; }
        .ip-axis-btn.active { background:#ef4444; color:#ffffff; }
        .ip-stat-chip { background:#f8fafc; border:1px solid #e8eaed; border-radius:8px; padding:8px 10px; display:flex; align-items:center; gap:8px; }
        .ip-proceed-btn { width:100%; padding:13px; border:none; border-radius:10px; background:linear-gradient(135deg,#ef4444,#dc2626); color:#fff; font-weight:900; font-size:13px; letter-spacing:1px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; margin-top:auto; }
        .ip-proceed-btn:hover { background:linear-gradient(135deg,#dc2626,#b91c1c); transform:translateY(-1px); box-shadow:0 6px 20px rgba(239,68,68,0.35); }
        .ip-add-btn { display:flex; align-items:center; justify-content:center; gap:6px; padding:8px; border-radius:8px; border:1.5px dashed #cbd5e1; background:transparent; color:#64748b; font-size:11px; font-weight:700; cursor:pointer; transition:all 0.15s; width:100%; margin-top:8px; }
        .ip-add-btn:hover { border-color:#94a3b8; background:#f8fafc; }
        .ip-badge { display:inline-flex; align-items:center; padding:2px 7px; border-radius:4px; font-size:9px; font-weight:800; letter-spacing:0.5px; text-transform:uppercase; }
        /* Quote Flow Active panels */
        .ip-qf-left { width:50%; min-width:400px; background:#ffffff; border-right:1.5px solid #e8eaed; display:flex; flex-direction:column; overflow:hidden; }
        .ip-qf-mid { flex:1; background:#ffffff; border-right:1.5px solid #e8eaed; overflow-y:auto; padding:24px 20px; min-width:0; }
        .ip-qf-right { width:460px; min-width:380px; background:#ffffff; display:flex; flex-direction:column; padding:16px 14px; overflow-y:auto; }
        .ip-qf-viewer { flex:1; position:relative; overflow:hidden; min-height:0; }
        .ip-qf-dims { padding:12px 14px; border-top:1.5px solid #e8eaed; background:#ffffff; flex-shrink:0; }
        .ip-back-btn { display:flex; align-items:center; gap:5px; padding:5px 12px; border-radius:8px; border:1.5px solid #e8eaed; background:#ffffff; color:#1e293b; font-size:11px; font-weight:700; cursor:pointer; letter-spacing:0.5px; transition:all 0.15s; }
        .ip-back-btn:hover { border-color:#94a3b8; background:#f8fafc; }
        @media (max-width: 1024px) {
          .ip-qf-left { width:100% !important; min-width:unset !important; border-right:none !important; border-bottom:1.5px solid #e8eaed; height:55vw; min-height:280px; max-height:400px; flex-shrink:0; }
          .ip-qf-mid { border-right:none !important; border-bottom:1.5px solid #e8eaed; padding:16px 14px; }
          .ip-qf-right { width:100% !important; min-width:unset !important; padding-bottom:24px; }
        }

        /* Modern Scrollbar Styling */
        .ip-right-panel::-webkit-scrollbar,
        .ip-qf-mid::-webkit-scrollbar,
        .ip-qf-right::-webkit-scrollbar,
        .instant-pricing-container::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .ip-right-panel::-webkit-scrollbar-track,
        .ip-qf-mid::-webkit-scrollbar-track,
        .ip-qf-right::-webkit-scrollbar-track,
        .instant-pricing-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .ip-right-panel::-webkit-scrollbar-thumb,
        .ip-qf-mid::-webkit-scrollbar-thumb,
        .ip-qf-right::-webkit-scrollbar-thumb,
        .instant-pricing-container::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }

        .ip-right-panel::-webkit-scrollbar-thumb:hover,
        .ip-qf-mid::-webkit-scrollbar-thumb:hover,
        .ip-qf-right::-webkit-scrollbar-thumb:hover,
        .instant-pricing-container::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
          background-clip: padding-box;
        }

        /* Firefox Support */
        .ip-right-panel, .ip-qf-mid, .ip-qf-right, .instant-pricing-container {
          scrollbar-width: thin;
          scrollbar-color: #e2e8f0 transparent;
        }
      `}</style>
      {!isQuoteFlowActive && (
        <header className="pricing-header text-center pt-5 pb-0 mb-0">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff0f0', border: '1px solid #fecaca', borderRadius: 999, padding: '4px 14px', marginBottom: 14 }}>
            <Zap size={13} color="#ef4444" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', letterSpacing: 1 }}>INSTANT ONLINE QUOTING</span>
          </div>
          <h1 className="fw-bold h2 text-uppercase letter-spacing-1">Get Instant Pricing</h1>
          {files.length === 0 && <p className="text-muted" style={{ maxWidth: 500, margin: '0 auto' }}>Upload your CAD files to get an immediate quote for your project. No account needed.</p>}
        </header>
      )}

      {files.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '0 20px 48px' }}>

          {/* ── How it works ─────────────────────────── */}
          <div style={{ width: '100%', maxWidth: 760, marginBottom: 28, display: 'flex', alignItems: 'stretch' }}>
            {[
              { num: '01', icon: <Upload size={18} />, label: 'Upload Your File', sub: 'DXF, DWG, STEP or STP' },
              { num: '02', icon: <Settings size={18} />, label: 'Configure Options', sub: 'Material, thickness & services' },
              { num: '03', icon: <Calculator size={18} />, label: 'Get Instant Quote', sub: 'Real-time price breakdown' },
              { num: '04', icon: <Shield size={18} />, label: 'Place Your Order', sub: 'Secure checkout & fast delivery' },
            ].map((step, i, arr) => (
              <React.Fragment key={i}>
                <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                    <div style={{ background: '#fff0f0', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>{step.icon}</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', letterSpacing: 1, marginBottom: 2 }}>STEP {step.num}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{step.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{step.sub}</div>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronRight size={15} color="#cbd5e1" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* ── Dropzone ──────────────────────────────── */}
          <div {...getRootProps()} className={`dropzone rounded-5 border-2 border-dashed p-5 text-center ${isDragActive ? 'bg-light border-primary' : 'bg-white border-secondary'}`} style={{ width: '100%', maxWidth: 760, cursor: 'pointer' }}>
            <input {...getInputProps()} />
            {isImporting ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={80} style={{ color: '#ef4444', animation: 'spin 1.5s linear infinite' }} />
                  <div style={{ position: 'absolute', fontSize: '12px', fontWeight: 900, color: '#ef4444' }}>{importProgress > 0 ? `${importProgress.toFixed(0)}%` : ''}</div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b', marginTop: '24px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  INITIALIZING IMPORT...
                </div>
              </div>
            ) : (
              <>
                <div className="file-icons-row d-flex justify-content-center gap-3 mb-4">
                  {['.dxf', '.dwg', '.step', '.stp'].map(ext => (
                    <div key={ext} className="file-icon-item p-3 border rounded-3 bg-light"><span className="fw-bold small">{ext}</span></div>
                  ))}
                </div>
                <h2 className="h3 fw-bold">Drop files here to get started</h2>
                <p className="text-muted fs-5">or</p>
                <button className="btn btn-danger btn-lg px-5 rounded-pill shadow-sm">BROWSE FILES</button>
              </>
            )}
          </div>

          {/* ── Trust / Capabilities strip ────────────── */}
          <div style={{ width: '100%', maxWidth: 760, marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {[
              { icon: <Shield size={13} />, text: 'Secure & Confidential' },
              { icon: <Zap size={13} />, text: 'Instant Price — No Wait' },
              { icon: <Layers size={13} />, text: 'Laser Cutting' },
              { icon: <Box size={13} />, text: 'Metal Bending' },
              { icon: <Settings size={13} />, text: 'Tapping & Hardware' },
              { icon: <Grid size={13} />, text: 'Powder Coating' },
              { icon: <TrendingDown size={13} />, text: 'Volume Discounts' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#475569' }}>
                <span style={{ color: '#ef4444' }}>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="qf-preview-container container-fluid p-0 h-100">
          {!isQuoteFlowActive ? (
            <div className="ip-panel-layout">

              {/* ── LEFT PANEL: File List ── */}
              <div className="ip-left-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#94a3b8' }}>
                    Files <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: '4px', padding: '1px 5px', marginLeft: '4px' }}>{files.length}</span>
                  </span>
                  <button style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }} onClick={() => { setFiles([]); setIsQuoteFlowActive(false); }}>Clear all</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  <AnimatePresence mode="popLayout">
                    {files.map(f => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        key={f.id}
                        className={`ip-file-card ${selectedFile?.id === f.id ? 'active' : ''}`}
                        onClick={() => setSelectedFile(f)}
                      >
                        <div className={`ip-file-icon ${selectedFile?.id === f.id ? 'active' : 'inactive'}`}>
                          <FileText size={14} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.file.name}</div>
                          <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '1px' }}>
                            {f.file.name.split('.').pop().toUpperCase()}
                          </div>
                        </div>
                        {selectedFile?.id === f.id
                          ? <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={9} color="#fff" /></div>
                          : <X size={13} color="#cbd5e1" style={{ flexShrink: 0, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} />
                        }
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <button className="ip-add-btn" {...getRootProps()}>
                  <Plus size={13} /> Add more files
                </button>
              </div>

              {/* ── CENTER PANEL: 3D Viewer ── */}
              <div className="ip-center-panel">
                <div className="ip-toolbar">
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div className="ip-pill-toggle">
                      <button className={`ip-pill-btn ${viewMode === '3d' ? 'active' : ''}`} onClick={() => { setViewMode('3d'); if (activeAxis === 'flat') { setActiveAxis('top'); setAxisCamera('top'); } }}>3D View</button>
                      <button className={`ip-pill-btn ${viewMode === '2d' ? 'active' : ''}`} onClick={() => { setViewMode('2d'); handleUnfold(); setActiveAxis('flat'); setAxisCamera('flat'); }}>2D View</button>
                    </div>
                    <div className="ip-pill-toggle">
                      {['top', 'front', 'side', 'flat']
                        .filter(ax => (viewMode === '3d' && ax !== 'flat') || (viewMode === '2d' && ax === 'flat'))
                        .map(ax => (
                          <button key={ax} className={`ip-axis-btn ${activeAxis === ax ? 'active' : ''}`} onClick={() => { setActiveAxis(ax); setAxisCamera(ax); }}>{ax}</button>
                        ))}
                    </div>
                  </div>
                  <div className="ip-pill-toggle">
                    <button className={`ip-pill-btn ${unit === 'mm' ? 'active' : ''}`} onClick={() => setUnit('mm')}>MM</button>
                    <button className={`ip-pill-btn ${unit === 'inch' ? 'active' : ''}`} onClick={() => setUnit('inch')}>INCH</button>
                  </div>
                </div>
                <div className="ip-viewer-frame qf-main-canvas">
                  {(isImporting || isCalculatingPrice || isDetectingHoles || isLoadingUnfold) && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 size={80} style={{ color: '#ef4444', animation: 'spin 1.5s linear infinite' }} />
                        <div style={{ position: 'absolute', fontSize: '12px', fontWeight: 900, color: '#ef4444' }}>{importProgress > 0 ? `${importProgress.toFixed(0)}%` : ''}</div>
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b', marginTop: '24px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        {isImporting ? 'Importing Asset...' : isLoadingUnfold ? 'Preparing Flat Pattern...' : isCalculatingPrice ? 'Calculating Quote...' : 'Analyzing Features...'}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginTop: '8px', letterSpacing: '0.5px' }}>
                        PLEASE WAIT WHILE WE PROCESS YOUR CAD DATA
                      </div>
                    </div>
                  )}
                  {(dxfError || backendError || holeDetectionError) && (
                    <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 3, background: '#fef2f2', color: '#ef4444', padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={12} />{dxfError || backendError || holeDetectionError}
                    </div>
                  )}
                  {viewMode === '3d' && currentIsStep && <div ref={stepViewerRef} style={{ width: '100%', height: '100%' }} />}
                  {viewMode === '2d' && currentIsStep && (backendData ? <FlatPatternViewer geometries={[]} options={{ highlightBends }} backendData={backendData} sourceFlatData={null} formatKind="drawing" /> : <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Preparing Pattern...</div>)}
                  {currentIsDxf && <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>{dxfSvg ? <div dangerouslySetInnerHTML={{ __html: dxfSvg }} /> : <div>Parsing...</div>}</div>}
                </div>
              </div>

              {/* ── RIGHT PANEL: Model Details ── */}
              <div className="ip-right-panel">
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#ef4444,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Info size={15} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', letterSpacing: '0.5px' }}>Model Details</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>Extracted from CAD file</div>
                  </div>
                </div>

                {/* File Info */}
                {selectedFile && (
                  <div style={{ marginBottom: 16 }}>
                    <div className="ip-section-title">File Info</div>
                    <div style={{ background: '#f8fafc', border: '1px solid #e8eaed', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fff0f0', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={16} color="#ef4444" />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFile.file.name}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 3, alignItems: 'center' }}>
                          <span className="ip-badge" style={{ background: '#dbeafe', color: '#1d4ed8' }}>{selectedFile.file.name.split('.').pop().toUpperCase()}</span>
                          <span className="ip-badge" style={{ background: '#dcfce7', color: '#15803d' }}>CAD MODEL</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {dimensions ? (
                  <>
                    {/* Dimensions */}
                    <div style={{ marginBottom: 16 }}>
                      <div className="ip-section-title">{unit === 'mm' ? 'Metric' : 'Imperial'} Dimensions</div>
                      {[
                        { label: 'Length', symbol: 'L', key: 'l', bg: '#eff6ff', iconBg: '#dbeafe', iconColor: '#3b82f6' },
                        { label: 'Width', symbol: 'W', key: 'w', bg: '#f0fdf4', iconBg: '#dcfce7', iconColor: '#22c55e' },
                        { label: 'Thickness', symbol: 'T', key: 't', bg: '#fff7ed', iconBg: '#fed7aa', iconColor: '#f97316' },
                      ].map(item => (
                        <div key={item.key} className="ip-dim-row" style={{ background: item.bg }}>
                          <div>
                            <div className="ip-dim-label">{item.label} <span style={{ opacity: 0.5 }}>({item.symbol})</span></div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 2 }}>
                              <span className="ip-dim-value" style={{ color: item.iconColor }}>
                                {unit === 'mm' ? dimensions.mm[item.key] : dimensions.inches[item.key]}
                              </span>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{unit}</span>
                            </div>
                          </div>
                          <div className="ip-dim-icon" style={{ background: item.iconBg }}>
                            {item.key === 't' ? <Shield size={14} color={item.iconColor} /> : <Box size={14} color={item.iconColor} />}
                          </div>
                        </div>
                      ))}
                      {selectedThickness && (
                        <div className="ip-dim-row" style={{ background: '#fdf4ff', border: '1.5px solid #e9d5ff' }}>
                          <div>
                            <div className="ip-dim-label">New Thickness <span style={{ opacity: 0.5 }}>(NT)</span></div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 2 }}>
                              <span className="ip-dim-value" style={{ color: '#a855f7' }}>
                                {unit === 'mm'
                                  ? (selectedThicknessMM || 0).toFixed(2)
                                  : parseFloat(selectedThickness).toFixed(3)}
                              </span>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{unit}</span>
                            </div>
                          </div>
                          <div className="ip-dim-icon" style={{ background: '#f3e8ff' }}>
                            <Layers size={14} color="#a855f7" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Analysis */}
                    <div style={{ marginBottom: 20 }}>
                      <div className="ip-section-title">Analysis</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div className="ip-stat-chip" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Volume</span>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>
                            {unit === 'mm' ? dimensions.mm.volume : dimensions.inches.volume}
                          </span>
                          <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>{unit === 'mm' ? 'mm³' : 'in³'}</span>
                        </div>
                        <div className="ip-stat-chip" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Footprint</span>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>
                            {unit === 'mm'
                              ? (parseFloat(dimensions.mm.l) * parseFloat(dimensions.mm.w) / 100).toFixed(1)
                              : (parseFloat(dimensions.inches.l) * parseFloat(dimensions.inches.w)).toFixed(3)}
                          </span>
                          <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>{unit === 'mm' ? 'cm²' : 'in²'}</span>
                        </div>
                        <div className="ip-stat-chip" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aspect Ratio</span>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>
                            {(parseFloat(dimensions.mm.l) / parseFloat(dimensions.mm.w)).toFixed(2)}
                          </span>
                          <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>L / W</span>
                        </div>
                        <div className="ip-stat-chip" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Format</span>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', fontFamily: 'monospace' }}>
                            {selectedFile?.file.name.split('.').pop().toUpperCase() || '—'}
                          </span>
                          <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>File type</span>
                        </div>
                      </div>
                    </div>

                    {/* Proceed */}
                    <button className="ip-proceed-btn" onClick={() => setIsQuoteFlowActive(true)}>
                      PROCEED TO QUOTE <ChevronRight size={16} />
                    </button>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 40 }}>
                    <Loader2 size={28} style={{ color: '#ef4444', animation: 'spin 1s linear infinite' }} />
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>CALCULATING DIMENSIONS...</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="ip-panel-layout">
              <div className="ip-qf-left">
                <div className="ip-toolbar">
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div className="ip-pill-toggle">
                      <button className={`ip-pill-btn ${viewMode === '3d' ? 'active' : ''}`} onClick={() => setViewMode('3d')}>3D VIEW</button>
                      <button className={`ip-pill-btn ${viewMode === '2d' ? 'active' : ''}`} onClick={() => { setViewMode('2d'); handleUnfold(); }}>2D FLAT</button>
                    </div>
                    <button className="ip-pill-btn" style={{ background: isModelFadedManually ? '#ef4444' : 'transparent', color: isModelFadedManually ? '#fff' : '#64748b', border: 'none' }} onClick={() => setIsModelFadedManually(!isModelFadedManually)}>FADE</button>
                    {isCountersinkingActive && !isModelFadedManually && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6, padding: '3px 8px', fontSize: '10px', fontWeight: 700, color: '#92400e', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 11 }}>⚠</span> Toggle FADE to view countersinks
                      </div>
                    )}
                  </div>
                  <button className="ip-back-btn" onClick={() => setIsQuoteFlowActive(false)}>
                    <ChevronLeft size={13} /> BACK
                  </button>
                </div>
                <div className="ip-qf-viewer">
                  {viewMode === '3d' && currentIsStep && <div ref={stepViewerRef} style={{ width: '100%', height: '100%' }} />}

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
                              fill: ${activeFinishColor ? (activeFinishColor.color || activeFinishColor.hex || 'rgba(0,0,0,0.4)') : 'rgba(0,0,0,0.05)'} !important;
                              fill-opacity: ${(isModelFadedManually || (activeTapHole !== null && !isAnodizingModalOpen)) ? 0.05 : (activeFinishColor ? 0.8 : 0.1)} !important;
                              stroke: ${activeFinishColor ? (activeFinishColor.color || activeFinishColor.hex) : '#000'} !important;
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
                </div>
                {dimensions && (
                  <div className="ip-qf-dims">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#94a3b8' }}>{unit === 'mm' ? 'Metric' : 'Imperial'} Dims</span>
                      <div className="ip-pill-toggle">
                        <button className={`ip-pill-btn ${unit === 'mm' ? 'active' : ''}`} onClick={() => setUnit('mm')}>MM</button>
                        <button className={`ip-pill-btn ${unit === 'inch' ? 'active' : ''}`} onClick={() => setUnit('inch')}>INCH</button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      {[
                        { label: 'L', key: 'l', color: '#3b82f6', bg: '#eff6ff' },
                        { label: 'W', key: 'w', color: '#22c55e', bg: '#f0fdf4' },
                        { label: 'T', key: 't', color: '#f97316', bg: '#fff7ed' },
                      ].map(item => (
                        <div key={item.key} style={{ background: item.bg, border: '1px solid #e8eaed', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                          <div style={{ fontSize: '14px', fontWeight: 900, color: item.color, fontFamily: 'monospace', lineHeight: 1.2 }}>{unit === 'mm' ? dimensions.mm[item.key] : dimensions.inches[item.key]}</div>
                          <div style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8' }}>{unit}</div>
                        </div>
                      ))}
                    </div>
                    {selectedThickness && (
                      <div style={{ marginTop: 6, background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New Thickness</div>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#a855f7', fontFamily: 'monospace', lineHeight: 1.2 }}>
                          {unit === 'mm'
                            ? (selectedThicknessMM || 0).toFixed(2)
                            : parseFloat(selectedThickness).toFixed(3)}
                        </div>
                        <div style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8' }}>{unit}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="ip-qf-mid">
                {!selectedProductionService ? (
                  <div className="animate-fade-in p-2">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div className="d-flex align-items-center gap-3">
                        <h2 className="fs-5 fw-bold m-0">Select production method:</h2>
                        <div className="d-flex align-items-center bg-white rounded-pill p-1 border shadow-sm" style={{ height: '24px', border: '1px solid #e2e8f0' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setProdUnit('mm'); }}
                            className={`btn btn-sm rounded-pill px-2 py-0 h-100 fw-black transition-all ${prodUnit === 'mm' ? 'bg-danger text-white shadow-sm' : 'text-muted'}`}
                            style={{ fontSize: '8px', border: 'none', minWidth: '32px' }}
                          >
                            MM
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setProdUnit('inch'); }}
                            className={`btn btn-sm rounded-pill px-2 py-0 h-100 fw-black transition-all ${prodUnit === 'inch' ? 'bg-danger text-white shadow-sm' : 'text-muted'}`}
                            style={{ fontSize: '8px', border: 'none', minWidth: '32px' }}
                          >
                            IN
                          </button>
                        </div>
                      </div>
                      <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-10 rounded-pill px-3 py-1 fw-normal text-uppercase letter-spacing-1" style={{ fontSize: '10px' }}>
                        {allServices.filter(s => !!s.is_production || s.is_production == "1").length} active
                      </span>
                    </div>
                    <div className="d-flex flex-column gap-2">
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
                          const minL = (parseFloat(svc.min_length) || 0) * unitRatio;
                          const minW = (parseFloat(svc.min_width) || 0) * unitRatio;
                          const minH = (parseFloat(svc.min_height) || 0) * unitRatio;
                          const svcMinLong = Math.max(minL, minW);
                          const svcMinShort = Math.min(minL, minW);
                          const fitMinL = svcMinLong === 0 || partMax >= svcMinLong;
                          const fitMinW = svcMinShort === 0 || partMin >= svcMinShort;
                          const fitMinH = minH === 0 || t >= minH;
                          if (!fitsMaxL || !fitsMaxW) return { fits: false, reason: `Exceeds max dimensions (${Math.round(svcMax)}×${Math.round(svcMin)}mm)` };
                          if (!fitsMaxH) return { fits: false, reason: `Exceeds max thickness (${Math.round(maxH)}mm)` };
                          if (!fitMinL || !fitMinW) return { fits: false, reason: `Below min dimensions (${Math.round(svcMinLong)}×${Math.round(svcMinShort)}mm)` };
                          if (!fitMinH) return { fits: false, reason: `Below min thickness (${Math.round(minH)}mm)` };
                          return { fits: true };
                        })();
                        return (
                          <button
                            key={svc.id}
                            disabled={!fits}
                            className={`btn text-start p-3 rounded-4 border-2 transition-all d-flex flex-column gap-2 position-relative ${fits
                              ? 'bg-white border-light-subtle shadow-sm hover-shadow hover-translate-y'
                              : 'bg-light opacity-50 cursor-not-allowed grayscale'
                              }`}
                            style={{
                              border: fits ? '1.5px solid #e8eaed' : '1.5px solid transparent',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            onClick={() => {
                              const title = svc.title.toLowerCase();
                              const isCNC = title.includes('cnc');

                              if (isCNC) {
                                const config = svc.pricing_config || {};
                                if (!config.base_setup && !config.price_per_width) {
                                  toast('This service (CNC) is not yet configured for pricing by admin.', 'error');
                                  return;
                                }
                              } else {
                                if (!svc.base_price && (!svc.pricing_rules || svc.pricing_rules.length === 0)) {
                                  // We'll be more lenient here as standard services might use the new decoupled model
                                  // but let's check if it has a base price at least
                                }
                              }
                              setSelectedProductionService(svc);
                            }}
                          >
                            <div className="d-flex justify-content-between align-items-center w-100">
                              <div className="d-flex align-items-center gap-2">
                                <div className={`p-2 rounded-3 ${fits ? 'bg-danger bg-opacity-10 text-danger' : 'bg-secondary bg-opacity-10 text-muted'}`}>
                                  {svc.title.toLowerCase().includes('cnc') ? <Box size={18} /> : <Zap size={18} />}
                                </div>
                                <strong className={`fs-5 d-block m-0 ${fits ? 'text-dark' : 'text-muted'}`}>{svc.title}</strong>
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
                            <span className="text-muted fw-medium" style={{ fontSize: '12px', lineHeight: '1.4' }}>
                              {svc.description}
                            </span>

                            {/* Size Constraints Display */}
                            <div className="mt-2 pt-2 border-top border-light-subtle d-flex flex-wrap gap-2">
                              {(() => {
                                const unitRatio = svc.dimensions_unit === 'in' ? 25.4 : 1;
                                const convert = (val) => {
                                  if (!val) return '0';
                                  const mmVal = parseFloat(val) * unitRatio;
                                  return prodUnit === 'mm' ? mmVal.toFixed(1) : (mmVal / 25.4).toFixed(2);
                                };
                                return (
                                  <>
                                    {(svc.max_length > 0 || svc.max_width > 0) && (
                                      <div className="d-flex align-items-center gap-1 bg-light px-2 py-1 rounded-2">
                                        <Maximize2 size={10} className="text-muted" />
                                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b' }}>
                                          MAX: {convert(svc.max_length)}{prodUnit} × {convert(svc.max_width)}{prodUnit}
                                        </span>
                                      </div>
                                    )}
                                    {(svc.min_length > 0 || svc.min_width > 0) && (
                                      <div className="d-flex align-items-center gap-1 bg-light px-2 py-1 rounded-2">
                                        <ArrowRight size={10} className="text-muted" style={{ transform: 'rotate(180deg)' }} />
                                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b' }}>
                                          MIN: {convert(svc.min_length)}{prodUnit} × {convert(svc.min_width)}{prodUnit}
                                        </span>
                                      </div>
                                    )}
                                    {(svc.max_height > 0 || svc.min_height > 0) && (
                                      <div className="d-flex align-items-center gap-1 bg-light px-2 py-1 rounded-2">
                                        <Layers size={10} className="text-muted" />
                                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b' }}>
                                          THICKNESS: {svc.min_height > 0 ? `${convert(svc.min_height)}${prodUnit} - ` : 'UP TO '}{convert(svc.max_height)}{prodUnit}
                                        </span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>

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
                ) : !selectedCategory ? (
                  <div className="animate-fade-in p-2">
                    <div style={{ background: '#f8fafc', border: '1.5px solid #e8eaed', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Zap size={13} color="#ef4444" />
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Method</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{selectedProductionService.title}</span>
                          <button className="btn btn-link text-danger text-decoration-none p-0 fw-bold" style={{ fontSize: '10px' }} onClick={() => setSelectedProductionService(null)}>CHANGE</button>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#1e293b' }}>Select Category</h2>
                      <span className="badge bg-danger bg-opacity-10 text-danger rounded-pill px-2 py-1 fw-bold text-uppercase" style={{ fontSize: '9px' }}>
                        {allCategories.filter(cat => allMetals.some(m => m.category_id === cat.id && m.services?.includes(selectedProductionService.id))).length} Categories
                      </span>
                    </div>

                    <div className="d-flex flex-column gap-2 pb-3">
                      {allCategories.map(cat => {
                        const catMetals = allMetals.filter(m => m.category_id === cat.id);
                        const isAvailable = catMetals.some(m => (m.services || []).map(id => Number(id)).includes(Number(selectedProductionService?.id)));
                        return (
                          <button
                            key={cat.id}
                            disabled={!isAvailable}
                            className={`btn text-start p-2 rounded-4 border transition-all d-flex align-items-center gap-3 px-4 w-100 ${isAvailable
                              ? 'bg-white border-light-subtle shadow-sm hover-shadow-sm hover-translate-y group'
                              : 'bg-light opacity-50 cursor-not-allowed grayscale border-transparent'
                              }`}
                            style={{
                              transition: 'all 0.2s ease-in-out',
                              minHeight: '60px'
                            }}
                            onClick={() => setSelectedCategory(cat)}
                          >
                            <div className={`p-2 rounded-3 transition-all border border-transparent ${isAvailable
                              ? 'bg-light group-hover-bg-danger group-hover-bg-opacity-10 group-hover-border-danger group-hover-border-opacity-10'
                              : 'bg-secondary bg-opacity-10'
                              }`}>
                              {cat.slug.includes('aluminum') ? <Layers size={18} className={isAvailable ? "group-hover-text-danger transition-all opacity-75" : "text-muted"} /> :
                                cat.slug.includes('steel') ? <Shield size={18} className={isAvailable ? "group-hover-text-danger transition-all opacity-75" : "text-muted"} /> :
                                  cat.slug.includes('brass') || cat.slug.includes('copper') ? <Zap size={18} className={isAvailable ? "group-hover-text-danger transition-all opacity-75" : "text-muted"} /> :
                                    <Box size={18} className={isAvailable ? "group-hover-text-danger transition-all opacity-75" : "text-muted"} />}
                            </div>
                            <div className="flex-grow-1">
                              <div className="d-flex align-items-center gap-2">
                                <strong className={`d-block m-0 fw-bold ${isAvailable ? 'text-dark' : 'text-muted'}`} style={{ fontSize: '14px' }}>{cat.name}</strong>
                                {!isAvailable && <span className="badge bg-secondary bg-opacity-10 text-muted rounded-pill px-2 py-0 fw-bold text-uppercase" style={{ fontSize: '8px' }}>NOT AVAILABLE</span>}
                              </div>
                              <span className="text-muted opacity-75 fw-bold text-uppercase d-block" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>{catMetals.length} Items</span>
                            </div>
                            {isAvailable && <ArrowRight size={16} className="text-danger opacity-0 group-hover-opacity-100 transition-all" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : !selectedMetal ? (
                  <div className="animate-fade-in">
                    {/* Compact breadcrumb card */}
                    <div style={{ background: '#f8fafc', border: '1.5px solid #e8eaed', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 7, marginBottom: 7, borderBottom: '1px solid #e8eaed' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Zap size={13} color="#ef4444" />
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Method</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{selectedProductionService.title}</span>
                          <button className="btn btn-link text-danger text-decoration-none p-0 fw-bold" style={{ fontSize: '10px' }} onClick={() => { setSelectedProductionService(null); setSelectedCategory(null); }}>CHANGE</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Grid size={13} color="#64748b" />
                          <span style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Category</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{selectedCategory.name}</span>
                          <button className="btn btn-link text-danger text-decoration-none p-0 fw-bold" style={{ fontSize: '10px' }} onClick={() => setSelectedCategory(null)}>CHANGE</button>
                        </div>
                      </div>
                    </div>

                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <button className="btn btn-light rounded-circle border p-1" onClick={() => setSelectedCategory(null)}>
                        <ChevronLeft size={16} className="text-dark" />
                      </button>
                      <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#1e293b' }}>Select Material</h2>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          type="text"
                          className="form-control rounded-pill border-light-subtle"
                          placeholder="Search materials..."
                          value={metalSearch}
                          onChange={(e) => setMetalSearch(e.target.value)}
                          style={{ height: '34px', fontSize: '12px', paddingLeft: '32px' }}
                        />
                        <Grid className="position-absolute translate-middle-y text-muted" style={{ top: '50%', left: '10px' }} size={13} />
                      </div>
                    </div>

                    <div className="d-flex flex-column gap-2">
                      {(() => {
                        const parseCutSizeStr = (sizeStr) => {
                          if (!sizeStr) return null;
                          const clean = sizeStr.replace(/['"]/g, '').replace(/\b(min|max)\b/gi, '').trim();
                          const parts = clean.split(/\s*[xX×]\s*/);
                          if (parts.length < 2) return null;
                          const a = parseFloat(parts[0]);
                          const b = parseFloat(parts[1]);
                          return (isNaN(a) || isNaN(b)) ? null : { l: Math.max(a, b), w: Math.min(a, b) };
                        };
                        return allMetals
                          .filter(m => Number(m.category_id) === Number(selectedCategory?.id))
                          .filter(m => m.name.toLowerCase().includes((metalSearch || '').toLowerCase()))
                          .map(m => {
                            const isCompatible = (m.services || []).map(id => Number(id)).includes(Number(selectedProductionService?.id));

                            const cutSizes = m.quick_look?.cutSizes || [];
                            const minEntry = cutSizes.find(cs => cs.label?.trim().toUpperCase() === 'A');
                            const maxEntry = cutSizes.find(cs => cs.label?.trim().toUpperCase() === 'B');
                            const minSize = parseCutSizeStr(minEntry?.size);
                            const maxSize = parseCutSizeStr(maxEntry?.size);

                            let _sizeBlock = null;
                            if (dimensions && (minSize || maxSize)) {
                              const ratio = 25.4;
                              const partLong = Math.max(parseFloat(dimensions.mm.l) || 0, parseFloat(dimensions.mm.w) || 0);
                              const partShort = Math.min(parseFloat(dimensions.mm.l) || 0, parseFloat(dimensions.mm.w) || 0);
                              const aboveMin = !minSize || (partLong >= minSize.l * ratio && partShort >= minSize.w * ratio);
                              const belowMax = !maxSize || (partLong <= maxSize.l * ratio && partShort <= maxSize.w * ratio);

                              if (!aboveMin) _sizeBlock = `Too small (min ${minEntry.size})`;
                              else if (!belowMax) _sizeBlock = `Too large (max ${maxEntry.size})`;
                            }

                            return { ...m, isCompatible, _sizeBlock, minSizeLabel: minEntry?.size, maxSizeLabel: maxEntry?.size };
                          })
                          .map(metal => {
                            const isDisabled = !metal.isCompatible || !!metal._sizeBlock;
                            return (
                              <button
                                key={metal.id}
                                disabled={isDisabled}
                                className={`btn text-start d-flex align-items-center justify-content-between transition-all ${isDisabled ? 'bg-light opacity-50 cursor-not-allowed grayscale' : 'text-dark bg-white shadow-sm hover-shadow hover-translate-y'}`}
                                style={{ padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${isDisabled ? 'transparent' : '#e8eaed'}` }}
                                onClick={() => !isDisabled && setSelectedMetal(metal)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                                  <div style={{ width: 34, height: 34, borderRadius: 8, background: metal.isCompatible ? '#f1f5f9' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flex_shrink: 0 }}>
                                    <Shield size={16} color={metal.isCompatible ? "#64748b" : "#94a3b8"} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div className="d-flex align-items-center gap-2">
                                      <div style={{ fontSize: '12px', fontWeight: 800, color: metal.isCompatible ? '#1e293b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{metal.name}</div>
                                      {!metal.isCompatible && <span className="badge bg-secondary bg-opacity-10 text-muted rounded-pill px-2 py-0 fw-bold text-uppercase" style={{ fontSize: '8px' }}>NOT SUPPORTED</span>}
                                    </div>

                                    {metal._sizeBlock ? (
                                      <span style={{ fontSize: '9px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>SIZE OUT OF RANGE — {metal._sizeBlock}</span>
                                    ) : (
                                      <div className="d-flex flex-column gap-1 mt-1">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span style={{ background: '#f1f5f9', borderRadius: 4, padding: '1px 6px', fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>IN STOCK</span>
                                          {metal.minSizeLabel && <span style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8' }}>MIN: {metal.minSizeLabel}</span>}
                                          {metal.maxSizeLabel && <span style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8' }}>MAX: {metal.maxSizeLabel}</span>}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {!isDisabled && <ArrowRight size={15} color="#ef4444" />}
                                {isDisabled && metal.isCompatible && <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 rounded-pill px-3 py-2 small fw-bold ms-2">SIZE OUT OF RANGE</span>}
                              </button>
                            );
                          });
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="animate-fade-in">
                    <div className="mb-4 bg-light p-4 rounded-5 small fw-bold d-flex flex-column gap-3 border border-light-subtle shadow-sm">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-2 text-muted fw-black text-uppercase letter-spacing-1" style={{ fontSize: '10px' }}>
                          <Zap size={14} className="text-danger" /> Method
                        </div>
                        <div className="d-flex align-items-center gap-3">
                          <span className="text-dark fw-black">{selectedProductionService.title}</span>
                          <button className="btn btn-link text-danger p-0 text-decoration-none small fw-bold transition-all hover-opacity-75" onClick={() => { setSelectedProductionService(null); setSelectedCategory(null); setSelectedMetal(null); }}>CHANGE</button>
                        </div>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-2 text-muted fw-black text-uppercase letter-spacing-1" style={{ fontSize: '10px' }}>
                          <Grid size={14} className="text-dark" /> Category
                        </div>
                        <div className="d-flex align-items-center gap-3">
                          <span className="text-dark fw-black">{selectedCategory?.name}</span>
                          <button className="btn btn-link text-danger p-0 text-decoration-none small fw-bold transition-all hover-opacity-75" onClick={() => { setSelectedCategory(null); setSelectedMetal(null); }}>CHANGE</button>
                        </div>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-2 text-muted fw-black text-uppercase letter-spacing-1" style={{ fontSize: '10px' }}>
                          <Shield size={14} className="text-dark" /> Metal
                        </div>
                        <div className="d-flex align-items-center gap-3">
                          <span className="text-dark fw-black">{selectedMetal.name}</span>
                          <button className="btn btn-link text-danger p-0 text-decoration-none small fw-bold transition-all hover-opacity-75" onClick={() => setSelectedMetal(null)}>CHANGE</button>
                        </div>
                      </div>
                      {selectedThickness && (
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center gap-2 text-muted fw-black text-uppercase letter-spacing-1" style={{ fontSize: '10px' }}>
                            <TrendingDown size={14} className="text-dark" /> Thickness
                          </div>
                          <div className="d-flex align-items-center gap-3">
                            <span className="text-dark fw-black">{selectedThickness}"</span>
                            <button className="btn btn-link text-danger p-0 text-decoration-none small fw-bold transition-all hover-opacity-75" onClick={() => setSelectedThickness(null)}>CHANGE</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Step: Select Thickness ── */}
                    {!selectedThickness ? (
                      <div className="animate-fade-in">
                        <h2 className="h4 fw-bold mb-2">Select Thickness</h2>
                        <p className="text-muted small mb-4">Choose the standard thickness for {selectedMetal.name}</p>
                        <div className="d-flex flex-column gap-2">
                          {(selectedMetal.quick_look?.thicknesses || []).map(t => (
                            <button
                              key={t.value}
                              className="btn text-start p-3 rounded-4 border-2 bg-white border-light-subtle shadow-sm transition-all hover-border-danger translate-y-hover"
                              style={{ border: '1.5px solid #e8eaed' }}
                              onClick={() => setSelectedThickness(t.value)}
                            >
                              <div className="d-flex justify-content-between align-items-center">
                                <div>
                                  <strong>{t.label || t.value}"</strong>
                                  {t.metric && <span className="text-muted ms-2 small">({t.metric})</span>}
                                </div>
                                <ArrowRight size={15} color="#ef4444" />
                              </div>
                            </button>
                          ))}
                          {!(selectedMetal.quick_look?.thicknesses?.length) && (
                            <p className="text-muted small">No standard thicknesses configured for this material.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="animate-fade-in">
                        <h2 className="h4 fw-bold mb-2">Additional Services</h2>
                        <p className="text-muted small mb-4">Enhance your part with extra processes</p>
                        <div className="d-flex flex-column gap-3">
                          {allServices.filter(svc => {
                            // Must be a sub-service of the selected production service
                            const parentIds = (svc.parent_ids || []).map(id => Number(id));
                            if (!parentIds.includes(Number(selectedProductionService?.id))) return false;

                            // Filter by what this metal+thickness actually supports
                            if (selectedMetal) {
                              // Collect allowed service IDs: from selected thickness if chosen, else union of all thicknesses
                              const allowedIds = new Set();
                              (selectedMetal.services || []).forEach(id => allowedIds.add(Number(id)));
                              if (selectedThickness) {
                                const t = (selectedMetal.quick_look?.thicknesses || []).find(t => String(t.value) === String(selectedThickness));
                                (t?.services || []).forEach(id => allowedIds.add(Number(id)));
                              } else {
                                (selectedMetal.quick_look?.thicknesses || []).forEach(t => {
                                  (t.services || []).forEach(id => allowedIds.add(Number(id)));
                                });
                              }
                              if (allowedIds.size > 0 && !allowedIds.has(Number(svc.id))) return false;
                            }

                            return true;
                          }).map(svc => {
                            const isSelected = selectedAdditionalServices.some(s => s.id === svc.id);
                            const title = svc.title.toLowerCase();
                            const isTap = title.includes('tap');
                            const isFinish = title.includes('anodiz') || title.includes('powder coat');
                            const isHardware = title.includes('hardware');
                            const isCS = title.includes('countersink');

                            return (
                              <div key={svc.id} className={`position-relative rounded-4 border-2 p-4 transition-all ${isSelected ? 'border-danger bg-danger bg-opacity-5' : 'border-light bg-white hover-bg-light shadow-none'}`} style={{ cursor: 'pointer' }} onClick={() => {
                                if (isFinish) {
                                  if (!isSelected) { setSelectedAdditionalServices(p => [...p, svc]); setActiveFinishSvcId(svc.id); setIsAnodizingModalOpen(true); }
                                  else { setSelectedAdditionalServices(p => p.filter(x => x.id !== svc.id)); setSelectedFinishColors(p => { const n = { ...p }; delete n[svc.id]; return n; }); }
                                } else if (isTap) {
                                  if (!isSelected) { setSelectedAdditionalServices(p => [...p, svc]); setActiveHwHole(null); if (detectedHoles.length > 0) setActiveTapHole(detectedHoles[0]); }
                                  else { setSelectedAdditionalServices(p => p.filter(x => x.id !== svc.id)); setSelectedTaps({}); setActiveTapHole(null); }
                                } else if (isHardware) {
                                  if (!isSelected) { setSelectedAdditionalServices(p => [...p, svc]); setActiveTapHole(null); if (detectedHoles.length > 0) setActiveHwHole(detectedHoles[0]); }
                                  else { setSelectedAdditionalServices(p => p.filter(x => x.id !== svc.id)); setSelectedHardware({}); setActiveHwHole(null); setHwItemsByType({}); }
                                } else if (isCS) {
                                  if (!isSelected) { setSelectedAdditionalServices(p => [...p, svc]); setActiveTapHole(null); setActiveHwHole(null); if (detectedHoles.length > 0) setActiveCSHole(detectedHoles[0]); }
                                  else { setSelectedAdditionalServices(p => p.filter(x => x.id !== svc.id)); setSelectedCountersinks({}); setActiveCSHole(null); }
                                } else {
                                  setSelectedAdditionalServices(p => isSelected ? p.filter(x => x.id !== svc.id) : [...p, svc]);
                                }
                              }}>
                                <div className="d-flex align-items-center gap-3">
                                  <div className={`rounded-circle border d-flex align-items-center justify-content-center ${isSelected ? 'bg-white border-white text-danger' : 'bg-white border-secondary border-opacity-25'}`} style={{ width: '28px', height: '28px', flexShrink: 0 }}>
                                    {isSelected ? <Check size={16} strokeWidth={4} /> : <div />}
                                  </div>
                                  <div className="flex-grow-1 overflow-hidden">
                                    <strong className={`d-block fs-5 fw-black ${isSelected ? 'text-white' : 'text-dark'}`}>{svc.title}</strong>
                                    <p className={`m-0 text-truncate ${isSelected ? 'text-white opacity-80' : 'text-muted'}`} style={{ fontSize: '12px' }}>{svc.description || 'Premium process'}</p>

                                    <div className="mt-2 d-flex flex-wrap gap-2">
                                      {(() => {
                                        const unitRatio = svc.dimensions_unit === 'in' ? 25.4 : 1;
                                        const convert = (val) => { if (!val) return '0'; return (parseFloat(val) * unitRatio).toFixed(1); };
                                        return (
                                          <>
                                            {(svc.max_length > 0 || svc.max_width > 0) && (
                                              <div className={`d-flex align-items-center gap-1 px-2 py-0.5 rounded-2 ${isSelected ? 'bg-white bg-opacity-20 text-white' : 'bg-light text-muted'}`}>
                                                <Maximize2 size={9} />
                                                <span style={{ fontSize: '9px', fontWeight: 800 }}>MAX: {convert(svc.max_length)}mm × {convert(svc.max_width)}mm</span>
                                              </div>
                                            )}
                                            {(svc.max_height > 0 || svc.min_height > 0) && (
                                              <div className={`d-flex align-items-center gap-1 px-2 py-0.5 rounded-2 ${isSelected ? 'bg-white bg-opacity-20 text-white' : 'bg-light text-muted'}`}>
                                                <Layers size={9} />
                                                <span style={{ fontSize: '9px', fontWeight: 800 }}>THICKNESS: {svc.min_height > 0 ? `${convert(svc.min_height)}mm - ` : ''}{convert(svc.max_height)}mm</span>
                                              </div>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
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
                                        <span className="fw-black text-white fs-4">{Object.keys(selectedTaps).length}</span>
                                      </div>
                                    </div>
                                    <button className="btn btn-white btn-sm rounded-pill px-4 fw-black shadow-sm text-danger h-auto py-2" onClick={(e) => { e.stopPropagation(); setActiveTapHole(detectedHoles[0]); }}>MANAGE</button>
                                  </div>
                                )}

                                {isSelected && isHardware && detectedHoles.length > 0 && (
                                  <div className="mt-4 pt-3 border-top border-white border-opacity-20 d-flex justify-content-between align-items-center animate-fade-in">
                                    <div className="d-flex gap-4 align-items-end">
                                      <div className="d-flex flex-column">
                                        <span className="text-white opacity-60 fw-bold" style={{ fontSize: '10px', letterSpacing: '1px' }}>HOLES</span>
                                        <span className="fw-black text-white fs-4">{detectedHoles.length}</span>
                                      </div>
                                      <div className="d-flex flex-column">
                                        <span className="text-white opacity-60 fw-bold" style={{ fontSize: '10px', letterSpacing: '1px' }}>ASSIGNED</span>
                                        <span className="fw-black text-white fs-4">{Object.keys(selectedHardware).length}</span>
                                      </div>
                                      {Object.keys(selectedHardware).length > 0 && (
                                        <div className="d-flex gap-1 flex-wrap mb-1">
                                          {HW_TYPES.filter(t => Object.values(selectedHardware).some(h => h.typeId === t.id)).map(t => (
                                            <span key={t.id} className="badge rounded-pill fw-bold" style={{ fontSize: '9px', background: t.color }}>{t.label}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <button className="btn btn-sm rounded-pill px-4 fw-black shadow-sm h-auto py-2" style={{ background: 'white', color: '#B8860B', border: 'none', fontSize: '12px' }} onClick={(e) => { e.stopPropagation(); setActiveHwHole(detectedHoles[0]); }}>MANAGE</button>
                                  </div>
                                )}

                                {isSelected && isCS && detectedHoles.length > 0 && (
                                  <div className="mt-4 pt-3 border-top border-white border-opacity-20 d-flex justify-content-between align-items-center animate-fade-in">
                                    <div className="d-flex gap-5">
                                      <div className="d-flex flex-column">
                                        <span className="text-white opacity-60 fw-bold" style={{ fontSize: '10px', letterSpacing: '1px' }}>HOLES</span>
                                        <span className="fw-black text-white fs-4">{detectedHoles.length}</span>
                                      </div>
                                      <div className="d-flex flex-column">
                                        <span className="text-white opacity-60 fw-bold" style={{ fontSize: '10px', letterSpacing: '1px' }}>COUNTERSUNK</span>
                                        <span className="fw-black text-white fs-4">{Object.keys(selectedCountersinks).length}</span>
                                      </div>
                                    </div>
                                    <button className="btn btn-white btn-sm rounded-pill px-4 fw-black shadow-sm h-auto py-2" style={{ color: '#7c3aed' }} onClick={(e) => { e.stopPropagation(); setActiveCSHole(detectedHoles[0]); }}>MANAGE</button>
                                  </div>
                                )}

                                {isSelected && isFinish && selectedFinishColors[svc.id] && (
                                  <div className="mt-4 pt-3 border-top border-white border-opacity-20 d-flex justify-content-between align-items-center animate-fade-in">
                                    <div className="d-flex align-items-center gap-3">
                                      <div className="rounded-circle shadow-lg" style={{ backgroundColor: selectedFinishColors[svc.id].color, width: '24px', height: '24px', border: '3px solid white' }} />
                                      <span className="fw-black text-white fs-6">{(selectedFinishColors[svc.id].name || '').toUpperCase()} {selectedFinishColors[svc.id].is_wrinkled ? '(WRINKLED)' : ''}</span>
                                    </div>
                                    <button className="btn btn-link text-white p-0 text-decoration-none small fw-black fs-6" onClick={(e) => { e.stopPropagation(); setActiveFinishSvcId(svc.id); setIsAnodizingModalOpen(true); }}>CHANGE</button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="ip-qf-right">
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

                    <div className="bg-dark text-white rounded-5 shadow-22xl position-relative mb-3 mt-auto d-flex flex-column" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', maxHeight: '60vh', overflow: 'hidden' }}>
                      <div className="position-relative z-1 d-flex flex-column h-100" style={{ overflow: 'hidden' }}>
                        <div className="p-4 pb-2 ip-breakdown-scroll" style={{ overflowY: 'auto', flex: 1 }}>
                          <span className="small text-white opacity-50 fw-bold text-uppercase letter-spacing-1 d-block mb-3">Project Breakdown</span>
                          <div className="d-flex flex-column gap-3 mb-4 p-4 rounded-4 border border-white border-opacity-10" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                            <div className="d-flex justify-content-between align-items-center">
                              <div className="d-flex flex-column">
                                <span className="opacity-70 small">Material Cost</span>
                                <span className="text-white-50" style={{ fontSize: '10px' }}>
                                  {isLoadingUnfold ? 'Analysing part geometry…' : 'Sheet nesting formula — cost ÷ parts per 4×8 sheet'}
                                </span>
                              </div>
                              {isCalculatingPrice ? <PriceSkeleton /> : (
                                <span className="fw-black fs-5">${(priceEstimate?.breakdown?.material_cost || 0).toFixed(2)}</span>
                              )}
                            </div>

                            <div className="d-flex justify-content-between align-items-center pt-2 border-top border-white border-opacity-10">
                              <div className="d-flex flex-column">
                                <span className="opacity-70 small">Fabrication cost</span>
                                <span className="text-white-50" style={{ fontSize: '10px' }}>
                                  {isLoadingUnfold
                                    ? 'Analysing part geometry…'
                                    : selectedProductionService?.title + ' setup & process'}
                                </span>
                              </div>
                              {isCalculatingPrice || isLoadingUnfold ? <PriceSkeleton /> : (
                                <span className="fw-black fs-5">${(priceEstimate?.breakdown?.production_cost || 0).toFixed(2)}</span>
                              )}
                            </div>

                            {/* Detailed Service Breakdown */}
                            {(priceEstimate?.breakdown?.service_breakdown || []).filter(svc => !svc.name?.toLowerCase().includes('tapping') && !svc.name?.toLowerCase().includes('hardware') && !svc.name?.toLowerCase().includes('countersink')).map((svc, idx) => (
                              <div key={idx} className="d-flex justify-content-between align-items-center pt-2 border-top border-white border-opacity-10">
                                <div className="d-flex flex-column">
                                  <span className="opacity-70 small">{svc.name}</span>
                                  <span className="text-white-50" style={{ fontSize: '10px' }}>Configured Finish</span>
                                </div>
                                {isCalculatingPrice ? <PriceSkeleton /> : (
                                  <span className="fw-black fs-5">${parseFloat(svc.price || 0).toFixed(2)}</span>
                                )}
                              </div>
                            ))}

                            {(() => {
                              const tapTotal = Object.values(selectedTaps).reduce((acc, t) => acc + (parseFloat(t.price) || 0), 0);
                              if (tapTotal <= 0) return null;
                              const tapCount = Object.values(selectedTaps).length;
                              return (
                                <div className="d-flex justify-content-between align-items-center pt-2 border-top border-white border-opacity-10">
                                  <div className="d-flex flex-column">
                                    <span className="opacity-70 small">Tapping Cost</span>
                                    <span className="text-white-50" style={{ fontSize: '10px' }}>{tapCount} hole{tapCount !== 1 ? 's' : ''} configured</span>
                                  </div>
                                  {isCalculatingPrice ? <PriceSkeleton /> : (
                                    <span className="fw-black fs-5">${tapTotal.toFixed(2)}</span>
                                  )}
                                </div>
                              );
                            })()}

                            {(() => {
                              const hwTotal = Object.values(selectedHardware).reduce((acc, { item }) => acc + (parseFloat(item?.price) || 0), 0);
                              if (hwTotal <= 0) return null;
                              const hwCount = Object.values(selectedHardware).length;
                              const usedTypes = HW_TYPES.filter(t => Object.values(selectedHardware).some(h => h.typeId === t.id));
                              return (
                                <div className="d-flex justify-content-between align-items-center pt-2 border-top border-white border-opacity-10">
                                  <div className="d-flex flex-column">
                                    <span className="opacity-70 small">Hardware Cost</span>
                                    <span className="text-white-50" style={{ fontSize: '10px' }}>{hwCount} hole{hwCount !== 1 ? 's' : ''} · {usedTypes.map(t => t.label).join(', ')}</span>
                                  </div>
                                  {isCalculatingPrice ? <PriceSkeleton /> : (
                                    <span className="fw-black fs-5">${hwTotal.toFixed(2)}</span>
                                  )}
                                </div>
                              );
                            })()}

                            {(() => {
                              const csTotal = Object.values(selectedCountersinks).reduce((acc, cs) => acc + (parseFloat(cs.price) || 0), 0);
                              if (csTotal <= 0) return null;
                              const csCount = Object.values(selectedCountersinks).length;
                              return (
                                <div className="d-flex justify-content-between align-items-center pt-2 border-top border-white border-opacity-10">
                                  <div className="d-flex flex-column">
                                    <span className="opacity-70 small">Countersinking Cost</span>
                                    <span className="text-white-50" style={{ fontSize: '10px' }}>{csCount} hole{csCount !== 1 ? 's' : ''} countersunk</span>
                                  </div>
                                  {isCalculatingPrice ? <PriceSkeleton /> : (
                                    <span className="fw-black fs-5">${csTotal.toFixed(2)}</span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* ── Discount row ── */}
                          {priceEstimate?.breakdown?.discount_percent > 0 && (() => {
                            const discountPct = parseFloat(priceEstimate.breakdown.discount_percent) / 100;
                            const extraPerPiece =
                              Object.values(selectedTaps).reduce((a, t) => a + (parseFloat(t.price) || 0), 0) +
                              Object.values(selectedHardware).reduce((a, { item }) => a + (parseFloat(item?.price) || 0), 0) +
                              Object.values(selectedCountersinks).reduce((a, cs) => a + (parseFloat(cs.price) || 0), 0);
                            const fullUnitPrice = (priceEstimate.breakdown.unit_total || 0) + extraPerPiece;
                            const totalDiscount = fullUnitPrice * discountPct * quantity;
                            return (
                              <div className="d-flex justify-content-between align-items-center px-3 py-2 rounded-3 mb-2" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                                <div className="d-flex flex-column">
                                  <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.82rem' }}>
                                    Quantity Discount ({priceEstimate.breakdown.discount_percent}% off)
                                  </span>
                                  <span style={{ color: 'rgba(74,222,128,0.7)', fontSize: '10px' }}>
                                    {priceEstimate.breakdown.applied_tier?.name || `${quantity} units`}
                                  </span>
                                </div>
                                {isCalculatingPrice ? <PriceSkeleton /> : (
                                  <span style={{ color: '#4ade80', fontWeight: 800, fontSize: '1.05rem' }}>
                                    −${totalDiscount.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            );
                          })()}

                          <div className="text-center">
                            <span className="small text-white fw-bold text-uppercase letter-spacing-1 d-block mb-1">Total Project Estimate</span>
                            <div className="d-flex align-items-baseline justify-content-center gap-2">
                              {isCalculatingPrice ? <PriceSkeleton width="150px" height="42px" /> : (
                                <>
                                  <span className="fs-4 text-danger fw-black">$</span>
                                  <strong className="fs-huge fw-black text-danger">
                                    {(() => {
                                      const discountPct = parseFloat(priceEstimate?.breakdown?.discount_percent || 0) / 100;
                                      const extraPerPiece =
                                        Object.values(selectedTaps).reduce((a, t) => a + (parseFloat(t.price) || 0), 0) +
                                        Object.values(selectedHardware).reduce((a, { item }) => a + (parseFloat(item?.price) || 0), 0) +
                                        Object.values(selectedCountersinks).reduce((a, cs) => a + (parseFloat(cs.price) || 0), 0);
                                      const fullUnitPrice = (priceEstimate?.breakdown?.unit_total || 0) + extraPerPiece;
                                      return (fullUnitPrice * (1 - discountPct) * quantity).toFixed(2);
                                    })()}
                                  </strong>
                                </>
                              )}
                            </div>

                            {/* ── Warnings ── */}
                            {(priceEstimate?.breakdown?.warnings?.length > 0) && (
                              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {priceEstimate.breakdown.warnings.map((w, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', borderRadius: 10, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
                                    <AlertTriangle size={14} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
                                    <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 600, lineHeight: 1.4 }}>{w}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="p-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
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
                    <span className="text-muted fw-bold text-uppercase letter-spacing-2" style={{ fontSize: '14px' }}>Diameter: {Number(activeTapHole.diameterInches || 0).toFixed(4)}&quot; ({Number((activeTapHole.diameterInches || 0) * 25.4).toFixed(3)} mm)</span>
                    <span className="text-muted fw-bold text-uppercase letter-spacing-2" style={{ fontSize: '14px' }}>Tap Height: {Number(activeTapHole.depthMm || 0).toFixed(2)} mm ({Number(activeTapHole.depthInches || 0).toFixed(4)}&quot;)</span>
                  </div>
                </div>
                <button className="btn-close action-btn-hover p-3 rounded-circle shadow-none" onClick={() => setActiveTapHole(null)} />
              </div>

              <div className="flex-grow-1 d-flex overflow-hidden bg-white">
                <div className="border-end bg-light-subtle bg-opacity-20 p-4 overflow-auto hide-scrollbar" style={{ width: '320px' }}>
                  <div className="mb-4 px-2 d-flex justify-content-between align-items-center">
                    <h4 className="fw-black text-muted text-uppercase letter-spacing-2 m-0" style={{ fontSize: '13px' }}>Detected Holes</h4>
                    <span className="badge bg-white border text-muted rounded-pill px-2 py-1 fw-bold" style={{ fontSize: '11px' }}>{detectedHoles.length}</span>
                  </div>
                  {holeGroups.map((group) => {
                    const isExpanded = expandedGroups.has(group.dia);
                    const tappedCount = group.holes.filter(h => !!selectedTaps[h.id]).length;
                    const allTapped = tappedCount === group.holes.length;
                    const tapSvc = allServices.find(s => s.title.toLowerCase().includes('tap'));
                    const isCompatible = (tapSvc?.service_options || []).some(tap =>
                      parseFloat(group.dia) >= parseFloat(tap.min_diameter) &&
                      parseFloat(group.dia) <= parseFloat(tap.max_diameter)
                    );
                    const bestTap = (tapSvc?.service_options || []).find(tap =>
                      parseFloat(group.dia) >= parseFloat(tap.min_diameter) &&
                      parseFloat(group.dia) <= parseFloat(tap.max_diameter)
                    );

                    return (
                      <div key={group.dia} className="mb-2">
                        {/* Group header */}
                        <div
                          className={`p-3 rounded-4 cursor-pointer border-2 d-flex align-items-center justify-content-between transition-all ${isExpanded ? 'bg-danger text-white border-danger shadow-sm' : 'bg-white border-light-subtle shadow-xs'}`}
                          onClick={() => setExpandedGroups(prev => {
                            const next = new Set(prev);
                            next.has(group.dia) ? next.delete(group.dia) : next.add(group.dia);
                            return next;
                          })}
                        >
                          <div className="d-flex align-items-center gap-2">
                            <ChevronDown
                              size={13}
                              style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                              className={isExpanded ? 'text-white' : 'text-muted'}
                            />
                            <div>
                              <span className="fw-black" style={{ fontSize: '14px' }}>&Oslash; {group.dia}&quot;</span>
                              <span className="ms-2 fw-bold" style={{ fontSize: '12px', opacity: 0.7 }}>
                                &times; {group.holes.length}
                              </span>
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            {allTapped && <Check size={13} className={isExpanded ? 'text-white' : 'text-success'} strokeWidth={3} />}
                            {!allTapped && tappedCount > 0 && (
                              <span className={`badge rounded-pill fw-bold ${isExpanded ? 'bg-white text-danger' : 'bg-danger text-white'}`} style={{ fontSize: '10px' }}>
                                {tappedCount}/{group.holes.length}
                              </span>
                            )}
                            {!isCompatible && <AlertCircle size={13} className={isExpanded ? 'text-white' : 'text-danger'} />}
                          </div>
                        </div>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="ps-2 pt-1">
                            {/* Tap All button */}
                            {group.holes.length > 1 && bestTap && (
                              <button
                                className="btn btn-sm w-100 mb-2 rounded-3 fw-bold border-danger text-danger bg-white"
                                style={{ fontSize: '12px' }}
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedTaps(prev => {
                                    const next = { ...prev };
                                    group.holes.forEach(h => { next[h.id] = { ...bestTap, hole: h }; });
                                    return next;
                                  });
                                }}
                              >
                                Tap all {group.holes.length} &rarr; {bestTap.name}
                              </button>
                            )}
                            {/* Individual holes */}
                            {group.holes.map(hole => {
                              const isTapped = !!selectedTaps[hole.id];
                              const isActive = activeTapHole?.id === hole.id;
                              const globalIdx = detectedHoles.findIndex(h => h.id === hole.id);
                              return (
                                <motion.div
                                  key={hole.id} layout
                                  className={`p-3 rounded-4 mb-1 cursor-pointer border-2 d-flex align-items-center justify-content-between ${isActive ? 'border-danger bg-danger text-white shadow-sm' : 'border-transparent bg-light hover-bg-white shadow-xs'}`}
                                  onClick={() => setActiveTapHole(hole)}
                                  whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}
                                >
                                  <div className="d-flex align-items-center gap-2">
                                    <div
                                      className={`rounded-circle d-flex align-items-center justify-content-center fw-black ${isActive ? 'bg-white text-danger' : isTapped ? 'bg-success text-white' : 'bg-white text-muted border'}`}
                                      style={{ width: '26px', height: '26px', fontSize: '12px' }}
                                    >
                                      {globalIdx + 1}
                                    </div>
                                    <span className={`fw-bold ${isActive ? 'text-white' : 'text-dark'}`} style={{ fontSize: '13px' }}>
                                      {isTapped ? selectedTaps[hole.id].name : 'Not Tapped'}
                                    </span>
                                  </div>
                                  {isTapped && !isActive && <Check size={13} className="text-success" strokeWidth={3} />}
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </div>
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
                            <h4 className="fw-black text-muted mb-4 d-flex align-items-center gap-2" style={{ fontSize: '13px', letterSpacing: '2px' }}><Check size={14} className="text-success" /> RECOMMENDED TAPS</h4>
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
                                        <span className={`fw-bold font-monospace ${isChosen ? 'text-white opacity-80' : 'text-muted'}`} style={{ fontSize: '12px' }}>{tap.min_diameter}&quot; - {tap.max_diameter}&quot;</span>
                                        <div className={`rounded-circle ${isChosen ? 'bg-white opacity-40' : 'bg-light-subtle'}`} style={{ width: '3px', height: '3px' }} />
                                        <span className={`fw-black ${isChosen ? 'text-white ripple-infinite' : 'text-danger'}`} style={{ fontSize: '13px' }}>+${tap.price || '0.00'}/HOLE</span>
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
                            <h4 className="fw-black text-muted mb-4 d-flex align-items-center gap-2 opacity-50" style={{ letterSpacing: '2px', fontSize: '13px' }}><AlertTriangle size={18} /> INCOMPATIBLE TAP SIZES (SELECTABLE WITH WARNING)</h4>
                            <div className="d-grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                              {incompatible.map((tap, idx) => {
                                const isChosen = assigned?.name === tap.name;
                                return (
                                  <motion.button key={idx} className={`btn text-start p-4 rounded-4 border-2 transition-all d-flex align-items-center gap-3 ${isChosen ? 'border-warning bg-warning shadow-warning' : 'bg-white border-light-subtle shadow-xs op-hover-100'}`} onClick={() => setSelectedTaps(prev => ({ ...prev, [activeTapHole.id]: { ...tap, hole: activeTapHole } }))} whileTap={{ scale: 0.98 }}>
                                    <div className={`p-3 rounded-4 ${isChosen ? 'bg-white text-warning' : 'bg-light text-muted'}`}>
                                      <AlertCircle size={20} />
                                    </div>
                                    <div className="flex-grow-1">
                                      <strong className={`d-block fw-black mb-1 ${isChosen ? 'text-white' : 'text-muted'}`} style={{ fontSize: '15px' }}>{tap.name}</strong>
                                      <span className={`fw-bold d-block ${isChosen ? 'text-white opacity-80' : 'text-danger'}`} style={{ fontSize: '12px' }}>Requires {tap.min_diameter}&quot; - {tap.max_diameter}&quot;</span>
                                      <span className={`fw-black ${isChosen ? 'text-white' : 'text-muted'}`} style={{ fontSize: '13px' }}>+${tap.price || '0.00'}/HOLE</span>
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
                <button className="btn btn-link text-muted text-decoration-none fw-bold hover-text-dark transition-all" style={{ fontSize: '15px' }} onClick={() => setSelectedTaps(p => { const n = { ...p }; delete n[activeTapHole.id]; return n; })}>CLEAR SELECTION</button>
                <button className="btn btn-dark px-5 py-3 rounded-pill fw-black shadow-lg hover-translate-y transition-all border-0" onClick={() => setActiveTapHole(null)}>DISMISS CONFIGURATOR</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {activeHwHole && (() => {
          const activeType = HW_TYPES.find(t => t.id === activeHwType) || HW_TYPES[0];
          const activeItems = (hwItemsByType[activeHwType] || []).filter(it => it.is_active !== false);
          const assignedHw = selectedHardware[activeHwHole.id];
          return (
            <motion.div key="hardware-modal" className="position-fixed inset-0 d-flex align-items-center justify-content-center z-10000" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ backdropFilter: 'blur(16px)', background: 'rgba(15,23,42,0.6)' }}>
              <motion.div className="overflow-hidden d-flex flex-column" style={{ width: '95%', maxWidth: '1200px', height: '88vh', borderRadius: '24px', background: '#ffffff', boxShadow: '0 40px 80px -20px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.04)', position: 'relative', zIndex: 10001 }} initial={{ scale: 0.96, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, y: 20, opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 350 }}>

                {/* ── Header ── */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${activeType.color}18, ${activeType.color}08)`, border: `1.5px solid ${activeType.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Boxes size={20} style={{ color: activeType.color }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 900, margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>Hardware Insertion</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', fontFamily: 'monospace' }}>&Oslash; {Number(activeHwHole.diameterInches || 0).toFixed(4)}&quot;</span>
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1' }} />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>{Number(activeHwHole.depthMm || activeHwHole.depth_mm || 0).toFixed(2)} mm depth</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', padding: 3, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', gap: 2 }}>
                      {HW_TYPES.map(t => (
                        <button
                          key={t.id}
                          style={{
                            border: 'none', borderRadius: 10, padding: '7px 14px', fontSize: '11px', fontWeight: 800,
                            cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.03em',
                            background: activeHwType === t.id ? t.color : 'transparent',
                            color: activeHwType === t.id ? '#fff' : '#64748b',
                            boxShadow: activeHwType === t.id ? `0 2px 8px ${t.color}40` : 'none',
                          }}
                          onClick={() => setActiveHwType(t.id)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setActiveHwHole(null)} style={{ border: 'none', background: '#f8fafc', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8', transition: 'all 0.15s' }}>
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  {/* ── Left: Hole List ── */}
                  <div style={{ width: 280, minWidth: 280, borderRight: '1px solid #f1f5f9', background: '#fafbfc', padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }} className="hw-sidebar-scroll">
                    <div style={{ padding: '4px 8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#94a3b8' }}>Holes</span>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', background: '#f1f5f9', borderRadius: 6, padding: '2px 8px' }}>{detectedHoles.length}</span>
                    </div>

                    {holeGroups.map((group) => {
                      const isExpanded = expandedHwGroups.has(group.dia);
                      const assignedCount = group.holes.filter(h => !!selectedHardware[h.id]).length;
                      const allAssigned = assignedCount === group.holes.length;
                      const firstItem = activeItems[0];

                      return (
                        <div key={group.dia} style={{ marginBottom: 2 }}>
                          <div
                            onClick={() => setExpandedHwGroups(prev => { const next = new Set(prev); next.has(group.dia) ? next.delete(group.dia) : next.add(group.dia); return next; })}
                            style={{
                              padding: '10px 12px', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.15s',
                              background: isExpanded ? activeType.color : '#fff',
                              color: isExpanded ? '#fff' : '#1e293b',
                              border: isExpanded ? `1.5px solid ${activeType.color}` : '1.5px solid #e8eaed',
                              boxShadow: isExpanded ? `0 4px 12px ${activeType.color}30` : '0 1px 2px rgba(0,0,0,0.04)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <ChevronDown size={12} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.6 }} />
                              <span style={{ fontSize: '13px', fontWeight: 800 }}>&Oslash; {group.dia}&quot;</span>
                              <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.6 }}>&times;{group.holes.length}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {allAssigned && <Check size={12} strokeWidth={3} style={{ color: isExpanded ? '#fff' : '#22c55e' }} />}
                              {!allAssigned && assignedCount > 0 && (
                                <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 6px', borderRadius: 6, background: isExpanded ? 'rgba(255,255,255,0.25)' : '#fef3c7', color: isExpanded ? '#fff' : '#92400e' }}>
                                  {assignedCount}/{group.holes.length}
                                </span>
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ paddingLeft: 4, paddingTop: 4 }}>
                              {group.holes.length > 1 && firstItem && (
                                <button
                                  style={{ width: '100%', padding: '6px 10px', borderRadius: 8, fontSize: '10px', fontWeight: 700, background: 'transparent', border: `1px dashed ${activeType.color}60`, color: activeType.color, cursor: 'pointer', marginBottom: 4, transition: 'all 0.15s' }}
                                  onClick={e => { e.stopPropagation(); setSelectedHardware(prev => { const next = { ...prev }; group.holes.forEach(h => { next[h.id] = { item: firstItem, hole: h, typeId: activeHwType, face: 'up' }; }); return next; }); }}
                                >
                                  Apply all &rarr; {firstItem.name}
                                </button>
                              )}
                              {group.holes.map(hole => {
                                const assigned = selectedHardware[hole.id];
                                const isActive = activeHwHole?.id === hole.id;
                                const globalIdx = detectedHoles.findIndex(h => h.id === hole.id);
                                return (
                                  <motion.div
                                    key={hole.id} layout
                                    onClick={() => setActiveHwHole(hole)}
                                    whileTap={{ scale: 0.98 }}
                                    style={{
                                      padding: '8px 10px', borderRadius: 10, marginBottom: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.15s',
                                      background: isActive ? `${activeType.color}12` : '#fff',
                                      border: isActive ? `1.5px solid ${activeType.color}` : '1.5px solid transparent',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <div style={{
                                        width: 22, height: 22, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800,
                                        background: isActive ? activeType.color : assigned ? '#22c55e' : '#f1f5f9',
                                        color: isActive || assigned ? '#fff' : '#94a3b8',
                                      }}>
                                        {globalIdx + 1}
                                      </div>
                                      <div>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: isActive ? activeType.color : '#1e293b', display: 'block', lineHeight: 1.2 }}>
                                          {assigned ? assigned.item.name : 'Unassigned'}
                                        </span>
                                        {assigned && (
                                          <span style={{ fontSize: '9px', fontWeight: 700, color: HW_TYPES.find(t => t.id === assigned.typeId)?.color || '#94a3b8' }}>
                                            {HW_TYPES.find(t => t.id === assigned.typeId)?.label}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {assigned && !isActive && <Check size={11} style={{ color: '#22c55e' }} strokeWidth={3} />}
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Right: Hardware Catalog ── */}
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }} className="hw-catalog-scroll">
                    {hwItemsByType[activeHwType] === undefined ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8' }}>
                          <Loader2 size={18} className="animate-spin" />
                          <span style={{ fontSize: '13px', fontWeight: 700 }}>Loading {activeType.label}...</span>
                        </div>
                      </div>
                    ) : activeItems.length === 0 ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
                        <AlertCircle size={40} style={{ color: '#e2e8f0', marginBottom: 12 }} />
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#94a3b8', margin: '0 0 4px' }}>No {activeType.label} Items</h3>
                        <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0 }}>Configure items in admin dashboard.</p>
                      </div>
                    ) : (
                      <div style={{ padding: '24px 28px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#94a3b8' }}>Select {activeType.label}</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, background: '#f1f5f9', borderRadius: 6, padding: '2px 8px', color: '#64748b' }}>{activeItems.length} items</span>
                          </div>
                          {assignedHw && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#94a3b8' }}>Face</span>
                              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                <button
                                  onClick={() => setSelectedHardware(prev => ({ ...prev, [activeHwHole.id]: { ...prev[activeHwHole.id], face: 'up' } }))}
                                  style={{ border: 'none', padding: '4px 12px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s', background: assignedHw?.face !== 'down' ? '#0f172a' : '#fff', color: assignedHw?.face !== 'down' ? '#fff' : '#64748b' }}
                                >↑ UP</button>
                                <button
                                  onClick={() => setSelectedHardware(prev => ({ ...prev, [activeHwHole.id]: { ...prev[activeHwHole.id], face: 'down' } }))}
                                  style={{ border: 'none', borderLeft: '1px solid #e2e8f0', padding: '4px 12px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s', background: assignedHw?.face === 'down' ? '#0f172a' : '#fff', color: assignedHw?.face === 'down' ? '#fff' : '#64748b' }}
                                >↓ DOWN</button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                          {activeItems.map(item => {
                            const isChosen = assignedHw?.item?.id === item.id && assignedHw?.typeId === activeHwType;
                            const typeSpecs = activeType.specs(item).filter(Boolean);
                            const holeDiaIn = activeHwHole?.diameterInches || 0;
                            const maxAllowed = item.max_hole_diameter ? parseFloat(item.max_hole_diameter) : Infinity;
                            const isLocked = holeDiaIn > maxAllowed;
                            return (
                              <motion.button
                                key={item.id}
                                onClick={isLocked ? undefined : () => setSelectedHardware(prev => ({ ...prev, [activeHwHole.id]: { item, hole: activeHwHole, typeId: activeHwType, face: prev[activeHwHole.id]?.face || 'up' } }))}
                                whileTap={isLocked ? {} : { scale: 0.98 }}
                                whileHover={isLocked ? {} : { y: -2 }}
                                style={{
                                  border: isLocked ? '1.5px solid #fecaca' : 'none', textAlign: 'left', padding: '16px', borderRadius: 16, cursor: isLocked ? 'not-allowed' : 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start', transition: 'all 0.2s',
                                  background: isLocked ? '#fff5f5' : isChosen ? `linear-gradient(135deg, ${activeType.color}, ${activeType.color}dd)` : '#fff',
                                  boxShadow: isLocked ? 'none' : isChosen ? `0 8px 24px ${activeType.color}30, 0 0 0 1.5px ${activeType.color}` : '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
                                  opacity: isLocked ? 0.55 : 1,
                                  color: isChosen ? '#fff' : '#1e293b',
                                }}
                              >
                                <div style={{
                                  width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                  background: isChosen ? 'rgba(255,255,255,0.2)' : `${activeType.color}10`,
                                  color: isChosen ? '#fff' : activeType.color,
                                }}>
                                  <Settings size={18} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                    <strong style={{ fontSize: '13px', fontWeight: 800, display: 'block', lineHeight: 1.3 }}>{item.name}</strong>
                                    {isLocked ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#fecaca', borderRadius: 6, padding: '2px 6px', flexShrink: 0 }}>
                                        <span style={{ fontSize: '9px', fontWeight: 800, color: '#DC2626' }}>🔒 Hole too large</span>
                                      </div>
                                    ) : isChosen && (
                                      <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Check size={11} strokeWidth={3} />
                                      </div>
                                    )}
                                  </div>
                                  {item.size_spec && (
                                    <span style={{ fontSize: '11px', fontWeight: 600, fontFamily: 'monospace', display: 'block', marginBottom: 6, opacity: isChosen ? 0.8 : 0.5 }}>{item.size_spec}</span>
                                  )}
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                    {item.tooling_diameter && (
                                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: isChosen ? 'rgba(255,255,255,0.15)' : '#f1f5f9', color: isChosen ? '#fff' : '#64748b' }}>Tool Ø{item.tooling_diameter}&quot;</span>
                                    )}
                                    {typeSpecs.map(s => (
                                      <span key={s} style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: isChosen ? 'rgba(255,255,255,0.15)' : '#f1f5f9', color: isChosen ? '#fff' : '#64748b' }}>{s}</span>
                                    ))}
                                    {item.min_edge_distance && (
                                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: isChosen ? 'rgba(255,255,255,0.15)' : '#f1f5f9', color: isChosen ? '#fff' : '#64748b' }}>Edge {item.min_edge_distance}&quot;</span>
                                    )}
                                    {item.max_hole_diameter && (
                                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: isChosen ? 'rgba(255,255,255,0.15)' : '#fecaca', color: isChosen ? '#fff' : '#DC2626' }}>Max Ø{item.max_hole_diameter}&quot;</span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '13px', fontWeight: 900, color: isChosen ? '#fff' : activeType.color }}>
                                    +${parseFloat(item.price || 0).toFixed(2)}<span style={{ fontSize: '9px', fontWeight: 700, opacity: 0.7, marginLeft: 2 }}>/HOLE</span>
                                  </span>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Footer ── */}
                <div style={{ padding: '16px 32px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fafbfc' }}>
                  <button
                    onClick={() => setSelectedHardware(p => { const n = { ...p }; delete n[activeHwHole.id]; return n; })}
                    style={{ border: 'none', background: 'transparent', color: '#94a3b8', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '8px 0', transition: 'color 0.15s' }}
                  >Clear Selection</button>
                  <button
                    onClick={() => setActiveHwHole(null)}
                    style={{ border: 'none', background: '#0f172a', color: '#fff', fontSize: '12px', fontWeight: 800, cursor: 'pointer', padding: '10px 28px', borderRadius: 12, transition: 'all 0.15s', boxShadow: '0 2px 8px rgba(15,23,42,0.2)' }}
                  >Done</button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}

        {activeCSHole && (() => {
          const csSvc = allServices.find(s => s.title.toLowerCase().includes('countersink'));
          const csOptions = csSvc?.service_options || [];
          const assignedCS = selectedCountersinks[activeCSHole.id];
          const csHoleGroups = detectedHoles.reduce((acc, h) => {
            const dia = Number(h.diameterInches || 0).toFixed(4);
            if (!acc[dia]) acc[dia] = { dia, holes: [] };
            acc[dia].holes.push(h);
            return acc;
          }, {});
          return (
            <motion.div key="cs-modal" className="position-fixed inset-0 d-flex align-items-center justify-content-center z-10000" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ backdropFilter: 'blur(16px)', background: 'rgba(15,23,42,0.6)' }}>
              <motion.div className="overflow-hidden d-flex flex-column" style={{ width: '95%', maxWidth: '1100px', height: '85vh', borderRadius: '24px', background: '#ffffff', boxShadow: '0 40px 80px -20px rgba(0,0,0,0.2)', position: 'relative', zIndex: 10001 }} initial={{ scale: 0.96, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, y: 20, opacity: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 350 }}>

                {/* Header */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 900, margin: 0, color: '#0f172a' }}>Countersink Configuration</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed', fontFamily: 'monospace' }}>&Oslash; {Number(activeCSHole.diameterInches || 0).toFixed(4)}&quot;</span>
                      <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1' }} />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Select a countersink profile for this hole</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {assignedCS && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#94a3b8' }}>Insert Side</span>
                        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                          <button
                            onClick={() => setSelectedCountersinks(prev => ({ ...prev, [activeCSHole.id]: { ...prev[activeCSHole.id], face: 'up' } }))}
                            style={{ border: 'none', padding: '4px 12px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s', background: assignedCS?.face !== 'down' ? '#7c3aed' : '#fff', color: assignedCS?.face !== 'down' ? '#fff' : '#64748b' }}
                          >↑ TOP</button>
                          <button
                            onClick={() => setSelectedCountersinks(prev => ({ ...prev, [activeCSHole.id]: { ...prev[activeCSHole.id], face: 'down' } }))}
                            style={{ border: 'none', borderLeft: '1px solid #e2e8f0', padding: '4px 12px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s', background: assignedCS?.face === 'down' ? '#7c3aed' : '#fff', color: assignedCS?.face === 'down' ? '#fff' : '#64748b' }}
                          >↓ BOTTOM</button>
                        </div>
                      </div>
                    )}
                    <button onClick={() => setActiveCSHole(null)} style={{ border: 'none', background: '#f8fafc', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8' }}>
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  {/* Left: Hole list */}
                  <div style={{ width: 280, borderRight: '1px solid #f1f5f9', overflowY: 'auto', padding: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12, paddingLeft: 4 }}>Detected Holes</div>
                    {Object.values(csHoleGroups).map(group => {
                      const isExpanded = expandedCSGroups.has(group.dia);
                      const csCount = group.holes.filter(h => !!selectedCountersinks[h.id]).length;
                      return (
                        <div key={group.dia} style={{ marginBottom: 8 }}>
                          <div
                            style={{ padding: '10px 12px', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isExpanded ? '#7c3aed' : '#f8fafc', color: isExpanded ? '#fff' : '#1e293b', border: isExpanded ? '1.5px solid #7c3aed' : '1.5px solid #f1f5f9', transition: 'all 0.15s' }}
                            onClick={() => setExpandedCSGroups(prev => { const next = new Set(prev); next.has(group.dia) ? next.delete(group.dia) : next.add(group.dia); return next; })}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <ChevronDown size={12} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                              <span style={{ fontWeight: 800, fontSize: '13px' }}>&Oslash; {group.dia}&quot; &times; {group.holes.length}</span>
                            </div>
                            {csCount > 0 && <span style={{ fontSize: '10px', fontWeight: 800, background: isExpanded ? 'rgba(255,255,255,0.25)' : '#7c3aed', color: isExpanded ? '#fff' : '#fff', borderRadius: 6, padding: '2px 6px' }}>{csCount}/{group.holes.length}</span>}
                          </div>
                          {isExpanded && (
                            <div style={{ paddingLeft: 8, paddingTop: 4 }}>
                              {group.holes.map(hole => {
                                const isCS = !!selectedCountersinks[hole.id];
                                const isActive = activeCSHole?.id === hole.id;
                                const globalIdx = detectedHoles.findIndex(h => h.id === hole.id);
                                return (
                                  <div key={hole.id}
                                    style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isActive ? '#7c3aed' : '#f8fafc', color: isActive ? '#fff' : '#1e293b', border: isActive ? '1.5px solid #7c3aed' : '1.5px solid transparent', transition: 'all 0.15s' }}
                                    onClick={() => setActiveCSHole(hole)}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: isActive ? '#fff' : isCS ? '#7c3aed' : '#e2e8f0', color: isActive ? '#7c3aed' : isCS ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>{globalIdx + 1}</div>
                                      <span style={{ fontSize: '12px', fontWeight: 700 }}>{isCS ? selectedCountersinks[hole.id].name : 'Not set'}</span>
                                    </div>
                                    {isCS && !isActive && <Check size={12} style={{ color: '#7c3aed' }} strokeWidth={3} />}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Right: Countersink profiles */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                    {csOptions.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', color: '#94a3b8' }}>
                        <AlertCircle size={40} style={{ marginBottom: 12, color: '#e2e8f0' }} />
                        <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 4px' }}>No Profiles Configured</h3>
                        <p style={{ fontSize: '12px', margin: 0 }}>Configure countersink profiles in the admin dashboard.</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 16 }}>Select Profile</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                          {csOptions.map((opt, idx) => {
                            const isChosen = assignedCS?.name === opt.name;
                            return (
                              <motion.button key={idx}
                                onClick={() => setSelectedCountersinks(prev => ({ ...prev, [activeCSHole.id]: { ...opt, hole: activeCSHole, face: prev[activeCSHole.id]?.face || 'up' } }))}
                                whileTap={{ scale: 0.98 }} whileHover={{ y: -2 }}
                                style={{ border: 'none', textAlign: 'left', padding: '16px', borderRadius: 16, cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start', transition: 'all 0.2s', background: isChosen ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : '#fff', boxShadow: isChosen ? '0 8px 24px rgba(124,58,237,0.3), 0 0 0 1.5px #7c3aed' : '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)', color: isChosen ? '#fff' : '#1e293b' }}
                              >
                                <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isChosen ? 'rgba(255,255,255,0.2)' : '#f3e8ff', color: isChosen ? '#fff' : '#7c3aed' }}>
                                  <Settings size={18} />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                    <strong style={{ fontSize: '13px', fontWeight: 800, lineHeight: 1.3 }}>{opt.name}</strong>
                                    {isChosen && <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={11} strokeWidth={3} /></div>}
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                    {opt.major_dia && <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: isChosen ? 'rgba(255,255,255,0.15)' : '#f3e8ff', color: isChosen ? '#fff' : '#7c3aed' }}>Maj Ø{opt.major_dia}&quot;</span>}
                                    {opt.minor_dia && <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: isChosen ? 'rgba(255,255,255,0.15)' : '#f3e8ff', color: isChosen ? '#fff' : '#7c3aed' }}>Min Ø{opt.minor_dia}&quot;</span>}
                                    {opt.angle && <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: isChosen ? 'rgba(255,255,255,0.15)' : '#f3e8ff', color: isChosen ? '#fff' : '#7c3aed' }}>{opt.angle}°</span>}
                                  </div>
                                  <span style={{ fontSize: '13px', fontWeight: 900, color: isChosen ? '#fff' : '#7c3aed' }}>
                                    +${parseFloat(opt.price || 0).toFixed(2)}<span style={{ fontSize: '9px', fontWeight: 700, opacity: 0.7, marginLeft: 2 }}>/HOLE</span>
                                  </span>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 32px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fafbfc' }}>
                  <button onClick={() => setSelectedCountersinks(p => { const n = { ...p }; delete n[activeCSHole.id]; return n; })} style={{ border: 'none', background: 'transparent', color: '#94a3b8', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '8px 0' }}>Clear Selection</button>
                  <button onClick={() => setActiveCSHole(null)} style={{ border: 'none', background: '#0f172a', color: '#fff', fontSize: '12px', fontWeight: 800, cursor: 'pointer', padding: '10px 28px', borderRadius: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.2)' }}>Done</button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}

        {isAnodizingModalOpen && (
          <motion.div key="anodizing-modal" className="position-fixed inset-0 bg-black-80 d-flex align-items-center justify-content-center z-10000" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ backdropFilter: 'blur(12px)' }}>
            {(() => {
              const svc = selectedAdditionalServices.find(s => s.id === activeFinishSvcId) || selectedAdditionalServices.find(s => {
                const t = (s.title || '').toLowerCase();
                return t.includes('anodiz') || t.includes('powder coat');
              });
              const isPowderCoating = svc?.title?.toLowerCase().includes('powder coat');
              const processName = isPowderCoating ? 'powder coating' : 'anodizing';

              return (
                <motion.div className="bg-white rounded-5 shadow-22xl p-0 overflow-hidden w-100 mx-4 d-flex flex-column" style={{ maxWidth: '850px', maxHeight: '90vh', border: '1px solid rgba(0,0,0,0.05)', position: 'relative', zIndex: 10001 }} initial={{ scale: 0.9, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 30, opacity: 0 }} transition={{ type: 'spring', damping: 25 }}>
                  <div className="p-5 bg-white border-bottom d-flex justify-content-between align-items-center flex-shrink-0">
                    <div>
                      <h3 className="fw-black fs-2 m-0 text-dark letter-spacing-1">PREMIUM FINISH COLOR</h3>
                      <p className="small text-muted fw-bold text-uppercase letter-spacing-2 mt-2">Selected metal will be treated with the chosen {processName} process</p>
                    </div>
                    <button className="btn-close action-btn-hover p-3 rounded-circle shadow-none" onClick={() => setIsAnodizingModalOpen(false)} />
                  </div>
                  <div className="p-5 bg-light-subtle bg-opacity-30 overflow-y-auto flex-grow-1">
                    <div className="d-grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                      {(() => {
                        const options = svc?.service_options || [];
                        return options.map((opt, i) => {
                          const isActive = selectedFinishColors[svc?.id]?.name === opt.name;
                          return (
                            <motion.button key={i} className={`group btn border-0 p-3 rounded-5 d-flex flex-column align-items-center gap-4 transition-all bg-transparent`} onClick={() => { setSelectedFinishColors(p => ({ ...p, [svc.id]: opt })); setIsAnodizingModalOpen(false); }} whileHover={{ y: -10 }}>
                              <div className="position-relative">
                                <div className={`rounded-circle shadow-2xl transition-all ${isActive ? 'scale-110' : 'group-hover-scale-105'}`} style={{ backgroundColor: opt.color, width: '100px', height: '100px', border: isActive ? '6px solid #ef4444' : '6px solid white', boxShadow: isActive ? '0 20px 40px -10px rgba(239, 68, 68, 0.4)' : '0 15px 30px -10px rgba(0,0,0,0.1)' }} />
                                {isActive && <div className="position-absolute top-0 end-0 bg-danger text-white rounded-circle p-2 shadow-lg" style={{ transform: 'translate(30%, -30%)' }}><Check size={16} strokeWidth={4} /></div>}
                              </div>
                              <div className="text-center">
                                <span className={`d-block fs-6 fw-black transition-all ${isActive ? 'text-danger' : 'text-dark group-hover-text-dark opacity-80'}`}>{(opt.name || '').toUpperCase()}</span>
                                <span className="small text-muted fw-bold opacity-50 letter-spacing-1 font-monospace mt-1 d-block">{(opt.color || '').toUpperCase()}</span>
                              </div>
                            </motion.button>
                          );
                        });
                      })()}
                    </div>

                    {(!svc?.service_options?.length) && (
                      <div className="py-5 text-center">
                        <Shield size={48} className="text-muted opacity-20 mb-3" />
                        <p className="text-muted fw-bold small">NO PREMIUM FINISHES CONFIGURED IN DASHBOARD</p>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-white border-top text-center flex-shrink-0">
                    <button className="btn btn-link text-muted text-decoration-none fw-bold small hover-text-dark" onClick={() => { setSelectedFinishColors(p => { const n = { ...p }; delete n[svc?.id]; return n; }); setIsAnodizingModalOpen(false); }}>SKIP {processName.toUpperCase()}</button>
                  </div>
                </motion.div>
              );
            })()}
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
                .skeleton-price {
                  background: rgba(255, 255, 255, 0.05);
                  background: linear-gradient(90deg, rgba(255, 255, 255, 0.03) 25%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.03) 75%);
                  background-size: 200% 100%;
                  animation: shimmer 1.5s infinite;
                  border-radius: 6px;
                }
                @keyframes shimmer {
                  0% { background-position: -200% 0; }
                  100% { background-position: 200% 0; }
                }
                ::-webkit-scrollbar {
                  width: 5px;
                  height: 5px;
                }
                ::-webkit-scrollbar-button {
                  display: none;
                }
                ::-webkit-scrollbar-track {
                  background: transparent;
                }
                ::-webkit-scrollbar-thumb {
                  background: rgba(0, 0, 0, 0.1);
                  border-radius: 20px;
                }
                ::-webkit-scrollbar-thumb:hover {
                  background: rgba(0, 0, 0, 0.2);
                }

                .ip-breakdown-scroll::-webkit-scrollbar {
                  width: 4px;
                  height: 4px;
                }
                .ip-breakdown-scroll::-webkit-scrollbar-button {
                  display: none;
                }
                .ip-breakdown-scroll::-webkit-scrollbar-track {
                  background: transparent;
                }
                .ip-breakdown-scroll::-webkit-scrollbar-thumb {
                  background: rgba(255, 255, 255, 0.12);
                  border-radius: 20px;
                }
                .ip-breakdown-scroll::-webkit-scrollbar-thumb:hover {
                  background: rgba(255, 255, 255, 0.25);
                }
                .ip-breakdown-scroll {
                  scrollbar-width: thin;
                  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
                }
                
                /* Ensure modals and other dark overlays have matching scrolls */
                .bg-black-80 ::-webkit-scrollbar-thumb,
                .bg-dark ::-webkit-scrollbar-thumb {
                  background: rgba(255, 255, 255, 0.12);
                  border-radius: 20px;
                }
                .bg-black-80 ::-webkit-scrollbar-track,
                .bg-dark ::-webkit-scrollbar-track {
                  background: transparent;
                }
                .bg-black-80 ::-webkit-scrollbar-button,
                .bg-dark ::-webkit-scrollbar-button {
                  display: none;
                }

                /* Hardware modal scrollbars */
                .hw-sidebar-scroll::-webkit-scrollbar,
                .hw-catalog-scroll::-webkit-scrollbar {
                  width: 4px;
                }
                .hw-sidebar-scroll::-webkit-scrollbar-button,
                .hw-catalog-scroll::-webkit-scrollbar-button {
                  display: none;
                }
                .hw-sidebar-scroll::-webkit-scrollbar-track,
                .hw-catalog-scroll::-webkit-scrollbar-track {
                  background: transparent;
                }
                .hw-sidebar-scroll::-webkit-scrollbar-thumb,
                .hw-catalog-scroll::-webkit-scrollbar-thumb {
                  background: rgba(0, 0, 0, 0.08);
                  border-radius: 20px;
                }
                .hw-sidebar-scroll::-webkit-scrollbar-thumb:hover,
                .hw-catalog-scroll::-webkit-scrollbar-thumb:hover {
                  background: rgba(0, 0, 0, 0.15);
                }
                .hw-sidebar-scroll, .hw-catalog-scroll {
                  scrollbar-width: thin;
                  scrollbar-color: rgba(0, 0, 0, 0.08) transparent;
                }
                `;
  return <style dangerouslySetInnerHTML={{ __html: styles }} />;
};

export default InstantPricing;

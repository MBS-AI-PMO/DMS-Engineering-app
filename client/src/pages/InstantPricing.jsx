import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, Info, Layers, Box, Boxes, ChevronLeft,
  ChevronRight, ChevronDown, AlertCircle, AlertTriangle, Loader2, Check, Shield, Calculator,
  Plus, Zap, TrendingDown, FileText, Settings, Grid, ArrowRight
} from 'lucide-react';
import {
  fetchServices, calculatePrice, fetchPublicDiscounts, fetchHardwareItemsByType,
  fetchCategories, fetchMetals, fetchPricingCncMetals, fetchPricingSheetMetals,
  fetchCncPricingConfig, fetchMetalsByServiceId, fetchSettings
} from '../utils/api';
import { useCart } from '../context/CartContext.js';
import { useToast } from '../context/ToastContext';
import StepModelViewer from '../components/viewer/StepModelViewer';
import DxfModelViewer from '../components/viewer/DxfModelViewer';
import CadFlatPatternViewer from '../components/viewer/CadFlatPatternViewer';
import HierarchicalProjectViewer from '../components/viewer/HierarchicalProjectViewer';
import PricingSidebar from '../components/pricing/PricingSidebar';
import HoleServiceDrawer from '../components/pricing/HoleServiceDrawer';
import FinishColorDrawer from '../components/pricing/FinishColorDrawer';
import { HARDWARE_TYPES, countersinkLabel, optionBlockedReason } from '../utils/holeFeatures';
import { analyzeDxfFile } from '../utils/dxfAnalysis';
import '../styles/PremiumPricing.css';
import '../styles/InstantPricingWorkbench.css';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '') || '/api';
const apiUrl = (path) => `${API_BASE_URL}${String(path || '').startsWith('/') ? path : `/${path}`}`;
const backendAssetUrl = (assetPath) => {
  const raw = String(assetPath || '').trim();
  if (!raw) return '';
  if (/^(?:https?:)?\/\//i.test(raw) || raw.startsWith('blob:') || raw.startsWith('data:')) return raw;

  const cleaned = raw.replace(/^\/+/, '');
  if (cleaned.startsWith('api/')) return `/${cleaned}`;
  if (cleaned.startsWith('temp_uploads/')) return apiUrl(`/${cleaned}`);
  if (cleaned.startsWith('uploads/')) return apiUrl(`/${cleaned}`);
  return `/${cleaned}`;
};

const is2DFile = (filename) => {
  const name = filename?.toLowerCase() ?? '';
  return name.endsWith('.dxf') || name.endsWith('.dwg');
};

const isStepFile = (filename) => {
  const name = filename?.toLowerCase() ?? '';
  return name.endsWith('.step') || name.endsWith('.stp');
};

const toFiniteNumber = (value) => {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : 0;
};

const parseServiceIds = (value) => {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const sumSegmentLengths = (flatEdgePoints = []) => {
  if (!Array.isArray(flatEdgePoints) || flatEdgePoints.length < 6) return 0;
  let total = 0;
  for (let i = 0; i + 5 < flatEdgePoints.length; i += 6) {
    const x1 = toFiniteNumber(flatEdgePoints[i]);
    const y1 = toFiniteNumber(flatEdgePoints[i + 1]);
    const z1 = toFiniteNumber(flatEdgePoints[i + 2]);
    const x2 = toFiniteNumber(flatEdgePoints[i + 3]);
    const y2 = toFiniteNumber(flatEdgePoints[i + 4]);
    const z2 = toFiniteNumber(flatEdgePoints[i + 5]);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    total += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return total;
};

// The CAD engine's own measure of the cutting path: the outline plus every
// cut-out, traced from the closed flat-pattern contours. The raw cut-edge sum
// also counts seams inside the blank where two faces meet (a folded enclosure
// read 7,813 mm for a 6,206 mm path), so it is only a fallback. An outline
// that is just a bounding-box stand-in measures nothing.
const measuredCutLengthMm = (backend) => {
  const length = toFiniteNumber(backend?.totalCutLength);
  if (!(length > 0)) return 0;
  const contours = Array.isArray(backend?.contours) ? backend.contours : [];
  if (contours.some(contour => String(contour?.source || '').includes('bbox_fallback'))) return 0;
  return length;
};

const normalizePierceCount = (directCount, dxfCount, detectedHoleCount, subtractOuterProfile = false) => {
  const direct = Number.parseInt(directCount, 10);
  if (Number.isFinite(direct) && direct >= 0) {
    return Math.max(0, direct - (subtractOuterProfile ? 1 : 0));
  }

  const dxf = Number.parseInt(dxfCount, 10);
  if (Number.isFinite(dxf) && dxf >= 0) return dxf;

  const holes = Number.parseInt(detectedHoleCount, 10);
  return Number.isFinite(holes) && holes > 0 ? holes : 0;
};

// One direction rule for every hole, so "Top" means the same side in the
// configure drawer, the 3D view and the production cut: the axis points up
// in the viewer (+Z) when it can, otherwise along +Y, otherwise +X.
const canonicalHoleAxis = (axis) => {
  if (!Array.isArray(axis) || axis.length < 3) return axis;
  const [x, y, z] = axis.map(Number);
  if (![x, y, z].every(Number.isFinite)) return axis;
  const flip = Math.abs(z) >= 0.5
    ? z < 0
    : (Math.abs(y) >= Math.abs(x) ? y < 0 : x < 0);
  return flip ? [-x || 0, -y || 0, -z || 0] : [x, y, z];
};

// Engine holes -> the page's hole records (positions on the 3D model).
const mapEngineHoles = (holes, fallbackDepthIn) => (holes || []).map((h, idx) => ({
  id: idx,
  diameterInches: h.diameter_in,
  diameter_mm: h.diameter_mm,
  rim_diameter_mm: h.rim_diameter_mm || null,
  depthMm: h.depth_mm || 0,
  depthInches: h.depth_mm ? h.depth_mm / 25.4 : fallbackDepthIn,
  position: h.position,
  axis: canonicalHoleAxis(h.axis),
  parent_face_id: h.face_id,
}));

// The full analysis lists holes twice: detectedHoles in the unfolded frame
// (right for counting) and modelHoles where they sit on the 3D model (right
// for placing taps and countersinks). Older results only have the first.
const engineHolesForModel = (result) => (
  Array.isArray(result?.modelHoles)
    ? result.modelHoles
    : (Array.isArray(result?.detectedHoles) ? result.detectedHoles : [])
);

const normalizeBooleanSetting = (value, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
};

const getProcessFlags = (serviceTitle = '') => {
  const normalized = String(serviceTitle || '').toLowerCase();
  return {
    isLaser: normalized.includes('laser'),
    isCnc: normalized.includes('cnc')
  };
};

// ─── Child Components ─────────────────────────────────────
const getFileAnalysisKey = (fileEntry) => (
  fileEntry?.id || fileEntry?.tempPath || fileEntry?.file?.name || ''
);

const PriceSkeleton = ({ width = '80px', height = '24px', className = '' }) => (
  <div className={`skeleton-price ${className}`} style={{ width, height, display: 'inline-block', verticalAlign: 'middle' }} />
);
const MotionDiv = motion.div;

const normalizeQuoteQuantity = (value) => Math.max(1, parseInt(value, 10) || 1);

const makeEmptyQuoteConfig = () => ({
  productionService: null,
  category: null,
  metal: null,
  selectedThickness: null,
  selectedAdditionalServices: [],
  selectedFinishColors: {},
  selectedTaps: {},
  selectedHardware: {},
  selectedCountersinks: {},
  selectedBends: {},
  quantity: 1,
  configStep: 0,
});

const makeEmptyQuoteAnalysis = () => ({
  dimensions: null,
  dxfSvg: null,
  dxfTechData: null,
  backendData: null,
  bendTree: null,
  detectedHoles: [],
  detectedBends: [],
});

const makeEmptyQuotePricing = () => ({
  estimate: null,
  status: 'idle',
  error: '',
  key: '',
});

const cloneQuoteConfig = (config = {}) => ({
  productionService: config.productionService || null,
  category: config.category || null,
  metal: config.metal || null,
  selectedThickness: config.selectedThickness ?? null,
  selectedAdditionalServices: Array.isArray(config.selectedAdditionalServices) ? [...config.selectedAdditionalServices] : [],
  selectedFinishColors: { ...(config.selectedFinishColors || {}) },
  selectedTaps: { ...(config.selectedTaps || {}) },
  selectedHardware: { ...(config.selectedHardware || {}) },
  selectedCountersinks: { ...(config.selectedCountersinks || {}) },
  selectedBends: { ...(config.selectedBends || {}) },
  quantity: normalizeQuoteQuantity(config.quantity),
  configStep: Number.isFinite(Number(config.configStep)) ? Number(config.configStep) : 0,
});

const cloneSharedQuoteConfig = (config = {}) => ({
  ...cloneQuoteConfig(config),
  quantity: 1,
});

const getQuoteConfigForFile = (item, sharedConfig = {}) => {
  const fileConfig = cloneQuoteConfig(item?.config || {});
  if (item?.customized) return fileConfig;

  return {
    ...cloneQuoteConfig(sharedConfig),
    quantity: fileConfig.quantity,
  };
};

const cloneQuoteAnalysis = (analysis = {}) => ({
  dimensions: analysis.dimensions || null,
  dxfSvg: analysis.dxfSvg || null,
  dxfTechData: analysis.dxfTechData || null,
  backendData: analysis.backendData || null,
  bendTree: analysis.bendTree || null,
  detectedHoles: Array.isArray(analysis.detectedHoles) ? analysis.detectedHoles : [],
  detectedBends: Array.isArray(analysis.detectedBends) ? analysis.detectedBends : [],
});

const getSelectedThicknessMmFromConfig = (config = {}) => {
  const metal = config.metal;
  const selectedThickness = config.selectedThickness;
  if (!metal || selectedThickness == null) return 0;
  const t = (metal.quick_look?.thicknesses || []).find(th => String(th.value) === String(selectedThickness));
  if (!t) return 0;
  return t.metric === 'mm' ? parseFloat(t.value) : parseFloat(t.value) * 25.4;
};

const getSelectedThicknessDisplayFromConfig = (config = {}) => {
  const selectedThickness = config.selectedThickness;
  if (selectedThickness == null) return null;
  const mm = getSelectedThicknessMmFromConfig(config);
  if (mm > 0) return `${mm.toFixed(3)} mm (${(mm / 25.4).toFixed(3)} in)`;
  return String(selectedThickness);
};

const getActiveFinishColorFromConfig = (config = {}) => {
  const selectedFinishColors = config.selectedFinishColors || {};
  const keys = Object.keys(selectedFinishColors);
  if (keys.length === 0) {
    if (config.metal?.color) {
      return { color: config.metal.color, name: config.metal.name || 'Base Material', isBaseMaterialFallback: true };
    }
    return null;
  }
  const firstWithColor = keys.find(k => selectedFinishColors[k]?.color || selectedFinishColors[k]?.hex);
  return selectedFinishColors[firstWithColor || keys[0]];
};

const flattenBendTree = (bendTree) => {
  const list = [];
  const flatten = (node) => {
    if (!node) return;
    if (node.bendAxis) list.push(node);
    if (node.children) node.children.forEach(flatten);
  };
  flatten(bendTree);
  return list;
};

const getBendSupportForConfig = (config = {}, allServices = [], selectedThicknessDisplay = null) => {
  const bendService = allServices.find(s => s.title?.toLowerCase().includes('bend')) || null;
  if (!bendService || !config.metal) return { supported: false, warning: '' };

  const bendServiceId = Number(bendService.id);
  const selectedThicknessObj = (config.metal.quick_look?.thicknesses || []).find(t => String(t.value) === String(config.selectedThickness)) || null;
  const metalServiceIds = parseServiceIds(config.metal.services);
  const thicknessServiceIds = parseServiceIds(selectedThicknessObj?.services);
  const hasMetalGrant = metalServiceIds.includes(bendServiceId);
  const hasThicknessGrant = thicknessServiceIds.includes(bendServiceId);
  const selectedLabel = selectedThicknessDisplay || config.selectedThickness || 'selected thickness';

  if (!hasMetalGrant && !hasThicknessGrant) {
    return { supported: false, warning: `Bending is not available for ${config.metal.name} at ${selectedLabel}.` };
  }
  if (config.metal.is_bendable === false && !hasThicknessGrant) {
    return { supported: false, warning: `${config.metal.name} at ${selectedLabel} is not bendable, so bending cost was removed.` };
  }
  return { supported: true, warning: '' };
};

const getQuoteAdditionalServicesForConfig = (config = {}, allServices = [], selectedThicknessDisplay = null) => {
  const bendSupport = getBendSupportForConfig(config, allServices, selectedThicknessDisplay);
  return (config.selectedAdditionalServices || []).filter((svc) => {
    const title = String(svc?.title || '').toLowerCase();
    return !(title.includes('bend') && !bendSupport.supported);
  });
};

const deriveQuoteItem = (item, config = {}, allServices = []) => {
  const analysis = cloneQuoteAnalysis(item?.analysis);
  const fileName = item?.file?.name || item?.fileName || '';
  const currentIsStepFile = isStepFile(fileName);
  const currentIsDxfFile = is2DFile(fileName);
  const backend = currentIsStepFile ? analysis.backendData : null;
  const selectedThicknessMM = getSelectedThicknessMmFromConfig(config);
  const selectedThicknessDisplay = getSelectedThicknessDisplayFromConfig(config);

  const modelThicknessFrom2dMm = currentIsStepFile ? toFiniteNumber(backend?.thickness) : 0;
  const modelThicknessFrom3dMm = toFiniteNumber(analysis.dimensions?.mm?.t);
  const thicknessResolution = (() => {
    if (currentIsStepFile && modelThicknessFrom2dMm > 0) return { value: modelThicknessFrom2dMm, source: 'Sheet stock from STEP' };
    if (currentIsStepFile && modelThicknessFrom3dMm > 0) return { value: modelThicknessFrom3dMm, source: '3D bounding box' };
    if (selectedThicknessMM > 0) return { value: selectedThicknessMM, source: 'Selected stock' };
    return { value: 0, source: currentIsStepFile ? '3D model unavailable' : 'Unknown' };
  })();

  const modelLenMm = toFiniteNumber(analysis.dimensions?.mm?.l);
  const modelWidMm = toFiniteNumber(analysis.dimensions?.mm?.w);
  // The CAD worker reports the flat pattern's two spans as xSpan/ySpan. Its
  // bbox.width is the shorter span and bbox.height is the sheet thickness, so
  // they are only a fallback for results that carry no spans.
  const flatWidth = currentIsStepFile ? toFiniteNumber(backend?.bbox?.xSpan ?? backend?.bbox?.width) : 0;
  const flatHeight = currentIsStepFile ? toFiniteNumber(backend?.bbox?.ySpan ?? backend?.bbox?.height) : 0;
  const hasFlatSize = flatWidth > 0 && flatHeight > 0;
  const useFlatSize = currentIsStepFile && hasFlatSize;
  const lengthMm = useFlatSize ? Math.max(flatWidth, flatHeight) : modelLenMm;
  const widthMm = useFlatSize ? Math.min(flatWidth, flatHeight) : modelWidMm;
  const volumeMm3 = toFiniteNumber(analysis.dimensions?.mm?.volume);

  const displayDimensions = (() => {
    if (!(lengthMm > 0) || !(widthMm > 0)) return null;
    const thicknessMm = thicknessResolution.value;
    return {
      mm: {
        l: lengthMm.toFixed(2),
        w: widthMm.toFixed(2),
        t: thicknessMm > 0 ? thicknessMm.toFixed(3) : '0.000',
        volume: volumeMm3.toFixed(2)
      },
      inches: {
        l: (lengthMm / 25.4).toFixed(3),
        w: (widthMm / 25.4).toFixed(3),
        t: thicknessMm > 0 ? (thicknessMm / 25.4).toFixed(3) : '0.000',
        volume: (volumeMm3 / 16387).toFixed(3)
      }
    };
  })();

  const perimeterMm = (() => {
    const direct = toFiniteNumber(backend?.totalPerimeter);
    if (direct > 0) return direct;
    const measured = measuredCutLengthMm(backend);
    if (measured > 0) return measured;
    const dxfPerimeter = toFiniteNumber(analysis.dxfTechData?.totalPerimeter);
    if (dxfPerimeter > 0) return dxfPerimeter;
    const edgePerimeter = sumSegmentLengths(backend?.cutEdges);
    if (edgePerimeter > 0) return edgePerimeter;
    return lengthMm > 0 && widthMm > 0 ? ((lengthMm + widthMm) * 2) : 0;
  })();

  const pierceCount = (() => {
    return normalizePierceCount(
      backend?.pierceCount,
      analysis.dxfTechData?.pierceCount,
      (analysis.detectedHoles || []).length,
      currentIsStepFile
    );
  })();

  const pricingTechnicalData = {
    totalPerimeter: perimeterMm,
    pierceCount,
    bends: Array.isArray(backend?.bends) ? backend.bends : [],
    sheetNest: backend?.sheetNest || backend?.sheet_nest || null,
    cutEdges: Array.isArray(backend?.cutEdges) ? backend.cutEdges : [],
    flatArea: toFiniteNumber(backend?.flatArea)
  };

  const quoteAdditionalServices = getQuoteAdditionalServicesForConfig(config, allServices, selectedThicknessDisplay);
  const bendList = flattenBendTree(analysis.bendTree);

  return {
    analysis,
    displayDimensions,
    selectedThicknessMM,
    selectedThicknessDisplay,
    dimensionSourceLabel: currentIsDxfFile ? '2D drawing' : useFlatSize ? '2D flat pattern' : '3D bounding box',
    thicknessSourceLabel: thicknessResolution.source,
    pricingTechnicalData,
    quoteAdditionalServices,
    activeFinishColor: getActiveFinishColorFromConfig(config),
    bendList,
  };
};

const buildPricingPayloadForQuoteItem = (item, config = {}, allServices = [], derived = null) => {
  const info = derived || deriveQuoteItem(item, config, allServices);
  if (!info.displayDimensions || (!config.metal && !config.productionService)) return null;
  if (config.metal && !(info.selectedThicknessMM > 0)) return null;
  const thicknessValueIn = info.selectedThicknessMM > 0 ? (info.selectedThicknessMM / 25.4).toFixed(6) : null;

  return {
    metal_id: config.metal?.id || null,
    service_id: config.productionService?.id || null,
    thickness_value: thicknessValueIn,
    length_in: info.displayDimensions.inches.l,
    height_in: info.displayDimensions.inches.w,
    quantity: Math.max(1, parseInt(config.quantity, 10) || 1),
    additional_services: info.quoteAdditionalServices.map(s => {
      const opt = config.selectedFinishColors?.[s.id];
      const options = Array.isArray(s.service_options) ? s.service_options : [];
      const optIndex = opt
        ? options.findIndex(o =>
          (opt.id != null && o.id === opt.id) ||
          (opt.name && o.name === opt.name) ||
          (opt.color && o.color === opt.color)
        )
        : -1;
      return {
        id: s.id,
        option_id: opt?.id ?? opt?.index ?? (optIndex >= 0 ? optIndex : (opt?.name || null))
      };
    }),
    taps: Object.values(config.selectedTaps || {}).map(t => ({ name: t.name, price: t.price || 0 })),
    hardware: Object.values(config.selectedHardware || {}).map(h => ({ id: h.item?.id ?? null, name: h.item?.name, price: h.item?.price || 0 })),
    countersinks: Object.values(config.selectedCountersinks || {}).map(cs => ({ name: cs.name, price: cs.price || 0 })),
    technical_data: info.pricingTechnicalData
  };
};

const buildPricingKeyForQuoteItem = (item, config = {}, allServices = [], derived = null) => {
  const payload = buildPricingPayloadForQuoteItem(item, config, allServices, derived);
  if (!payload) return '';
  return JSON.stringify({ fileId: item.id, payload });
};

const buildCartItemFromQuoteItem = (item, config = {}, allServices = []) => {
  const info = deriveQuoteItem(item, config, allServices);
  const estimate = item.pricing?.estimate;
  if (!estimate?.breakdown || !info.displayDimensions) return null;

  const qty = Math.max(1, parseInt(config.quantity, 10) || 1);
  const unitBasePrice = parseFloat(estimate.breakdown?.unit_total || 0);
  const unitFinalPrice = parseFloat(
    estimate.breakdown?.final_unit_price ||
    (qty > 0 ? (parseFloat(estimate?.total_price || 0) / qty) : 0)
  );
  const discountPercent = parseFloat(estimate.breakdown?.discount_percent || 0);

  return {
    fileName: item.file?.name || item.fileName,
    file: item.file,
    tempPath: item.tempPath,
    configuration: {
      productionService: config.productionService,
      metal: config.metal,
      thickness: info.displayDimensions.mm.t,
      selectedThickness: config.selectedThickness,
      selectedThicknessDisplay: info.selectedThicknessDisplay,
      modelDimensionSource: info.dimensionSourceLabel,
      modelThicknessSource: info.thicknessSourceLabel,
      anodizingColor: info.activeFinishColor,
      selectedTaps: config.selectedTaps || {},
      selectedHardware: config.selectedHardware || {},
      selectedCountersinks: config.selectedCountersinks || {},
      selectedBends: config.selectedBends || {},
      bendTree: info.analysis.bendTree,
      bendCount: info.bendList?.length || 0,
      detectedHoles: info.analysis.detectedHoles || [],
      detectedBends: info.analysis.detectedBends || [],
      additionalServices: info.quoteAdditionalServices,
      dimensions: info.displayDimensions,
      dxfSvg: info.analysis.dxfSvg,
      selectedFinishColors: config.selectedFinishColors || {},
      pricingTechnicalData: info.pricingTechnicalData,
    },
    pricing: {
      baseUnit: unitBasePrice,
      discount_percent: discountPercent,
      finish: 0,
      total: unitFinalPrice
    },
    quantity: qty
  };
};

// ─── Component ──────────────────────────────────────────
const InstantPricing = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [sharedConfig, setSharedConfig] = useState(() => makeEmptyQuoteConfig());
  const [dimensions, setDimensions] = useState(null);
  const [viewMode, setViewMode] = useState('3d');
  // 'iso' is the angled front-right-top view a part opens with (as in Zamyr).
  const [activeAxis, setActiveAxis] = useState('iso');
  const [unit, setUnit] = useState('mm'); // mm or inch
  const [dxfSvg, setDxfSvg] = useState(null);
  const [backendData, setBackendData] = useState(null);
  const [dxfTechData, setDxfTechData] = useState(null);
  const [isLoadingUnfold, setIsLoadingUnfold] = useState(false);
  const [unfoldProgress, setUnfoldProgress] = useState(0);
  const [unfoldStage, setUnfoldStage] = useState('');
  const [isStepModelLoading, setIsStepModelLoading] = useState(false);
  const [stepModelProgress, setStepModelProgress] = useState(0);
  const unfoldAbortControllerRef = useRef(null);
  const unfoldRequestSeqRef = useRef(0);
  const unfoldRequestFileKeyRef = useRef(null);
  const configurePreviewAbortRef = useRef(null);
  const configurePreviewSeqRef = useRef(0);
  const configurePreviewKeyRef = useRef('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isGeneratingConfiguredPreview, setIsGeneratingConfiguredPreview] = useState(false);
  const [configuredPreviewUrl, setConfiguredPreviewUrl] = useState(null);
  const [isQuoteFlowActive, setIsQuoteFlowActive] = useState(false);
  const [configStep, setConfigStep] = useState(0); // 0: Method, 1: Category, 2: Metal, 3: Thickness, 4: Services
  const [showServiceBreakdown, setShowServiceBreakdown] = useState(true);

  // Dynamic data from DB
  const [allServices, setAllServices] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [allMetals, setAllMetals] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const { addManyToCart } = useCart();
  const navigate = useNavigate();
  const toast = useToast();
  const filesRef = useRef(files);
  const selectedFileRef = useRef(selectedFile);
  const sharedConfigRef = useRef(sharedConfig);
  const restoringQuoteItemRef = useRef(false);
  const backgroundPricingRef = useRef(new Set());

  useEffect(() => {
    let active = true;
    fetchSettings()
      .then((data) => {
        if (!active) return;
        const value = normalizeBooleanSetting(data?.show_service_breakdown, true);
        setShowServiceBreakdown(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const [selectedProductionService, setSelectedProductionService] = useState(null);
  const [selectedMetal, setSelectedMetal] = useState(null);
  const [selectedThickness, setSelectedThickness] = useState(null);
  const selectedFileId = selectedFile?.id || null;
  const selectedRawFile = selectedFile?.file || null;
  const selectedFileName = selectedRawFile?.name || '';
  const selectedFilePreview = selectedFile?.preview || null;
  const selectedFileTempPath = selectedFile?.tempPath || '';
  const currentIsStep = useMemo(() => isStepFile(selectedFileName), [selectedFileName]);
  const currentIsDxf = useMemo(() => is2DFile(selectedFileName), [selectedFileName]);
  const selectedFileKey = useMemo(() => (
    selectedFileId || selectedFileTempPath || selectedFileName || ''
  ), [selectedFileId, selectedFileTempPath, selectedFileName]);
  const [selectedAdditionalServices, setSelectedAdditionalServices] = useState([]);
  const [selectedFinishColors, setSelectedFinishColors] = useState({});
  // The Finish color drawer: the finish service it is open for, and the color
  // its pointer is over (shown on the 3D model only, never priced or cut).
  const [finishDrawerSvcId, setFinishDrawerSvcId] = useState(null);
  const [finishPreview, setFinishPreview] = useState(null);
  const activeFinishColor = useMemo(() => {
    // Priority order: Find any selected finish that has a color assigned
    const keys = Object.keys(selectedFinishColors);
    if (keys.length === 0) {
      if (selectedMetal?.color) {
        return { color: selectedMetal.color, name: selectedMetal.name || 'Base Material', isBaseMaterialFallback: true };
      }
      return null;
    }
    const firstWithColor = keys.find(k => selectedFinishColors[k]?.color || selectedFinishColors[k]?.hex);
    return selectedFinishColors[firstWithColor || keys[0]];
  }, [selectedFinishColors, selectedMetal]);

  const activeFinishKey = useMemo(() => {
    return Object.keys(selectedFinishColors).find(k => selectedFinishColors[k] === activeFinishColor) || Object.keys(selectedFinishColors)[0];
  }, [selectedFinishColors, activeFinishColor]);

  const isFinishPowderCoating = useMemo(() => {
    if (!activeFinishKey) return false;
    return selectedAdditionalServices.find(s => s.id?.toString() === activeFinishKey.toString())?.title?.toLowerCase().includes('powder coat');
  }, [selectedAdditionalServices, activeFinishKey]);
  const [selectedTaps, setSelectedTaps] = useState({});
  const [selectedHardware, setSelectedHardware] = useState({});
  // The admin's hardware list, per hardware_types id (loaded when the
  // Hardware service is switched on).
  const [hwItemsByType, setHwItemsByType] = useState({});
  const [selectedCountersinks, setSelectedCountersinks] = useState({});
  // The Tapping / Countersinking / Hardware drawer ('tap' | 'cs' | 'hw' |
  // null), the holes its pointer is over (lit on the 3D model) and the last
  // hole clicked there.
  const [holeDrawer, setHoleDrawer] = useState(null);
  const [drawerHoverHoleIds, setDrawerHoverHoleIds] = useState(null);
  const [pickedHole, setPickedHole] = useState({ id: null, seq: 0 });
  // Taps, countersinks and hardware as last confirmed: the drawer's choices
  // are copied here only while it is shut, so the server builds the real cut
  // model once per Done instead of once per pick.
  const [confirmedHoleCuts, setConfirmedHoleCuts] = useState({ taps: {}, sinks: {}, hardware: {} });
  // The finish color as last confirmed, for the same reason: the cut model is
  // built in that color, so it follows the Finish drawer's Done, not each pick.
  const [confirmedFinishColor, setConfirmedFinishColor] = useState(activeFinishColor);
  const [isDetectingHoles, setIsDetectingHoles] = useState(false);
  const [detectedHoles, setDetectedHoles] = useState([]);
  const [allDiscounts, setAllDiscounts] = useState([]);
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [quantityInputValue, setQuantityInputValue] = useState('1');
  const [isModelFadedManually, setIsModelFadedManually] = useState(false);
  const [bendTree, setBendTree] = useState(null);
  const [detectedBends, setDetectedBends] = useState([]);
  const [selectedBends, setSelectedBends] = useState({});
  const activeQuoteItem = useMemo(
    () => files.find(f => f.id === selectedFile?.id) || null,
    [files, selectedFile?.id]
  );
  const selectedViewerFile = useMemo(() => {
    if (!selectedFileId && !selectedRawFile) return null;
    return {
      id: selectedFileId,
      file: selectedRawFile,
      preview: selectedFilePreview,
      tempPath: selectedFileTempPath,
    };
  }, [selectedFileId, selectedRawFile, selectedFilePreview, selectedFileTempPath]);
  const currentBackendData = (
    currentIsStep && selectedFileKey && backendData?.__fileKey === selectedFileKey
      ? backendData
      : null
  );
  // The 2D view is ready once this file's unfold result is in. A flat part
  // (no bends) has no bend tree, and waiting for one kept its flat pattern
  // behind "will appear here after analysis" for good.
  const currentUnfoldReady = Boolean(
    currentBackendData && (bendTree || currentBackendData.success === true)
  );

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  useEffect(() => {
    sharedConfigRef.current = sharedConfig;
  }, [sharedConfig]);

  useEffect(() => {
    setQuantityInputValue(String(normalizeQuoteQuantity(quantity)));
  }, [quantity, selectedFileId]);

  const changeQuantityBy = useCallback((delta) => {
    setQuantity(prev => normalizeQuoteQuantity(prev + delta));
  }, []);

  const handleQuantityInputChange = useCallback((event) => {
    const digits = event.target.value.replace(/\D/g, '');
    setQuantityInputValue(digits);
    if (digits) {
      setQuantity(normalizeQuoteQuantity(digits));
    }
  }, []);

  const commitQuantityInput = useCallback(() => {
    const nextQuantity = normalizeQuoteQuantity(quantityInputValue);
    setQuantity(nextQuantity);
    setQuantityInputValue(String(nextQuantity));
  }, [quantityInputValue]);

  const handleQuantityInputKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  }, []);

  const buildCurrentQuoteConfig = useCallback(() => cloneQuoteConfig({
    productionService: selectedProductionService,
    category: selectedCategory,
    metal: selectedMetal,
    selectedThickness,
    selectedAdditionalServices,
    selectedFinishColors,
    selectedTaps,
    selectedHardware,
    selectedCountersinks,
    selectedBends,
    quantity,
    configStep,
  }), [
    selectedProductionService,
    selectedCategory,
    selectedMetal,
    selectedThickness,
    selectedAdditionalServices,
    selectedFinishColors,
    selectedTaps,
    selectedHardware,
    selectedCountersinks,
    selectedBends,
    quantity,
    configStep,
  ]);

  const applyQuoteConfigToUi = useCallback((config = {}) => {
    const next = cloneQuoteConfig(config);
    setSelectedProductionService(next.productionService);
    setSelectedCategory(next.category);
    setSelectedMetal(next.metal);
    setSelectedThickness(next.selectedThickness);
    setSelectedAdditionalServices(next.selectedAdditionalServices);
    setSelectedFinishColors(next.selectedFinishColors);
    setSelectedTaps(next.selectedTaps);
    setSelectedHardware(next.selectedHardware);
    setSelectedCountersinks(next.selectedCountersinks);
    setSelectedBends(next.selectedBends);
    setQuantity(next.quantity);
    setConfigStep(next.configStep);
  }, []);

  const clearActiveTransientUi = useCallback(() => {
    setHoleDrawer(null);
    setDrawerHoverHoleIds(null);
    setFinishDrawerSvcId(null);
    setFinishPreview(null);
    setConfiguredPreviewUrl(null);
    setIsGeneratingConfiguredPreview(false);
    setIsDetectingHoles(false);
    setIsLoadingUnfold(false);
    setUnfoldProgress(0);
    setUnfoldStage('');
    setStepModelProgress(0);
    setIsStepModelLoading(false);
    stepHolesDetectedRef.current = false;
    holeDetectionAttemptedRef.current = false;
    qty1PriceRef.current = null;
  }, []);

  const selectedThicknessMM = useMemo(() => {
    if (!selectedMetal || !selectedThickness) return 0;
    const t = (selectedMetal.quick_look?.thicknesses || []).find(th => String(th.value) === String(selectedThickness));
    if (!t) return 0;
    return t.metric === 'mm' ? parseFloat(t.value) : parseFloat(t.value) * 25.4;
  }, [selectedMetal, selectedThickness]);

  const selectedThicknessInches = useMemo(() => {
    return selectedThicknessMM > 0 ? selectedThicknessMM / 25.4 : 0;
  }, [selectedThicknessMM]);

  const modelThicknessFrom2dMm = useMemo(() => {
    if (!currentIsStep) return 0;
    return toFiniteNumber(currentBackendData?.thickness);
  }, [currentIsStep, currentBackendData?.thickness]);

  const modelThicknessFrom3dMm = useMemo(() => {
    return toFiniteNumber(dimensions?.mm?.t);
  }, [dimensions?.mm?.t]);

  const modelSize = useMemo(() => {
    const l = toFiniteNumber(dimensions?.mm?.l);
    const w = toFiniteNumber(dimensions?.mm?.w);
    const hasSize = l > 0 && w > 0;
    return {
      l,
      w,
      max: hasSize ? Math.max(l, w) : 0,
      min: hasSize ? Math.min(l, w) : 0,
      hasSize
    };
  }, [dimensions?.mm?.l, dimensions?.mm?.w]);

  const flatSize = useMemo(() => {
    // xSpan/ySpan are the flat pattern's spans; bbox.width/height are only a
    // fallback (on the current worker bbox.height is the sheet thickness).
    const width = currentIsStep ? toFiniteNumber(currentBackendData?.bbox?.xSpan ?? currentBackendData?.bbox?.width) : 0;
    const height = currentIsStep ? toFiniteNumber(currentBackendData?.bbox?.ySpan ?? currentBackendData?.bbox?.height) : 0;
    const hasSize = width > 0 && height > 0;
    return {
      width,
      height,
      max: hasSize ? Math.max(width, height) : 0,
      min: hasSize ? Math.min(width, height) : 0,
      hasSize
    };
  }, [
    currentIsStep,
    currentBackendData?.bbox?.xSpan,
    currentBackendData?.bbox?.ySpan,
    currentBackendData?.bbox?.width,
    currentBackendData?.bbox?.height
  ]);

  const thicknessResolution = useMemo(() => {
    if (currentIsStep && modelThicknessFrom2dMm > 0) {
      return { value: modelThicknessFrom2dMm, source: 'Sheet stock from STEP' };
    }
    if (currentIsStep && modelThicknessFrom3dMm > 0) {
      return { value: modelThicknessFrom3dMm, source: '3D bounding box' };
    }
    if (selectedThicknessMM > 0) {
      return { value: selectedThicknessMM, source: 'Selected stock' };
    }
    return { value: 0, source: currentIsStep ? '3D model unavailable' : 'Unknown' };
  }, [currentIsStep, modelThicknessFrom2dMm, modelThicknessFrom3dMm, selectedThicknessMM]);

  const resolvedModelThicknessMm = thicknessResolution.value;

  const useFlatSize = useMemo(() => {
    if (!currentIsStep) return false;
    return flatSize.hasSize;
  }, [currentIsStep, flatSize.hasSize]);

  const dimensionSourceLabel = useMemo(() => {
    if (currentIsDxf) return '2D drawing';
    return useFlatSize ? '2D flat pattern' : '3D bounding box';
  }, [currentIsDxf, useFlatSize]);

  const thicknessSourceLabel = thicknessResolution.source;

  const selectedThicknessDisplay = useMemo(() => {
    if (!selectedThickness) return null;
    if (selectedThicknessMM > 0) {
      return `${selectedThicknessMM.toFixed(3)} mm (${(selectedThicknessMM / 25.4).toFixed(3)} in)`;
    }
    return String(selectedThickness);
  }, [selectedThickness, selectedThicknessMM]);

  const displayDimensions = useMemo(() => {
    const modelLenMm = modelSize.l;
    const modelWidMm = modelSize.w;
    const lengthMm = useFlatSize ? flatSize.max : modelLenMm;
    const widthMm = useFlatSize ? flatSize.min : modelWidMm;
    const thicknessMm = resolvedModelThicknessMm;
    const volumeMm3 = toFiniteNumber(dimensions?.mm?.volume);

    if (!(lengthMm > 0) || !(widthMm > 0)) return null;

    return {
      mm: {
        l: lengthMm.toFixed(2),
        w: widthMm.toFixed(2),
        t: thicknessMm > 0 ? thicknessMm.toFixed(3) : '0.000',
        volume: volumeMm3.toFixed(2)
      },
      inches: {
        l: (lengthMm / 25.4).toFixed(3),
        w: (widthMm / 25.4).toFixed(3),
        t: thicknessMm > 0 ? (thicknessMm / 25.4).toFixed(3) : '0.000',
        volume: (volumeMm3 / 16387).toFixed(3)
      }
    };
  }, [
    modelSize.l,
    modelSize.w,
    flatSize.max,
    flatSize.min,
    useFlatSize,
    dimensions?.mm?.volume,
    resolvedModelThicknessMm
  ]);

  const perimeterMm = useMemo(() => {
    const direct = toFiniteNumber(currentBackendData?.totalPerimeter);
    if (direct > 0) return direct;

    const measured = measuredCutLengthMm(currentBackendData);
    if (measured > 0) return measured;

    const dxfPerimeter = toFiniteNumber(dxfTechData?.totalPerimeter);
    if (dxfPerimeter > 0) return dxfPerimeter;

    const edgePerimeter = sumSegmentLengths(currentBackendData?.cutEdges);
    if (edgePerimeter > 0) return edgePerimeter;

    const l = toFiniteNumber(displayDimensions?.mm?.l);
    const w = toFiniteNumber(displayDimensions?.mm?.w);
    return l > 0 && w > 0 ? ((l + w) * 2) : 0;
  }, [currentBackendData, dxfTechData?.totalPerimeter, displayDimensions?.mm?.l, displayDimensions?.mm?.w]);

  const pierceCount = useMemo(() => {
    return normalizePierceCount(
      currentBackendData?.pierceCount,
      dxfTechData?.pierceCount,
      detectedHoles.length,
      currentIsStep
    );
  }, [currentBackendData?.pierceCount, dxfTechData?.pierceCount, detectedHoles.length, currentIsStep]);

  const pricingTechnicalData = useMemo(() => {
    return {
      totalPerimeter: perimeterMm,
      pierceCount,
      bends: Array.isArray(currentBackendData?.bends) ? currentBackendData.bends : [],
      sheetNest: currentBackendData?.sheetNest || currentBackendData?.sheet_nest || null,
      // Used by backend smart nesting. cutEdges are the unfolded 2D profile segments in mm.
      cutEdges: Array.isArray(currentBackendData?.cutEdges) ? currentBackendData.cutEdges : [],
      flatArea: toFiniteNumber(currentBackendData?.flatArea)
    };
  }, [
    perimeterMm,
    pierceCount,
    currentBackendData?.bends,
    currentBackendData?.sheetNest,
    currentBackendData?.sheet_nest,
    currentBackendData?.cutEdges,
    currentBackendData?.flatArea
  ]);

  const measurementMetrics = useMemo(() => {
    const lengthMm = toFiniteNumber(displayDimensions?.mm?.l);
    const widthMm = toFiniteNumber(displayDimensions?.mm?.w);
    const thicknessMm = toFiniteNumber(displayDimensions?.mm?.t);
    const areaMm2 = lengthMm * widthMm;
    const diagonalMm = Math.sqrt((lengthMm * lengthMm) + (widthMm * widthMm));

    return {
      lengthMm,
      widthMm,
      thicknessMm,
      areaMm2,
      diagonalMm,
      perimeterMm,
      pierceCount
    };
  }, [displayDimensions?.mm?.l, displayDimensions?.mm?.w, displayDimensions?.mm?.t, perimeterMm, pierceCount]);

  // Pricing uses the user-selected stock thickness only — never the model's
  // measured thickness, since the latter rarely matches an allowed stock size
  // (e.g. 7.372 mm has no matching 6061 sheet; 8.0 mm / .313" does).
  const pricingThicknessInches = useMemo(() => {
    return selectedThicknessInches > 0 ? selectedThicknessInches : 0;
  }, [selectedThicknessInches]);

  const bendList = useMemo(() => {
    const list = [];
    if (!bendTree) return list;
    const flatten = (node) => {
      if (node.bendAxis) list.push(node);
      if (node.children) node.children.forEach(flatten);
    };
    flatten(bendTree);
    return list;
  }, [bendTree]);

  const bendCountTotal = useMemo(() => {
    const fromTree = bendList.length;
    const fromBackend = Array.isArray(currentBackendData?.bends) ? currentBackendData.bends.length : 0;
    return Math.max(fromTree, fromBackend);
  }, [bendList.length, currentBackendData?.bends]);

  const nonFlatFeatureInfo = useMemo(() => {
    const raw = currentBackendData?.nonFlatFeatures;
    if (!raw || typeof raw !== 'object') {
      return {
        hasRaisedFeatures: false,
        raisedFeatureFaceCount: 0,
        maxOffsetMm: 0,
        primaryReason: ''
      };
    }

    const raisedCount = Number.parseInt(raw?.raisedFeatureFaceCount, 10);
    const maxOffsetMm = toFiniteNumber(raw?.maxOffsetMm);
    const reasons = Array.isArray(raw?.reasons) ? raw.reasons.filter(Boolean) : [];

    return {
      hasRaisedFeatures: Boolean(raw?.hasRaisedFeatures),
      raisedFeatureFaceCount: Number.isFinite(raisedCount) ? raisedCount : 0,
      maxOffsetMm,
      primaryReason: reasons[0] || ''
    };
  }, [currentBackendData?.nonFlatFeatures]);

  const processEligibility = currentBackendData?.processEligibility || {};
  const laserEligibility = processEligibility?.laser || {};

  // Laser is allowed for plain sheet profiles and sheet-metal bends.
  // Prefer backend processEligibility when present. Do NOT also OR with
  // nonFlatFeatures.hasRaisedFeatures, because bent sheet parts can have
  // offset parallel flanges that the raw diagnostic may still report as
  // raised planar offsets. The final allow/block decision belongs to
  // processEligibility.laser.blocked.
  const hasLaserEligibilityDecision = typeof laserEligibility.blocked === 'boolean';
  const isLaserBlockedByNonFlatFeatures = currentIsStep && (
    hasLaserEligibilityDecision
      ? laserEligibility.blocked === true
      : nonFlatFeatureInfo.hasRaisedFeatures
  );

  useMemo(() => {
    const areaMm2 = measurementMetrics.areaMm2;
    const thicknessMm = measurementMetrics.thicknessMm;
    const minSpan = Math.max(1, Math.min(measurementMetrics.lengthMm || 0, measurementMetrics.widthMm || 0));
    const thicknessRatio = thicknessMm > 0 ? (thicknessMm / minSpan) : 0;
    const pierceDensity = areaMm2 > 0 ? ((pierceCount * 10000) / areaMm2) : 0; // per 100 cm²
    const perimeterComplexity = areaMm2 > 0 ? (perimeterMm / Math.sqrt(areaMm2)) : 0;
    const has2dProfile = currentIsDxf || (currentIsStep && dimensionSourceLabel === '2D flat pattern');
    const raisedCount = nonFlatFeatureInfo.raisedFeatureFaceCount;
    const raisedOffset = nonFlatFeatureInfo.maxOffsetMm;

    return [
      {
        id: 'bends',
        label: 'Bend Features',
        value: `${bendCountTotal}`,
        status: 'pass',
        impact: bendCountTotal > 0 ? 'Laser OK + Bending' : 'Laser OK',
        reason: bendCountTotal > 0
          ? `Detected ${bendCountTotal} bend(s). Bends are allowed for Laser jobs; add/select the Bending service for forming cost.`
          : 'No bends detected.'
      },
      {
        id: 'raised-features',
        label: 'Raised 3D Features',
        value: `${raisedCount}`,
        status: isLaserBlockedByNonFlatFeatures ? 'fail' : 'pass',
        impact: isLaserBlockedByNonFlatFeatures ? 'Locks Laser' : 'Laser OK',
        reason: isLaserBlockedByNonFlatFeatures
          ? (nonFlatFeatureInfo.primaryReason || `Detected raised 3D bosses/features (max offset ${raisedOffset.toFixed(3)} mm).`)
          : 'No raised bosses/emboss features detected.'
      },
      {
        id: 'thickness-ratio',
        label: 'Thickness Ratio (T/min span)',
        value: thicknessRatio > 0 ? `${(thicknessRatio * 100).toFixed(2)}%` : 'N/A',
        status: thicknessRatio > 0.18 ? 'warn' : 'pass',
        impact: thicknessRatio > 0.18 ? 'Complex Setup Risk' : 'Normal',
        reason: thicknessRatio > 0.18
          ? 'High thickness-to-span ratio often indicates complex machining or fixturing.'
          : 'Thickness ratio is within a typical flat-part range.'
      },
      {
        id: 'pierce-density',
        label: 'Pierce Density',
        value: `${pierceDensity.toFixed(2)} / 100 cm²`,
        status: pierceDensity > 8 ? 'warn' : 'pass',
        impact: pierceDensity > 8 ? 'Feature Dense' : 'Normal',
        reason: pierceDensity > 8
          ? 'High feature density can increase cycle complexity and setup requirements.'
          : 'Feature density is within typical production ranges.'
      },
      {
        id: 'edge-complexity',
        label: 'Edge Complexity',
        value: perimeterComplexity > 0 ? perimeterComplexity.toFixed(2) : 'N/A',
        status: perimeterComplexity > 9 ? 'warn' : 'pass',
        impact: perimeterComplexity > 9 ? 'Complex Profile' : 'Normal',
        reason: perimeterComplexity > 9
          ? 'High perimeter-to-area complexity indicates detailed contouring.'
          : 'Contour complexity is suitable for standard profiling.'
      },
      {
        id: 'profile-availability',
        label: '2D Profile Availability',
        value: has2dProfile ? 'Available' : 'Limited',
        status: has2dProfile ? 'pass' : 'warn',
        impact: has2dProfile ? 'Reliable Flat Sizing' : 'Using 3D Fallback',
        reason: has2dProfile
          ? 'Flat profile data is available for accurate process suitability checks.'
          : 'Flat profile data not available; sizing relies on 3D fallback dimensions.'
      }
    ];
  }, [
    measurementMetrics.areaMm2,
    measurementMetrics.thicknessMm,
    measurementMetrics.lengthMm,
    measurementMetrics.widthMm,
    pierceCount,
    perimeterMm,
    currentIsDxf,
    currentIsStep,
    dimensionSourceLabel,
    bendCountTotal,
    isLaserBlockedByNonFlatFeatures,
    nonFlatFeatureInfo.raisedFeatureFaceCount,
    nonFlatFeatureInfo.maxOffsetMm,
    nonFlatFeatureInfo.primaryReason
  ]);

  const bendService = useMemo(
    () => allServices.find(s => s.title?.toLowerCase().includes('bend')) || null,
    [allServices]
  );

  const selectedThicknessObj = useMemo(() => {
    if (!selectedMetal || !selectedThickness) return null;
    return (selectedMetal.quick_look?.thicknesses || []).find(t => String(t.value) === String(selectedThickness)) || null;
  }, [selectedMetal, selectedThickness]);

  const bendSupportStatus = useMemo(() => {
    if (!bendService || !selectedMetal) return { supported: false, warning: '' };

    const bendServiceId = Number(bendService.id);
    const metalServiceIds = parseServiceIds(selectedMetal.services);
    const thicknessServiceIds = parseServiceIds(selectedThicknessObj?.services);
    const hasMetalGrant = metalServiceIds.includes(bendServiceId);
    const hasThicknessGrant = thicknessServiceIds.includes(bendServiceId);
    const selectedLabel = selectedThicknessDisplay || selectedThickness || 'selected thickness';

    if (!hasMetalGrant && !hasThicknessGrant) {
      return {
        supported: false,
        warning: `Bending is not available for ${selectedMetal.name} at ${selectedLabel}.`
      };
    }

    if (selectedMetal.is_bendable === false && !hasThicknessGrant) {
      return {
        supported: false,
        warning: `${selectedMetal.name} at ${selectedLabel} is not bendable, so bending cost was removed.`
      };
    }

    return { supported: true, warning: '' };
  }, [bendService, selectedMetal, selectedThicknessObj, selectedThicknessDisplay, selectedThickness]);

  const quoteAdditionalServices = useMemo(() => {
    return selectedAdditionalServices.filter((svc) => {
      const title = String(svc?.title || '').toLowerCase();
      return !(title.includes('bend') && !bendSupportStatus.supported);
    });
  }, [selectedAdditionalServices, bendSupportStatus.supported]);

  const bendDisplayPrice = useMemo(() => {
    const rows = priceEstimate?.breakdown?.service_breakdown || [];
    const bendRow = rows.find(r => (r?.name || '').toLowerCase().includes('bend'));
    if (bendRow) return parseFloat(bendRow.price || 0) || 0;

    // Fallback if service_breakdown is unavailable.
    const bendCount = bendList?.length || 0;
    if (!bendService || bendCount === 0) return 0;
    return (parseFloat(bendService.base_price || 0) || 0) * bendCount;
  }, [priceEstimate, bendList, bendService]);

  useEffect(() => {
    if (!bendService) return;
    const bendCount = bendCountTotal;
    const hasBendingServiceSelected = selectedAdditionalServices.some(s => s.id === bendService.id);

    if ((bendCount === 0 || !bendSupportStatus.supported) && hasBendingServiceSelected) {
      setSelectedAdditionalServices(prev => prev.filter(s => s.id !== bendService.id));
      setSelectedBends({});
      return;
    }

    if (bendCount > 0 && bendSupportStatus.supported && !hasBendingServiceSelected) {
      setSelectedAdditionalServices(prev => [...prev, bendService]);
      return;
    }

    if (bendCount === 0 && hasBendingServiceSelected) {
      setSelectedAdditionalServices(prev => prev.filter(s => s.id !== bendService.id));
      setSelectedBends({});
    }
  }, [bendService, bendCountTotal, bendSupportStatus.supported, selectedAdditionalServices]);

  useEffect(() => {
    if (!selectedProductionService) return;
    const { isLaser } = getProcessFlags(selectedProductionService.title);
    if (!isLaser || !isLaserBlockedByNonFlatFeatures) return;

    setSelectedProductionService(null);
    setSelectedCategory(null);
    setSelectedMetal(null);
    setSelectedThickness(null);
    setConfigStep(0);

    const raisedCount = nonFlatFeatureInfo.raisedFeatureFaceCount;
    const reason = laserEligibility.lockReason
      || nonFlatFeatureInfo.primaryReason
      || `Detected raised 3D features (${raisedCount}). Laser cutting supports plain sheet profiles and bends only.`;
    toast(reason, 'error');
  }, [selectedProductionService, isLaserBlockedByNonFlatFeatures, nonFlatFeatureInfo.raisedFeatureFaceCount, nonFlatFeatureInfo.primaryReason, laserEligibility.lockReason, toast]);

  const stepHolesDetectedRef = useRef(false);
  const holeDetectionAttemptedRef = useRef(false);
  const qty1PriceRef = useRef(null);
  // Each price request takes a number; only the newest one's reply is kept,
  // so a slow older reply can never overwrite a newer price.
  const priceRequestSeqRef = useRef(0);
  const detectHolesAbortRef = useRef(null);

  const holeIndexById = useMemo(() => {
    const idx = {};
    detectedHoles.forEach((h, i) => { idx[h.id] = i + 1; });
    return idx;
  }, [detectedHoles]);

  // Keep only assignments that still map to currently detected holes.
  // This prevents stale hidden entries from inflating hardware/tap/countersink counts and pricing.
  useEffect(() => {
    if (!detectedHoles.length) return;

    const validIds = new Set(detectedHoles.map(h => String(h.id)));
    const pruneByHoleIds = (prev) => {
      const src = prev || {};
      const next = {};
      let changed = false;
      Object.entries(src).forEach(([k, v]) => {
        if (validIds.has(String(k))) next[k] = v;
        else changed = true;
      });
      if (!changed && Object.keys(src).length === Object.keys(next).length) return prev;
      return next;
    };

    setSelectedHardware(prev => pruneByHoleIds(prev));
    setSelectedCountersinks(prev => pruneByHoleIds(prev));
    setSelectedTaps(prev => pruneByHoleIds(prev));
  }, [detectedHoles]);

  const isTappingActive = useMemo(() =>
    selectedAdditionalServices.some(s => s.title.toLowerCase().includes('tap')),
    [selectedAdditionalServices]
  );
  const isCountersinkingActive = useMemo(() =>
    selectedAdditionalServices.some(s => s.title.toLowerCase().includes('countersink')),
    [selectedAdditionalServices]
  );

  const isHardwareActive = useMemo(() =>
    selectedAdditionalServices.some(s => s.title.toLowerCase().includes('hardware')),
    [selectedAdditionalServices]
  );

  // The admin's active parts of the four kinds, in the order the drawer
  // lists them; null until the lists have loaded.
  const hwOptions = useMemo(() => {
    if (!HARDWARE_TYPES.every(t => Array.isArray(hwItemsByType[t.id]))) return null;
    return HARDWARE_TYPES.flatMap(t => hwItemsByType[t.id].filter(item => item && item.is_active !== false));
  }, [hwItemsByType]);

  const selectedHardwareForPreview = useMemo(() => {
    const entries = Object.entries(confirmedHoleCuts.hardware || {}).filter(([, hw]) => {
      const typeId = Number(hw?.typeId);
      return typeId === 1 || typeId === 2 || typeId === 3 || typeId === 4;
    });
    return Object.fromEntries(entries);
  }, [confirmedHoleCuts]);

  // The server builds a real cut model for the 3D view. While a configure
  // drawer is open taps, countersinks and hardware are drawn straight onto
  // the view as they are chosen; the cut model follows once it closes
  // (Done), so the model reloads once per Done, not once per pick.
  const hasConfiguredCuts = useMemo(() => {
    return (
      Object.keys(selectedHardwareForPreview || {}).length > 0 ||
      Object.keys(confirmedHoleCuts.taps || {}).length > 0 ||
      Object.keys(confirmedHoleCuts.sinks || {}).length > 0
    );
  }, [selectedHardwareForPreview, confirmedHoleCuts]);

  const configuredPreviewPayload = useMemo(() => {
    if (!selectedFile?.tempPath || !currentIsStep || !hasConfiguredCuts) return null;

    const finishColor = confirmedFinishColor
      ? (confirmedFinishColor?.color || confirmedFinishColor?.hex || (typeof confirmedFinishColor === 'string' ? confirmedFinishColor : null))
      : null;
    const mmThickness = resolvedModelThicknessMm > 0
      ? Number(resolvedModelThicknessMm.toFixed(4))
      : (selectedThicknessMM > 0 ? Number(selectedThicknessMM.toFixed(4)) : null);

    return {
      tempPath: selectedFile.tempPath,
      configuration: {
        selectedTaps: confirmedHoleCuts.taps,
        selectedHardware: selectedHardwareForPreview,
        selectedCountersinks: confirmedHoleCuts.sinks,
        thickness: mmThickness,
        dimensions: mmThickness ? { mm: { t: mmThickness } } : null,
        anodizingColor: finishColor ? { color: finishColor } : null,
      }
    };
  }, [selectedFile?.tempPath, currentIsStep, hasConfiguredCuts, selectedHardwareForPreview, confirmedHoleCuts, resolvedModelThicknessMm, selectedThicknessMM, confirmedFinishColor]);

  const tapOptions = useMemo(() => {
    const tapSvc = allServices.find(s => s.title.toLowerCase().includes('tap'));
    let options = tapSvc?.service_options || [];
    if (typeof options === 'string') {
      try { options = JSON.parse(options); } catch { options = []; }
    }
    return Array.isArray(options) ? options : [];
  }, [allServices]);

  const csOptions = useMemo(() => {
    const csSvc = allServices.find(s => s.title.toLowerCase().includes('countersink'));
    let options = csSvc?.service_options || [];
    if (typeof options === 'string') {
      try { options = JSON.parse(options); } catch { options = []; }
    }
    return Array.isArray(options) ? options : [];
  }, [allServices]);

  // The drawer belongs to the Services step of an open quote; it never
  // lingers behind another step or once its service is switched off.
  const activeHoleDrawer = (
    isQuoteFlowActive
    && configStep === 4
    && (
      (holeDrawer === 'tap' && isTappingActive)
      || (holeDrawer === 'cs' && isCountersinkingActive)
      || (holeDrawer === 'hw' && isHardwareActive)
    )
  ) ? holeDrawer : null;

  // The Finish color drawer follows the same rule: the finish service it was
  // opened for, only on the Services step and only while that service is on.
  const activeFinishDrawerSvc = (
    isQuoteFlowActive
    && configStep === 4
    && finishDrawerSvcId !== null
  ) ? (selectedAdditionalServices.find(s => String(s.id) === String(finishDrawerSvcId)) || null) : null;

  // While it is open the model shows the color under its pointer; prices and
  // the cut model only ever see the chosen one.
  const finishPreviewShown = activeFinishDrawerSvc && finishPreview ? finishPreview : null;
  const viewerFinishColor = finishPreviewShown || activeFinishColor;
  const viewerFinishIsPowder = finishPreviewShown
    ? String(activeFinishDrawerSvc.title || '').toLowerCase().includes('powder coat')
    : isFinishPowderCoating;

  const closeFinishDrawer = useCallback(() => {
    setFinishDrawerSvcId(null);
    setFinishPreview(null);
  }, []);

  if (!activeFinishDrawerSvc && confirmedFinishColor !== activeFinishColor) {
    setConfirmedFinishColor(activeFinishColor);
  }

  // One feature per hole (as SendCutSend does): a hole that is tapped,
  // countersunk or carries hardware is locked in the other drawer, so an
  // order can never pay for two features the cut can only make one of.
  const lockedHolesForDrawer = useMemo(() => {
    if (!activeHoleDrawer) return {};
    const locks = {};
    if (activeHoleDrawer !== 'hw') {
      Object.entries(selectedHardware || {}).forEach(([id, hw]) => {
        locks[id] = { kind: 'hw', label: 'Hardware', detail: hw?.item?.name || '' };
      });
    }
    if (activeHoleDrawer !== 'cs') {
      Object.entries(selectedCountersinks || {}).forEach(([id, cs]) => {
        locks[id] = { kind: 'cs', label: 'Countersinking', detail: countersinkLabel(cs) };
      });
    }
    if (activeHoleDrawer !== 'tap') {
      Object.entries(selectedTaps || {}).forEach(([id, tap]) => {
        locks[id] = { kind: 'tap', label: 'Tapping', detail: tap?.name || '' };
      });
    }
    return locks;
  }, [activeHoleDrawer, selectedHardware, selectedCountersinks, selectedTaps]);

  // The x on a locked hole in the drawer takes the other feature off it, so
  // the hole is free for this one (as SendCutSend does).
  const unlockHoles = useCallback((holeIds, kind) => {
    const drop = (prev) => {
      const next = { ...(prev || {}) };
      holeIds.forEach(id => { delete next[id]; });
      return next;
    };
    if (kind === 'tap') setSelectedTaps(drop);
    else if (kind === 'cs') setSelectedCountersinks(drop);
    else if (kind === 'hw') setSelectedHardware(drop);
  }, []);

  const closeHoleDrawer = useCallback(() => {
    setHoleDrawer(null);
    setDrawerHoverHoleIds(null);
  }, []);

  if (!activeHoleDrawer && (
    confirmedHoleCuts.taps !== selectedTaps
    || confirmedHoleCuts.sinks !== selectedCountersinks
    || confirmedHoleCuts.hardware !== selectedHardware
  )) {
    setConfirmedHoleCuts({ taps: selectedTaps, sinks: selectedCountersinks, hardware: selectedHardware });
  }

  const handleHolePick = useCallback((hole) => {
    setPickedHole(prev => ({ id: hole?.id ?? null, seq: prev.seq + 1 }));
  }, []);

  // The part is made from the chosen stock, so that thickness decides which
  // tap and countersink sizes can be made (see optionBlockedReason).
  const holeSheetThicknessMm = selectedThicknessMM > 0 ? selectedThicknessMM : resolvedModelThicknessMm;

  // When the sheet changes, sizes that no longer fit it are taken off their
  // holes and the customer is told (state adjusted during render, as React
  // recommends for state that follows a value; the message goes out after).
  const [holeSheetSeen, setHoleSheetSeen] = useState(holeSheetThicknessMm);
  const [holeSheetNotice, setHoleSheetNotice] = useState(null);
  if (holeSheetThicknessMm !== holeSheetSeen) {
    setHoleSheetSeen(holeSheetThicknessMm);
    const keepFitting = (selections, kind) => {
      const next = {};
      let dropped = 0;
      Object.entries(selections || {}).forEach(([holeId, sel]) => {
        if (sel && optionBlockedReason(kind, sel, holeSheetThicknessMm)) dropped += 1;
        else next[holeId] = sel;
      });
      return { next, dropped };
    };
    const taps = keepFitting(selectedTaps, 'tap');
    const sinks = keepFitting(selectedCountersinks, 'cs');
    if (taps.dropped > 0) setSelectedTaps(taps.next);
    if (sinks.dropped > 0) setSelectedCountersinks(sinks.next);
    if (taps.dropped + sinks.dropped > 0) {
      const parts = [];
      if (taps.dropped) parts.push(`${taps.dropped} tap${taps.dropped === 1 ? '' : 's'}`);
      if (sinks.dropped) parts.push(`${sinks.dropped} countersink${sinks.dropped === 1 ? '' : 's'}`);
      setHoleSheetNotice({
        seq: (holeSheetNotice?.seq || 0) + 1,
        text: `Removed ${parts.join(' and ')} that can't be made on the new sheet thickness.`,
      });
    }
  }
  const shownHoleSheetNoticeRef = useRef(0);
  useEffect(() => {
    if (!holeSheetNotice || holeSheetNotice.seq === shownHoleSheetNoticeRef.current) return;
    shownHoleSheetNoticeRef.current = holeSheetNotice.seq;
    toast(holeSheetNotice.text, 'info');
  }, [holeSheetNotice, toast]);

  function handleProceedToReview() {
    handleAddAllToCart();
  }

  // ── Fetch all hardware types when hardware service is selected ──────────
  useEffect(() => {
    const hwSvc = selectedAdditionalServices.find(s => s.title.toLowerCase().includes('hardware'));
    if (!hwSvc) return;
    HARDWARE_TYPES.forEach(({ id }) => {
      if (hwItemsByType[id] !== undefined) return;
      fetchHardwareItemsByType(id)
        .then(items => setHwItemsByType(prev => ({ ...prev, [id]: items || [] })))
        .catch(() => setHwItemsByType(prev => ({ ...prev, [id]: [] })));
    });
  }, [selectedAdditionalServices]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch metals for the selected production service ─────────────────────
  useEffect(() => {
    if (!selectedProductionService) return;
    const fetchServiceMetals = async () => {
      try {
        const metals = await fetchMetalsByServiceId(selectedProductionService.id);
        if (metals) setAllMetals(metals);
      } catch (err) {
        console.error('Failed to fetch service-specific metals:', err);
      }
    };
    fetchServiceMetals();
  }, [selectedProductionService]);

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
          fetchPublicDiscounts(),
          fetchCategories(),
          fetchMetals(),
          fetchCncPricingConfig(),
          fetchPricingSheetMetals(),
          fetchPricingCncMetals()
        ]);

        const svcs = results[0].status === 'fulfilled' ? results[0].value : [];
        const disc = results[1].status === 'fulfilled' ? results[1].value : [];
        const cats = results[2].status === 'fulfilled' ? results[2].value : [];
        const mets = results[3].status === 'fulfilled' ? results[3].value : [];
        const cncCfg = results[4].status === 'fulfilled' ? results[4].value : null;

        setAllDiscounts(disc || []);
        setAllCategories(cats || []);
        setAllMetals(mets || []);

        // Convert service dimension fields to mm for size locking
        const toMM = (val, unit) => {
          const v = parseFloat(val) || 0;
          return v > 0 ? (unit === 'in' ? v * 25.4 : v) : null;
        };
        const enhancedServices = (svcs || []).map(s => {
          const unit = s.dimensions_unit || 'in';
          // Build config from the service's own admin-configured fields
          const dimCfg = {
            max_x: toMM(s.max_length, unit),
            min_x: toMM(s.min_length, unit),
            max_y: toMM(s.max_width, unit),
            min_y: toMM(s.min_width, unit),
            max_z: toMM(s.max_height, unit),
            min_z: toMM(s.min_height, unit),
          };
          if (s.title.toLowerCase().includes('cnc') && cncCfg) {
            // Merge CNC global config with service-level fields (service fields take priority)
            return { ...s, config: { ...cncCfg, ...Object.fromEntries(Object.entries(dimCfg).filter(([, v]) => v !== null)) } };
          }
          return { ...s, config: dimCfg };
        });

        setAllServices(enhancedServices);

        // Set default primary service (e.g. Laser Cut)
        if (svcs && svcs.length > 0 && !selectedProductionService) {
          const primary = svcs.find(s => s.is_production);
          if (primary) setSelectedProductionService(primary);
        }
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
      }
    };
    loadAppData();
    // Runs once on mount — loading metals/services/discounts/configs is a one-shot; depending on
    // selectedProductionService would re-fetch all 7 APIs on every method change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Check backend availability on mount ───────────────
  useEffect(() => {
    fetch(apiUrl('/health'), { signal: AbortSignal.timeout(300000) })
      .catch(() => { /* Backend is handled per-request */ });
  }, []);

  // ── Restore quote state when the active file changes ──────────────
  useEffect(() => {
    if (!selectedFile) return;
    const item = filesRef.current.find(f => f.id === selectedFile.id);
    const config = getQuoteConfigForFile(item, sharedConfigRef.current);
    const analysis = cloneQuoteAnalysis(item?.analysis);
    restoringQuoteItemRef.current = true;
    applyQuoteConfigToUi(config);
    setDimensions(analysis.dimensions);
    setDxfSvg(analysis.dxfSvg);
    setDxfTechData(analysis.dxfTechData);
    setBackendData(analysis.backendData);
    setBendTree(analysis.bendTree);
    setDetectedHoles(analysis.detectedHoles);
    setDetectedBends(analysis.detectedBends);
    setPriceEstimate(item?.pricing?.estimate || null);
    setIsCalculatingPrice(item?.pricing?.status === 'calculating');
    clearActiveTransientUi();
    setViewMode(is2DFile(selectedFile.file?.name) ? '2d' : '3d');
    setActiveAxis(is2DFile(selectedFile.file?.name) ? 'flat' : 'iso');
  }, [selectedFile, selectedFile?.id, applyQuoteConfigToUi, clearActiveTransientUi]);

  useEffect(() => {
    if (!selectedFile) return;
    if (restoringQuoteItemRef.current) {
      restoringQuoteItemRef.current = false;
      return;
    }

    const nextConfig = buildCurrentQuoteConfig();
    const active = filesRef.current.find(f => f.id === selectedFile.id);

    const shouldKeepShared = filesRef.current.length <= 1 && !active?.customized;

    if (!shouldKeepShared) {
      setFiles(prev => prev.map(f => (
        f.id === selectedFile.id
          ? { ...f, customized: true, config: cloneQuoteConfig(nextConfig), pricing: makeEmptyQuotePricing() }
          : f
      )));
      return;
    }

    const nextSharedConfig = cloneSharedQuoteConfig(nextConfig);
    setSharedConfig(nextSharedConfig);
    setFiles(prev => prev.map(f => (
      f.customized
        ? f
        : {
          ...f,
          config: cloneQuoteConfig({
            ...nextSharedConfig,
            quantity: f.id === selectedFile.id
              ? nextConfig.quantity
              : normalizeQuoteQuantity(f.config?.quantity),
          }),
          pricing: makeEmptyQuotePricing()
        }
    )));
  }, [
    selectedFile?.id,
    selectedFile,
    buildCurrentQuoteConfig,
    selectedProductionService,
    selectedCategory,
    selectedMetal,
    selectedThickness,
    selectedAdditionalServices,
    selectedFinishColors,
    selectedTaps,
    selectedHardware,
    selectedCountersinks,
    selectedBends,
    quantity,
    configStep,
  ]);

  // ── STEP Hole Detection (pierce count + tapping/hardware) ───────
  // Split into two effects so that backendData arriving (from handleUnfold)
  // can't race against an in-flight /api/detect-holes fetch. Each effect has
  // the minimum deps needed so cleanup never aborts a live request unless
  // the file itself actually changed.
  const detectHolesContextRef = useRef({ thicknessMm: 0 });
  detectHolesContextRef.current.thicknessMm = parseFloat(displayDimensions?.mm?.t) || 0;

  // 1) When the backend (via handleUnfold) returns detectedHoles, adopt them.
  useEffect(() => {
    if (!selectedFile || !isStepFile(selectedFile.file.name)) return;
    if (backendData?.__fileKey !== selectedFileKey) return;
    const backendHoles = engineHolesForModel(backendData);
    if (backendHoles.length === 0) return;
    const tMm = detectHolesContextRef.current.thicknessMm;
    const depthIn = tMm > 0 ? tMm / 25.4 : 2 / 25.4;
    setDetectedHoles(mapEngineHoles(backendHoles, depthIn));
    stepHolesDetectedRef.current = true;
    holeDetectionAttemptedRef.current = true;
    // If a fallback detect() is still in-flight, cancel it — we have real data.
    if (detectHolesAbortRef.current) {
      try { detectHolesAbortRef.current.abort(); } catch { /* noop */ }
      detectHolesAbortRef.current = null;
    }
  }, [selectedFile, selectedFileKey, backendData]);

  // 2) Fire the direct /api/detect-holes fetch once per file. Depends ONLY on
  // selectedFile so no other state change can abort the in-flight request.
  useEffect(() => {
    if (!selectedFile || !isStepFile(selectedFile.file.name)) return;
    if (stepHolesDetectedRef.current || holeDetectionAttemptedRef.current || detectHolesAbortRef.current) return;

    const controller = new AbortController();
    detectHolesAbortRef.current = controller;
    holeDetectionAttemptedRef.current = true;
    setIsDetectingHoles(true);

    const timeoutId = setTimeout(() => {
      try { controller.abort(); } catch { /* noop */ }
    }, 30000);

    (async () => {
      try {
        let r;
        if (selectedFile?.tempPath) {
          r = await fetch(apiUrl('/detect-holes-by-temp'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempPath: selectedFile.tempPath }),
            signal: controller.signal,
          });
        } else {
          const fd = new FormData();
          fd.append('file', selectedFile.file);
          r = await fetch(apiUrl('/detect-holes'), {
            method: 'POST',
            body: fd,
            signal: controller.signal,
          });
        }

        if (!r.ok) throw new Error(`Server responded with ${r.status}`);
        const d = await r.json();
        // If backendData already populated detectedHoles, it wins — bail.
        if (stepHolesDetectedRef.current) return;
        const tMm = detectHolesContextRef.current.thicknessMm;
        const depthIn = tMm > 0 ? tMm / 25.4 : 2 / 25.4;
        setDetectedHoles(mapEngineHoles(d.holes, depthIn));
        stepHolesDetectedRef.current = true;
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Could not detect holes:', err.message);
      } finally {
        clearTimeout(timeoutId);
        setIsDetectingHoles(false);
        if (detectHolesAbortRef.current === controller) {
          detectHolesAbortRef.current = null;
        }
      }
    })();

    return () => {
      // File changed — abort the fetch and free the slot so the next file
      // can fire its own detection cleanly.
      clearTimeout(timeoutId);
      try { controller.abort(); } catch { /* noop */ }
      if (detectHolesAbortRef.current === controller) {
        detectHolesAbortRef.current = null;
      }
    };
  }, [selectedFile]);

  // Open one sub-service drawer or modal (closes all others first)
  const openSubModal = (kind, svc) => {
    setHoleDrawer(null);
    setFinishDrawerSvcId(null);
    setFinishPreview(null);
    if (kind === 'tap' || kind === 'cs' || kind === 'hw') {
      setHoleDrawer(kind);
    } else if (kind === 'finish') {
      if (svc) setFinishDrawerSvcId(svc.id);
    }
  };

  // ── Real-Time Price Calculation ───────────────────────
  useEffect(() => {
    // Guard: Need dimensions and at least one selection
    if (!displayDimensions || (!selectedMetal && !selectedProductionService)) {
      setPriceEstimate(null);
      return;
    }

    // A metal without a selected stock thickness can't be priced — skip the
    // call rather than sending the model's measured thickness (which rarely
    // matches any allowed stock and would 400 with "not configured").
    if (selectedMetal && !(pricingThicknessInches > 0)) {
      setPriceEstimate(null);
      setIsCalculatingPrice(false);
      return;
    }

    // Preemptive metal-bounds check: lock silently instead of letting the
    // backend 400 and spam the console. metal_configs.min_x/max_x/... are inches.
    if (selectedMetal) {
      const mL = parseFloat(displayDimensions.mm.l) || 0;
      const mW = parseFloat(displayDimensions.mm.w) || 0;
      const mT = parseFloat(displayDimensions.mm.t) || 0;
      const inToMm = (v) => (v ? parseFloat(v) * 25.4 : null);
      const maxXmm = inToMm(selectedMetal.max_x);
      const maxYmm = inToMm(selectedMetal.max_y);
      const minXmm = inToMm(selectedMetal.min_x);
      const minYmm = inToMm(selectedMetal.min_y);
      const maxZmm = inToMm(selectedMetal.max_z);
      const minZmm = inToMm(selectedMetal.min_z);
      const outOfBounds =
        (maxXmm && mL > maxXmm) || (maxYmm && mW > maxYmm) ||
        (minXmm && mL < minXmm) || (minYmm && mW < minYmm) ||
        (mT > 0 && maxZmm && mT > maxZmm) ||
        (mT > 0 && minZmm && mT < minZmm);
      if (outOfBounds) {
        setPriceEstimate(null);
        setIsCalculatingPrice(false);
        return;
      }
    }

    const getEstimate = async () => {
      const requestSeq = priceRequestSeqRef.current + 1;
      priceRequestSeqRef.current = requestSeq;
      const isLatest = () => requestSeq === priceRequestSeqRef.current;
      setIsCalculatingPrice(true);
      try {
        const thicknessValueIn = pricingThicknessInches > 0 ? pricingThicknessInches.toFixed(6) : null;
        const activePricingKey = buildPricingKeyForQuoteItem(
          {
            ...selectedFile,
            analysis: {
              dimensions,
              dxfSvg,
              dxfTechData,
              backendData,
              bendTree,
              detectedHoles,
              detectedBends,
            }
          },
          buildCurrentQuoteConfig(),
          allServices
        );

        const payload = {
          metal_id: selectedMetal?.id || null,
          service_id: selectedProductionService?.id || null,
          thickness_value: thicknessValueIn,
          length_in: displayDimensions.inches.l,
          height_in: displayDimensions.inches.w,
          quantity: quantity,
          additional_services: quoteAdditionalServices.map(s => {
            const opt = selectedFinishColors[s.id];
            const options = Array.isArray(s.service_options) ? s.service_options : [];
            const optIndex = opt
              ? options.findIndex(o =>
                (opt.id != null && o.id === opt.id) ||
                (opt.name && o.name === opt.name) ||
                (opt.color && o.color === opt.color)
              )
              : -1;
            return {
              id: s.id,
              option_id: opt?.id ?? opt?.index ?? (optIndex >= 0 ? optIndex : (opt?.name || null))
            };
          }),
          taps: Object.values(selectedTaps).map(t => ({
            name: t.name,
            price: t.price || 0
          })),
          hardware: Object.values(selectedHardware).map(h => ({
            id: h.item?.id ?? null,
            name: h.item?.name,
            price: h.item?.price || 0
          })),
          countersinks: Object.values(selectedCountersinks).map(cs => ({
            name: cs.name,
            price: cs.price || 0
          })),
          technical_data: pricingTechnicalData
        };
        const res = await calculatePrice(payload);
        if (!isLatest()) return;
        if (res.success) {
          setPriceEstimate({ ...res, __pricingKey: activePricingKey });
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
        if (!isLatest()) return;
        // Bounds mismatches are surfaced as card-level locks — swallow silently.
        const msg = String(err?.message || '');
        const isBoundsError = /exceeds max|is below min/i.test(msg);
        if (!isBoundsError) {
          console.error('Price calculation failed:', err);
        }
        setPriceEstimate(null);
      } finally {
        if (isLatest()) setIsCalculatingPrice(false);
      }
    };

    const timeoutId = setTimeout(getEstimate, 500); // Debounce
    return () => clearTimeout(timeoutId);
    // toast/isCNC are derived — including them triggers unnecessary recalcs on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMetal, selectedProductionService, selectedAdditionalServices, quoteAdditionalServices, selectedTaps, selectedHardware, selectedCountersinks, selectedFinishColors, displayDimensions, quantity, pricingThicknessInches, pricingTechnicalData]);

  useEffect(() => {
    if (!selectedFile) return;
    const analysis = cloneQuoteAnalysis({
      dimensions,
      dxfSvg,
      dxfTechData,
      backendData,
      bendTree,
      detectedHoles,
      detectedBends,
    });
    const config = buildCurrentQuoteConfig();
    const itemForKey = { ...selectedFile, analysis };
    const pricingKey = priceEstimate?.success
      ? (priceEstimate.__pricingKey || buildPricingKeyForQuoteItem(itemForKey, config, allServices))
      : '';
    const status = isCalculatingPrice
      ? 'calculating'
      : priceEstimate?.success
        ? 'ready'
        : 'idle';

    setFiles(prev => prev.map(f => (
      f.id === selectedFile.id
        ? {
          ...f,
          analysis,
          pricing: {
            estimate: priceEstimate,
            status,
            error: '',
            key: pricingKey,
          }
        }
        : f
    )));
  }, [
    selectedFile?.id,
    selectedFile,
    dimensions,
    dxfSvg,
    dxfTechData,
    backendData,
    bendTree,
    detectedHoles,
    detectedBends,
    priceEstimate,
    isCalculatingPrice,
    buildCurrentQuoteConfig,
    allServices,
  ]);

  // ── Dimension Validation Helper ────────────────────────

  const onDrop = useCallback(async acceptedFiles => {
    setIsImporting(true);
    setImportProgress(0);

    const newFiles = await Promise.all(acceptedFiles.map(async file => {
      let tempPath = '';
      let analysis = makeEmptyQuoteAnalysis();
      let analysisStatus = isStepFile(file.name) ? 'idle' : 'ready';
      let analysisError = '';
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

      if (is2DFile(file.name)) {
        try {
          const dxfAnalysis = await analyzeDxfFile(file);
          analysis = cloneQuoteAnalysis({
            dimensions: dxfAnalysis.dimensions,
            dxfSvg: dxfAnalysis.svg,
            dxfTechData: dxfAnalysis.techData,
            detectedHoles: dxfAnalysis.holes,
          });
        } catch (err) {
          analysisStatus = 'error';
          analysisError = err.message || 'DXF analysis failed';
        }
      }

      return {
        file,
        id: Math.random().toString(36).substr(2, 9),
        preview: URL.createObjectURL(file),
        tempPath: tempPath, // Essential for world-class order finalization
        customized: false,
        config: cloneSharedQuoteConfig(sharedConfigRef.current),
        analysis,
        analysisStatus,
        analysisError,
        pricing: makeEmptyQuotePricing(),
      };
    }));

    setFiles(prev => [...prev, ...newFiles]);
    if (newFiles.length > 0) {
      setSelectedFile(newFiles[0]);
      setViewMode(is2DFile(newFiles[0].file.name) ? '2d' : '3d');
      setBackendData(null);
    }
    setIsImporting(false);
  }, []);

  const priceQuoteItem = useCallback(async (item) => {
    if (!item?.id || item.id === selectedFileRef.current?.id) return;
    const config = getQuoteConfigForFile(item, sharedConfigRef.current);
    const derived = deriveQuoteItem(item, config, allServices);
    const key = buildPricingKeyForQuoteItem(item, config, allServices, derived);
    if (!key) return;
    if (item.pricing?.key === key && item.pricing?.estimate?.success) return;
    if (item.pricing?.key === key && (item.pricing?.status === 'calculating' || item.pricing?.status === 'error')) return;
    if (backgroundPricingRef.current.has(item.id)) return;

    backgroundPricingRef.current.add(item.id);
    setFiles(prev => prev.map(f => (
      f.id === item.id
        ? { ...f, pricing: { ...(f.pricing || makeEmptyQuotePricing()), status: 'calculating', error: '', key } }
        : f
    )));

    try {
      const payload = buildPricingPayloadForQuoteItem(item, config, allServices, derived);
      const res = await calculatePrice(payload);
      if (!res.success) throw new Error(res.error || 'Pricing failed');
      setFiles(prev => prev.map(f => (
        f.id === item.id
          ? {
            ...f,
            pricing: {
              estimate: { ...res, __pricingKey: key },
              status: 'ready',
              error: '',
              key,
            }
          }
          : f
      )));
    } catch (err) {
      setFiles(prev => prev.map(f => (
        f.id === item.id
          ? {
            ...f,
            pricing: {
              ...(f.pricing || makeEmptyQuotePricing()),
              estimate: null,
              status: 'error',
              error: err.message || 'Pricing failed',
              key,
            }
          }
          : f
      )));
    } finally {
      backgroundPricingRef.current.delete(item.id);
    }
  }, [allServices]);

  useEffect(() => {
    if (backgroundPricingRef.current.size > 0) return;
    const nextItem = files.find(f => {
      if (f.id === selectedFile?.id) return false;
      if (f.analysisStatus === 'analyzing' || f.analysisStatus === 'error') return false;
      const config = getQuoteConfigForFile(f, sharedConfig);
      const derived = deriveQuoteItem(f, config, allServices);
      const key = buildPricingKeyForQuoteItem(f, config, allServices, derived);
      if (!key) return false;
      if (f.pricing?.key === key && (f.pricing?.status === 'calculating' || f.pricing?.status === 'error')) return false;
      return !(f.pricing?.key === key && f.pricing?.estimate?.success);
    });
    if (nextItem) priceQuoteItem(nextItem);
  }, [files, sharedConfig, allServices, selectedFile?.id, priceQuoteItem]);

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop,
    accept: {
      'model/step': ['.step', '.stp'],
      'application/x-dxf': ['.dxf'],
      'application/octet-stream': ['.dxf', '.dwg'],
      'text/plain': ['.dxf'],
    },
    maxFiles: 10
  });

  const formatRulePairMm = (xMm, yMm) => {
    const x = toFiniteNumber(xMm);
    const y = toFiniteNumber(yMm);
    const suffix = unit === 'mm' ? 'mm' : 'in';
    const displayX = unit === 'mm' ? x : x / 25.4;
    const displayY = unit === 'mm' ? y : y / 25.4;
    return `${displayX.toFixed(3)} x ${displayY.toFixed(3)} ${suffix}`;
  };

  const formatRuleRangeMm = (minMm, maxMm) => {
    const min = toFiniteNumber(minMm);
    const max = toFiniteNumber(maxMm);
    const suffix = unit === 'mm' ? 'mm' : 'in';
    const displayMin = unit === 'mm' ? min : min / 25.4;
    const displayMax = unit === 'mm' ? max : max / 25.4;
    return `${displayMin.toFixed(3)}-${displayMax.toFixed(3)} ${suffix}`;
  };

  const removeFile = (id) => {
    const fileToRemove = files.find(f => f.id === id);
    if (fileToRemove) URL.revokeObjectURL(fileToRemove.preview);
    setFiles(prev => prev.filter(f => f.id !== id));
    if (selectedFile?.id === id) {
      setSelectedFile(null); setDimensions(null);
      setDxfSvg(null);
    }
  };

  const handleUnfold = useCallback(async (isBackground = false) => {
    if (!selectedFile || is2DFile(selectedFile.file.name)) {
      if (is2DFile(selectedFile?.file?.name)) { setViewMode('2d'); setActiveAxis('flat'); }
      return;
    }

    const unfoldFileKey = getFileAnalysisKey(selectedFile) || 'unknown';

    // Only return early when the cached unfold result belongs to this file.
    // A flat part's result has no bend tree; without the success check every
    // finished result started a fresh unfold job (and a verify run) again.
    if (backendData?.__fileKey === unfoldFileKey && (bendTree || backendData?.success === true)) return;

    // If the same file is already unfolding, avoid abort/restart loops that produce nginx 499.
    if (unfoldAbortControllerRef.current && unfoldRequestFileKeyRef.current === unfoldFileKey) {
      setIsLoadingUnfold(true);
      return;
    }

    const requestSeq = unfoldRequestSeqRef.current + 1;
    unfoldRequestSeqRef.current = requestSeq;

    // Abort stale call only when switching to a different file.
    if (unfoldAbortControllerRef.current) unfoldAbortControllerRef.current.abort();
    const controller = new AbortController();
    unfoldAbortControllerRef.current = controller;
    unfoldRequestFileKeyRef.current = unfoldFileKey;

    setIsLoadingUnfold(true);
    setUnfoldProgress(2);
    setUnfoldStage(isBackground ? 'Preparing 2D flat pattern' : 'Uploading STEP model');

    const fd = new FormData(); fd.append('file', selectedFile.file);
    try {
      const startResponse = await fetch(apiUrl('/unfold-job/start'), {
        method: 'POST',
        body: fd,
        signal: controller.signal
      });
      if (!startResponse.ok) throw new Error('Unfold start failed');

      const startData = await startResponse.json();
      const jobId = startData?.jobId;
      if (!jobId) throw new Error('Unfold job was not created');

      let d = null;
      for (; ;) {
        const statusResponse = await fetch(apiUrl(`/unfold-job/${encodeURIComponent(jobId)}?ts=${Date.now()}`), {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          },
          signal: controller.signal
        });
        if (statusResponse.status === 304) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        if (!statusResponse.ok) {
          throw new Error(`Unfold status failed (${statusResponse.status})`);
        }

        const statusData = await statusResponse.json();
        const pct = Number(statusData?.percent);
        if (Number.isFinite(pct)) {
          setUnfoldProgress(Math.max(0, Math.min(100, pct)));
        }
        const queueAhead = Number(statusData?.queuePosition);
        if (statusData?.status === 'queued' && Number.isFinite(queueAhead) && queueAhead > 0) {
          setUnfoldStage(`Queued (${queueAhead} ahead)`);
        } else if (statusData?.stage) {
          setUnfoldStage(String(statusData.stage));
        }

        if (statusData?.status === 'completed') {
          d = statusData?.result || null;
          break;
        }

        if (statusData?.status === 'failed') {
          throw new Error(statusData?.error || 'Unfold failed');
        }

        const pollDelayMs = statusData?.status === 'queued' ? 1200 : 800;
        await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
      }

      if (!d) throw new Error('Unfold returned empty result');

      if (d.success) {
        setUnfoldProgress(100);
        setUnfoldStage('Completed');
        setBendTree(d.bendTree);
        const keyedBackendData = { ...d, __fileKey: unfoldFileKey };
        setBackendData(keyedBackendData); // Keep backendData for other compatibility

        const unfoldDepthIn = toFiniteNumber(d?.thickness) > 0 ? (toFiniteNumber(d.thickness) / 25.4) : (2 / 25.4);
        const unfoldHoles = engineHolesForModel(d);
        if (unfoldHoles.length > 0) {
          setDetectedHoles(mapEngineHoles(unfoldHoles, unfoldDepthIn));
          stepHolesDetectedRef.current = true;
          holeDetectionAttemptedRef.current = true;
        }

        // Cache-safe verification: if queued/cached unfold result says "no raised features",
        // run one direct unfold call (non job-cache path) before method gating.
        if (isStepFile(selectedFile.file.name) && !d?.nonFlatFeatures?.hasRaisedFeatures) {
          try {
            const verifyFd = new FormData();
            verifyFd.append('file', selectedFile.file);
            const verifyRes = await fetch(apiUrl('/unfold'), {
              method: 'POST',
              body: verifyFd,
              signal: controller.signal,
            });

            if (verifyRes.ok) {
              const verifyData = await verifyRes.json();
              if (
                requestSeq === unfoldRequestSeqRef.current
                && verifyData?.success
                && verifyData?.nonFlatFeatures
                && verifyData.nonFlatFeatures.hasRaisedFeatures
              ) {
                setBackendData((prev) => ({
                  ...((prev?.__fileKey === unfoldFileKey ? prev : keyedBackendData) || keyedBackendData),
                  nonFlatFeatures: verifyData.nonFlatFeatures,
                  ...(verifyData.processEligibility ? { processEligibility: verifyData.processEligibility } : {}),
                  __fileKey: unfoldFileKey,
                }));
              }
            }
          } catch (verifyErr) {
            if (verifyErr?.name !== 'AbortError') {
              console.warn('Non-flat verification fallback failed:', verifyErr);
            }
          }
        }

        // Initialize selectedBends with default values (90 degrees)
        const initial = {};
        const bendsList = [];
        const flatten = (node) => {
          if (node.bendAxis) {
            initial[node.id] = { angle: 90, direction: 'up' };
            bendsList.push(node.bendAxis);
          }
          if (node.children) node.children.forEach(flatten);
        };
        if (d.bendTree) flatten(d.bendTree);
        setSelectedBends(initial);
        setDetectedBends(bendsList);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('Error during unfold stage:', err);
    } finally {
      if (requestSeq === unfoldRequestSeqRef.current) {
        setIsLoadingUnfold(false);
        if (unfoldAbortControllerRef.current === controller) {
          unfoldAbortControllerRef.current = null;
          unfoldRequestFileKeyRef.current = null;
        }
      }
    }
  }, [selectedFile, backendData, bendTree]);

  // ── Fast Analysis Stage (Holes/Dimensions) ────────────────────────────────
  // ── Analysis Orchestrator ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFile || !currentIsStep) return;
    // Start bend/unfold analysis as soon as a STEP is active so bending prices
    // and service recognition do not depend on opening the 2D view first.
    handleUnfold(true);
  }, [selectedFile, currentIsStep, handleUnfold]);

  // ── Real Configured-Cut STEP Preview (debounced + abortable) ─────────────
  useEffect(() => {
    if (!configuredPreviewPayload) {
      if (configurePreviewAbortRef.current) configurePreviewAbortRef.current.abort();
      configurePreviewKeyRef.current = '';
      setConfiguredPreviewUrl(null);
      setIsGeneratingConfiguredPreview(false);
      return;
    }

    const key = JSON.stringify(configuredPreviewPayload);
    if (key === configurePreviewKeyRef.current && configuredPreviewUrl) return;

    const seq = configurePreviewSeqRef.current + 1;
    configurePreviewSeqRef.current = seq;

    if (configurePreviewAbortRef.current) configurePreviewAbortRef.current.abort();
    const controller = new AbortController();
    configurePreviewAbortRef.current = controller;

    const timerId = setTimeout(async () => {
      setIsGeneratingConfiguredPreview(true);
      try {
        const response = await fetch('/api/pricing/configure-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configuredPreviewPayload),
          signal: controller.signal,
        });

        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to generate configured preview');
        }

        if (seq !== configurePreviewSeqRef.current) return;

        configurePreviewKeyRef.current = key;
        if (!data.previewPath) {
          setConfiguredPreviewUrl(null);
          return;
        }

        setConfiguredPreviewUrl(backendAssetUrl(data.previewPath));
      } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error('Configured STEP preview error:', err);
        if (seq === configurePreviewSeqRef.current) {
          setConfiguredPreviewUrl(null);
        }
      } finally {
        if (seq === configurePreviewSeqRef.current) setIsGeneratingConfiguredPreview(false);
      }
    }, 220);

    return () => clearTimeout(timerId);
  }, [configuredPreviewPayload, configuredPreviewUrl]);

  useEffect(() => {
    return () => {
      if (configurePreviewAbortRef.current) configurePreviewAbortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (!selectedFileId || !currentIsStep || viewMode !== '3d') {
      setIsStepModelLoading(false);
      return;
    }
    setIsStepModelLoading(true);
    setStepModelProgress(0);
  }, [selectedFileId, currentIsStep, viewMode, configuredPreviewUrl]);

  const handleStepViewerProgress = useCallback((nextValue) => {
    const num = Number(nextValue);
    if (!Number.isFinite(num)) return;
    const clamped = Math.max(0, Math.min(100, num));
    setStepModelProgress(clamped);
    setIsStepModelLoading(clamped < 100);
  }, []);

  const handleStepViewerLoaded = useCallback(() => {
    setStepModelProgress(100);
    setIsStepModelLoading(false);
  }, []);

  const quoteQueueRows = useMemo(() => {
    return files.map((file) => {
      const config = getQuoteConfigForFile(file, sharedConfig);
      const derived = deriveQuoteItem(file, config, allServices);
      const pricingKey = buildPricingKeyForQuoteItem(file, config, allServices, derived);
      const ready = Boolean(
        pricingKey &&
        file.pricing?.estimate?.success &&
        file.pricing?.key === pricingKey
      );
      const analysisStatus = file.analysisStatus || 'idle';
      const pricingStatus = file.pricing?.status || 'idle';
      const status = analysisStatus === 'error'
        ? 'Error'
        : analysisStatus === 'analyzing'
          ? 'Analyzing'
          : pricingStatus === 'error'
            ? 'Error'
            : pricingStatus === 'calculating'
              ? 'Calculating'
              : ready
                ? 'Ready'
                : 'Needs config';
      return {
        id: file.id,
        file,
        config,
        derived,
        pricingKey,
        ready,
        status,
        error: file.analysisError || file.pricing?.error || '',
        total: ready ? (parseFloat(file.pricing?.estimate?.total_price || 0) || 0) : 0,
      };
    });
  }, [files, sharedConfig, allServices]);

  const queueReadyCount = quoteQueueRows.filter(row => row.ready).length;
  const queueTotal = quoteQueueRows.reduce((sum, row) => sum + row.total, 0);
  const allQueueItemsReady = files.length > 0 && queueReadyCount === files.length;
  const blockedQueueRow = quoteQueueRows.find(row => !row.ready);
  const queueBlockedReason = !files.length
    ? 'Upload files first'
    : blockedQueueRow?.status === 'Error'
      ? (blockedQueueRow.error || 'Fix the errored file before adding all items')
      : blockedQueueRow?.status === 'Analyzing'
        ? 'Waiting for file analysis'
        : blockedQueueRow?.status === 'Calculating'
          ? 'Waiting for pricing'
          : 'Configure and price all files';

  const getFilesWithActiveSnapshot = () => {
    const activeId = selectedFileRef.current?.id;
    const activeAnalysis = cloneQuoteAnalysis({
      dimensions,
      dxfSvg,
      dxfTechData,
      backendData,
      bendTree,
      detectedHoles,
      detectedBends,
    });
    const activeConfig = buildCurrentQuoteConfig();

    return filesRef.current.map(f => {
      if (f.id !== activeId) return f;
      const activeKey = priceEstimate?.success
        ? (priceEstimate.__pricingKey || buildPricingKeyForQuoteItem({ ...f, analysis: activeAnalysis }, activeConfig, allServices))
        : '';
      return {
        ...f,
        config: f.customized
          ? activeConfig
          : cloneQuoteConfig({
            ...f.config,
            quantity: activeConfig.quantity,
          }),
        analysis: activeAnalysis,
        pricing: {
          estimate: priceEstimate,
          status: isCalculatingPrice ? 'calculating' : priceEstimate?.success ? 'ready' : 'idle',
          error: '',
          key: activeKey,
        }
      };
    });
  };

  const selectQuoteFile = (file) => {
    if (!file || file.id === selectedFile?.id) return;
    const latestFiles = getFilesWithActiveSnapshot();
    const nextFile = latestFiles.find(item => item.id === file.id) || file;
    setFiles(latestFiles);
    setSelectedFile(nextFile);
  };

  const renderFileTabs = (className = '') => {
    if (!files.length) return null;

    return (
      <div className={`ip-file-tabs ${className}`.trim()} role="tablist" aria-label="Uploaded files">
        {files.map((f, index) => {
          const queueRow = quoteQueueRows.find(row => row.id === f.id);
          const status = queueRow?.status || 'Needs config';
          const statusKey = status.toLowerCase().replace(/\s+/g, '-');
          const isActive = selectedFile?.id === f.id;
          const fileName = f.file?.name || `File ${index + 1}`;

          return (
            <div
              key={f.id}
              className={`ip-file-tab ${isActive ? 'active' : ''}`}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
              title={fileName}
              onClick={() => selectQuoteFile(f)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectQuoteFile(f);
                }
              }}
            >
              <span className="ip-file-tab-icon">
                <FileText size={13} />
              </span>
              <span className="ip-file-tab-main">
                <span className="ip-file-tab-name">{fileName}</span>
                <span className={`ip-file-tab-status ${statusKey}`}>{status}</span>
              </span>
              {isActive ? (
                <span className="ip-file-tab-check">
                  <Check size={10} />
                </span>
              ) : files.length > 1 ? (
                <button
                  type="button"
                  className="ip-file-tab-close"
                  aria-label={`Remove ${fileName}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(f.id);
                  }}
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>
          );
        })}
        <button type="button" className="ip-file-tab-add" onClick={openFilePicker} aria-label="Add file">
          <Plus size={15} />
        </button>
      </div>
    );
  };

  function handleAddAllToCart() {
    const latestFiles = getFilesWithActiveSnapshot();
    const rows = latestFiles.map((file) => {
      const config = getQuoteConfigForFile(file, sharedConfigRef.current);
      const derived = deriveQuoteItem(file, config, allServices);
      const pricingKey = buildPricingKeyForQuoteItem(file, config, allServices, derived);
      const ready = Boolean(pricingKey && file.pricing?.estimate?.success && file.pricing?.key === pricingKey);
      return { file, config, ready, cartItem: ready ? buildCartItemFromQuoteItem(file, config, allServices) : null };
    });

    const blocked = rows.find(row => !row.ready || !row.cartItem);
    if (blocked) {
      toast(queueBlockedReason || 'Every uploaded file must be configured and priced first.', 'error');
      return;
    }

    addManyToCart(rows.map(row => row.cartItem));
    navigate('/cart');
  }

  const markActiveFileCustom = () => {
    if (!selectedFile) return;
    const nextConfig = buildCurrentQuoteConfig();
    setFiles(prev => prev.map(f => (
      f.id === selectedFile.id
        ? { ...f, customized: true, config: cloneQuoteConfig(nextConfig) }
        : f
    )));
    toast('This file now has its own configuration.', 'success');
  };

  const applyActiveConfigToAllFiles = () => {
    if (!selectedFile) return;
    const nextConfig = buildCurrentQuoteConfig();
    setSharedConfig(cloneSharedQuoteConfig(nextConfig));
    setFiles(prev => prev.map(f => ({
      ...f,
      customized: false,
      config: cloneQuoteConfig(nextConfig),
      pricing: makeEmptyQuotePricing(),
    })));
    setPriceEstimate(null);
    toast('Active configuration applied to all files.', 'success');
  };

  const showStepModelLoadingOverlay = currentIsStep && viewMode === '3d' && isStepModelLoading;
  // A price update never covers the model while a configure drawer is open:
  // the drawer and the receipt show the price, the model shows each pick.
  const showGlobalViewerOverlay = isDetectingHoles
    || (isCalculatingPrice && !activeHoleDrawer && !activeFinishDrawerSvc)
    || isGeneratingConfiguredPreview
    || showStepModelLoadingOverlay;
  const globalOverlayTitle = showStepModelLoadingOverlay
    ? 'Importing 3D Model...'
    : isGeneratingConfiguredPreview
      ? 'Applying Configured Cuts...'
      : isCalculatingPrice
        ? 'Calculating Quote...'
        : 'Analyzing Features...';
  const globalOverlayPercent = showStepModelLoadingOverlay ? stepModelProgress : null;

  return (
    <div className={`instant-pricing-container ${isQuoteFlowActive || files.length > 0 ? 'ip-fullpage qf-active' : ''}`}>
      <style>{`
        .qf-active, .qf-active .app-container, .qf-active .main-content, .qf-active #root, .qf-active .instant-pricing-container { background-color: #ffffff !important; background: #ffffff !important; }
        .qf-main-canvas > div { background-color: #ffffff !important; }
        .qf-preview-container { height: 0 !important; }
        .ip-left-panel { width: clamp(176px, 13vw, 210px); min-width: 176px; background: #ffffff; border-right: 1.5px solid #e8eaed; display: flex; flex-direction: column; padding: 12px 12px; overflow: hidden; min-height:0; }
        .ip-center-panel { flex: 1; display: flex; flex-direction: column; background: #ffffff; min-width: 0; min-height: 0; overflow: hidden; }
        .ip-right-panel { width: clamp(300px, 22vw, 340px); min-width: 300px; background: #ffffff; border-left: 1.5px solid #e8eaed; display: flex; flex-direction: column; padding: 10px; overflow-y: auto; overflow-x: hidden; box-sizing: border-box; min-height:0; }
        .ip-sidebar { height:100%; min-height:0; overflow-y:auto; overflow-x:hidden; }
        /* Desktop: floating card with padding from edges */
        .ip-panel-layout { display: flex; position: fixed; top: clamp(18px, 3vw, 48px); left: clamp(18px, 3vw, 48px); right: clamp(18px, 3vw, 48px); bottom: clamp(18px, 3vw, 48px); z-index: 50; overflow: hidden; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.12); border: 1.5px solid #e2e6ea; }
        body.qf-active { overflow: hidden !important; background: #e8eaed !important; }
        @media (max-height: 820px) and (min-width: 1025px) {
          .ip-panel-layout { top: 16px; left: 24px; right: 24px; bottom: 16px; border-radius: 14px; }
          .ip-toolbar { padding: 8px 10px; }
          .ip-left-panel { padding: 10px; }
          .ip-right-panel { padding: 8px; width: 310px; min-width: 310px; }
          .ip-sidebar { padding: 14px !important; }
          .ip-file-card { padding: 7px 9px; }
        }
        /* Tablet + Mobile: switch to scrollable vertical stack */
        @media (max-width: 1024px) {
          .ip-panel-layout { position: static; flex-direction: column; height: auto; min-height: unset; overflow: visible; border-radius: 0; box-shadow: none; border: none; top: auto; left: auto; right: auto; bottom: auto; }
          .qf-preview-container { height: auto !important; overflow: visible !important; }
          html.qf-active, body.qf-active { overflow-y: auto !important; overflow-x: hidden !important; background: #f4f5f7 !important; }
          .ip-left-panel { width: 100% !important; min-width: unset !important; border-right: none !important; border-bottom: 1.5px solid #e8eaed; flex-direction: row; flex-wrap: wrap; align-items: center; padding: 8px 12px; gap: 6px; overflow: visible !important; height: auto !important; }
          .ip-center-panel { height: 110vw; min-height: 550px; max-height: 800px; flex-shrink: 0; overflow: hidden; }
          .ip-right-panel { width: 100% !important; min-width: unset !important; border-left: none !important; border-top: 1.5px solid #e8eaed; height: auto; overflow-y: visible; padding-bottom: 24px; }
          .ip-proceed-btn { margin-top: 16px; }
        }
        /* Mobile */
        @media (max-width: 640px) {
          .ip-center-panel { height: 120vw; min-height: 500px; }
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
        .ip-viewer-frame { flex:1; margin:0; border-radius:0; overflow:hidden; border:none; background:#ffffff; position:relative; display: flex; flex-direction: column; }
        .ip-toolbar { padding:10px 12px; display:flex; justify-content:space-between; align-items:center; gap:8px; background:#ffffff; border-bottom:1.5px solid #e8eaed; }
        .ip-file-tabs { display:flex; align-items:center; gap:8px; min-height:54px; padding:7px 12px; background:#fbfcfd; border-bottom:1.5px solid #e8eaed; overflow-x:auto; overflow-y:hidden; flex-shrink:0; scrollbar-width:thin; scrollbar-color:#cbd5e1 transparent; }
        .ip-file-tabs.compact { min-height:50px; padding:6px 10px; }
        .ip-file-tabs::-webkit-scrollbar { height:6px; }
        .ip-file-tabs::-webkit-scrollbar-track { background:transparent; }
        .ip-file-tabs::-webkit-scrollbar-thumb { background:#d5dde8; border-radius:999px; }
        .ip-file-tab { min-width:138px; max-width:220px; height:38px; display:flex; align-items:center; gap:8px; padding:6px 8px; border:1px solid #dbe3ee; border-radius:8px; background:#ffffff; color:#1e293b; cursor:pointer; transition:border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease; flex:0 0 auto; }
        .ip-file-tab:hover { border-color:#b8c5d6; background:#f8fafc; }
        .ip-file-tab.active { border-color:#ef4444; background:#fff5f5; box-shadow:0 5px 14px rgba(239,68,68,0.12); }
        .ip-file-tab:focus-visible { outline:2px solid #ef4444; outline-offset:2px; }
        .ip-file-tab-icon { width:24px; height:24px; border-radius:7px; display:flex; align-items:center; justify-content:center; background:#f1f5f9; color:#64748b; flex-shrink:0; }
        .ip-file-tab.active .ip-file-tab-icon { background:#ef4444; color:#ffffff; }
        .ip-file-tab-main { display:flex; flex-direction:column; justify-content:center; gap:2px; min-width:0; flex:1; }
        .ip-file-tab-name { font-size:11px; font-weight:850; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ip-file-tab-status { width:max-content; max-width:100%; border-radius:999px; padding:1px 5px; font-size:8px; font-weight:900; line-height:1.2; text-transform:uppercase; color:#64748b; background:#f1f5f9; border:1px solid #e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ip-file-tab-status.ready { color:#047857; background:#ecfdf5; border-color:#bbf7d0; }
        .ip-file-tab-status.error { color:#b91c1c; background:#fef2f2; border-color:#fecaca; }
        .ip-file-tab-status.analyzing, .ip-file-tab-status.calculating { color:#1d4ed8; background:#eff6ff; border-color:#bfdbfe; }
        .ip-file-tab-status.needs-config { color:#475569; background:#f8fafc; border-color:#dbe3ee; }
        .ip-file-tab-check { width:18px; height:18px; border-radius:999px; display:flex; align-items:center; justify-content:center; background:#ef4444; color:#ffffff; flex-shrink:0; }
        .ip-file-tab-close { width:22px; height:22px; border:0; border-radius:7px; background:transparent; color:#94a3b8; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:background 0.15s ease, color 0.15s ease; }
        .ip-file-tab-close:hover { background:#fee2e2; color:#ef4444; }
        .ip-file-tab-add { width:36px; height:36px; border:1px dashed #cbd5e1; border-radius:8px; background:#ffffff; color:#64748b; display:flex; align-items:center; justify-content:center; cursor:pointer; flex:0 0 auto; transition:border-color 0.15s ease, color 0.15s ease, background 0.15s ease; }
        .ip-file-tab-add:hover { border-color:#94a3b8; color:#1e293b; background:#f8fafc; }
        @media (max-width: 640px) {
          .ip-file-tabs { min-height:50px; padding:6px 10px; gap:6px; }
          .ip-file-tab { min-width:126px; max-width:172px; height:36px; gap:6px; }
          .ip-file-tab-name { font-size:10px; }
        }
        .ip-pill-toggle { display:flex; padding:3px; border-radius:8px; background:#f1f5f9; border:1px solid #e2e8f0; gap:2px; }
        .ip-pill-btn { border:none; background:transparent; border-radius:6px; padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer; color:#64748b; transition:all 0.15s; letter-spacing:0.5px; }
        .ip-pill-btn.active { background:#1a1a2e; color:#ffffff; }
        .ip-unit-toggle { display:inline-flex; align-items:center; gap:3px; padding:3px; border-radius:10px; background:#f8fafc; border:1px solid #dbe3ee; box-shadow:inset 0 1px 0 rgba(255,255,255,0.85); }
        .ip-unit-toggle.compact { padding:2px; border-radius:8px; }
        .ip-unit-btn { min-width:36px; height:26px; border:0; border-radius:7px; background:transparent; color:#52657a; font-size:10px; font-weight:900; letter-spacing:0; cursor:pointer; line-height:1; transition:background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease; }
        .ip-unit-toggle.compact .ip-unit-btn { min-width:30px; height:22px; font-size:9px; border-radius:6px; }
        .ip-unit-btn:hover { color:#1e293b; background:#ffffff; }
        .ip-unit-btn.active { background:#111827; color:#ffffff; box-shadow:0 2px 7px rgba(15,23,42,0.22); }
        .ip-unit-btn:focus-visible { outline:2px solid #ef4444; outline-offset:2px; }
        .ip-axis-btn { border:none; background:transparent; border-radius:6px; padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer; color:#64748b; transition:all 0.15s; letter-spacing:0.5px; text-transform:uppercase; }
        .ip-axis-btn.active { background:#ef4444; color:#ffffff; }
        .ip-stat-chip { background:#f8fafc; border:1px solid #e8eaed; border-radius:8px; padding:8px 10px; display:flex; align-items:center; gap:8px; }
        .ip-proceed-btn { width:100%; padding:13px; border:none; border-radius:10px; background:linear-gradient(135deg,#ef4444,#dc2626); color:#fff; font-weight:900; font-size:13px; letter-spacing:1px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; margin-top:auto; }
        .ip-proceed-btn:hover { background:linear-gradient(135deg,#dc2626,#b91c1c); transform:translateY(-1px); box-shadow:0 6px 20px rgba(239,68,68,0.35); }
        .ip-add-btn { display:flex; align-items:center; justify-content:center; gap:6px; padding:8px; border-radius:8px; border:1.5px dashed #cbd5e1; background:transparent; color:#64748b; font-size:11px; font-weight:700; cursor:pointer; transition:all 0.15s; width:100%; margin-top:8px; }
        .ip-add-btn:hover { border-color:#94a3b8; background:#f8fafc; }
        .ip-left-topline { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:10px 0; }
        .ip-back-mini { display:inline-flex; align-items:center; justify-content:center; gap:4px; border:1px solid #e2e8f0; background:#f8fafc; color:#334155; border-radius:7px; padding:5px 8px; font-size:10px; font-weight:900; letter-spacing:0.4px; text-transform:uppercase; cursor:pointer; transition:all 0.15s ease; width:100%; }
        .ip-back-mini:hover { background:#ffffff; border-color:#cbd5e1; color:#0f172a; }
        .ip-file-tools { display:flex; align-items:center; gap:8px; }
        .ip-clear-btn { background:none; border:none; color:#ef4444; font-size:11px; font-weight:800; cursor:pointer; padding:0; white-space:nowrap; }
        .ip-badge { display:inline-flex; align-items:center; padding:2px 7px; border-radius:4px; font-size:9px; font-weight:800; letter-spacing:0.5px; text-transform:uppercase; }
        /* Quote Flow Active panels */
        .ip-qf-left { width:clamp(360px, 42vw, 760px); min-width:360px; background:#ffffff; border-right:1.5px solid #e8eaed; display:flex; flex-direction:column; overflow:hidden; }
        .ip-qf-mid { flex:1; background:#ffffff; border-right:1.5px solid #e8eaed; overflow-y:auto; padding:24px 20px; min-width:0; }
        .ip-qf-right { width: clamp(300px, 22vw, 340px); min-width: 300px; background: #ffffff; display: flex; flex-direction: column; padding: 10px; overflow-y: auto; overflow-x: hidden; box-sizing: border-box; min-height:0; }
        .ip-qf-viewer { flex:1; position:relative; overflow:hidden; min-height:0; display: flex; flex-direction: column; }
        .ip-qf-dims { padding:12px 14px; border-top:1.5px solid #e8eaed; background:#ffffff; flex-shrink:0; }
        .ip-back-btn { display:flex; align-items:center; gap:5px; padding:5px 12px; border-radius:8px; border:1.5px solid #e8eaed; background:#ffffff; color:#1e293b; font-size:11px; font-weight:700; cursor:pointer; letter-spacing:0.5px; transition:all 0.15s; }
        .ip-back-btn:hover { border-color:#94a3b8; background:#f8fafc; }
        @media (max-width: 1024px) {
          .ip-qf-left { width:100% !important; min-width:unset !important; border-right:none !important; border-bottom:1.5px solid #e8eaed; height: 110vw; min-height: 550px; max-height: 800px; flex-shrink:0; display: flex; flex-direction: column; }
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
        canvas#viewer, .qf-main-canvas canvas, .ip-qf-viewer canvas, .ip-viewer-frame canvas {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
        }
        .qf-main-canvas > div:not(.ip-legend-card), .ip-qf-viewer > div:not(.ip-legend-card), .ip-viewer-frame > div:not(.ip-legend-card) {
          height: 100% !important;
          width: 100% !important;
          display: flex !important;
          flex-direction: column !important;
        }
        div.ip-legend-card {
          position: absolute !important;
          top: 24px !important;
          left: 24px !important;
          height: auto !important;
          width: auto !important;
          min-width: 180px !important;
          max-width: 240px !important;
          z-index: 9999 !important;
          pointer-events: none !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
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
          <div className="ip-steps" style={{ width: '100%', maxWidth: 760, marginBottom: 28 }}>
            {[
              { num: '01', icon: <Upload size={18} />, label: 'Upload Your File', sub: 'DXF, DWG, STEP or STP' },
              { num: '02', icon: <Settings size={18} />, label: 'Configure Options', sub: 'Material, thickness & services' },
              { num: '03', icon: <Calculator size={18} />, label: 'Get Instant Quote', sub: 'Real-time price breakdown' },
              { num: '04', icon: <Shield size={18} />, label: 'Place Your Order', sub: 'Secure checkout & fast delivery' },
            ].map((step, i, arr) => (
              <React.Fragment key={i}>
                <div className="ip-step-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                    <div style={{ background: '#fff0f0', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>{step.icon}</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', letterSpacing: 1, marginBottom: 2 }}>STEP {step.num}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{step.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{step.sub}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="ip-step-arrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <div className="file-icons-row d-flex flex-wrap justify-content-center gap-2 gap-sm-3 mb-4">
                  {['.dxf', '.dwg', '.step', '.stp'].map(ext => (
                    <div key={ext} className="file-icon-item border rounded-3 bg-light"><span className="fw-bold small">{ext}</span></div>
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
            <div className="ip-panel-layout ipw-layout">

              {/* ── LEFT: files and the quote queue ── */}
              <aside className="ip-left-panel ipw-files">
                <button type="button" className="ipw-back" onClick={() => navigate(-1)}>
                  <ChevronLeft size={15} /> Back
                </button>
                <div className="ipw-files-head">
                  <span className="ipw-eyebrow">
                    Files <span className="ipw-count">{files.length}</span>
                  </span>
                  <button
                    type="button"
                    className="ipw-link-btn"
                    onClick={() => { setFiles([]); setSelectedFile(null); setIsQuoteFlowActive(false); }}
                  >
                    Clear all
                  </button>
                </div>
                <div className="ipw-file-list">
                  <AnimatePresence mode="popLayout">
                    {files.map(f => {
                      const queueRow = quoteQueueRows.find(row => row.id === f.id);
                      const status = queueRow?.status || 'Needs config';
                      const statusTone = status === 'Ready'
                        ? 'ready'
                        : status === 'Error'
                          ? 'error'
                          : status === 'Calculating' || status === 'Analyzing'
                            ? 'busy'
                            : 'idle';
                      const isActiveFile = selectedFile?.id === f.id;
                      return (
                        <MotionDiv
                          layout
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -12 }}
                          key={f.id}
                          className={`ipw-file-card${isActiveFile ? ' is-active' : ''}`}
                          onClick={() => selectQuoteFile(f)}
                        >
                          <span className="ipw-file-icon"><FileText size={15} /></span>
                          <span className="ipw-file-main">
                            <span className="ipw-file-name" title={f.file.name}>{f.file.name}</span>
                            <span className="ipw-file-meta">
                              <span className="ipw-file-ext">{f.file.name.split('.').pop().toUpperCase()}</span>
                              <span className={`ipw-status is-${statusTone}`}>{status}</span>
                              {f.customized && <span className="ipw-status is-custom">Custom</span>}
                            </span>
                            {queueRow?.ready && (
                              <span className="ipw-file-price">${queueRow.total.toFixed(2)}</span>
                            )}
                          </span>
                          {isActiveFile ? (
                            <span className="ipw-file-check" aria-hidden="true"><Check size={10} /></span>
                          ) : (
                            <button
                              type="button"
                              className="ipw-file-remove"
                              aria-label={`Remove ${f.file.name}`}
                              onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                            >
                              <X size={13} />
                            </button>
                          )}
                        </MotionDiv>
                      );
                    })}
                  </AnimatePresence>
                </div>
                <input {...getInputProps()} />
                <button type="button" className="ipw-add-btn" onClick={openFilePicker}>
                  <Plus size={14} /> Add more files
                </button>
                <div className="ipw-queue">
                  <div className="ipw-queue-top">
                    <div>
                      <span className="ipw-eyebrow">Quote queue</span>
                      <strong>{queueReadyCount}/{files.length} ready</strong>
                    </div>
                    <div className="ipw-queue-total">
                      <span className="ipw-eyebrow">Total</span>
                      <strong className={allQueueItemsReady ? 'is-ready' : ''}>${queueTotal.toFixed(2)}</strong>
                    </div>
                  </div>
                  {!allQueueItemsReady && <p className="ipw-queue-note">{queueBlockedReason}</p>}
                  <div className="ipw-queue-actions">
                    <button
                      type="button"
                      className="ipw-btn"
                      onClick={markActiveFileCustom}
                      disabled={!selectedFile || activeQuoteItem?.customized}
                    >
                      Customize
                    </button>
                    <button
                      type="button"
                      className="ipw-btn"
                      onClick={applyActiveConfigToAllFiles}
                      disabled={!selectedFile}
                    >
                      Apply all
                    </button>
                  </div>
                  <button
                    type="button"
                    className="ipw-btn ipw-btn-primary"
                    onClick={handleAddAllToCart}
                    disabled={!allQueueItemsReady}
                  >
                    Add {files.length} to cart <ChevronRight size={14} />
                  </button>
                </div>
              </aside>

              {/* ── CENTRE: toolbar and viewer ── */}
              <main className="ip-center-panel ipw-center">
                <div className="ipw-toolbar">
                  <div className="ipw-toolbar-left">
                    {selectedFile && (
                      <div className="ipw-file-chip" title={selectedFile.file.name}>
                        <span className="ipw-file-chip-icon"><FileText size={15} /></span>
                        <span className="ipw-file-chip-text">
                          <strong>{selectedFile.file.name}</strong>
                          <span>
                            {selectedFile.file.name.split('.').pop().toUpperCase()}
                            {' · '}
                            {quoteQueueRows.find(row => row.id === selectedFile.id)?.status || 'Needs config'}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="ipw-toolbar-controls">
                    <div className="ipw-seg" role="group" aria-label="View">
                      <button
                        type="button"
                        className={viewMode === '3d' ? 'active' : ''}
                        aria-pressed={viewMode === '3d'}
                        onClick={() => { setViewMode('3d'); if (activeAxis === 'flat') { setActiveAxis('iso'); } }}
                      >
                        3D
                      </button>
                      <button
                        type="button"
                        className={viewMode === '2d' ? 'active' : ''}
                        aria-pressed={viewMode === '2d'}
                        onClick={() => { setViewMode('2d'); if (!currentUnfoldReady) handleUnfold(); setActiveAxis('flat'); }}
                      >
                        2D
                      </button>
                    </div>
                    {viewMode === '3d' && currentIsStep && (
                      <div className="ipw-seg ipw-seg-axis" role="group" aria-label="Camera view">
                        {[['top', 'Top'], ['side', 'Side'], ['front', 'Front']].map(([axisKey, axisLabel]) => (
                          <button
                            key={axisKey}
                            type="button"
                            className={activeAxis === axisKey ? 'active' : ''}
                            aria-pressed={activeAxis === axisKey}
                            onClick={() => setActiveAxis(axisKey)}
                          >
                            {axisLabel}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="ipw-seg" role="group" aria-label="Measurement unit">
                      <button
                        type="button"
                        className={unit === 'mm' ? 'active' : ''}
                        aria-pressed={unit === 'mm'}
                        onClick={() => setUnit('mm')}
                      >
                        mm
                      </button>
                      <button
                        type="button"
                        className={unit === 'inch' ? 'active' : ''}
                        aria-pressed={unit === 'inch'}
                        onClick={() => setUnit('inch')}
                      >
                        inch
                      </button>
                    </div>
                  </div>
                </div>
                <div className="ipw-stage">


                  {currentIsStep && viewMode === '3d' && (
                    <StepModelViewer
                      selectedFile={selectedViewerFile}
                      modelUrlOverride={configuredPreviewUrl}
                      viewMode={viewMode}
                      activeAxis={activeAxis}
                      selectedThickness={selectedThickness}
                      selectedThicknessMm={selectedThicknessMM}
                      activeFinishColor={viewerFinishColor}
                      isFinishPowderCoating={viewerFinishIsPowder}
                      isModelFadedManually={isModelFadedManually}
                      detectedHoles={detectedHoles}
                      selectedTaps={selectedTaps}
                      holeDrawerKind={activeHoleDrawer}
                      highlightHoleIds={activeHoleDrawer ? drawerHoverHoleIds : null}
                      onHolePick={handleHolePick}
                      selectedHardware={selectedHardware}
                      selectedCountersinks={selectedCountersinks}
                      allServices={allServices}
                      onDimensionsExtracted={setDimensions}
                      onProgress={handleStepViewerProgress}
                      onModelLoaded={handleStepViewerLoaded}
                    />
                  )}
                  {currentIsStep && viewMode === '2d' && (
                    currentUnfoldReady ? (
                      <CadFlatPatternViewer
                        analysis={currentBackendData}
                      />
                    ) : (
                      <div className="cad-viewer-empty ipw-pending" role="status" aria-live="polite">
                        <div>
                          {isLoadingUnfold ? (
                            <>
                              <span className="ipw-spinner" aria-hidden="true" />
                              <strong>{`${Math.max(0, Math.min(100, Math.round(unfoldProgress)))}%`}</strong>
                              <p>{unfoldStage || 'Generating the 2D flat pattern…'}</p>
                            </>
                          ) : (
                            <>
                              <strong>2D flat pattern</strong>
                              <p>It appears here once the part has been analysed.</p>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  )}
                  {currentIsDxf && (
                    <DxfModelViewer
                      selectedFile={selectedViewerFile}
                      viewMode={viewMode}
                      activeFinishColor={viewerFinishColor}
                      isFinishPowderCoating={viewerFinishIsPowder}
                      selectedThickness={selectedThickness}
                      onDimensionsExtracted={setDimensions}
                      onHolesDetected={setDetectedHoles}
                      onTechDataExtracted={setDxfTechData}
                      setIsImporting={setIsImporting}
                      setImportProgress={setImportProgress}
                    />
                  )}

                  {showGlobalViewerOverlay && (
                    <div className="cad-viewer-empty ipw-pending ipw-busy" role="status" aria-live="polite">
                      <div>
                        <span className="ipw-spinner" aria-hidden="true" />
                        {globalOverlayPercent !== null && Number.isFinite(globalOverlayPercent) && (
                          <strong>{`${Math.max(0, Math.min(100, Math.round(globalOverlayPercent)))}%`}</strong>
                        )}
                        <p>{globalOverlayTitle}</p>
                      </div>
                    </div>
                  )}

                </div>
              </main>

              {/* ── RIGHT: model details ── */}
              <div className="ip-right-panel ipw-details">
                <PricingSidebar
                  selectedFile={selectedFile}
                  dimensions={displayDimensions}
                  unit={unit}
                  measurementMetrics={measurementMetrics}
                  holeCount={currentIsStep ? detectedHoles.length : null}
                  isDetectingHoles={isDetectingHoles}
                  isFlatPending={currentIsStep && !useFlatSize && isLoadingUnfold}
                  dimensionSourceLabel={dimensionSourceLabel}
                  thicknessSourceLabel={thicknessSourceLabel}
                  selectedProductionService={selectedProductionService}
                  setSelectedProductionService={setSelectedProductionService}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  selectedMetal={selectedMetal}
                  setSelectedMetal={setSelectedMetal}
                  selectedThickness={selectedThickness}
                  selectedThicknessDisplay={selectedThicknessDisplay}
                  selectedThicknessMM={selectedThicknessMM}
                  setSelectedThickness={setSelectedThickness}
                  quantity={quantity}
                  setQuantity={setQuantity}
                  selectedAdditionalServices={selectedAdditionalServices}
                  setSelectedAdditionalServices={setSelectedAdditionalServices}
                  selectedTaps={selectedTaps}
                  setSelectedTaps={setSelectedTaps}
                  selectedHardware={selectedHardware}
                  setSelectedHardware={setSelectedHardware}
                  selectedCountersinks={selectedCountersinks}
                  setSelectedCountersinks={setSelectedCountersinks}
                  selectedFinishColors={selectedFinishColors}
                  setSelectedFinishColors={setSelectedFinishColors}
                  allServices={allServices}
                  detectedHoles={detectedHoles}
                  isLoadingUnfold={isLoadingUnfold}
                  bendList={bendList}
                  priceEstimate={priceEstimate}
                  isCalculatingPrice={isCalculatingPrice}
                  allDiscounts={allDiscounts}
                  handleUnfold={handleUnfold}
                  handleProceedToReview={handleProceedToReview}
                  is2DFile={is2DFile}
                  isStepFile={isStepFile}
                  isQuoteFlowActive={isQuoteFlowActive}
                  setIsQuoteFlowActive={setIsQuoteFlowActive}
                />
              </div>
            </div>
          ) : (
            <div className="ip-panel-layout ipw-layout ipw-quote">
              <div className="ip-qf-left ipw-q-left">
                <div className="ipw-toolbar ipw-q-toolbar">
                  <div className="ipw-toolbar-left">
                    <button type="button" className="ipw-back" onClick={() => setIsQuoteFlowActive(false)}>
                      <ChevronLeft size={15} /> Back to model
                    </button>
                  </div>
                  <div className="ipw-toolbar-controls">
                    <div className="ipw-seg" role="group" aria-label="View">
                      <button
                        type="button"
                        className={viewMode === '3d' ? 'active' : ''}
                        aria-pressed={viewMode === '3d'}
                        onClick={() => setViewMode('3d')}
                      >
                        3D
                      </button>
                      <button
                        type="button"
                        className={viewMode === '2d' ? 'active' : ''}
                        aria-pressed={viewMode === '2d'}
                        onClick={() => { setViewMode('2d'); if (!currentUnfoldReady) handleUnfold(); }}
                      >
                        2D
                      </button>
                    </div>
                    <div className="ipw-seg" role="group" aria-label="See through the part">
                      <button
                        type="button"
                        className={isModelFadedManually ? 'active' : ''}
                        aria-pressed={isModelFadedManually}
                        onClick={() => setIsModelFadedManually(!isModelFadedManually)}
                      >
                        Fade
                      </button>
                    </div>
                  </div>
                </div>
                {renderFileTabs('compact')}
                <div className="ip-qf-viewer ipw-stage" style={{ position: 'relative' }}>


                  {currentIsStep && viewMode === '3d' ? (
                    <StepModelViewer
                      selectedFile={selectedViewerFile}
                      modelUrlOverride={configuredPreviewUrl}
                      viewMode={viewMode}
                      activeAxis={activeAxis}
                      selectedThickness={selectedThickness}
                      selectedThicknessMm={selectedThicknessMM}
                      activeFinishColor={viewerFinishColor}
                      isFinishPowderCoating={viewerFinishIsPowder}
                      isModelFadedManually={isModelFadedManually}
                      detectedHoles={detectedHoles}
                      selectedTaps={selectedTaps}
                      holeDrawerKind={activeHoleDrawer}
                      highlightHoleIds={activeHoleDrawer ? drawerHoverHoleIds : null}
                      onHolePick={handleHolePick}
                      selectedHardware={selectedHardware}
                      selectedCountersinks={selectedCountersinks}
                      allServices={allServices}
                      backendData={currentUnfoldReady ? currentBackendData : null}
                      onProgress={handleStepViewerProgress}
                      onModelLoaded={handleStepViewerLoaded}
                    />
                  ) : null}
                  {currentIsStep && viewMode === '2d' && (
                    currentUnfoldReady ? (
                      <CadFlatPatternViewer
                        analysis={currentBackendData}
                      />
                    ) : (
                      <div className="cad-viewer-empty ipw-pending" role="status" aria-live="polite">
                        <div>
                          {isLoadingUnfold ? (
                            <>
                              <span className="ipw-spinner" aria-hidden="true" />
                              <strong>{`${Math.max(0, Math.min(100, Math.round(unfoldProgress)))}%`}</strong>
                              <p>{unfoldStage || 'Generating the 2D flat pattern…'}</p>
                            </>
                          ) : (
                            <>
                              <strong>2D flat pattern</strong>
                              <p>It appears here once the part has been analysed.</p>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  )}
                  {currentIsDxf && (
                    <DxfModelViewer
                      selectedFile={selectedViewerFile}
                      viewMode={viewMode}
                      activeFinishColor={viewerFinishColor}
                      isFinishPowderCoating={viewerFinishIsPowder}
                      selectedThickness={selectedThickness}
                      onDimensionsExtracted={setDimensions}
                      onHolesDetected={setDetectedHoles}
                      onTechDataExtracted={setDxfTechData}
                      setIsImporting={setIsImporting}
                      setImportProgress={setImportProgress}
                    />
                  )}

                  {showGlobalViewerOverlay && (
                    <div className="cad-viewer-empty ipw-pending ipw-busy" role="status" aria-live="polite">
                      <div>
                        <span className="ipw-spinner" aria-hidden="true" />
                        {globalOverlayPercent !== null && Number.isFinite(globalOverlayPercent) && (
                          <strong>{`${Math.max(0, Math.min(100, Math.round(globalOverlayPercent)))}%`}</strong>
                        )}
                        <p>{globalOverlayTitle}</p>
                      </div>
                    </div>
                  )}
                </div>
                {displayDimensions && (
                  <div className="ip-qf-dims ipw-q-dims">
                    <div className="ipw-q-dims-head">
                      <span className="ipw-eyebrow">Part size</span>
                      <div className="ipw-seg ipw-seg-sm" role="group" aria-label="Measurement unit">
                        <button
                          type="button"
                          className={unit === 'mm' ? 'active' : ''}
                          aria-pressed={unit === 'mm'}
                          onClick={() => setUnit('mm')}
                        >
                          mm
                        </button>
                        <button
                          type="button"
                          className={unit === 'inch' ? 'active' : ''}
                          aria-pressed={unit === 'inch'}
                          onClick={() => setUnit('inch')}
                        >
                          inch
                        </button>
                      </div>
                    </div>
                    <dl className="ipw-q-figures">
                      {[
                        { label: 'Length', value: unit === 'mm' ? displayDimensions.mm.l : displayDimensions.inches.l, unit: unit === 'mm' ? 'mm' : 'in' },
                        { label: 'Width', value: unit === 'mm' ? displayDimensions.mm.w : displayDimensions.inches.w, unit: unit === 'mm' ? 'mm' : 'in' },
                        { label: 'Thickness', value: unit === 'mm' ? displayDimensions.mm.t : displayDimensions.inches.t, unit: unit === 'mm' ? 'mm' : 'in' },
                        {
                          label: 'Area',
                          value: unit === 'mm' ? (measurementMetrics.areaMm2 / 100).toFixed(2) : (measurementMetrics.areaMm2 / (25.4 * 25.4)).toFixed(2),
                          unit: unit === 'mm' ? 'cm²' : 'in²',
                        },
                        {
                          label: 'Perimeter',
                          value: unit === 'mm' ? measurementMetrics.perimeterMm.toFixed(2) : (measurementMetrics.perimeterMm / 25.4).toFixed(2),
                          unit: unit === 'mm' ? 'mm' : 'in',
                        },
                        { label: 'Pierces', value: measurementMetrics.pierceCount, unit: '' },
                      ].map((figure) => (
                        <div key={figure.label}>
                          <dt>{figure.label}</dt>
                          <dd>
                            {figure.value}
                            {figure.unit ? <i>{figure.unit}</i> : null}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="ipw-q-source">{dimensionSourceLabel} · {thicknessSourceLabel}</p>
                  </div>
                )}
              </div>

              <div className="ip-qf-mid ipw-q-mid">
                <div className="ipw-q-body">
                  <ol className="ipw-q-steps" aria-label="Quote steps">
                    {(() => {
                      // A step is done when its choice is made, and open once
                      // every step before it is done. Moving between steps
                      // keeps all choices; a pick only clears the later ones
                      // when it actually changes (see each step's onClick).
                      const chosen = [
                        selectedProductionService?.title,
                        selectedCategory?.name,
                        selectedMetal?.name,
                        selectedThickness ? (selectedThicknessDisplay || String(selectedThickness)) : null,
                      ];
                      return [
                        { label: 'Method', num: 0 },
                        { label: 'Category', num: 1 },
                        { label: 'Material', num: 2 },
                        { label: 'Thickness', num: 3 },
                        { label: 'Services', num: 4 },
                      ].map((s) => {
                        const done = Boolean(chosen[s.num]);
                        const active = configStep === s.num;
                        const open = chosen.slice(0, s.num).every(Boolean);
                        const marker = (
                          <>
                            <span className="ipw-q-step-num">{done && !active ? <Check size={12} strokeWidth={3} /> : s.num + 1}</span>
                            <span className="ipw-q-step-label">{s.label}</span>
                          </>
                        );
                        return (
                          <li
                            key={s.num}
                            className={`ipw-q-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}
                            aria-current={active ? 'step' : undefined}
                          >
                            {open && !active ? (
                              <button
                                type="button"
                                className="ipw-q-step-link"
                                onClick={() => setConfigStep(s.num)}
                                title={chosen[s.num] ? `${s.label}: ${chosen[s.num]}` : s.label}
                                aria-label={chosen[s.num] ? `${s.label}: ${chosen[s.num]}` : s.label}
                              >
                                {marker}
                              </button>
                            ) : marker}
                          </li>
                        );
                      });
                    })()}
                  </ol>

                  {configStep === 0 && (
                    <div className="wizard-screen">
                      <div className="ipw-step-head">
                        <h2 className="ipw-step-title">Choose a production method</h2>
                      </div>

                      <div className="ipw-option-list">
                        {allServices.filter(s => s.is_production).map(svc => {
                          const isActive = selectedProductionService?.id === svc.id;
                          const processFlags = getProcessFlags(svc.title);
                          const cfg = svc.config || {};
                          const dim = displayDimensions?.mm || null;
                          const dL = dim ? parseFloat(dim.l) : 0;
                          const dW = dim ? parseFloat(dim.w) : 0;
                          const dT = dim ? parseFloat(dim.t) : 0;
                          const hasThickness = dT > 0;
                          const isTooLarge = dim && ((cfg.max_x && dL > cfg.max_x) || (cfg.max_y && dW > cfg.max_y));
                          const isTooSmall = dim && ((cfg.min_x && dL < cfg.min_x) || (cfg.min_y && dW < cfg.min_y));
                          const ignoreThicknessForLaser = processFlags.isLaser;
                          const isTooThick = !ignoreThicknessForLaser && dim && hasThickness && cfg.max_z && dT > cfg.max_z;
                          const isTooThin = !ignoreThicknessForLaser && dim && hasThickness && cfg.min_z && dT < cfg.min_z;
                          const maxSizeLabel = formatRulePairMm(cfg.max_x || 3048, cfg.max_y || 1524);
                          const minSizeLabel = formatRulePairMm(cfg.min_x || 6.3, cfg.min_y || 6.3);
                          const thicknessRangeLabel = formatRuleRangeMm(cfg.min_z || 0.5, cfg.max_z || 25.4);
                          const lockReasons = [];
                          if (isTooThick) lockReasons.push(`Part thickness ${dT.toFixed(3)} mm exceeds max ${parseFloat(cfg.max_z).toFixed(3)} mm.`);
                          if (isTooThin) lockReasons.push(`Part thickness ${dT.toFixed(3)} mm is below min ${parseFloat(cfg.min_z).toFixed(3)} mm.`);
                          if (isTooLarge) lockReasons.push(`Part size ${dL.toFixed(3)} × ${dW.toFixed(3)} mm exceeds process max ${parseFloat(cfg.max_x).toFixed(3)} × ${parseFloat(cfg.max_y).toFixed(3)} mm.`);
                          if (isTooSmall) lockReasons.push(`Part size ${dL.toFixed(3)} × ${dW.toFixed(3)} mm is below process minimum ${parseFloat(cfg.min_x).toFixed(3)} × ${parseFloat(cfg.min_y).toFixed(3)} mm.`);
                          // Do not lock Laser because of bends. Laser can cut the flat profile;
                          // Bending is handled as an additional forming operation.
                          if (processFlags.isLaser && isLaserBlockedByNonFlatFeatures) {
                            const raisedCount = nonFlatFeatureInfo.raisedFeatureFaceCount;
                            const maxOffset = nonFlatFeatureInfo.maxOffsetMm;
                            lockReasons.push(
                              nonFlatFeatureInfo.primaryReason
                              || `Detected raised 3D features (${raisedCount}, max offset ${maxOffset.toFixed(3)} mm). Laser cutting supports flat 2D profiles only.`
                            );
                          }
                          const isLocked = lockReasons.length > 0;
                          return (
                            <div
                              key={svc.id}
                              className={`ip-wizard-card ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                              onClick={() => {
                                if (isLocked) return;
                                if (selectedProductionService?.id !== svc.id) {
                                  setSelectedCategory(null);
                                  setSelectedMetal(null);
                                  setSelectedThickness(null);
                                }
                                setSelectedProductionService(svc);
                                setConfigStep(1);
                              }}
                            >
                              <div className="ipw-option-body">
                                <div className={`icon-box ${svc.title.toLowerCase().includes('cnc') ? 'blue' : 'red'}`}>
                                  {svc.title.toLowerCase().includes('cnc') ? <Box size={20} /> : <Zap size={20} />}
                                </div>
                                <div className="ipw-option-main">
                                  <div className="ip-card-title-row">
                                    <div className="ip-card-title">{svc.title}</div>
                                    {isLocked && (
                                      <span className="ipw-tag is-danger"><AlertCircle size={12} />Not compatible</span>
                                    )}
                                    {!isLocked && isActive && (
                                      <span className="ipw-tag is-success"><Check size={12} strokeWidth={3} />Selected</span>
                                    )}
                                    {!isLocked && !isActive && processFlags.isCnc && isLaserBlockedByNonFlatFeatures && (
                                      <span className="ipw-tag is-info"><Check size={12} strokeWidth={3} />Recommended</span>
                                    )}
                                  </div>
                                  <div className="ip-card-description">{svc.description || 'Precision production.'}</div>
                                  {isLocked && (
                                    <div className="ipw-lock-list">
                                      {lockReasons.map((reason, reasonIdx) => (
                                        <div key={reasonIdx} className="ipw-lock-reason">
                                          <AlertTriangle size={13} />
                                          {reason}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="ip-spec-strip">
                                    <div className="ip-spec-chip limit">
                                      <Check size={13} color="#2563eb" strokeWidth={3} />
                                      <span className="ip-spec-label">Max</span>
                                      <span className="ip-spec-value">{maxSizeLabel}</span>
                                    </div>
                                    <div className="ip-spec-chip">
                                      <ChevronLeft size={13} color="#64748b" strokeWidth={3} />
                                      <span className="ip-spec-label">Min</span>
                                      <span className="ip-spec-value">{minSizeLabel}</span>
                                    </div>
                                    <div className="ip-spec-chip thickness">
                                      <Layers size={13} color="#f59e0b" strokeWidth={3} />
                                      <span className="ip-spec-label">Thick</span>
                                      <span className="ip-spec-value">{thicknessRangeLabel}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {configStep === 1 && (
                    <div className="wizard-screen">
                      <div className="ipw-step-head">
                        <h2 className="ipw-step-title">Choose a category</h2>
                        <span className="ipw-step-meta">{allCategories.length} categories</span>
                      </div>
                      <div className="ipw-option-list">
                        {allCategories.map(cat => {
                          const metalCount = allMetals.filter(m => m.category_id === cat.id).length;
                          const isAvailable = metalCount > 0;
                          const isActive = selectedCategory?.id === cat.id;
                          return (
                            <div
                              key={cat.id}
                              className={`ip-category-bar ${isActive ? 'active' : ''} ${!isAvailable ? 'locked' : ''}`}
                              onClick={() => {
                                if (!isAvailable) return;
                                if (selectedCategory?.id !== cat.id) {
                                  setSelectedMetal(null);
                                  setSelectedThickness(null);
                                }
                                setSelectedCategory(cat);
                                setConfigStep(2);
                              }}
                            >
                              <div className="icon-disc"><Grid size={16} /></div>
                              <div className="ipw-option-main">
                                <div className="ipw-option-title-row">
                                  <div className="ipw-option-title">{cat.name}</div>
                                  {!isAvailable && <span className="ipw-tag">Not available</span>}
                                </div>
                                <div className="ipw-option-meta">{metalCount} {metalCount === 1 ? 'material' : 'materials'}</div>
                                {!isAvailable && (
                                  <div className="ipw-option-warn">
                                    Locked: no materials available in this category for the selected process.
                                  </div>
                                )}
                              </div>
                              {isAvailable && <ChevronRight size={18} className="ipw-option-chevron" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {configStep === 2 && (
                    <div className="wizard-screen">
                      <div className="ipw-step-head">
                        <h2 className="ipw-step-title">Choose a material</h2>
                        <span className="ipw-step-meta">In stock</span>
                      </div>
                      <div className="ipw-option-list">
                        {(allMetals || []).filter(m => m.category_id === selectedCategory?.id).map(met => {
                          const isActive = selectedMetal?.id === met.id;
                          const dim = displayDimensions?.mm || { l: 0, w: 0, t: 0 };
                          const mL = parseFloat(dim.l) || 0;
                          const mW = parseFloat(dim.w) || 0;
                          const mT = parseFloat(dim.t) || 0;
                          const hasThickness = mT > 0;
                          // Helper to parse "30" x 43" max" style strings from Admin
                          const parseAdminSize = (str) => {
                            if (!str) return null;
                            const matches = str.match(/(\d*\.?\d+)/g);
                            if (matches && matches.length >= 2) {
                              return { x: parseFloat(matches[0]), y: parseFloat(matches[1]) };
                            }
                            return null;
                          };

                          const cutSizes = met.quick_look?.cutSizes || [];
                          // Find the specific min/max for Instant Pricing from the Admin table
                          const adminMax = cutSizes.find(s => s.size?.toLowerCase().includes('max') && s.action === 'Instant Pricing');
                          const adminMin = cutSizes.find(s => s.size?.toLowerCase().includes('min') && s.action === 'Instant Pricing');

                          const maxParsed = parseAdminSize(adminMax?.size);
                          const minParsed = parseAdminSize(adminMin?.size);

                          const maxXIn = maxParsed ? maxParsed.x : parseFloat(met.max_x || '30');
                          const maxYIn = maxParsed ? maxParsed.y : parseFloat(met.max_y || '43');
                          const minXIn = minParsed ? minParsed.x : parseFloat(met.min_x || '0');
                          const minYIn = minParsed ? minParsed.y : parseFloat(met.min_y || '0');

                          const maxXmm = maxXIn * 25.4;
                          const maxYmm = maxYIn * 25.4;
                          const minXmm = minXIn * 25.4;
                          const minYmm = minYIn * 25.4;
                          const maxZmm = met.max_z ? parseFloat(met.max_z) * 25.4 : null;
                          const minZmm = met.min_z ? parseFloat(met.min_z) * 25.4 : null;
                          const materialMinLabel = formatRulePairMm(minXmm, minYmm);
                          const materialMaxLabel = formatRulePairMm(maxXmm, maxYmm);

                          // Check if part fits in either orientation
                          const fitsNormal = (mL <= maxXmm && mW <= maxYmm);
                          const fitsRotated = (mL <= maxYmm && mW <= maxXmm);
                          const isTooLarge = !fitsNormal && !fitsRotated;

                          // For minimums
                          const isTooSmall = (mL < minXmm && mW < minXmm) || (mL < minYmm && mW < minYmm);

                          const selectedProcessFlags = getProcessFlags(selectedProductionService?.title);
                          const ignoreThicknessForLaserMaterial = selectedProcessFlags.isLaser;
                          const isTooThick = !ignoreThicknessForLaserMaterial && hasThickness && maxZmm && mT > maxZmm;
                          const isTooThin = !ignoreThicknessForLaserMaterial && hasThickness && minZmm && mT < minZmm;

                          const lockReasons = [];
                          if (isTooThick) lockReasons.push(`Part thickness ${mT.toFixed(3)} mm exceeds max ${maxZmm.toFixed(3)} mm.`);
                          if (isTooThin) lockReasons.push(`Part thickness ${mT.toFixed(3)} mm is below min ${minZmm.toFixed(3)} mm.`);
                          if (isTooLarge) lockReasons.push(`Part size (${(mL / 25.4).toFixed(3)}" × ${(mW / 25.4).toFixed(3)}") exceeds material max (${maxXIn}" × ${maxYIn}").`);
                          if (isTooSmall) lockReasons.push(`Part size is below material minimum (${minXIn}" × ${minYIn}").`);
                          const isLocked = lockReasons.length > 0;

                          return (
                            <div
                              key={met.id}
                              className={`ip-wizard-card ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                              onClick={() => {
                                if (isLocked) return;
                                if (selectedMetal?.id !== met.id) setSelectedThickness(null);
                                setSelectedMetal(met);
                                setConfigStep(3);
                              }}
                            >
                              <div className="ipw-option-body">
                                <div className="icon-box green"><Box size={20} /></div>
                                <div className="ipw-option-main">
                                  <div className="ip-card-title-row">
                                    <div className="ip-card-title">{met.name}</div>
                                    {isLocked && (
                                      <span className="ipw-tag is-danger"><AlertCircle size={12} />Not supported</span>
                                    )}
                                  </div>
                                  {isLocked && (
                                    <div className="ipw-lock-list">
                                      {lockReasons.map((reason, reasonIdx) => (
                                        <div key={reasonIdx} className="ipw-lock-reason"><AlertTriangle size={13} />{reason}</div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="ip-spec-strip">
                                    <div className="ip-spec-chip success">
                                      <Check size={13} color="#10b981" strokeWidth={3} />
                                      <span className="ip-spec-value">In stock</span>
                                    </div>
                                    <div className="ip-spec-chip">
                                      <span className="ip-spec-label">Min</span>
                                      <span className="ip-spec-value">{materialMinLabel}</span>
                                    </div>
                                    <div className="ip-spec-chip limit">
                                      <span className="ip-spec-label">Max</span>
                                      <span className="ip-spec-value">{materialMaxLabel}</span>
                                    </div>
                                  </div>
                                </div>
                                {!isLocked && <ChevronRight size={18} className="ipw-option-chevron" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {configStep === 3 && (
                    <div className="wizard-screen">
                      <div className="ipw-step-head is-stacked">
                        <h2 className="ipw-step-title">Choose a thickness</h2>
                        <p className="ipw-step-sub">Choose the gauge for <strong>{selectedMetal?.name}</strong></p>
                      </div>
                      <div className="ipw-thick-grid">
                        {(selectedMetal?.quick_look?.thicknesses || []).map(t => {
                          const tMM = t.metric === 'mm' ? parseFloat(t.value) : parseFloat(t.value) * 25.4;
                          const modelTMM = resolvedModelThicknessMm;
                          const isMatch = modelTMM > 0 && Math.abs(tMM - modelTMM) < 0.15;
                          const isActive = selectedThickness === t.value;
                          return (
                            <button
                              type="button"
                              key={t.value}
                              className={`ipw-thick${isActive ? ' is-active' : ''}${isMatch ? ' is-match' : ''}`}
                              aria-pressed={isActive}
                              onClick={() => { setSelectedThickness(t.value); setConfigStep(4); }}
                            >
                              {isMatch && <span className="ipw-thick-match">Matches model</span>}
                              <span className="ipw-thick-value">
                                {t.metric === 'mm' ? `${parseFloat(t.value).toFixed(3)} mm` : `${parseFloat(t.value).toFixed(3)}"`}
                              </span>
                              <span className="ipw-thick-alt">
                                {t.metric === 'mm' ? `${(tMM / 25.4).toFixed(3)}"` : `${tMM.toFixed(3)} mm`}
                              </span>
                              {t.gauge && <span className="ipw-thick-gauge">{t.gauge}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {configStep === 4 && (
                    <div className="wizard-screen">
                      <div className="ipw-step-head is-stacked">
                        <h2 className="ipw-step-title">Additional services</h2>
                        <p className="ipw-step-sub">Enhance your part with extra processes</p>
                      </div>
                      <div className="ipw-option-list">
                        {allServices
                          .filter(s => {
                            if (!selectedMetal) return false;

                            // 1) Must be assigned to the selected production method (parent service)
                            let pids = s.parent_ids;
                            if (typeof pids === 'string') {
                              try { pids = JSON.parse(pids); } catch { pids = []; }
                            }
                            const pidsOk = Array.isArray(pids) && pids.map(Number).includes(Number(selectedProductionService?.id));
                            if (!pidsOk) return false;

                            // 2) Parse services assigned directly to the metal
                            let metalSvcs = selectedMetal.services;
                            if (typeof metalSvcs === 'string') {
                              try { metalSvcs = JSON.parse(metalSvcs); } catch { metalSvcs = []; }
                            }
                            const metalSvcsNums = Array.isArray(metalSvcs) ? metalSvcs.map(Number) : [];

                            // 3) Check all thicknesses to see if any thickness supports this service
                            const anyThickHas = (selectedMetal.quick_look?.thicknesses || []).some(t => {
                              let ts = t.services;
                              if (typeof ts === 'string') { try { ts = JSON.parse(ts); } catch { ts = []; } }
                              return Array.isArray(ts) && ts.map(Number).includes(Number(s.id));
                            });

                            // Only show if explicitly assigned at metal or thickness level
                            return (metalSvcsNums.includes(Number(s.id)) || anyThickHas);
                          })
                          .map(svc => {
                            const svcTitle = svc.title.toLowerCase();
                            const kind = svcTitle.includes('bend') ? 'bend'
                              : svcTitle.includes('tap') ? 'tap'
                                : svcTitle.includes('hardware') ? 'hw'
                                  : svcTitle.includes('countersink') ? 'cs'
                                    : (svcTitle.includes('anodiz') || svcTitle.includes('powder') || svcTitle.includes('coat')) ? 'finish'
                                      : null;
                            const isBendService = kind === 'bend';
                            const bendCount = bendList?.length || 0;

                            // Check if the service is assigned globally to the metal
                            let metalSvcsRoot = selectedMetal?.services;
                            if (typeof metalSvcsRoot === 'string') { try { metalSvcsRoot = JSON.parse(metalSvcsRoot); } catch { metalSvcsRoot = []; } }
                            const hasMetalGrant = Array.isArray(metalSvcsRoot) && metalSvcsRoot.map(Number).includes(Number(svc.id));

                            const selectedThicknessObj = (selectedMetal?.quick_look?.thicknesses || []).find(t => String(t.value) === String(selectedThickness));
                            let tServices = selectedThicknessObj?.services;
                            if (typeof tServices === 'string') {
                              try { tServices = JSON.parse(tServices); } catch { tServices = []; }
                            }
                            const tServicesNums = Array.isArray(tServices) ? tServices.map(Number) : [];
                            const isThicknessLocked = !hasMetalGrant && !tServicesNums.includes(Number(svc.id));

                            // If it's specifically assigned to this thickness, it's supported even if global bendable flag is false
                            const isBendUnsupported = svcTitle.includes('bend') && !selectedMetal?.is_bendable && !tServicesNums.includes(Number(svc.id));
                            const isNoBends = isBendService && bendCount === 0;

                            const isUnsupported = (isBendUnsupported || isThicknessLocked || isNoBends);
                            const isActive = isBendService
                              ? bendCount > 0 && !isUnsupported
                              : selectedAdditionalServices.some(s => s.id === svc.id);
                            const lockReason = isBendUnsupported
                              ? `${selectedMetal?.name} is typically not bendable`
                              : isThicknessLocked
                                ? `Not available for ${selectedThicknessDisplay || selectedThickness || 'selected'} thickness`
                                : isNoBends
                                  ? 'No bends detected in uploaded model'
                                  : '';

                            const svcIcon = svcTitle.includes('bend') ? <Layers size={16} />
                              : svcTitle.includes('tap') ? <Settings size={16} />
                                : svcTitle.includes('hardware') ? <Boxes size={16} />
                                  : svcTitle.includes('countersink') ? <ChevronDown size={16} />
                                    : svcTitle.includes('anodiz') ? <Zap size={16} />
                                      : svcTitle.includes('powder') || svcTitle.includes('coat') ? <Grid size={16} />
                                        : <Settings size={16} />;

                            const holeCount = detectedHoles.length;
                            const configuredCount = kind === 'tap' ? Object.keys(selectedTaps).length
                              : kind === 'hw' ? Object.keys(selectedHardware).length
                                : kind === 'cs' ? Object.keys(selectedCountersinks).length
                                  : kind === 'bend' ? bendCount
                                    : kind === 'finish' ? (selectedFinishColors?.[svc.id] ? 1 : 0)
                                      : 0;
                            const totalForKind = (kind === 'tap' || kind === 'hw' || kind === 'cs') ? holeCount
                              : kind === 'bend' ? bendCount
                                : kind === 'finish' ? 1
                                  : 0;
                            const baseServicePrice = parseFloat(svc.base_price || 0) || 0;
                            const serviceOptions = Array.isArray(svc.service_options) ? svc.service_options : [];
                            const selectedFinish = selectedFinishColors?.[svc.id];
                            const selectedFinishUpcharge = selectedFinish ? (parseFloat(selectedFinish.price || 0) || 0) : 0;
                            const minFinishUpcharge = serviceOptions.length > 0
                              ? Math.min(...serviceOptions.map(opt => parseFloat(opt.price || 0) || 0))
                              : 0;
                            const finishPrice = selectedFinish ? selectedFinishUpcharge : minFinishUpcharge;
                            const displayServicePrice = kind === 'finish'
                              ? (finishPrice > 0 ? finishPrice : baseServicePrice)
                              : baseServicePrice;
                            const shouldShowPriceBadge = !isUnsupported
                              && isActive
                              && displayServicePrice > 0
                              && (kind !== 'finish' || selectedFinish)
                              && !(svcTitle.includes('powder') || svcTitle.includes('coat'));
                            const priceBadgeLabel = 'selected';

                            return (
                              <React.Fragment key={svc.id}>
                                <div
                                  className={`ip-category-bar ${isActive ? 'active' : ''} ${isUnsupported ? 'locked' : ''}`}
                                  style={{ pointerEvents: isUnsupported ? 'none' : 'auto' }}
                                  onClick={() => {
                                    if (isUnsupported || isBendService) return;
                                    const t = svc.title.toLowerCase();
                                    const k = t.includes('bend') ? 'bend'
                                      : t.includes('tap') ? 'tap'
                                        : t.includes('hardware') ? 'hw'
                                          : t.includes('countersink') ? 'cs'
                                            : (t.includes('anodiz') || t.includes('powder') || t.includes('coat')) ? 'finish'
                                              : null;

                                    if (isActive) {
                                      setSelectedAdditionalServices(prev => prev.filter(s => s.id !== svc.id));
                                      if (k === 'tap') { setSelectedTaps({}); setHoleDrawer(prev => (prev === 'tap' ? null : prev)); }
                                      else if (k === 'hw') { setSelectedHardware({}); setHoleDrawer(prev => (prev === 'hw' ? null : prev)); }
                                      else if (k === 'cs') { setSelectedCountersinks({}); setHoleDrawer(prev => (prev === 'cs' ? null : prev)); }
                                      else if (k === 'finish') {
                                        setSelectedFinishColors(prev => { const n = { ...prev }; delete n[svc.id]; return n; });
                                        setFinishDrawerSvcId(prev => (String(prev) === String(svc.id) ? null : prev));
                                      }
                                    } else {
                                      setSelectedAdditionalServices(prev => [...prev, svc]);
                                      if (k && k !== 'bend') openSubModal(k, svc);
                                    }
                                  }}
                                >
                                  <div className="icon-disc">{svcIcon}</div>
                                  <div className="ipw-option-main">
                                    <div className="ipw-option-title-row">
                                      <div className="ipw-option-title">{svc.title}</div>
                                      {isUnsupported && (
                                        <span className="ipw-tag is-danger"><AlertCircle size={11} />{lockReason || 'Not supported'}</span>
                                      )}
                                      {shouldShowPriceBadge && (
                                        <span className="ipw-tag is-success">
                                          {priceBadgeLabel} ${displayServicePrice.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="ipw-option-meta">{svc.description || 'Professional finish.'}</div>
                                  </div>
                                  {!isUnsupported && !isBendService && (
                                    <div className={`selection-dot ipw-check ${isActive ? 'active' : ''}`}>
                                      {isActive && <Check size={10} color="#fff" strokeWidth={3} />}
                                    </div>
                                  )}
                                </div>
                                {isActive && kind && !isUnsupported && (
                                  <div className="ipw-svc-config">
                                    <div className="ipw-svc-stats">
                                      {(kind === 'tap' || kind === 'hw' || kind === 'cs') && (
                                        <>
                                          <div className="ipw-svc-stat">
                                            <span>Detected</span>
                                            <span className="ipw-svc-value">{holeCount} hole{holeCount === 1 ? '' : 's'}</span>
                                          </div>
                                          <span className="ipw-svc-divider" aria-hidden="true" />
                                          <div className="ipw-svc-stat">
                                            <span>Configured</span>
                                            <span className={`ipw-svc-value${configuredCount > 0 ? ' is-good' : ' is-muted'}`}>{configuredCount} / {totalForKind}</span>
                                          </div>
                                        </>
                                      )}
                                      {kind === 'bend' && (
                                        <>
                                          <div className="ipw-svc-stat">
                                            <span>Bends</span>
                                            <span className="ipw-svc-value">{bendList?.length || 0} detected</span>
                                          </div>
                                          <span className="ipw-svc-divider" aria-hidden="true" />
                                          <div className="ipw-svc-stat">
                                            <span>Price</span>
                                            <span className="ipw-svc-value is-good">${bendDisplayPrice.toFixed(2)}</span>
                                          </div>
                                        </>
                                      )}
                                      {kind === 'finish' && (
                                        <div className="ipw-svc-stat">
                                          <span>Color</span>
                                          <span className={`ipw-svc-value${selectedFinishColors?.[svc.id] ? ' is-good' : ' is-muted'}`}>{selectedFinishColors?.[svc.id]?.name || 'Not selected'}</span>
                                        </div>
                                      )}
                                    </div>
                                    {kind !== 'bend' && (
                                      <button
                                        type="button"
                                        className="ipw-btn ipw-btn-dark"
                                        onClick={(e) => { e.stopPropagation(); openSubModal(kind, svc); }}
                                      >
                                        {kind === 'finish' ? 'Pick color' : 'Configure'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="ip-qf-right ipw-q-right">
                {(() => {
                  const ALLOWED_TIERS = [2, 5, 10, 50, 100, 1000];
                  const seen = new Set();
                  const tiers = (allDiscounts || [])
                    .filter(d => d.is_active !== false && parseFloat(d.discount_percent) > 0 && ALLOWED_TIERS.includes(Number(d.min_quantity)))
                    .filter(d => { if (seen.has(Number(d.min_quantity))) return false; seen.add(Number(d.min_quantity)); return true; })
                    .sort((a, b) => a.min_quantity - b.min_quantity);
                  if (tiers.length === 0) return null;
                  return (
                    <section className="ipw-q-section">
                      <h3 className="ipw-q-section-title">Volume discounts</h3>
                      <ul className="ipw-q-tiers">
                        {tiers.map((d, i) => {
                          const reached = quantity >= d.min_quantity;
                          return (
                            <li key={i} className={reached ? 'is-reached' : ''}>
                              <span>{d.min_quantity}+ units</span>
                              <strong>{parseFloat(d.discount_percent).toFixed(2)}% off</strong>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })()}

                {!selectedMetal ? (
                  <section className="ipw-q-section">
                    <h2 className="ipw-q-title">Quote summary</h2>
                    <p className="ipw-q-sub">Your choices so far</p>
                    <ol className="ipw-q-progress">
                      {[
                        { label: 'Production method', value: selectedProductionService?.title, step: 0 },
                        { label: 'Category', value: selectedCategory?.name, step: 1 },
                        { label: 'Material', value: selectedMetal?.name, step: 2 },
                        { label: 'Thickness', value: selectedThickness ? (selectedThicknessDisplay || String(selectedThickness)) : null, step: 3 },
                        { label: 'Additional services', value: configStep >= 4 ? `${selectedAdditionalServices.length} selected` : null, step: 4 },
                      ].map((item, i) => {
                        const active = configStep === item.step;
                        const displayValue = item.step === 0 && selectedProductionService?.title ? selectedProductionService.title
                          : item.step === 1 && selectedCategory?.name ? selectedCategory.name
                            : item.step === 2 && selectedMetal?.name ? selectedMetal.name
                              : item.step === 3 && selectedThickness ? (selectedThicknessDisplay || String(selectedThickness))
                                : item.step === 4 && configStep >= 4 ? `${selectedAdditionalServices.length} selected`
                                  : null;
                        return (
                          <li key={i} className={`${displayValue ? 'is-done' : ''}${active ? ' is-active' : ''}`.trim() || undefined}>
                            <span className="ipw-q-progress-dot" aria-hidden="true">
                              {displayValue && <Check size={10} strokeWidth={3} />}
                            </span>
                            <span className="ipw-q-progress-text">
                              <strong>{item.label}</strong>
                              <small>{displayValue || 'Not chosen yet'}</small>
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ) : (
                  <div className="ipw-q-panel">
                    <section className="ipw-q-section">
                      <h3 className="ipw-q-section-title">Quantity</h3>
                      <div className="ipw-qty">
                        <button type="button" aria-label="One fewer" onClick={() => changeQuantityBy(-1)}>−</button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          aria-label="Order quantity"
                          value={quantityInputValue}
                          onChange={handleQuantityInputChange}
                          onBlur={commitQuantityInput}
                          onKeyDown={handleQuantityInputKeyDown}
                          onFocus={event => event.target.select()}
                        />
                        <button type="button" aria-label="One more" onClick={() => changeQuantityBy(1)}>+</button>
                      </div>
                    </section>

                    <section className="ipw-q-section">
                      <h3 className="ipw-q-section-title">Part</h3>
                      <dl className="ipw-q-specs">
                        {[
                          { label: 'File', value: selectedFile?.file?.name || 'No file selected' },
                          { label: 'Material', value: selectedMetal?.name || 'Select material' },
                          { label: 'Stock', value: selectedThicknessDisplay || selectedThickness || 'Select thickness' },
                          {
                            label: 'Size',
                            value: displayDimensions
                              ? `${displayDimensions.mm.l} × ${displayDimensions.mm.w} × ${displayDimensions.mm.t} mm`
                              : 'Analyzing geometry',
                          },
                        ].map((row) => (
                          <div key={row.label}>
                            <dt>{row.label}</dt>
                            <dd title={String(row.value || '')}>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="ipw-q-counts">
                        {[
                          { label: 'Pierces', value: measurementMetrics.pierceCount },
                          { label: 'Bends', value: bendCountTotal },
                          { label: 'Services', value: quoteAdditionalServices.length },
                        ].map(item => (
                          <div key={item.label}>
                            <strong>{item.value}</strong>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                      <p className={`ipw-q-status${isLoadingUnfold || isDetectingHoles || isCalculatingPrice ? ' is-busy' : ' is-ready'}`} role="status">
                        {isLoadingUnfold || isDetectingHoles || isCalculatingPrice
                          ? <span className="ipw-spinner is-inline" aria-hidden="true" />
                          : <Check size={13} strokeWidth={3} aria-hidden="true" />}
                        <span>{isLoadingUnfold || isDetectingHoles || isCalculatingPrice ? 'Working out your quote…' : 'Quote ready'}</span>
                      </p>
                    </section>

                    <div className="ipw-geo-spacer" />

                    <section className="ipw-q-receipt" aria-label="Price breakdown">
                      <h3 className="ipw-q-section-title">Breakdown</h3>

                      {showServiceBreakdown && (
                        <div className="ipw-q-line">
                          <span>
                            Material
                            {isCalculatingPrice && <small>Working out the material…</small>}
                          </span>
                          {isCalculatingPrice
                            ? <span className="skeleton-price ipw-q-skel" />
                            : <strong>${(((priceEstimate?.breakdown?.material_cost ?? 0) * quantity) || 0).toFixed(2)}</strong>
                          }
                        </div>
                      )}

                      {(() => {
                        if (!showServiceBreakdown) return null;
                        const rows = priceEstimate?.breakdown?.service_breakdown || [];
                        if (rows.length === 0) return null;
                        return rows.map((r, i) => (
                          <div key={i} className="ipw-q-line">
                            <span>{r.name}</span>
                            {isCalculatingPrice
                              ? <span className="skeleton-price ipw-q-skel" />
                              : (
                                <strong>
                                  ${((r.pricing_mode === 'fixed_total'
                                    ? (parseFloat(r.price) || 0)
                                    : ((parseFloat(r.price) || 0) * quantity)) || 0).toFixed(2)}
                                </strong>
                              )
                            }
                          </div>
                        ));
                      })()}

                      {(() => {
                        const warnings = Array.from(new Set([
                          ...(priceEstimate?.breakdown?.warnings || []),
                          ...(bendSupportStatus.warning && bendCountTotal > 0 ? [bendSupportStatus.warning] : [])
                        ]));
                        if (warnings.length === 0) return null;
                        return (
                          <div className="ipw-q-warnings" role="note">
                            <strong>Please note</strong>
                            <ul>
                              {warnings.map((warning, index) => (
                                <li key={`${warning}-${index}`}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()}

                      <div className="ipw-q-line is-gross">
                        <span>Gross total</span>
                        {isCalculatingPrice
                          ? <span className="skeleton-price ipw-q-skel" />
                          : <strong>${(parseFloat(priceEstimate?.breakdown?.subtotal_before_discount || 0)).toFixed(2)}</strong>
                        }
                      </div>

                      {priceEstimate?.breakdown?.discount_percent > 0 && (
                        <div className="ipw-q-line is-discount">
                          <span>Discount ({parseFloat(priceEstimate?.breakdown?.discount_percent || 0).toFixed(2)}%)</span>
                          <strong>−${(parseFloat(priceEstimate?.breakdown?.discount_amount || 0)).toFixed(2)}</strong>
                        </div>
                      )}

                      <div className="ipw-q-total">
                        <span>Total</span>
                        {isCalculatingPrice
                          ? <span className="skeleton-price ipw-q-skel is-lg" />
                          : <strong>${(parseFloat(priceEstimate?.total_price) || 0).toFixed(2)}</strong>
                        }
                      </div>

                      <button
                        type="button"
                        className="ipw-proceed"
                        onClick={handleProceedToReview}
                        disabled={!priceEstimate}
                      >
                        <span className="ipw-proceed-text">
                          <strong>Proceed to review</strong>
                          <small>Adds this part to your cart</small>
                        </span>
                        <span className="ipw-proceed-arrow" aria-hidden="true">
                          <ArrowRight size={16} />
                        </span>
                      </button>
                    </section>
                  </div>
                )}
              </div>

              <AnimatePresence>
                {activeHoleDrawer && (
                  <HoleServiceDrawer
                    key={activeHoleDrawer}
                    kind={activeHoleDrawer}
                    holes={detectedHoles}
                    holeNumberById={holeIndexById}
                    options={activeHoleDrawer === 'tap' ? tapOptions : activeHoleDrawer === 'cs' ? csOptions : (hwOptions || [])}
                    isLoadingOptions={activeHoleDrawer === 'hw' && hwOptions === null}
                    selections={activeHoleDrawer === 'tap' ? selectedTaps : activeHoleDrawer === 'cs' ? selectedCountersinks : selectedHardware}
                    onSelectionsChange={activeHoleDrawer === 'tap' ? setSelectedTaps : activeHoleDrawer === 'cs' ? setSelectedCountersinks : setSelectedHardware}
                    sheetThicknessMm={holeSheetThicknessMm}
                    unit={unit}
                    onClose={closeHoleDrawer}
                    onHoverHoles={setDrawerHoverHoleIds}
                    pickedHole={pickedHole}
                    isFindingHoles={isDetectingHoles}
                    lockedHoles={lockedHolesForDrawer}
                    onUnlockHoles={unlockHoles}
                  />
                )}
                {activeFinishDrawerSvc && (
                  <FinishColorDrawer
                    key={`finish-${activeFinishDrawerSvc.id}`}
                    svc={activeFinishDrawerSvc}
                    selected={selectedFinishColors[activeFinishDrawerSvc.id] || null}
                    onSelect={(option, index) => {
                      const svcId = activeFinishDrawerSvc.id;
                      setSelectedFinishColors(p => ({ ...p, [svcId]: { ...option, index } }));
                    }}
                    onSkip={() => {
                      const svcId = activeFinishDrawerSvc.id;
                      setSelectedFinishColors(p => { const n = { ...p }; delete n[svcId]; return n; });
                      closeFinishDrawer();
                    }}
                    onPreview={setFinishPreview}
                    onClose={closeFinishDrawer}
                  />
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )
      }

      <StyleTag />

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

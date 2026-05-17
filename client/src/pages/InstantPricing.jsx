import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import {
  Upload, X, Info, Layers, Box, Boxes, ChevronLeft,
  ChevronRight, ChevronDown, AlertCircle, AlertTriangle, Loader2, Check, Shield, Calculator,
  Plus, Zap, TrendingDown, FileText, Settings, Grid
} from 'lucide-react';
import {
  fetchServices, calculatePrice, fetchPublicDiscounts, fetchHardwareItemsByType,
  fetchCategories, fetchMetals, fetchPricingCncMetals, fetchPricingSheetMetals,
  fetchCncPricingConfig, fetchMetalsByServiceId
} from '../utils/api';
import { useCart } from '../context/CartContext.js';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StepModelViewer from '../components/viewer/StepModelViewer';
import DxfModelViewer from '../components/viewer/DxfModelViewer';
import FlatPatternViewer from '../components/viewer/FlatPatternViewer';
import HierarchicalProjectViewer from '../components/viewer/HierarchicalProjectViewer';
import PricingSidebar from '../components/pricing/PricingSidebar';
import { wrinkleSwatchStyle } from '../utils/wrinkleTexture';
import '../styles/PremiumPricing.css';

const BACKEND_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

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

// ─── Component ──────────────────────────────────────────
const InstantPricing = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [viewMode, setViewMode] = useState('3d');
  const [activeAxis, setActiveAxis] = useState('top');
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
  const [configuredHardwareResizeReport, setConfiguredHardwareResizeReport] = useState({});
  const [isQuoteFlowActive, setIsQuoteFlowActive] = useState(false);
  const [configStep, setConfigStep] = useState(0); // 0: Method, 1: Category, 2: Metal, 3: Thickness, 4: Services

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
  const currentIsStep = useMemo(() => isStepFile(selectedFile?.file?.name), [selectedFile]);
  const currentIsDxf = useMemo(() => is2DFile(selectedFile?.file?.name), [selectedFile]);
  const selectedFileKey = useMemo(() => getFileAnalysisKey(selectedFile), [selectedFile]);
  const [selectedAdditionalServices, setSelectedAdditionalServices] = useState([]);
  const [selectedFinishColors, setSelectedFinishColors] = useState({});
  const [activeFinishSvcId, setActiveFinishSvcId] = useState(null);
  const [isAnodizingModalOpen, setIsAnodizingModalOpen] = useState(false);
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
  const [detectedHoles, setDetectedHoles] = useState([]);
  const [allDiscounts, setAllDiscounts] = useState([]);
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isModelFadedManually, setIsModelFadedManually] = useState(false);
  const [bendTree, setBendTree] = useState(null);
  const [detectedBends, setDetectedBends] = useState([]);
  const [selectedBends, setSelectedBends] = useState({});
  const currentBackendData = (
    currentIsStep && selectedFileKey && backendData?.__fileKey === selectedFileKey
      ? backendData
      : null
  );
  const currentUnfoldReady = Boolean(
    currentBackendData && bendTree
  );

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
    const width = currentIsStep ? toFiniteNumber(currentBackendData?.bbox?.width) : 0;
    const height = currentIsStep ? toFiniteNumber(currentBackendData?.bbox?.height) : 0;
    const hasSize = width > 0 && height > 0;
    return {
      width,
      height,
      max: hasSize ? Math.max(width, height) : 0,
      min: hasSize ? Math.min(width, height) : 0,
      hasSize
    };
  }, [currentIsStep, currentBackendData?.bbox?.width, currentBackendData?.bbox?.height]);

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

    if (currentIsStep && !useFlatSize) return null;
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
    currentIsStep,
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

    const dxfPerimeter = toFiniteNumber(dxfTechData?.totalPerimeter);
    if (dxfPerimeter > 0) return dxfPerimeter;

    const edgePerimeter = sumSegmentLengths(currentBackendData?.cutEdges);
    if (edgePerimeter > 0) return edgePerimeter;

    const l = toFiniteNumber(displayDimensions?.mm?.l);
    const w = toFiniteNumber(displayDimensions?.mm?.w);
    return l > 0 && w > 0 ? ((l + w) * 2) : 0;
  }, [currentBackendData?.totalPerimeter, currentBackendData?.cutEdges, dxfTechData?.totalPerimeter, displayDimensions?.mm?.l, displayDimensions?.mm?.w]);

  const pierceCount = useMemo(() => {
    const direct = Number.parseInt(currentBackendData?.pierceCount, 10);
    if (Number.isFinite(direct) && direct > 0) return direct;

    const dxfCount = Number.parseInt(dxfTechData?.pierceCount, 10);
    if (Number.isFinite(dxfCount) && dxfCount > 0) return dxfCount;

    return Math.max(1, detectedHoles.length || 1);
  }, [currentBackendData?.pierceCount, dxfTechData?.pierceCount, detectedHoles.length]);

  const pricingTechnicalData = useMemo(() => {
    return {
      totalPerimeter: perimeterMm,
      pierceCount,
      bends: Array.isArray(currentBackendData?.bends) ? currentBackendData.bends : []
    };
  }, [perimeterMm, pierceCount, currentBackendData?.bends]);

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

  const isLaserBlockedByBends = bendCountTotal > 0;
  const isLaserBlockedByNonFlatFeatures = currentIsStep && nonFlatFeatureInfo.hasRaisedFeatures;

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
        status: bendCountTotal > 0 ? 'fail' : 'pass',
        impact: bendCountTotal > 0 ? 'Locks Laser' : 'Laser OK',
        reason: bendCountTotal > 0
          ? `Detected ${bendCountTotal} bend(s); formed geometry is not laser-cuttable.`
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
    if (!isLaser || (!isLaserBlockedByBends && !isLaserBlockedByNonFlatFeatures)) return;

    setSelectedProductionService(null);
    setSelectedCategory(null);
    setSelectedMetal(null);
    setSelectedThickness(null);
    setConfigStep(0);
    if (isLaserBlockedByBends) {
      toast(`Detected ${bendCountTotal} bend(s). Laser cutting is locked for bent models.`, 'error');
      return;
    }
    const raisedCount = nonFlatFeatureInfo.raisedFeatureFaceCount;
    toast(`Detected raised 3D features (${raisedCount}). Laser cutting is limited to flat 2D profiles.`, 'error');
  }, [selectedProductionService, isLaserBlockedByBends, isLaserBlockedByNonFlatFeatures, bendCountTotal, nonFlatFeatureInfo.raisedFeatureFaceCount, toast]);

  const stepHolesDetectedRef = useRef(false);
  const holeDetectionAttemptedRef = useRef(false);
  const qty1PriceRef = useRef(null);
  const detectHolesAbortRef = useRef(null);
  const TAP_RANGE_TOLERANCE = 0.00025;

  const holeGroups = useMemo(() => {
    const groups = {};
    detectedHoles.forEach(hole => {
      const key = Number(hole.diameterInches || 0).toFixed(3);
      if (!groups[key]) groups[key] = { dia: key, holes: [] };
      groups[key].holes.push(hole);
    });
    return Object.values(groups).sort((a, b) => parseFloat(a.dia) - parseFloat(b.dia));
  }, [detectedHoles]);

  const holeIndexById = useMemo(() => {
    const idx = {};
    detectedHoles.forEach((h, i) => { idx[h.id] = i + 1; });
    return idx;
  }, [detectedHoles]);

  const hwTypeById = useMemo(() => {
    const m = {};
    HW_TYPES.forEach(t => { m[t.id] = t; });
    return m;
  }, []);

  const holeGroupsWithHwState = useMemo(() => {
    return holeGroups.map(group => {
      let assignedCount = 0;
      group.holes.forEach(h => { if (selectedHardware[h.id]) assignedCount += 1; });
      return {
        ...group,
        assignedCount,
        allAssigned: assignedCount === group.holes.length,
      };
    });
  }, [holeGroups, selectedHardware]);

  const csHoleGroups = useMemo(() => {
    const groups = {};
    detectedHoles.forEach(h => {
      const dia = Number(h.diameterInches || 0).toFixed(4);
      if (!groups[dia]) groups[dia] = { dia, holes: [] };
      groups[dia].holes.push(h);
    });
    return Object.values(groups).sort((a, b) => parseFloat(a.dia) - parseFloat(b.dia));
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

    setActiveHwHole(prev => (prev && validIds.has(String(prev.id)) ? prev : null));
    setActiveCSHole(prev => (prev && validIds.has(String(prev.id)) ? prev : null));
    setActiveTapHole(prev => (prev && validIds.has(String(prev.id)) ? prev : null));
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

  const showHardwareFitLegend = useMemo(() => {
    return isHardwareActive && viewMode === '3d' && Object.keys(selectedHardware || {}).length > 0;
  }, [isHardwareActive, viewMode, selectedHardware]);

  const selectedHardwareForPreview = useMemo(() => {
    const entries = Object.entries(selectedHardware || {}).filter(([, hw]) => {
      const typeId = Number(hw?.typeId);
      return typeId === 1 || typeId === 2 || typeId === 3 || typeId === 4;
    });
    return Object.fromEntries(entries);
  }, [selectedHardware]);

  const hasConfiguredCuts = useMemo(() => {
    return (
      Object.keys(selectedCountersinks || {}).length > 0 ||
      Object.keys(selectedTaps || {}).length > 0 ||
      Object.keys(selectedHardwareForPreview || {}).length > 0
    );
  }, [selectedCountersinks, selectedTaps, selectedHardwareForPreview]);

  const configuredPreviewPayload = useMemo(() => {
    if (!selectedFile?.tempPath || !currentIsStep || !hasConfiguredCuts) return null;

    const finishColor = activeFinishColor
      ? (activeFinishColor?.color || activeFinishColor?.hex || (typeof activeFinishColor === 'string' ? activeFinishColor : null))
      : null;
    const mmThickness = resolvedModelThicknessMm > 0
      ? Number(resolvedModelThicknessMm.toFixed(4))
      : (selectedThicknessMM > 0 ? Number(selectedThicknessMM.toFixed(4)) : null);

    return {
      tempPath: selectedFile.tempPath,
      configuration: {
        selectedTaps,
        selectedHardware: selectedHardwareForPreview,
        selectedCountersinks,
        thickness: mmThickness,
        dimensions: mmThickness ? { mm: { t: mmThickness } } : null,
        anodizingColor: finishColor ? { color: finishColor } : null,
      }
    };
  }, [selectedFile?.tempPath, currentIsStep, hasConfiguredCuts, selectedTaps, selectedHardwareForPreview, selectedCountersinks, resolvedModelThicknessMm, selectedThicknessMM, activeFinishColor]);

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
    return csSvc?.service_options || [];
  }, [allServices]);

  const handleProceedToReview = () => {
    if (!selectedFile || !selectedMetal || !displayDimensions) return;
    if (!priceEstimate?.breakdown) {
      toast('Pricing is not ready yet. Please wait a moment and try again.', 'error');
      return;
    }

    // Backend breakdown is the source of truth for per-unit prices at current quantity.
    const unitBasePrice = parseFloat(priceEstimate.breakdown?.unit_total || 0);
    const unitFinalPrice = parseFloat(
      priceEstimate.breakdown?.final_unit_price ||
      (quantity > 0 ? (parseFloat(priceEstimate?.total_price || 0) / quantity) : 0)
    );
    const discountPercent = parseFloat(priceEstimate.breakdown?.discount_percent || 0);
    const config = {
      productionService: selectedProductionService,
      metal: selectedMetal,
      thickness: displayDimensions.mm.t,
      selectedThickness: selectedThickness, // Store string value for Laser établissements
      selectedThicknessDisplay,
      modelDimensionSource: dimensionSourceLabel,
      modelThicknessSource: thicknessSourceLabel,
      anodizingColor: activeFinishColor,
      selectedTaps,
      selectedHardware,
      selectedCountersinks,
      selectedBends,
      bendTree,
      bendCount: bendList?.length || 0,
      detectedHoles,
      detectedBends,
      additionalServices: quoteAdditionalServices,
      dimensions: displayDimensions,
      dxfSvg: dxfSvg,
      selectedFinishColors,
      pricingTechnicalData,
    };

    addToCart({
      fileName: selectedFile.file.name,
      file: selectedFile.file,
      tempPath: selectedFile.tempPath,
      configuration: config,
      pricing: {
        baseUnit: unitBasePrice,
        discount_percent: discountPercent,
        finish: 0,
        total: unitFinalPrice
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
    fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(300000) })
      .catch(() => { /* Backend is handled per-request */ });
  }, []);

  // ── Reset quoting flow when file changes ──────────────
  useEffect(() => {
    setSelectedProductionService(null);
    setSelectedCategory(null);
    setSelectedMetal(null);
    setQuantity(1);
    // PRESERVE selectedAdditionalServices and service-specific selections (hardware, taps, countersinks, finishes)
    // They will only be cleared when the user explicitly unchecks the service in the UI
    setDetectedHoles([]);
    setIsDetectingHoles(false);
    setSelectedThickness(null);
    setBackendData(null);
    setBendTree(null);
    setDetectedBends([]);
    setSelectedBends({});
    setDxfTechData(null);
    setUnfoldProgress(0);
    setUnfoldStage('');
    setStepModelProgress(0);
    setIsStepModelLoading(false);
    stepHolesDetectedRef.current = false;
    holeDetectionAttemptedRef.current = false;
    qty1PriceRef.current = null;
  }, [selectedFile]);

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
    const backendHoles = Array.isArray(backendData?.detectedHoles) ? backendData.detectedHoles : [];
    if (backendHoles.length === 0) return;
    const tMm = detectHolesContextRef.current.thicknessMm;
    const depthIn = tMm > 0 ? tMm / 25.4 : 2 / 25.4;
    const mapped = backendHoles.map((h, idx) => ({
      id: idx,
      diameterInches: h.diameter_in,
      diameter_mm: h.diameter_mm,
      depthMm: h.depth_mm || 0,
      depthInches: h.depth_mm ? h.depth_mm / 25.4 : depthIn,
      position: h.position,
      axis: h.axis,
      parent_face_id: h.face_id,
    }));
    setDetectedHoles(mapped);
    stepHolesDetectedRef.current = true;
    holeDetectionAttemptedRef.current = true;
    // If a fallback detect() is still in-flight, cancel it — we have real data.
    if (detectHolesAbortRef.current) {
      try { detectHolesAbortRef.current.abort(); } catch { /* noop */ }
      detectHolesAbortRef.current = null;
    }
  }, [selectedFile, selectedFileKey, backendData?.__fileKey, backendData?.detectedHoles]);

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
          r = await fetch(`${BACKEND_URL}/api/detect-holes-by-temp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempPath: selectedFile.tempPath }),
            signal: controller.signal,
          });
        } else {
          const fd = new FormData();
          fd.append('file', selectedFile.file);
          r = await fetch(`${BACKEND_URL}/api/detect-holes`, {
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
        const mapped = (d.holes || []).map((h, idx) => ({
          id: idx,
          diameterInches: h.diameter_in,
          diameter_mm: h.diameter_mm,
          depthMm: h.depth_mm || 0,
          depthInches: h.depth_mm ? h.depth_mm / 25.4 : depthIn,
          position: h.position,
          axis: h.axis,
          parent_face_id: h.face_id,
        }));
        setDetectedHoles(mapped);
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

  // Open one sub-service modal (closes all others first)
  const openSubModal = (kind, svc) => {
    setActiveTapHole(null);
    setActiveHwHole(null);
    setActiveCSHole(null);
    setIsAnodizingModalOpen(false);
    if (kind === 'tap') {
      setActiveTapHole(detectedHoles[0]);
    } else if (kind === 'hw') {
      setActiveHwHole(detectedHoles[0]);
    } else if (kind === 'cs') {
      setActiveCSHole(detectedHoles[0]);
    } else if (kind === 'finish') {
      if (svc) setActiveFinishSvcId(svc.id);
      setIsAnodizingModalOpen(true);
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
      setIsCalculatingPrice(true);
      try {
        const thicknessValueIn = pricingThicknessInches > 0 ? pricingThicknessInches.toFixed(6) : null;

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
        // Bounds mismatches are surfaced as card-level locks — swallow silently.
        const msg = String(err?.message || '');
        const isBoundsError = /exceeds max|is below min/i.test(msg);
        if (!isBoundsError) {
          console.error('Price calculation failed:', err);
        }
        setPriceEstimate(null);
      } finally {
        setIsCalculatingPrice(false);
      }
    };

    const timeoutId = setTimeout(getEstimate, 500); // Debounce
    return () => clearTimeout(timeoutId);
    // toast/isCNC are derived — including them triggers unnecessary recalcs on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMetal, selectedProductionService, selectedAdditionalServices, quoteAdditionalServices, selectedTaps, selectedHardware, selectedCountersinks, selectedFinishColors, displayDimensions, quantity, pricingThicknessInches, pricingTechnicalData]);

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
    }
    setIsImporting(false);
  }, []);

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

  const renderUnitToggle = (className = '') => (
    <div className={`ip-unit-toggle ${className}`.trim()} role="group" aria-label="Measurement unit">
      <button
        type="button"
        className={`ip-unit-btn ${unit === 'mm' ? 'active' : ''}`}
        aria-pressed={unit === 'mm'}
        onClick={() => setUnit('mm')}
      >
        MM
      </button>
      <button
        type="button"
        className={`ip-unit-btn ${unit === 'inch' ? 'active' : ''}`}
        aria-pressed={unit === 'inch'}
        onClick={() => setUnit('inch')}
      >
        IN
      </button>
    </div>
  );

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
    if (backendData?.__fileKey === unfoldFileKey && bendTree) return;

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
      const startResponse = await fetch(`${BACKEND_URL}/api/unfold-job/start`, {
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
        const statusResponse = await fetch(`${BACKEND_URL}/api/unfold-job/${encodeURIComponent(jobId)}?ts=${Date.now()}`, {
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
        const unfoldHoles = Array.isArray(d?.detectedHoles) ? d.detectedHoles : [];
        if (unfoldHoles.length > 0) {
          const mappedHoles = unfoldHoles.map((h, idx) => ({
            id: idx,
            diameterInches: h.diameter_in,
            diameter_mm: h.diameter_mm,
            depthMm: h.depth_mm || 0,
            depthInches: h.depth_mm ? h.depth_mm / 25.4 : unfoldDepthIn,
            position: h.position,
            axis: h.axis,
            parent_face_id: h.face_id,
          }));
          setDetectedHoles(mappedHoles);
          stepHolesDetectedRef.current = true;
          holeDetectionAttemptedRef.current = true;
        }

        // Cache-safe verification: if queued/cached unfold result says "no raised features",
        // run one direct unfold call (non job-cache path) before method gating.
        if (isStepFile(selectedFile.file.name) && !d?.nonFlatFeatures?.hasRaisedFeatures) {
          try {
            const verifyFd = new FormData();
            verifyFd.append('file', selectedFile.file);
            const verifyRes = await fetch(`${BACKEND_URL}/api/unfold`, {
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
        flatten(d.bendTree);
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
    // Trigger heavy unfold in background once per selected STEP file.
    handleUnfold(true);
  }, [selectedFile, currentIsStep, handleUnfold]);

  // ── Real Configured-Cut STEP Preview (debounced + abortable) ─────────────
  useEffect(() => {
    if (!configuredPreviewPayload) {
      if (configurePreviewAbortRef.current) configurePreviewAbortRef.current.abort();
      configurePreviewKeyRef.current = '';
      setConfiguredPreviewUrl(null);
      setConfiguredHardwareResizeReport({});
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

        const nextResizeReport =
          (data?.hardwareResizeReport && typeof data.hardwareResizeReport === 'object')
            ? data.hardwareResizeReport
            : {};
        setConfiguredHardwareResizeReport(nextResizeReport);

        configurePreviewKeyRef.current = key;
        if (!data.previewPath) {
          setConfiguredPreviewUrl(null);
          return;
        }

        const relativePath = String(data.previewPath).replace(/^\/+/, '');
        const apiRoutedPath = relativePath.startsWith('temp_uploads/')
          ? `api/${relativePath}`
          : relativePath;
        const resolved = BACKEND_URL ? `${BACKEND_URL}/${apiRoutedPath}` : `/${apiRoutedPath}`;
        setConfiguredPreviewUrl(resolved);
      } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error('Configured STEP preview error:', err);
        if (seq === configurePreviewSeqRef.current) {
          setConfiguredPreviewUrl(null);
          setConfiguredHardwareResizeReport({});
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
    if (!selectedFile || !currentIsStep || viewMode !== '3d') {
      setIsStepModelLoading(false);
      return;
    }
    setIsStepModelLoading(true);
    setStepModelProgress(0);
  }, [selectedFile, currentIsStep, viewMode, configuredPreviewUrl]);

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

  const showStepModelLoadingOverlay = currentIsStep && viewMode === '3d' && isStepModelLoading;
  const showGlobalViewerOverlay = isDetectingHoles || isCalculatingPrice || isGeneratingConfiguredPreview || showStepModelLoadingOverlay;
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
            <div className="ip-panel-layout">

              {/* ── LEFT PANEL: File List ── */}
              <div className="ip-left-panel">
                <button type="button" className="ip-back-mini" onClick={() => navigate(-1)}>
                  <ChevronLeft size={13} /> Back
                </button>
                <div className="ip-left-topline">
                  <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#94a3b8' }}>
                    Files <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: '4px', padding: '1px 5px', marginLeft: '4px' }}>{files.length}</span>
                  </span>
                  <button className="ip-clear-btn" onClick={() => { setFiles([]); setIsQuoteFlowActive(false); }}>Clear all</button>
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
                <input {...getInputProps()} />
                <button type="button" className="ip-add-btn" onClick={openFilePicker}>
                  <Plus size={13} /> Add more files
                </button>
              </div>

              {/* ── CENTER PANEL: 3D Viewer ── */}
              <div className="ip-center-panel">
                <div className="ip-toolbar">
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div className="ip-pill-toggle">
                      <button className={`ip-pill-btn ${viewMode === '3d' ? 'active' : ''}`} onClick={() => { setViewMode('3d'); if (activeAxis === 'flat') { setActiveAxis('top'); } }}>3D View</button>
                      <button className={`ip-pill-btn ${viewMode === '2d' ? 'active' : ''}`} onClick={() => { setViewMode('2d'); if (!currentUnfoldReady) handleUnfold(); setActiveAxis('flat'); }}>2D View</button>
                    </div>
                    <div className="ip-pill-toggle">
                      {['top', 'front', 'side', 'flat']
                        .filter(ax => (viewMode === '3d' && ax !== 'flat') || (viewMode === '2d' && ax === 'flat'))
                        .map(ax => (
                          <button key={ax} className={`ip-axis-btn ${activeAxis === ax ? 'active' : ''}`} onClick={() => { setActiveAxis(ax); }}>{ax}</button>
                        ))}
                    </div>
                  </div>
                  {renderUnitToggle()}
                </div>
                <div className="ip-viewer-frame qf-main-canvas">


                  {currentIsStep && viewMode === '3d' && (
                    <StepModelViewer
                      selectedFile={selectedFile}
                      modelUrlOverride={configuredPreviewUrl}
                      viewMode={viewMode}
                      activeAxis={activeAxis}
                      selectedThickness={selectedThickness}
                      selectedThicknessMm={selectedThicknessMM}
                      activeFinishColor={activeFinishColor}
                      isFinishPowderCoating={isFinishPowderCoating}
                      isModelFadedManually={isModelFadedManually}
                      detectedHoles={detectedHoles}
                      selectedTaps={selectedTaps}
                      activeTapHole={activeTapHole}
                      setActiveTapHole={setActiveTapHole}
                      selectedHardware={selectedHardware}
                      hardwareResizeReport={configuredHardwareResizeReport}
                      selectedCountersinks={selectedCountersinks}
                      showCountersinkMarkers={false}
                      countersinkMarkerStyle="camouflage"
                      isTappingActive={isTappingActive}
                      isCountersinkingActive={isCountersinkingActive}
                      isHardwareActive={isHardwareActive}
                      tapOptions={tapOptions}
                      csOptions={csOptions}
                      hwItemsByType={hwItemsByType}
                      allServices={allServices}
                      dimensions={displayDimensions || dimensions}
                      onDimensionsExtracted={setDimensions}
                      onProgress={handleStepViewerProgress}
                      onModelLoaded={handleStepViewerLoaded}
                    />
                  )}
                  {currentIsStep && viewMode === '2d' && (
                    currentUnfoldReady ? (
                      <FlatPatternViewer
                        backendData={currentBackendData}
                        holes={detectedHoles}
                      />
                    ) : (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 700, fontSize: 13 }}>
                        {isLoadingUnfold ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <Loader2 size={64} style={{ color: '#ef4444', animation: 'spin 1.25s linear infinite' }} />
                            <div style={{ marginTop: 10, fontSize: 20, fontWeight: 900, color: '#ef4444' }}>
                              {`${Math.max(0, Math.min(100, Math.round(unfoldProgress)))}%`}
                            </div>
                            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                              {unfoldStage || 'Generating 2D Flat Pattern...'}
                            </div>
                          </div>
                        ) : (
                          '2D flat pattern will appear here after analysis.'
                        )}
                      </div>
                    )
                  )}
                  {currentIsDxf && (
                    <DxfModelViewer
                      selectedFile={selectedFile}
                      viewMode={viewMode}
                      activeFinishColor={activeFinishColor}
                      isFinishPowderCoating={isFinishPowderCoating}
                      selectedThickness={selectedThickness}
                      onDimensionsExtracted={setDimensions}
                      onHolesDetected={setDetectedHoles}
                      onTechDataExtracted={setDxfTechData}
                      setIsImporting={setIsImporting}
                      setImportProgress={setImportProgress}
                    />
                  )}

                  {showGlobalViewerOverlay && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 size={80} style={{ color: '#ef4444', animation: 'spin 1.5s linear infinite' }} />
                      </div>
                      {globalOverlayPercent !== null && Number.isFinite(globalOverlayPercent) && (
                        <div style={{ fontSize: '20px', fontWeight: 900, color: '#ef4444', marginTop: '10px' }}>
                          {`${Math.max(0, Math.min(100, Math.round(globalOverlayPercent)))}%`}
                        </div>
                      )}
                      <div style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b', marginTop: '24px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        {globalOverlayTitle}
                      </div>
                    </div>
                  )}
                  {showHardwareFitLegend && (
                    <div className="ip-legend-card" style={{
                      background: '#1e293b',
                      padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>Hardware Fit</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#DC2626', boxShadow: '0 0 8px #dc262680' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Red hardware: hole reduced to fit</span>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.8)', lineHeight: 1.35 }}>
                        Red appears only when the original hole was larger than the required hardware bore.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT PANEL: Model Details ── */}
              <div className="ip-right-panel">
                <PricingSidebar
                  selectedFile={selectedFile}
                  dimensions={displayDimensions}
                  unit={unit}
                  measurementMetrics={measurementMetrics}
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
                  setIsAnodizingModalOpen={setIsAnodizingModalOpen}
                  setActiveFinishSvcId={setActiveFinishSvcId}
                  setActiveTapHole={setActiveTapHole}
                  setActiveHwHole={setActiveHwHole}
                  setActiveCSHole={setActiveCSHole}
                  handleProceedToReview={handleProceedToReview}
                  is2DFile={is2DFile}
                  isStepFile={isStepFile}
                  isQuoteFlowActive={isQuoteFlowActive}
                  setIsQuoteFlowActive={setIsQuoteFlowActive}
                />
              </div>
            </div>
          ) : (
            <div className="ip-panel-layout">
              <div className="ip-qf-left">
                <div className="ip-toolbar">
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div className="ip-pill-toggle">
                      <button className={`ip-pill-btn ${viewMode === '3d' ? 'active' : ''}`} onClick={() => setViewMode('3d')}>3D VIEW</button>
                      <button className={`ip-pill-btn ${viewMode === '2d' ? 'active' : ''}`} onClick={() => { setViewMode('2d'); if (!currentUnfoldReady) handleUnfold(); }}>2D FLAT</button>
                    </div>
                    <button className="ip-pill-btn" style={{ background: isModelFadedManually ? '#ef4444' : 'transparent', color: isModelFadedManually ? '#fff' : '#64748b', border: 'none' }} onClick={() => setIsModelFadedManually(!isModelFadedManually)}>FADE</button>
                    {isCountersinkingActive && isGeneratingConfiguredPreview && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6, padding: '3px 8px', fontSize: '10px', fontWeight: 700, color: '#92400e', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 11 }}>⚙</span> Generating countersink cuts
                      </div>
                    )}
                  </div>
                  <button className="ip-back-btn" onClick={() => setIsQuoteFlowActive(false)}>
                    <ChevronLeft size={13} /> BACK
                  </button>
                </div>
                <div className="ip-qf-viewer" style={{ position: 'relative' }}>


                  {currentIsStep && viewMode === '3d' ? (
                    <StepModelViewer
                      selectedFile={selectedFile}
                      modelUrlOverride={configuredPreviewUrl}
                      viewMode={viewMode}
                      activeAxis={activeAxis}
                      selectedThickness={selectedThickness}
                      selectedThicknessMm={selectedThicknessMM}
                      activeFinishColor={activeFinishColor}
                      isFinishPowderCoating={isFinishPowderCoating}
                      isModelFadedManually={isModelFadedManually}
                      detectedHoles={detectedHoles}
                      selectedTaps={selectedTaps}
                      isTappingActive={isTappingActive}
                      activeTapHole={activeTapHole}
                      setActiveTapHole={setActiveTapHole}
                      selectedHardware={selectedHardware}
                      hardwareResizeReport={configuredHardwareResizeReport}
                      isHardwareActive={isHardwareActive}
                      hwItemsByType={hwItemsByType}
                      selectedCountersinks={selectedCountersinks}
                      showCountersinkMarkers={false}
                      countersinkMarkerStyle="camouflage"
                      csOptions={csOptions}
                      isCountersinkingActive={isCountersinkingActive}
                      dimensions={displayDimensions || dimensions}
                      allServices={allServices}
                      backendData={currentUnfoldReady ? currentBackendData : null}
                      onProgress={handleStepViewerProgress}
                      onModelLoaded={handleStepViewerLoaded}
                    />
                  ) : null}
                  {currentIsStep && viewMode === '2d' && (
                    currentUnfoldReady ? (
                      <FlatPatternViewer
                        backendData={currentBackendData}
                        holes={detectedHoles}
                      />
                    ) : (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 700, fontSize: 13 }}>
                        {isLoadingUnfold ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <Loader2 size={64} style={{ color: '#ef4444', animation: 'spin 1.25s linear infinite' }} />
                            <div style={{ marginTop: 10, fontSize: 20, fontWeight: 900, color: '#ef4444' }}>
                              {`${Math.max(0, Math.min(100, Math.round(unfoldProgress)))}%`}
                            </div>
                            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                              {unfoldStage || 'Generating 2D Flat Pattern...'}
                            </div>
                          </div>
                        ) : (
                          '2D flat pattern will appear here after analysis.'
                        )}
                      </div>
                    )
                  )}
                  {currentIsDxf && (
                    <DxfModelViewer
                      selectedFile={selectedFile}
                      viewMode={viewMode}
                      activeFinishColor={activeFinishColor}
                      isFinishPowderCoating={isFinishPowderCoating}
                      selectedThickness={selectedThickness}
                      onDimensionsExtracted={setDimensions}
                      onHolesDetected={setDetectedHoles}
                      onTechDataExtracted={setDxfTechData}
                      setIsImporting={setIsImporting}
                      setImportProgress={setImportProgress}
                    />
                  )}

                  {showGlobalViewerOverlay && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}>
                      <Loader2 size={80} style={{ color: '#ef4444', animation: 'spin 1.5s linear infinite' }} />
                      {globalOverlayPercent !== null && Number.isFinite(globalOverlayPercent) && (
                        <div style={{ fontSize: '20px', fontWeight: 900, color: '#ef4444', marginTop: '10px' }}>
                          {`${Math.max(0, Math.min(100, Math.round(globalOverlayPercent)))}%`}
                        </div>
                      )}
                      <div style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b', marginTop: '24px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                        {globalOverlayTitle}
                      </div>
                    </div>
                  )}
                  {showHardwareFitLegend && (
                    <div className="ip-legend-card" style={{
                      background: '#1e293b',
                      padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.5)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>Hardware Fit</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#DC2626', boxShadow: '0 0 8px #dc262680' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Red hardware: hole reduced to fit</span>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.8)', lineHeight: 1.35 }}>
                        Red appears only when the original hole was larger than the required hardware bore.
                      </div>
                    </div>
                  )}
                </div>
                {displayDimensions && (
                  <div className="ip-qf-dims">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#94a3b8' }}>{unit === 'mm' ? 'Metric' : 'Imperial'} Dims</span>
                      {renderUnitToggle('compact')}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      {[
                        { label: 'L', key: 'l', color: '#3b82f6', bg: '#eff6ff' },
                        { label: 'W', key: 'w', color: '#22c55e', bg: '#f0fdf4' },
                        { label: 'T', key: 't', color: '#f97316', bg: '#fff7ed' },
                      ].map(item => (
                        <div key={item.key} style={{ background: item.bg, border: '1px solid #e8eaed', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                          <div style={{ fontSize: '14px', fontWeight: 900, color: item.color, fontFamily: 'monospace', lineHeight: 1.2 }}>{unit === 'mm' ? displayDimensions.mm[item.key] : displayDimensions.inches[item.key]}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
                      <div style={{ background: '#f8fafc', border: '1px solid #e8eaed', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Area</div>
                        <div style={{ fontSize: '13px', fontWeight: 900, color: '#1e293b', fontFamily: 'monospace', lineHeight: 1.2 }}>
                          {unit === 'mm' ? (measurementMetrics.areaMm2 / 100).toFixed(2) : (measurementMetrics.areaMm2 / (25.4 * 25.4)).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>{unit === 'mm' ? 'cm²' : 'in²'}</div>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #e8eaed', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Perimeter</div>
                        <div style={{ fontSize: '13px', fontWeight: 900, color: '#1e293b', fontFamily: 'monospace', lineHeight: 1.2 }}>
                          {unit === 'mm' ? measurementMetrics.perimeterMm.toFixed(2) : (measurementMetrics.perimeterMm / 25.4).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>{unit === 'mm' ? 'mm' : 'in'}</div>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #e8eaed', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pierces</div>
                        <div style={{ fontSize: '13px', fontWeight: 900, color: '#1e293b', fontFamily: 'monospace', lineHeight: 1.2 }}>{measurementMetrics.pierceCount}</div>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>count</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: '10px', color: '#64748b', fontWeight: 700 }}>
                      Size source: {dimensionSourceLabel} | Thickness source: {thicknessSourceLabel}
                    </div>
                  </div>
                )}
              </div>

              <div className="ip-qf-mid" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
                {/* ── wizard Selection Header ──────────────── */}
                <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {selectedProductionService && (
                    <div className="ip-step-summary">
                      <div className="label"><Zap size={10} /> METHOD</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="value">{selectedProductionService.title}</span>
                        <button className="change-btn" onClick={() => { setConfigStep(0); setSelectedCategory(null); setSelectedMetal(null); setSelectedThickness(null); }}>CHANGE</button>
                      </div>
                    </div>
                  )}
                  {selectedCategory && (
                    <div className="ip-step-summary">
                      <div className="label"><Grid size={10} /> CATEGORY</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="value">{selectedCategory.name}</span>
                        <button className="change-btn" onClick={() => { setConfigStep(1); setSelectedMetal(null); setSelectedThickness(null); }}>CHANGE</button>
                      </div>
                    </div>
                  )}
                  {selectedMetal && (
                    <div className="ip-step-summary">
                      <div className="label"><Box size={10} /> METAL</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="value">{selectedMetal.name}</span>
                        <button className="change-btn" onClick={() => { setConfigStep(2); setSelectedThickness(null); }}>CHANGE</button>
                      </div>
                    </div>
                  )}
                  {selectedThickness && (
                    <div className="ip-step-summary">
                      <div className="label"><Layers size={10} /> THICKNESS</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="value">{selectedThicknessDisplay || selectedThickness}</span>
                        <button className="change-btn" onClick={() => { setConfigStep(3); }}>CHANGE</button>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ padding: '24px 20px', flex: 1, overflowY: 'auto' }}>
                  {/* ── Wizard Progress Stepper ── */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22, overflowX: 'auto', paddingBottom: 4 }}>
                    {[
                      { label: 'Method', num: 0 },
                      { label: 'Category', num: 1 },
                      { label: 'Material', num: 2 },
                      { label: 'Thickness', num: 3 },
                      { label: 'Services', num: 4 },
                    ].map((s, i, arr) => {
                      const done = configStep > s.num;
                      const active = configStep === s.num;
                      return (
                        <React.Fragment key={s.num}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: done ? '#10b981' : active ? '#ef4444' : '#f1f5f9',
                              border: `2px solid ${done ? '#10b981' : active ? '#ef4444' : '#e2e8f0'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.25s',
                            }}>
                              {done
                                ? <Check size={13} color="#fff" strokeWidth={3} />
                                : <span style={{ fontSize: 11, fontWeight: 900, color: active ? '#fff' : '#94a3b8' }}>{s.num + 1}</span>
                              }
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', color: done ? '#10b981' : active ? '#ef4444' : '#94a3b8', whiteSpace: 'nowrap' }}>{s.label}</span>
                          </div>
                          {i < arr.length - 1 && (
                            <div style={{ flex: 1, height: 2, background: done ? '#10b981' : '#e2e8f0', margin: '0 6px', marginBottom: 20, transition: 'background 0.3s', borderRadius: 2 }} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {configStep === 0 && (
                    <div className="wizard-screen">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', margin: 0 }}>Select production method:</h2>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                          const isTooThick = dim && hasThickness && cfg.max_z && dT > cfg.max_z;
                          const isTooThin = dim && hasThickness && cfg.min_z && dT < cfg.min_z;
                          const maxSizeLabel = formatRulePairMm(cfg.max_x || 3048, cfg.max_y || 1524);
                          const minSizeLabel = formatRulePairMm(cfg.min_x || 6.3, cfg.min_y || 6.3);
                          const thicknessRangeLabel = formatRuleRangeMm(cfg.min_z || 0.5, cfg.max_z || 25.4);
                          const lockReasons = [];
                          if (isTooThick) lockReasons.push(`Part thickness ${dT.toFixed(3)} mm exceeds max ${parseFloat(cfg.max_z).toFixed(3)} mm.`);
                          if (isTooThin) lockReasons.push(`Part thickness ${dT.toFixed(3)} mm is below min ${parseFloat(cfg.min_z).toFixed(3)} mm.`);
                          if (isTooLarge) lockReasons.push(`Part size ${dL.toFixed(3)} × ${dW.toFixed(3)} mm exceeds process max ${parseFloat(cfg.max_x).toFixed(3)} × ${parseFloat(cfg.max_y).toFixed(3)} mm.`);
                          if (isTooSmall) lockReasons.push(`Part size ${dL.toFixed(3)} × ${dW.toFixed(3)} mm is below process minimum ${parseFloat(cfg.min_x).toFixed(3)} × ${parseFloat(cfg.min_y).toFixed(3)} mm.`);
                          if (processFlags.isLaser && isLaserBlockedByBends) {
                            lockReasons.push(`Detected ${bendCountTotal} bend(s). Laser cutting cannot produce formed bends.`);
                          }
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
                                setSelectedProductionService(svc);
                                setConfigStep(1);
                              }}
                            >
                              <div style={{ display: 'flex', gap: 18 }}>
                                <div className={`icon-box ${svc.title.toLowerCase().includes('cnc') ? 'blue' : 'red'}`}>
                                  {svc.title.toLowerCase().includes('cnc') ? <Box size={20} /> : <Zap size={20} />}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div className="ip-card-title-row">
                                    <div className="ip-card-title">{svc.title}</div>
                                    {isLocked && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fee2e2', borderRadius: 6, padding: '3px 9px', flexShrink: 0 }}>
                                        <AlertCircle size={11} color="#ef4444" />
                                        <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Not Compatible</span>
                                      </div>
                                    )}
                                    {!isLocked && isActive && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#dcfce7', borderRadius: 6, padding: '3px 9px', flexShrink: 0 }}>
                                        <Check size={11} color="#16a34a" strokeWidth={3} />
                                        <span style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase' }}>Selected</span>
                                      </div>
                                    )}
                                    {!isLocked && !isActive && processFlags.isCnc && (isLaserBlockedByBends || isLaserBlockedByNonFlatFeatures) && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#eff6ff', borderRadius: 6, padding: '3px 9px', flexShrink: 0 }}>
                                        <Check size={11} color="#2563eb" strokeWidth={3} />
                                        <span style={{ fontSize: 10, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>Recommended</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="ip-card-description" style={{ marginBottom: isLocked ? 8 : 14 }}>{svc.description || 'Precision production.'}</div>
                                  {isLocked && (
                                    <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      {lockReasons.map((reason, reasonIdx) => (
                                        <div key={reasonIdx} style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, background: '#fff5f5', padding: '6px 10px', borderRadius: 6, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <AlertTriangle size={12} color="#dc2626" />
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', margin: 0 }}>Select Category</h2>
                        <div className="ip-badge outline">{allCategories.length} CATEGORIES</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                                setSelectedCategory(cat);
                                setConfigStep(2);
                              }}
                            >
                              <div className="icon-disc"><Grid size={16} /></div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{cat.name}</div>
                                  {!isAvailable && <div className="ip-badge outline" style={{ fontSize: 9 }}>Not Available</div>}
                                </div>
                                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>{metalCount} {metalCount === 1 ? 'ITEM' : 'ITEMS'}</div>
                                {!isAvailable && (
                                  <div style={{ marginTop: 3, fontSize: 10, fontWeight: 700, color: '#dc2626' }}>
                                    Locked: no materials available in this category for the selected process.
                                  </div>
                                )}
                              </div>
                              {isAvailable && <ChevronRight size={18} color="#cbd5e1" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {configStep === 2 && (
                    <div className="wizard-screen">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', margin: 0 }}>Select Material</h2>
                        <div className="ip-badge outline">IN STOCK</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

                          const isTooThick = hasThickness && maxZmm && mT > maxZmm;
                          const isTooThin = hasThickness && minZmm && mT < minZmm;

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
                                setSelectedMetal(met);
                                setConfigStep(3);
                              }}
                            >
                              <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                                <div className="icon-box green"><Box size={20} /></div>
                                <div style={{ flex: 1 }}>
                                  <div className="ip-card-title-row">
                                    <div className="ip-card-title">{met.name}</div>
                                    {isLocked && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fee2e2', borderRadius: 5, padding: '2px 7px', flexShrink: 0 }}>
                                        <AlertCircle size={10} color="#ef4444" />
                                        <span style={{ fontSize: 9, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>Not Supported</span>
                                      </div>
                                    )}
                                  </div>
                                  {isLocked && (
                                    <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                      {lockReasons.map((reason, reasonIdx) => (
                                        <div key={reasonIdx} style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, background: '#fff5f5', padding: '4px 8px', borderRadius: 5, border: '1px solid #fecaca' }}>{reason}</div>
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
                                {!isLocked && <ChevronRight size={20} color="#94a3b8" style={{ flexShrink: 0, marginTop: 2 }} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {configStep === 3 && (
                    <div className="wizard-screen">
                      <div style={{ marginBottom: 20 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', margin: 0 }}>Select Thickness</h2>
                        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Choose the gauge for <strong>{selectedMetal?.name}</strong></p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                        {(selectedMetal?.quick_look?.thicknesses || []).map(t => {
                          const tMM = t.metric === 'mm' ? parseFloat(t.value) : parseFloat(t.value) * 25.4;
                          const modelTMM = resolvedModelThicknessMm;
                          const isMatch = modelTMM > 0 && Math.abs(tMM - modelTMM) < 0.15;
                          const isActive = selectedThickness === t.value;
                          return (
                            <div
                              key={t.value}
                              style={{
                                background: isActive ? '#fff5f5' : '#ffffff',
                                border: `1.5px solid ${isActive ? '#ef4444' : isMatch ? '#10b981' : '#e2e8f0'}`,
                                borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                                transition: 'all 0.15s', position: 'relative',
                                boxShadow: isActive ? '0 0 0 2px rgba(239,68,68,0.15)' : isMatch ? '0 0 0 2px rgba(16,185,129,0.12)' : 'none',
                              }}
                              onClick={() => { setSelectedThickness(t.value); setConfigStep(4); }}
                            >
                              {isMatch && (
                                <div style={{ position: 'absolute', top: 8, right: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 4, padding: '1px 5px', fontSize: 8, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                  ≈ Model
                                </div>
                              )}
                              <div style={{ fontSize: 22, fontWeight: 900, color: isActive ? '#ef4444' : '#1e293b', fontFamily: 'monospace', lineHeight: 1.1 }}>
                                {t.metric === 'mm' ? `${parseFloat(t.value).toFixed(3)}` : parseFloat(t.value).toFixed(3)}"
                              </div>
                              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginTop: 3 }}>
                                {t.metric === 'mm' ? `${(tMM / 25.4).toFixed(3)}"` : `${tMM.toFixed(3)} mm`}
                              </div>
                              {t.gauge && (
                                <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  {t.gauge}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {configStep === 4 && (
                    <div className="wizard-screen">
                      <div style={{ marginBottom: 20 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', margin: 0 }}>Additional Services</h2>
                        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Enhance your part with extra processes</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                            const displayServicePrice = kind === 'finish'
                              ? baseServicePrice + (selectedFinish ? selectedFinishUpcharge : minFinishUpcharge)
                              : baseServicePrice;
                            const shouldShowPriceBadge = !isUnsupported
                              && displayServicePrice > 0
                              && !(svcTitle.includes('powder') || svcTitle.includes('coat'));
                            const priceBadgeLabel = selectedFinish ? 'selected' : 'from';

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
                                      if (k === 'tap') { setSelectedTaps({}); setActiveTapHole(null); }
                                      else if (k === 'hw') { setSelectedHardware({}); setActiveHwHole(null); }
                                      else if (k === 'cs') { setSelectedCountersinks({}); setActiveCSHole(null); }
                                      else if (k === 'finish') {
                                        setSelectedFinishColors(prev => { const n = { ...prev }; delete n[svc.id]; return n; });
                                        setIsAnodizingModalOpen(false);
                                        setActiveFinishSvcId(null);
                                      }
                                    } else {
                                      setSelectedAdditionalServices(prev => [...prev, svc]);
                                      if (k && k !== 'bend') openSubModal(k, svc);
                                    }
                                  }}
                                >
                                  <div className="icon-disc">{svcIcon}</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{svc.title}</div>
                                      {isUnsupported && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fee2e2', borderRadius: 4, padding: '2px 7px', flexShrink: 0 }}>
                                          <AlertCircle size={9} color="#ef4444" />
                                          <span style={{ fontSize: 9, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                            {lockReason || 'Not Supported'}
                                          </span>
                                        </div>
                                      )}
                                      {shouldShowPriceBadge && (
                                        <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
                                          {priceBadgeLabel} ${displayServicePrice.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{svc.description || 'Professional finish.'}</div>
                                  </div>
                                  {!isUnsupported && !isBendService && (
                                    <div className={`selection-dot ${isActive ? 'active' : ''}`} style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${isActive ? '#ef4444' : '#e2e8f0'}`, background: isActive ? '#ef4444' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                                      {isActive && <Check size={10} color="#fff" strokeWidth={3} />}
                                    </div>
                                  )}
                                </div>
                                {isActive && kind && !isUnsupported && (
                                  <div style={{ marginTop: 6, marginBottom: 10, marginLeft: 12, marginRight: 12, padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                                      {(kind === 'tap' || kind === 'hw' || kind === 'cs') && (
                                        <>
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Detected</span>
                                            <span style={{ fontSize: 14, fontWeight: 900, color: '#1e293b' }}>{holeCount} hole{holeCount === 1 ? '' : 's'}</span>
                                          </div>
                                          <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Configured</span>
                                            <span style={{ fontSize: 14, fontWeight: 900, color: configuredCount > 0 ? '#059669' : '#94a3b8' }}>{configuredCount} / {totalForKind}</span>
                                          </div>
                                        </>
                                      )}
                                      {kind === 'bend' && (
                                        <>
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Bends</span>
                                            <span style={{ fontSize: 14, fontWeight: 900, color: '#1e293b' }}>{bendList?.length || 0} detected</span>
                                          </div>
                                          <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Price</span>
                                            <span style={{ fontSize: 14, fontWeight: 900, color: '#059669' }}>${bendDisplayPrice.toFixed(2)}</span>
                                          </div>
                                        </>
                                      )}
                                      {kind === 'finish' && (
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                          <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Color</span>
                                          <span style={{ fontSize: 14, fontWeight: 900, color: selectedFinishColors?.[svc.id] ? '#059669' : '#94a3b8' }}>{selectedFinishColors?.[svc.id]?.name || 'Not selected'}</span>
                                        </div>
                                      )}
                                    </div>
                                    {kind !== 'bend' && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); openSubModal(kind, svc); }}
                                        style={{ border: 'none', background: '#1e293b', color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
                                      >
                                        {kind === 'finish' ? 'Pick Color' : 'Configure'}
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

              <div className="ip-qf-right">
                {/* ── Volume Discounts: fixed tiers (2, 10, 50, 100, 1000) ── */}
                {(() => {
                  const ALLOWED_TIERS = [2, 5, 10, 50, 100, 1000];
                  const seen = new Set();
                  const tiers = (allDiscounts || [])
                    .filter(d => d.is_active !== false && parseFloat(d.discount_percent) > 0 && ALLOWED_TIERS.includes(Number(d.min_quantity)))
                    .filter(d => { if (seen.has(Number(d.min_quantity))) return false; seen.add(Number(d.min_quantity)); return true; })
                    .sort((a, b) => a.min_quantity - b.min_quantity);
                  if (tiers.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 22 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>Volume Discounts</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {tiers.map((d, i) => {
                          const reached = quantity >= d.min_quantity;
                          return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderRadius: 8, background: reached ? '#fff5f5' : '#ffffff', border: `1.5px solid ${reached ? '#fecaca' : '#e8eaed'}` }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{d.min_quantity}+ UNITS</span>
                              <span style={{ fontSize: 13, fontWeight: 900, color: '#ef4444' }}>{parseFloat(d.discount_percent).toFixed(2)}% OFF</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* ── Configuration Progress (before metal selected) ── */}
                {!selectedMetal ? (
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1e293b', margin: '0 0 4px' }}>Quote Summary</h2>
                    <p style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 28 }}>Configuration Progress</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {[
                        { label: 'Production Method', value: selectedProductionService?.title, step: 0 },
                        { label: 'Category', value: selectedCategory?.name, step: 1 },
                        { label: 'Material', value: selectedMetal?.name, step: 2 },
                        { label: 'Thickness', value: selectedThickness ? (selectedThicknessDisplay || String(selectedThickness)) : null, step: 3 },
                        { label: 'Additional Services', value: configStep >= 4 ? `${selectedAdditionalServices.length} selected` : null, step: 4 },
                      ].map((item, i, arr) => {
                        const active = configStep === item.step;
                        const displayValue = item.step === 0 && selectedProductionService?.title ? selectedProductionService.title
                          : item.step === 1 && selectedCategory?.name ? selectedCategory.name
                            : item.step === 2 && selectedMetal?.name ? selectedMetal.name
                              : item.step === 3 && selectedThickness ? (selectedThicknessDisplay || String(selectedThickness))
                                : item.step === 4 && configStep >= 4 ? `${selectedAdditionalServices.length} selected`
                                  : null;
                        return (
                          <div key={i} style={{ display: 'flex', gap: 14, position: 'relative', paddingBottom: i < arr.length - 1 ? 20 : 0 }}>
                            {i < arr.length - 1 && (
                              <div style={{ position: 'absolute', left: 9, top: 24, width: 2, height: 'calc(100% - 4px)', background: displayValue ? '#10b981' : '#e2e8f0', transition: 'background 0.3s' }} />
                            )}
                            <div style={{ width: 20, height: 20, borderRadius: '50%', background: displayValue ? '#10b981' : active ? '#ef4444' : 'transparent', border: `2px solid ${displayValue ? '#10b981' : active ? '#ef4444' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1, transition: 'all 0.25s' }}>
                              {displayValue && <Check size={10} color="#fff" strokeWidth={3} />}
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: displayValue ? '#1e293b' : '#94a3b8' }}>{item.label}</div>
                              <div style={{ fontSize: 12, color: displayValue ? '#10b981' : '#cbd5e1', fontWeight: displayValue ? 700 : 500, marginTop: 1 }}>{displayValue || 'Pending Selection'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* ── Full Quote Panel (after metal selected) ── */
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* ORDER QUANTITY */}
                    <div style={{ marginBottom: 22 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>Order Quantity</div>
                      <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                        <button
                          onClick={() => setQuantity(q => Math.max(1, q - 1))}
                          style={{ width: 44, height: 44, background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s' }}
                          onMouseEnter={e => e.target.style.background = '#f8fafc'}
                          onMouseLeave={e => e.target.style.background = 'transparent'}
                        >−</button>
                        <div style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 900, color: '#1e293b', fontFamily: 'monospace' }}>{quantity}</div>
                        <button
                          onClick={() => setQuantity(q => q + 1)}
                          style={{ width: 44, height: 44, background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s' }}
                          onMouseEnter={e => e.target.style.background = '#f8fafc'}
                          onMouseLeave={e => e.target.style.background = 'transparent'}
                        >+</button>
                      </div>
                    </div>

                    {/* PROJECT BREAKDOWN */}
                    <div style={{ flex: 1 }} />
                    <div style={{ background: '#1a1a2e', borderRadius: 16, padding: '22px 20px', color: '#fff', marginTop: 'auto' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#64748b', marginBottom: 18 }}>Project Breakdown</div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Material Cost</div>
                          {isCalculatingPrice && <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>Analysing part geometry...</div>}
                        </div>
                        {isCalculatingPrice
                          ? <div className="skeleton-price" style={{ width: 56, height: 18, borderRadius: 4 }} />
                          : <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>${(((priceEstimate?.breakdown?.material_cost ?? 0) * quantity) || 0).toFixed(2)}</span>
                        }
                      </div>

                      {(() => {
                        const rows = priceEstimate?.breakdown?.service_breakdown || [];
                        if (rows.length === 0) return null;
                        return (
                          <div style={{ paddingBottom: 12 }}>
                            {rows.map((r, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>{r.name}</div>
                                </div>
                                {isCalculatingPrice
                                  ? <div className="skeleton-price" style={{ width: 48, height: 14, borderRadius: 4 }} />
                                  : <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>${(((parseFloat(r.price) || 0) * quantity) || 0).toFixed(2)}</span>
                                }
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {(() => {
                        const warnings = Array.from(new Set([
                          ...(priceEstimate?.breakdown?.warnings || []),
                          ...(bendSupportStatus.warning && bendCountTotal > 0 ? [bendSupportStatus.warning] : [])
                        ]));
                        if (warnings.length === 0) return null;
                        return (
                          <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.35)', borderRadius: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: '#fdba74', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Quote Warnings</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {warnings.map((warning, index) => (
                                <div key={`${warning}-${index}`} style={{ fontSize: 11, fontWeight: 700, color: '#fed7aa', lineHeight: 1.5 }}>
                                  {warning}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 4 }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                          Gross Total
                        </span>
                        {isCalculatingPrice
                          ? <div className="skeleton-price" style={{ width: 78, height: 16, borderRadius: 4 }} />
                          : <span style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>
                            ${(parseFloat(priceEstimate?.breakdown?.subtotal_before_discount || 0)).toFixed(2)}
                          </span>
                        }
                      </div>

                      {priceEstimate?.breakdown?.discount_percent > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '9px 12px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.28)', borderRadius: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#a7f3d0', textTransform: 'uppercase' }}>
                            Discount Applied ({parseFloat(priceEstimate?.breakdown?.discount_percent || 0).toFixed(2)}%)
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 900, color: '#d1fae5' }}>
                            -${(parseFloat(priceEstimate?.breakdown?.discount_amount || 0)).toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div style={{ marginTop: 16, marginBottom: 18 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Discounted Total</div>
                        {isCalculatingPrice
                          ? <div className="skeleton-price" style={{ width: 130, height: 32, borderRadius: 6 }} />
                          : <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>
                            $ {(parseFloat(priceEstimate?.total_price) || 0).toFixed(2)}
                          </div>
                        }
                      </div>

                      <button
                        className="ip-proceed-btn"
                        style={{ background: '#ef4444', marginTop: 0 }}
                        onClick={handleProceedToReview}
                        disabled={!priceEstimate}
                      >
                        PROCEED TO REVIEW <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )
      }

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
                    const groupDia = parseFloat(group.dia);
                    const compatibleForGroup = tapOptions.filter(tap =>
                      groupDia >= ((parseFloat(tap.min_diameter) || 0) - TAP_RANGE_TOLERANCE) &&
                      groupDia <= ((parseFloat(tap.max_diameter) || 0) + TAP_RANGE_TOLERANCE)
                    );
                    const isCompatible = compatibleForGroup.length > 0;
                    const bestTap = compatibleForGroup[0];

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
                            {group.holes.length > 1 && (() => {
                              const sourceTap = selectedTaps[activeTapHole?.id];
                              const theTap = sourceTap || bestTap;
                              if (!theTap) return null;

                              return (
                                <button
                                  className="btn btn-sm w-100 mb-2 rounded-3 fw-bold border-danger text-danger bg-white"
                                  style={{ fontSize: '12px' }}
                                  onClick={e => {
                                    e.stopPropagation();
                                    setSelectedTaps(prev => {
                                      const next = { ...prev };
                                      group.holes.forEach(h => { next[h.id] = { ...theTap, hole: h }; });
                                      return next;
                                    });
                                  }}
                                >
                                  Tap all {group.holes.length} &rarr; {theTap.name}
                                </button>
                              );
                            })()}
                            {/* Individual holes */}
                            {group.holes.map(hole => {
                              const isTapped = !!selectedTaps[hole.id];
                              const isActive = activeTapHole?.id === hole.id;
                              const globalIdx = holeIndexById[hole.id] || 0;
                              return (
                                <div
                                  key={hole.id}
                                  className={`p-3 rounded-4 mb-1 cursor-pointer border-2 d-flex align-items-center justify-content-between ${isActive ? 'border-danger bg-danger text-white shadow-sm' : 'border-transparent bg-light hover-bg-white shadow-xs'}`}
                                  onClick={() => setActiveTapHole(hole)}
                                >
                                  <div className="d-flex align-items-center gap-2">
                                    <div
                                      className={`rounded-circle d-flex align-items-center justify-content-center fw-black ${isActive ? 'bg-white text-danger' : isTapped ? 'bg-success text-white' : 'bg-white text-muted border'}`}
                                      style={{ width: '26px', height: '26px', fontSize: '12px' }}
                                    >
                                      {globalIdx}
                                    </div>
                                    <span className={`fw-bold ${isActive ? 'text-white' : 'text-dark'}`} style={{ fontSize: '13px' }}>
                                      {isTapped ? selectedTaps[hole.id].name : 'Not Tapped'}
                                    </span>
                                  </div>
                                  {isTapped && !isActive && <Check size={13} className="text-success" strokeWidth={3} />}
                                </div>
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
                    const options = tapOptions;
                    const compatible = options.filter(tap =>
                      dia >= ((parseFloat(tap.min_diameter) || 0) - TAP_RANGE_TOLERANCE) &&
                      dia <= ((parseFloat(tap.max_diameter) || 0) + TAP_RANGE_TOLERANCE)
                    );
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
                                      {isCalculatingPrice && (
                                        <p className="ip-qf-subtitle" style={{ fontSize: '0.9rem', color: '#64748b', margin: '4px 0 0 0' }}>
                                          Analysing part geometry...
                                        </p>
                                      )}
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
          const activeType = hwTypeById[activeHwType] || HW_TYPES[0];
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

                    {holeGroupsWithHwState.map((group) => {
                      const isExpanded = expandedHwGroups.has(group.dia);
                      const assignedCount = group.assignedCount;
                      const allAssigned = group.allAssigned;

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
                              {group.holes.length > 1 && (() => {
                                const sourceHw = selectedHardware[activeHwHole?.id];
                                const theItem = sourceHw?.item || activeItems[0];
                                if (!theItem) return null;

                                return (
                                  <button
                                    style={{ width: '100%', padding: '6px 10px', borderRadius: 8, fontSize: '10px', fontWeight: 700, background: 'transparent', border: `1px dashed ${activeType.color}60`, color: activeType.color, cursor: 'pointer', marginBottom: 4, transition: 'all 0.15s' }}
                                    onClick={e => {
                                      e.stopPropagation();
                                      const maxAllowedIn = theItem?.max_hole_diameter ? parseFloat(theItem.max_hole_diameter) : Infinity;
                                      setSelectedHardware(prev => {
                                        const next = { ...prev };
                                        group.holes.forEach(h => {
                                          const hDiaIn = parseFloat(h.diameterInches || h.diameter_in || 0);
                                          if (hDiaIn > maxAllowedIn) return;
                                          next[h.id] = {
                                            item: theItem,
                                            hole: h,
                                            typeId: sourceHw?.typeId || activeHwType,
                                            face: sourceHw?.face || 'up'
                                          };
                                        });
                                        return next;
                                      });
                                    }}
                                  >
                                    Apply all &rarr; {theItem.name}
                                  </button>
                                );
                              })()}
                              {group.holes.map(hole => {
                                const assigned = selectedHardware[hole.id];
                                const isActive = activeHwHole?.id === hole.id;
                                return (
                                  <div
                                    key={hole.id}
                                    onClick={() => setActiveHwHole(hole)}
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
                                        {holeIndexById[hole.id] || 0}
                                      </div>
                                      <div>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: isActive ? activeType.color : '#1e293b', display: 'block', lineHeight: 1.2 }}>
                                          {assigned ? assigned.item.name : 'Unassigned'}
                                        </span>
                                        {assigned && (
                                          <span style={{ fontSize: '9px', fontWeight: 700, color: hwTypeById[assigned.typeId]?.color || '#94a3b8' }}>
                                            {hwTypeById[assigned.typeId]?.label}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {assigned && !isActive && <Check size={11} style={{ color: '#22c55e' }} strokeWidth={3} />}
                                  </div>
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
                    {csHoleGroups.map(group => {
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
                              {group.holes.length > 1 && (() => {
                                const sourceCS = selectedCountersinks[activeCSHole?.id];
                                const theCS = sourceCS || csOptions[0];
                                if (!theCS) return null;

                                return (
                                  <button
                                    style={{ width: '100%', padding: '6px 10px', borderRadius: 8, fontSize: '10px', fontWeight: 700, background: 'transparent', border: `1px dashed #7c3aed60`, color: '#7c3aed', cursor: 'pointer', marginBottom: 6, transition: 'all 0.15s' }}
                                    onClick={e => {
                                      e.stopPropagation();
                                      setSelectedCountersinks(prev => {
                                        const next = { ...prev };
                                        group.holes.forEach(h => {
                                          next[h.id] = {
                                            ...theCS,
                                            hole: h,
                                            face: sourceCS?.face || 'up'
                                          };
                                        });
                                        return next;
                                      });
                                    }}
                                  >
                                    Apply all &rarr; {theCS.name}
                                  </button>
                                );
                              })()}
                              {group.holes.map(hole => {
                                const isCS = !!selectedCountersinks[hole.id];
                                const isActive = activeCSHole?.id === hole.id;
                                const globalIdx = holeIndexById[hole.id] || 0;
                                return (
                                  <div key={hole.id}
                                    style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isActive ? '#7c3aed' : '#f8fafc', color: isActive ? '#fff' : '#1e293b', border: isActive ? '1.5px solid #7c3aed' : '1.5px solid transparent', transition: 'all 0.15s' }}
                                    onClick={() => setActiveCSHole(hole)}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: isActive ? '#fff' : isCS ? '#7c3aed' : '#e2e8f0', color: isActive ? '#7c3aed' : isCS ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>{globalIdx}</div>
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
                            <motion.button key={i} className={`group btn border-0 p-3 rounded-5 d-flex flex-column align-items-center gap-4 transition-all bg-transparent`} onClick={() => { setSelectedFinishColors(p => ({ ...p, [svc.id]: { ...opt, index: i } })); setIsAnodizingModalOpen(false); }} whileHover={{ y: -10 }}>
                              <div className="position-relative">
                                <div className={`rounded-circle shadow-2xl transition-all ${isActive ? 'scale-110' : 'group-hover-scale-105'}`} style={{ ...wrinkleSwatchStyle(opt.color, !!opt.is_wrinkled, 18), width: '100px', height: '100px', border: isActive ? '6px solid #ef4444' : '6px solid white', boxShadow: isActive ? '0 20px 40px -10px rgba(239, 68, 68, 0.4)' : '0 15px 30px -10px rgba(0,0,0,0.1)' }} />
                                {isActive && <div className="position-absolute top-0 end-0 bg-danger text-white rounded-circle p-2 shadow-lg" style={{ transform: 'translate(30%, -30%)' }}><Check size={16} strokeWidth={4} /></div>}
                              </div>
                              <div className="text-center">
                                <span className={`d-block fs-6 fw-black transition-all ${isActive ? 'text-danger' : 'text-dark group-hover-text-dark opacity-80'}`}>{(opt.name || '').toUpperCase()}</span>
                                <span className="small text-muted fw-bold opacity-50 letter-spacing-1 font-monospace mt-1 d-block">{(opt.color || '').toUpperCase()}</span>
                                {opt.is_wrinkled && (
                                  <span className="d-inline-block mt-2 fw-bold" style={{ fontSize: '0.6rem', letterSpacing: '0.14em', padding: '3px 10px', borderRadius: '999px', background: '#1e293b', color: '#f8fafc', textTransform: 'uppercase' }}>Wrinkle Finish</span>
                                )}
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

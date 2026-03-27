import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Info, ArrowRight, FileCode, Layers, Grid3x3, Box, Square, Monitor, Maximize2, Ruler, Boxes, Wrench, Scissors, ChevronLeft, AlertCircle } from 'lucide-react';
import * as OV from 'online-3d-viewer';
import { parseString, toSVG } from 'dxf';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import FlatPatternViewer from '../components/viewer/FlatPatternViewer';
import { fetchPricingSheetMetals, fetchPricingCncMetals, fetchCncPricingConfig, fetchMetalServices } from '../utils/api';

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

  // ── Quoting flow state ────────────────────────────────
  const [selectedService, setSelectedService] = useState(null); // 'cnc_machining' | 'sheet_cutting'
  const [sheetMetals, setSheetMetals] = useState([]);
  const [selectedMetal, setSelectedMetal] = useState(null);
  const [selectedThickness, setSelectedThickness] = useState(null);
  const [metalServices, setMetalServices] = useState(null); // { metalLevel, thicknessLevel }
  const [cncMetals, setCncMetals] = useState([]);
  const [cncConfig, setCncConfig] = useState(null);
  const [loadingMetals, setLoadingMetals] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const modelBaseThicknessRef = useRef(null);

  const stepViewerRef = useRef(null);
  const dxfViewerRef = useRef(null);
  const viewerInstance = useRef(null);
  const dxfViewerInstance = useRef(null);
  const dimensionsRef = useRef(null);
  const modelRef = useRef(null);
  const gridHelperRef = useRef(null);
  const pendingAxisRef = useRef(null);

  const navigate = useNavigate();

  // ── Check backend availability on mount ───────────────
  useEffect(() => {
    fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(300000) })
      .catch(() => { /* Backend is handled per-request */ });
  }, []);

  // ── Reset quoting flow when file changes ──────────────
  useEffect(() => {
    if (isQuoteFlowActive) {
      setViewMode('3d');
    }
  }, [isQuoteFlowActive]);

  useEffect(() => {
    setIsQuoteFlowActive(false);
    setSelectedService(null);
    setSelectedMetal(null);
    setSelectedThickness(null);
    setMetalServices(null);
    modelBaseThicknessRef.current = null;
  }, [selectedFile]);

  // ── Fetch CNC metals + config on mount ───────────────────
  useEffect(() => {
    fetchPricingCncMetals()
      .then(data => setCncMetals(data || []))
      .catch(() => setCncMetals([]));
    fetchCncPricingConfig()
      .then(data => setCncConfig(data || null))
      .catch(() => setCncConfig(null));
  }, []);

  // ── Fetch sheet metals when Sheet Cutting selected ────
  useEffect(() => {
    if (selectedService !== 'sheet_cutting') return;
    setLoadingMetals(true);
    fetchPricingSheetMetals()
      .then(data => setSheetMetals(data || []))
      .catch(() => setSheetMetals([]))
      .finally(() => setLoadingMetals(false));
  }, [selectedService]);

  // ── Fetch services when thickness selected ────────────
  useEffect(() => {
    if (!selectedThickness || !selectedMetal) return;
    setLoadingServices(true);
    fetchMetalServices(selectedMetal.slug)
      .then(data => setMetalServices(data || null))
      .catch(() => setMetalServices(null))
      .finally(() => setLoadingServices(false));
  }, [selectedThickness, selectedMetal]);

  // ── Apply Z-scale to 3D viewer when thickness changes ─
  useEffect(() => {
    if (!selectedThickness || !dimensions) return;
    const baseThickness = parseFloat(dimensions.mm.thickness);
    if (!baseThickness || baseThickness === 0) return;

    // Store original base on first selection
    if (!modelBaseThicknessRef.current) {
      modelBaseThicknessRef.current = baseThickness;
    }

    const scaleFactor = selectedThickness / modelBaseThicknessRef.current;

    const v = viewerInstance.current?.GetViewer?.();
    if (v?.scene) {
      v.scene.traverse((child) => {
        if (child.isMesh) {
          child.scale.z = scaleFactor;
        }
      });
      try { v.Render(); } catch { /* silent */ }
    }
  }, [selectedThickness, dimensions]);

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
        const x = bb.max.x - bb.min.x, y = bb.max.y - bb.min.y, z = bb.max.z - bb.min.z;
        // Sort so smallest axis = thickness, largest = width, middle = height
        const sorted = [x, y, z].sort((a, b) => a - b);
        const thicknessMm = sorted[0], heightMm = sorted[1], widthMm = sorted[2];
        let vol = 0; try { vol = OV.CalculateVolume(model); } catch (error) { console.warn("Error calculating model volume:", error); }
        dimensionsRef.current = {
          is2D: false,
          mm: { width: widthMm.toFixed(2), height: heightMm.toFixed(2), thickness: thicknessMm.toFixed(2), volume: (vol / 1000).toFixed(2) },
          inches: { width: (widthMm / 25.4).toFixed(3), height: (heightMm / 25.4).toFixed(3), thickness: (thicknessMm / 25.4).toFixed(3), volume: (vol / 16387.064).toFixed(3) }
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

          // Apply any pending axis camera requested while viewer was rebuilding
          if (pendingAxisRef.current) {
            const axis = pendingAxisRef.current;
            pendingAxisRef.current = null;
            setTimeout(() => setAxisCamera(axis), 100);
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
      gridHelperRef.current = null;
      try { localViewer?.Destroy(); } catch (error) { console.warn("Error destroying local viewer:", error); }
      if (viewerInstance.current === localViewer) viewerInstance.current = null;
    };
  }, [selectedFile, viewMode, dxfSvg, isQuoteFlowActive]);

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
      setViewMode('2d');
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
        setViewMode('2d');
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
      v.SetProjectionMode(OV.ProjectionMode.Orthographic);
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

  const toggleMesh = useCallback(() => {
    setShowMesh(prev => {
      const next = !prev;
      const v = viewerInstance.current?.GetViewer?.();
      if (v?.scene) {
        if (next) {
          if (!gridHelperRef.current) {
            const dims = dimensionsRef.current;
            const size = dims
              ? Math.max(parseFloat(dims.mm.width), parseFloat(dims.mm.height), parseFloat(dims.mm.thickness)) * 4
              : 2000;
            const grid = new THREE.GridHelper(Math.max(size, 200), 30, 0xaaaaaa, 0xcccccc);
            gridHelperRef.current = grid;
            v.scene.add(grid);
          } else {
            gridHelperRef.current.visible = true;
          }
        } else {
          if (gridHelperRef.current) {
            gridHelperRef.current.visible = false;
          }
        }
        try { v.Render(); } catch { /* silent */ }
      }
      return next;
    });
  }, []);

  const toggleView = (mode) => {
    setViewMode(mode);
    if (!isStepFile(selectedFile?.file?.name ?? '')) return;
    if (mode === '2d') {
      setActiveAxis('flat');
      handleUnfold();
    }
    // For '3d': the STEP viewer effect recreates the OV viewer with default perspective
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

  // CNC size check — true when model dimensions are outside the configured limits
  const cncOutOfBounds = (() => {
    if (!dimensions || !cncConfig || !cncMetals.length) return false;
    const modelDims = [parseFloat(dimensions.mm.width), parseFloat(dimensions.mm.height), parseFloat(dimensions.mm.thickness)].sort((a, b) => b - a);
    const configMaxs = [parseFloat(cncConfig.max_x), parseFloat(cncConfig.max_y), parseFloat(cncConfig.max_z)].sort((a, b) => b - a);
    const configMins = [parseFloat(cncConfig.min_x), parseFloat(cncConfig.min_y), parseFloat(cncConfig.min_z)].sort((a, b) => a - b);
    return modelDims.some((d, i) => d > configMaxs[i] || d < configMins[i]);
  })();

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

          {!isQuoteFlowActive && (
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
          )}

          {isQuoteFlowActive ? (
            <div className="quote-flow-step-container">
              <div className="qf-top-nav">
                <button className="qf-nav-btn" onClick={() => { setIsQuoteFlowActive(false); setSelectedService(null); setSelectedMetal(null); setSelectedThickness(null); }} title="Close Quote Flow"><X size={20} /></button>
                <div className="qf-nav-right">
                  <button className="qf-nav-btn" onClick={() => setAxisCamera('top')} title="Reset View"><Box size={20} /></button>
                  <button className="qf-nav-btn" onClick={() => {
                    if (selectedThickness) setSelectedThickness(null);
                    else if (selectedMetal) setSelectedMetal(null);
                    else if (selectedService) setSelectedService(null);
                    else setIsQuoteFlowActive(false);
                  }} title="Go Back"><ChevronLeft size={24} /></button>
                </div>
              </div>

              <div className="qf-split-content">
                <div className="qf-left-side">
                  <div className="qf-model-box">
                    <div className="qf-viewer-wrapper">
                      {viewMode === '3d' && isStepFile(selectedFile.file.name) && (
                        <div ref={stepViewerRef} style={{ width: '100%', height: '100%' }} />
                      )}
                      {viewMode === '2d' && isStepFile(selectedFile.file.name) && (
                        backendData ? (
                          <FlatPatternViewer
                            geometries={[]}
                            options={{}}
                            backendData={backendData}
                            sourceFlatData={null}
                            formatKind="drawing"
                          />
                        ) : (
                          <div className="qf-loading-viewer">Preparing flat model...</div>
                        )
                      )}
                      {is2DFile(selectedFile.file.name) && (
                        <div className="dxf-svg-wrapper">
                          {dxfSvg ? <div className="dxf-svg-content" dangerouslySetInnerHTML={{ __html: dxfSvg }} /> : <div>Parsing...</div>}
                        </div>
                      )}
                    </div>
                    <div className="qf-view-toggles-simple">
                      <button className={viewMode === '3d' ? 'active' : ''} onClick={() => setViewMode('3d')}>3D</button>
                      <button className={viewMode === '2d' ? 'active' : ''} onClick={() => { setViewMode('2d'); handleUnfold(); }}>2D (Flat)</button>
                    </div>
                  </div>

                  <div className="qf-controls-simple">
                    <div className="qf-unit-switch-simple">
                      <button className={unit === 'mm' ? 'active' : ''} onClick={() => setUnit('mm')}>MM</button>
                      <button className={unit === 'inch' ? 'active' : ''} onClick={() => setUnit('inch')}>INCH</button>
                    </div>
                  </div>

                  {dimensions && (
                    <div className="qf-dimensions-simple">
                      <h4>{unit === 'mm' ? 'Metric (mm)' : 'Imperial (inches)'}</h4>
                      <div className="qf-dim-grid">
                        <div className="dim-row"><span>Width:</span> <strong>{unit === 'mm' ? dimensions.mm.width : dimensions.inches.width} {unit}</strong></div>
                        <div className="dim-row"><span>Height:</span> <strong>{unit === 'mm' ? dimensions.mm.height : dimensions.inches.height} {unit}</strong></div>
                        <div className="dim-row"><span>Thickness:</span> <strong>{unit === 'mm' ? (selectedThickness || dimensions.mm.thickness) : (selectedThickness ? (selectedThickness / 25.4).toFixed(3) : dimensions.inches.thickness)} {unit}</strong></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="qf-right-side">
                  <div className="qf-selection-panel">
                    {!selectedService && (
                      <>
                        <h2>Select production method:</h2>
                        <p>Please tell us which service you were intending to use with your file.</p>
                        <div className="qf-large-buttons">
                          <button
                            className={`qf-large-service-card${cncOutOfBounds ? ' disabled' : ''}`}
                            onClick={() => !cncOutOfBounds && setSelectedService('cnc_machining')}
                            disabled={cncOutOfBounds}
                          >
                            <div className="qf-card-main">
                              <strong>CNC Machining</strong>
                              <span>Precision milled parts</span>
                            </div>
                            {cncOutOfBounds ? (
                              <div className="qf-card-status error">
                                <span>Exceeds Size Limits</span> <AlertCircle size={16} />
                              </div>
                            ) : cncMetals.length > 0 ? (
                              <div className="qf-card-status price">
                                <span>Select Material</span> <ArrowRight size={16} />
                              </div>
                            ) : (
                              <div className="qf-card-status error">
                                <span>Coming Soon</span> <AlertCircle size={16} />
                              </div>
                            )}
                          </button>
                          <button className="qf-large-service-card" onClick={() => setSelectedService('sheet_cutting')}>
                            <div className="qf-card-main">
                              <strong>Sheet Cutting</strong>
                              <span>Laser / plasma cut sheets</span>
                            </div>
                            <div className="qf-card-status price">
                              <span>Select Material</span> <ArrowRight size={16} />
                            </div>
                          </button>
                        </div>
                      </>
                    )}

                    {selectedService === 'cnc_machining' && (
                      <div className="qf-step-content">
                        <h2>CNC Machining</h2>
                        {cncMetals.length > 0 ? (
                          <>
                            <p style={{ color: '#6b7280', marginBottom: '16px' }}>Select material</p>
                            <div className="qf-metal-grid">
                              {cncMetals.map(metal => (
                                <button key={metal.id} className="qf-metal-card" onClick={() => navigate('/quote')}>
                                  {metal.image_path && <img src={metal.image_path} alt={metal.name} className="qf-metal-img" />}
                                  <span className="qf-metal-name">{metal.name}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="qf-coming-soon">
                              <AlertCircle size={32} />
                              <p>CNC Machining pricing coming soon. You can still request a manual quote.</p>
                            </div>
                            <button className="btn-get-quote" style={{ marginTop: '30px', width: '100%' }} onClick={() => navigate('/quote')}>
                              REQUEST MANUAL QUOTE <ArrowRight size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {selectedService === 'sheet_cutting' && (
                      <div className="qf-step-content">
                        {!selectedMetal && (
                          <>
                            <h2>Select Material</h2>
                            <p>Choose the material for your sheet cutting project.</p>
                            {loadingMetals ? (
                              <div className="qf-loading"><div className="qf-spinner" /></div>
                            ) : (
                              <div className="qf-metal-grid">
                                {sheetMetals.map(metal => (
                                  <button key={metal.id} className="qf-metal-card" onClick={() => setSelectedMetal(metal)}>
                                    {metal.image_path && <img src={metal.image_path} alt={metal.name} className="qf-metal-img" />}
                                    <span className="qf-metal-name">{metal.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {selectedMetal && !selectedThickness && (
                          <>
                            <h2>{selectedMetal.name}</h2>
                            <p>Select the desired thickness for your parts.</p>
                            <div className="qf-thickness-chips">
                              {selectedMetal.available_thicknesses?.map(t => (
                                <button key={t} className="qf-thickness-chip" onClick={() => setSelectedThickness(t)}>{t} mm</button>
                              ))}
                            </div>
                          </>
                        )}

                        {selectedMetal && selectedThickness && (
                          <>
                            <h2>Summary & Services</h2>
                            <div className="qf-selected-summary">
                              <div className="qf-summary-pill material">{selectedMetal.name}</div>
                              <div className="qf-summary-pill thickness">{selectedThickness} mm</div>
                            </div>
                            {loadingServices ? (
                              <div className="qf-loading">Loading services...</div>
                            ) : (
                              <div className="qf-services" style={{ marginTop: '20px' }}>
                                {metalServices?.metalLevel?.map(s => (
                                  <div key={s.id} className="qf-service-card">
                                    <strong>{s.title}</strong>
                                    <p>{s.description}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            <button className="btn-get-quote" style={{ marginTop: '30px', width: '100%' }} onClick={() => navigate('/quote')}>
                              PROCEED TO QUOTE <ArrowRight size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
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
                              setActiveAxis('flat');
                              setViewMode('2d');
                              handleUnfold();
                            } else {
                              setActiveAxis(key);
                              if (currentIsStep && viewMode === '2d') {
                                // Coming from flat/2D view — rebuild OV viewer then snap camera
                                pendingAxisRef.current = key;
                                setViewMode('3d');
                              } else {
                                setAxisCamera(key);
                              }
                            }
                          }}>
                          {key === 'flat' ? <Maximize2 size={14} /> : <Monitor size={14} />}
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="viewer-actions">
                    {showViewer && currentIsStep && viewMode === '3d' && (
                      <button
                        className={`btn-wireframe ${showMesh ? 'active' : ''}`}
                        onClick={toggleMesh}
                        title={showMesh ? 'Hide mesh' : 'Show mesh'}
                      >
                        <Boxes size={20} />
                        <span>Show Mesh</span>
                      </button>
                    )}
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

              {/* ── Right Panel: Dimensions + Quote Flow ── */}
              <div className="dimensions-panel">

                {/* Dimensions Section */}
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
                            <div className="dim-row"><span>Thickness:</span>
                              <strong>
                                {selectedThickness ? `${selectedThickness} mm` : `${dimensions.mm.thickness} mm`}
                                {selectedThickness && <span className="qf-thickness-override"> (selected)</span>}
                              </strong>
                            </div>
                            <div className="dim-row"><span>Volume:</span> <strong>{dimensions.mm.volume} cm³</strong></div>
                          </>}
                        </>
                      ) : (
                        <>
                          <div className="dim-row"><span>Width:</span>  <strong>{dimensions.inches.width} in</strong></div>
                          <div className="dim-row"><span>Height:</span> <strong>{dimensions.inches.height} in</strong></div>
                          {!dimensions.is2D && <>
                            <div className="dim-row"><span>Thickness:</span>
                              <strong>
                                {selectedThickness ? `${(selectedThickness / 25.4).toFixed(3)} in` : `${dimensions.inches.thickness} in`}
                                {selectedThickness && <span className="qf-thickness-override"> (selected)</span>}
                              </strong>
                            </div>
                            <div className="dim-row"><span>Volume:</span> <strong>{dimensions.inches.volume} in³</strong></div>
                          </>}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="no-dimensions">
                    <Layers size={40} />
                    <p>{selectedFile ? 'Loading model data...' : 'Select a file to view'}</p>
                  </div>
                )}

                {/* ── Quote Flow ── */}
                {dimensions && (
                  <div className="qf-container">
                    <div className="qf-divider" />

                    {/* Step 0: Service selection */}
                    {!isQuoteFlowActive && (
                      <div className="qf-initial-selection">
                        <p className="qf-step-label">Ready to get a formal quote?</p>
                        <button className="btn-get-quote" onClick={() => setIsQuoteFlowActive(true)}>
                          PROCEED TOWARD QUOTE <ArrowRight size={18} />
                        </button>
                      </div>
                    )}

                    {isQuoteFlowActive && !selectedService && (
                      <div className="qf-service-selector">
                        <p className="qf-step-label">Select production method:</p>
                        <p className="qf-step-sublabel">Please tell us which service you were intending to use with your file.</p>
                        <button
                          className={`qf-service-btn large-btn${cncOutOfBounds ? ' disabled' : ''}`}
                          onClick={() => !cncOutOfBounds && setSelectedService('cnc_machining')}
                          disabled={cncOutOfBounds}
                        >
                          <div className="qf-service-info">
                            <strong>CNC Machining</strong>
                            <span>Precision milled parts</span>
                          </div>
                          {cncOutOfBounds ? (
                            <div className="view-errors-badge">
                              <span>Exceeds Size Limits</span>
                              <AlertCircle size={14} />
                            </div>
                          ) : cncMetals.length > 0 ? (
                            <div className="qf-service-price">
                              <span>Select Material</span>
                              <ArrowRight size={15} />
                            </div>
                          ) : (
                            <div className="view-errors-badge">
                              <span>Coming Soon</span>
                              <AlertCircle size={14} />
                            </div>
                          )}
                        </button>
                        <button className="qf-service-btn large-btn" onClick={() => setSelectedService('sheet_cutting')}>
                          <div className="qf-service-info">
                            <strong>Sheet Cutting</strong>
                            <span>Laser / plasma cut sheets</span>
                          </div>
                          <div className="qf-service-price">
                            <span>from $153.46</span>
                            <ArrowRight size={15} />
                          </div>
                        </button>
                      </div>
                    )}

                    {selectedService === 'cnc_machining' && (
                      <div className="qf-step">
                        <div className="qf-step-header">
                          <button className="qf-back-btn" onClick={() => setSelectedService(null)}>
                            <ChevronLeft size={15} />
                          </button>
                          <span><Wrench size={14} /> CNC Machining</span>
                        </div>
                        {cncMetals.length > 0 ? (
                          <>
                            <p className="qf-step-label">Select material</p>
                            <div className="qf-metal-grid">
                              {cncMetals.map(metal => (
                                <button key={metal.id} className="qf-metal-card" onClick={() => navigate('/quote')}>
                                  {metal.image_path && <img src={metal.image_path} alt={metal.name} className="qf-metal-img" />}
                                  <span className="qf-metal-name">{metal.name}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="qf-coming-soon">
                              <AlertCircle size={20} />
                              <p>CNC Machining pricing coming soon.</p>
                            </div>
                            <button className="btn-get-quote" onClick={() => navigate('/quote')}>
                              REQUEST QUOTE <ArrowRight size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Sheet Cutting flow */}
                    {selectedService === 'sheet_cutting' && (
                      <div className="qf-step">

                        {/* Step A: Metal Selection */}
                        {!selectedMetal && (
                          <>
                            <div className="qf-step-header">
                              <button className="qf-back-btn" onClick={() => setSelectedService(null)}>
                                <ChevronLeft size={15} />
                              </button>
                              <span><Scissors size={14} /> Select Material</span>
                            </div>
                            {loadingMetals ? (
                              <div className="qf-loading"><div className="qf-spinner" /> Loading metals…</div>
                            ) : sheetMetals.length === 0 ? (
                              <div className="qf-empty">
                                <AlertCircle size={18} />
                                <p>No metals configured for sheet cutting yet.</p>
                              </div>
                            ) : (
                              <div className="qf-metal-grid">
                                {sheetMetals.map(metal => (
                                  <button
                                    key={metal.id}
                                    className="qf-metal-card"
                                    onClick={() => { setSelectedMetal(metal); setSelectedThickness(null); }}
                                  >
                                    {metal.image_path && (
                                      <img src={metal.image_path} alt={metal.name} className="qf-metal-img" />
                                    )}
                                    <span className="qf-metal-name">{metal.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {/* Step B: Thickness Selection */}
                        {selectedMetal && !selectedThickness && (
                          <>
                            <div className="qf-step-header">
                              <button className="qf-back-btn" onClick={() => setSelectedMetal(null)}>
                                <ChevronLeft size={15} />
                              </button>
                              <span className="qf-breadcrumb">{selectedMetal.name}</span>
                            </div>
                            <p className="qf-step-label">Select thickness</p>
                            {(!selectedMetal.available_thicknesses || selectedMetal.available_thicknesses.length === 0) ? (
                              <div className="qf-empty">
                                <AlertCircle size={18} />
                                <p>No thicknesses configured for this metal.</p>
                              </div>
                            ) : (
                              <div className="qf-thickness-chips">
                                {selectedMetal.available_thicknesses.map(t => (
                                  <button
                                    key={t}
                                    className="qf-thickness-chip"
                                    onClick={() => setSelectedThickness(t)}
                                  >
                                    {t} mm
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {/* Step C+D: Thickness selected — viewer updated + services shown */}
                        {selectedMetal && selectedThickness && (
                          <>
                            <div className="qf-step-header">
                              <button className="qf-back-btn" onClick={() => setSelectedThickness(null)}>
                                <ChevronLeft size={15} />
                              </button>
                              <span className="qf-breadcrumb">{selectedMetal.name} · {selectedThickness} mm</span>
                            </div>

                            <div className="qf-selected-summary">
                              <div className="qf-summary-pill"><Scissors size={12} /> Sheet Cutting</div>
                              <div className="qf-summary-pill material">{selectedMetal.name}</div>
                              <div className="qf-summary-pill thickness">{selectedThickness} mm</div>
                            </div>

                            {/* Services / Guidelines */}
                            {loadingServices ? (
                              <div className="qf-loading"><div className="qf-spinner" /> Loading services…</div>
                            ) : metalServices ? (
                              <div className="qf-services">
                                <p className="qf-services-title">Available Services</p>
                                {[
                                  ...(metalServices.metalLevel || []),
                                  ...((metalServices.thicknessLevel || [])
                                    .filter(tl => {
                                      const tlVal = parseFloat(tl.metric);
                                      return Math.abs(tlVal - selectedThickness) < 0.01;
                                    })
                                    .flatMap(tl => tl.services || []))
                                ]
                                  .filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i)
                                  .map(service => (
                                    <div key={service.id} className="qf-service-card">
                                      <strong>{service.title}</strong>
                                      {service.description && <p>{service.description}</p>}
                                    </div>
                                  ))
                                }
                                {metalServices.metalLevel?.length === 0 && (
                                  <p className="qf-no-services">No specific services configured for this metal.</p>
                                )}
                              </div>
                            ) : null}

                            <button className="btn-get-quote" style={{ marginTop: '16px' }} onClick={() => navigate('/quote')}>
                              PROCEED TO QUOTE <ArrowRight size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Fallback quote button (no flow active) */}
                {!dimensions && (
                  <div className="pricing-summary" style={{ padding: '16px' }}>
                    <button className="btn-get-quote" onClick={() => navigate('/quote')}>
                      PROCEED TO QUOTE <ArrowRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default InstantPricing;

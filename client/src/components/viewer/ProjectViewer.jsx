import React, { useEffect, useMemo, useRef, useState } from 'react';
import StepModelViewer from './StepModelViewer';

const noop = () => {};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const BACKEND_URL = API_BASE_URL.replace(/\/api\/?$/, '');

const toVector3Array = (value) => {
  if (Array.isArray(value) && value.length >= 3) {
    return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
  }

  if (value && typeof value === 'object') {
    return [Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0];
  }

  return null;
};

const normalizeHole = (hole, fallbackId) => {
  if (!hole) return null;
  const position = toVector3Array(hole.position);
  if (!position) return null;

  const axis = toVector3Array(hole.axis);
  return {
    ...hole,
    id: hole.id ?? fallbackId,
    position,
    axis: axis || hole.axis,
  };
};

const normalizeHoleAssignments = (assignments = {}) => {
  return Object.entries(assignments).reduce((acc, [holeId, config]) => {
    const normalizedHole = normalizeHole(config?.hole, holeId);
    acc[holeId] = normalizedHole ? { ...config, hole: normalizedHole } : config;
    return acc;
  }, {});
};

const mergeDetectedHoles = (configuration, selectedTaps, selectedHardware, selectedCountersinks) => {
  const holesById = new Map();

  const upsert = (hole, fallbackId) => {
    const normalized = normalizeHole(hole, fallbackId);
    if (!normalized) return;

    const key = String(normalized.id ?? fallbackId);
    const prev = holesById.get(key) || {};
    holesById.set(key, {
      ...prev,
      ...normalized,
      id: normalized.id ?? prev.id ?? fallbackId,
    });
  };

  (configuration?.detectedHoles || []).forEach((hole, index) => {
    upsert(hole, hole?.id ?? `detected_${index + 1}`);
  });

  [selectedTaps, selectedHardware, selectedCountersinks].forEach((set) => {
    Object.entries(set || {}).forEach(([holeId, config]) => {
      upsert(config?.hole, holeId);
    });
  });

  return Array.from(holesById.values());
};

const normalizeViewerFile = (file) => {
  if (!file) return null;

  if (typeof File !== 'undefined' && file instanceof File) {
    return { file };
  }

  const modelFile = file.file || file;
  if (typeof File !== 'undefined' && modelFile instanceof File) {
    return { file: modelFile };
  }

  const remoteUrl = file.path || file.url || modelFile.path || modelFile.url;
  if (remoteUrl) {
    return {
      file: { name: modelFile.name || file.name || 'model.step' },
      url: remoteUrl,
    };
  }

  return modelFile ? { file: modelFile } : null;
};

const sanitizeStepPath = (value) => {
  if (typeof value !== 'string') return null;
  let raw = value.trim();
  if (!raw) return null;

  try {
    if (/^https?:\/\//i.test(raw)) {
      raw = new URL(raw).pathname || '';
    }
  } catch {
    // Keep the original string when URL parsing fails.
  }

  raw = raw.split('?')[0].split('#')[0];
  if (!/\.(step|stp)$/i.test(raw)) return null;

  try {
    raw = decodeURIComponent(raw);
  } catch {
    // If decoding fails, keep raw as-is.
  }

  return raw.replace(/^\/+/, '');
};

const inferSourceStepPath = (file, selectedFile, configuration) => {
  const candidates = [
    configuration?.tempPath,
    file?.tempPath,
    file?.path,
    file?.url,
    file?.file?.path,
    file?.file?.url,
    selectedFile?.path,
    selectedFile?.url,
  ];

  for (const candidate of candidates) {
    const resolved = sanitizeStepPath(candidate);
    if (resolved) return resolved;
  }

  return null;
};

const isConfiguredStepPath = (pathValue) => {
  if (!pathValue) return false;
  return /configured_preview|configured[_-]|_conf(?:ig(?:ured)?)?/i.test(pathValue);
};

const isStepLikeFile = (file) => {
  if (!file) return false;

  const name = file.name || file.file?.name || '';
  if (/\.(step|stp)$/i.test(name)) return true;

  const path = file.path || file.url || file.file?.path || file.file?.url || '';
  return /\.(step|stp)(\?|#|$)/i.test(path);
};

const getActiveFinishColor = (configuration) => {
  if (configuration?.anodizingColor) return configuration.anodizingColor;

  const selectedFinishColors = configuration?.selectedFinishColors || {};
  const firstColor = Object.values(selectedFinishColors).find((c) => c?.color || c?.hex);
  if (firstColor) return firstColor;

  if (configuration?.metal?.color) {
    return {
      color: configuration.metal.color,
      name: configuration.metal.name || 'Base Material',
      isBaseMaterialFallback: true,
    };
  }

  return null;
};

const isPowderStyle = (configuration, activeFinishColor) => {
  const finishName = String(activeFinishColor?.name || '').toLowerCase();
  if (activeFinishColor?.is_wrinkled || finishName.includes('wrinkled')) return true;

  const selectedFinishColors = configuration?.selectedFinishColors || {};
  return Object.values(selectedFinishColors).some((c) => {
    const text = `${c?.name || ''} ${c?.service || ''} ${c?.service_name || ''}`.toLowerCase();
    return text.includes('powder') || text.includes('wrinkled');
  });
};

const ProjectViewer = ({
  file,
  configuration = {},
  onDimensionsExtracted = null,
  isPreview = false,
}) => {
  const selectedFile = useMemo(() => normalizeViewerFile(file), [file]);
  const selectedTaps = useMemo(() => normalizeHoleAssignments(configuration.selectedTaps || {}), [configuration.selectedTaps]);
  const selectedHardware = useMemo(() => normalizeHoleAssignments(configuration.selectedHardware || {}), [configuration.selectedHardware]);
  const selectedCountersinks = useMemo(() => normalizeHoleAssignments(configuration.selectedCountersinks || {}), [configuration.selectedCountersinks]);
  const configurePreviewAbortRef = useRef(null);
  const configurePreviewSeqRef = useRef(0);
  const configurePreviewKeyRef = useRef('');
  const [configuredPreviewUrl, setConfiguredPreviewUrl] = useState(null);
  const [configuredHardwareResizeReport, setConfiguredHardwareResizeReport] = useState({});

  const detectedHoles = useMemo(
    () => mergeDetectedHoles(configuration, selectedTaps, selectedHardware, selectedCountersinks),
    [configuration, selectedTaps, selectedHardware, selectedCountersinks]
  );

  const activeFinishColor = useMemo(() => getActiveFinishColor(configuration), [configuration]);
  const isFinishPowderCoating = useMemo(
    () => isPowderStyle(configuration, activeFinishColor),
    [configuration, activeFinishColor]
  );

  const selectedThickness = useMemo(() => {
    if (configuration?.selectedThickness === null || configuration?.selectedThickness === undefined || configuration?.selectedThickness === '') {
      return null;
    }
    return String(configuration.selectedThickness);
  }, [configuration?.selectedThickness]);

  const isSupported = useMemo(() => isStepLikeFile(file) || isStepLikeFile(selectedFile), [file, selectedFile]);
  const selectedHardwareForPreview = useMemo(() => {
    const entries = Object.entries(selectedHardware || {}).filter(([, hw]) => {
      const typeId = Number(hw?.typeId);
      return typeId === 1 || typeId === 2 || typeId === 3 || typeId === 4;
    });
    return Object.fromEntries(entries);
  }, [selectedHardware]);

  const hasConfiguredCuts = useMemo(
    () => (
      Object.keys(selectedCountersinks || {}).length > 0 ||
      Object.keys(selectedTaps || {}).length > 0 ||
      Object.keys(selectedHardwareForPreview || {}).length > 0
    ),
    [selectedCountersinks, selectedTaps, selectedHardwareForPreview]
  );

  const sourceStepPath = useMemo(
    () => inferSourceStepPath(file, selectedFile, configuration),
    [file, selectedFile, configuration]
  );

  const sourceIsConfigured = useMemo(() => isConfiguredStepPath(sourceStepPath), [sourceStepPath]);

  const configuredPreviewPayload = useMemo(() => {
    if (!isSupported || !hasConfiguredCuts || !sourceStepPath || sourceIsConfigured) return null;

    const finishColor = (activeFinishColor && !activeFinishColor?.isBaseMaterialFallback)
      ? (activeFinishColor?.color || activeFinishColor?.hex || (typeof activeFinishColor === 'string' ? activeFinishColor : null))
      : null;
    const mmThickness = configuration?.dimensions?.mm?.t || selectedThickness || null;

    return {
      tempPath: sourceStepPath,
      configuration: {
        selectedTaps,
        selectedHardware: selectedHardwareForPreview,
        selectedCountersinks,
        thickness: mmThickness,
        dimensions: mmThickness ? { mm: { t: mmThickness } } : null,
        anodizingColor: finishColor ? { color: finishColor } : null,
      }
    };
  }, [
    isSupported,
    hasConfiguredCuts,
    sourceStepPath,
    sourceIsConfigured,
    selectedTaps,
    selectedHardwareForPreview,
    selectedCountersinks,
    selectedThickness,
    activeFinishColor,
    configuration?.dimensions?.mm?.t,
  ]);

  useEffect(() => {
    if (!configuredPreviewPayload) {
      if (configurePreviewAbortRef.current) configurePreviewAbortRef.current.abort();
      configurePreviewKeyRef.current = '';
      setConfiguredPreviewUrl(null);
      setConfiguredHardwareResizeReport({});
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
        const resolved = BACKEND_URL ? `${BACKEND_URL}/${relativePath}` : `/${relativePath}`;
        setConfiguredPreviewUrl(resolved);
      } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error('ProjectViewer configured preview error:', err);
        if (seq === configurePreviewSeqRef.current) {
          setConfiguredPreviewUrl(null);
          setConfiguredHardwareResizeReport({});
        }
      }
    }, 220);

    return () => clearTimeout(timerId);
  }, [configuredPreviewPayload, configuredPreviewUrl]);

  useEffect(() => {
    return () => {
      if (configurePreviewAbortRef.current) configurePreviewAbortRef.current.abort();
    };
  }, []);

  const configuredFileUrl = useMemo(() => {
    if (!sourceIsConfigured) return null;

    const direct = selectedFile?.url || selectedFile?.path || file?.path || file?.url || null;
    if (!direct) return null;
    if (/^(?:https?:)?\/\//i.test(direct) || String(direct).startsWith('blob:') || String(direct).startsWith('data:')) {
      return direct;
    }

    const cleaned = String(direct).replace(/^\/+/, '');
    return BACKEND_URL ? `${BACKEND_URL}/${cleaned}` : `/${cleaned}`;
  }, [sourceIsConfigured, selectedFile, file]);

  const modelUrlOverride = configuredPreviewUrl || configuredFileUrl || null;

  const handleDimensionsExtracted = (dimensions) => {
    if (!onDimensionsExtracted) return;

    onDimensionsExtracted({
      l: Number(dimensions?.mm?.l) || 0,
      w: Number(dimensions?.mm?.w) || 0,
      t: Number(dimensions?.mm?.t) || 0,
      mm: dimensions?.mm,
      inches: dimensions?.inches,
    });
  };

  return (
    <div
      className="project-viewer-surface"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: isPreview ? 'none' : 'inset 0 4px 12px rgba(0,0,0,0.05)',
      }}
    >
      {isSupported && selectedFile ? (
        <StepModelViewer
          selectedFile={selectedFile}
          modelUrlOverride={modelUrlOverride}
          detectedHoles={detectedHoles}
          selectedTaps={selectedTaps}
          activeTapHole={null}
          setActiveTapHole={noop}
          isTappingActive={false}
          tapOptions={[]}
          selectedHardware={selectedHardware}
          hardwareResizeReport={configuredHardwareResizeReport}
          isHardwareActive={Object.keys(selectedHardware || {}).length > 0}
          hwItemsByType={{}}
          selectedCountersinks={selectedCountersinks}
          showCountersinkMarkers={false}
          countersinkMarkerStyle="camouflage"
          csOptions={[]}
          isCountersinkingActive={false}
          activeFinishColor={activeFinishColor}
          isFinishPowderCoating={isFinishPowderCoating}
          isBendingActive={Boolean((configuration.detectedBends || []).length)}
          detectedBends={configuration.detectedBends || []}
          selectedThickness={selectedThickness}
          isModelFadedManually={false}
          isAnodizingModalOpen={false}
          dimensions={configuration.dimensions || null}
          allServices={configuration.additionalServices || []}
          backendData={configuration.pricingTechnicalData || null}
          onModelLoaded={noop}
          onProgress={noop}
          onDimensionsExtracted={handleDimensionsExtracted}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'grid',
            placeItems: 'center',
            color: '#6b7280',
            fontSize: '0.9rem',
            padding: '0.75rem',
            textAlign: 'center',
          }}
        >
          Preview is available for STEP files only.
        </div>
      )}
    </div>
  );
};

export default React.memo(ProjectViewer);

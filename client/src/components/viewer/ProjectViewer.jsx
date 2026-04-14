import React, { useMemo } from 'react';
import StepModelViewer from './StepModelViewer';

const noop = () => {};

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
          detectedHoles={detectedHoles}
          selectedTaps={selectedTaps}
          activeTapHole={null}
          setActiveTapHole={noop}
          isTappingActive={false}
          tapOptions={[]}
          selectedHardware={selectedHardware}
          isHardwareActive={false}
          hwItemsByType={{}}
          selectedCountersinks={selectedCountersinks}
          showCountersinkMarkers={false}
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

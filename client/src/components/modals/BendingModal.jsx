/* eslint-disable no-unused-vars */
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  X, Minus, Plus,
  RotateCcw, Sliders, ChevronRight,
  ArrowUp, ArrowDown, HelpCircle,
  Layers
} from 'lucide-react';
import HierarchicalProjectViewer from '../viewer/HierarchicalProjectViewer';

const BendingModal = ({
  isOpen,
  onClose,
  bendTree,
  faceMeshes,
  selectedBends,
  onUpdateBend
}) => {
  const [activeBendId, setActiveBendId] = useState(null);

  // Flatten tree for list view
  const bendList = useMemo(() => {
    const list = [];
    const traverse = (node, depth = 0) => {
      if (node.bendAxis) {
        list.push({ ...node, depth });
      }
      if (node.children) {
        node.children.forEach(child => traverse(child, depth + 1));
      }
    };
    if (bendTree) traverse(bendTree);
    return list;
  }, [bendTree]);

  if (!isOpen) return null;

  if (!bendTree) {
    return (
      <div className="position-fixed inset-0 d-flex align-items-center justify-content-center z-10000" style={{ backdropFilter: 'blur(20px)', background: 'rgba(15, 23, 42, 0.7)' }}>
        <div className="bg-white p-5 rounded-4 d-flex flex-column align-items-center gap-3 shadow-xl position-relative">
          <button
            onClick={onClose}
            className="position-absolute top-0 end-0 m-3 btn btn-link text-dark p-0 opacity-50 hover-opacity-100"
          >
            <X size={20} />
          </button>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <span className="fw-bold text-dark">Analyzing Bends...</span>
          <p className="text-muted small text-center mb-0">This may take a moment for complex parts.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="position-fixed inset-0 d-flex align-items-center justify-content-center z-10000"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ backdropFilter: 'blur(20px)', background: 'rgba(15, 23, 42, 0.7)' }}
    >
      <motion.div
        className="bg-white overflow-hidden d-flex flex-column shadow-22xl"
        style={{ width: '95%', maxWidth: '1300px', height: '90vh', borderRadius: '32px', position: 'relative' }}
        initial={{ scale: 0.95, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Header */}
        <div className="p-4 border-bottom d-flex justify-content-between align-items-center bg-white">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="bg-primary text-white p-1 rounded">
                <Layers size={16} />
              </div>
              <h3 className="fw-900 fs-4 m-0 letter-spacing-1 text-dark">METAL BENDING CONFIGURATOR</h3>
            </div>
            <p className="text-muted small m-0 fw-bold opacity-75">Configure hardware-precision bends with live 3D feedback</p>
          </div>
          <button
            className="btn btn-light rounded-circle p-3 shadow-none hover-bg-danger hover-text-white transition-all border-0"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-grow-1 d-flex overflow-hidden">
          {/* Sidebar: Bend List */}
          <div className="border-end bg-light-subtle bg-opacity-30 p-4 overflow-auto hide-scrollbar" style={{ width: '380px' }}>
            <div className="d-flex align-items-center justify-content-between mb-4 px-2">
              <span className="text-muted fw-black letter-spacing-2" style={{ fontSize: '12px' }}>DETECTED BENDS</span>
              <span className="badge bg-white border text-primary rounded-pill px-2 py-1">{bendList.length}</span>
            </div>

            <div className="d-flex flex-column gap-2">
              {bendList.map((bend, idx) => {
                const isActive = activeBendId === bend.id;
                const config = selectedBends[bend.id] || { angle: bend.initialAngle, direction: 'up' };

                return (
                  <motion.div
                    key={bend.id}
                    className={`p-4 rounded-4 cursor-pointer transition-all border-2 d-flex align-items-center justify-content-between ${isActive ? 'bg-primary text-white border-primary shadow-lg scale-102' : 'bg-white border-light-subtle hover-border-primary text-dark'
                      }`}
                    onClick={() => setActiveBendId(bend.id)}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div className={`rounded-3 p-2 ${isActive ? 'bg-white text-primary' : 'bg-light text-muted'}`}>
                        <RotateCcw size={18} />
                      </div>
                      <div>
                        <div className="fw-black" style={{ fontSize: '15px' }}>BEND #{idx + 1}</div>
                        <div className={`small fw-bold opacity-75`}>
                          Initial: {Math.round(bend.initialAngle)}° • Current: {Math.round(config.angle)}°
                        </div>
                      </div>
                    </div>
                    {isActive && <ChevronRight size={18} className="animate-bounce-x" />}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Main: 3D Viewer */}
          <div className="flex-grow-1 position-relative bg-white border-end">
            <HierarchicalProjectViewer
              bendTree={bendTree}
              faceMeshes={faceMeshes}
              selectedBends={selectedBends}
              activeBendId={activeBendId}
              onBendClick={setActiveBendId}
            />

            {/* 3D Context Indicators */}
            <div className="position-absolute bottom-4 start-4 d-flex gap-3">
              <div className="glass-morphism p-3 rounded-4 border d-flex align-items-center gap-2">
                <div className="bg-primary rounded-circle" style={{ width: '8px', height: '8px' }} />
                <span className="fw-black small text-dark">ACTIVE SEGMENT</span>
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="p-5 d-flex flex-column bg-white shadow-sm" style={{ width: '420px' }}>
            {activeBendId ? (() => {
              const bend = bendList.find(b => b.id === activeBendId);
              const config = selectedBends[activeBendId] || { angle: bend.initialAngle, direction: 'up' };

              return (
                <div className="animate-fade-in d-flex flex-column h-100">
                  <div className="mb-5">
                    <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1 rounded-pill fw-black small mb-3">CURRENT SELECTION</span>
                    <h2 className="fw-900 fs-1 text-dark mb-2">BEND #{bendList.indexOf(bend) + 1}</h2>
                    <p className="text-muted fw-bold small">Direct geometric manipulation of the bend segment.</p>
                  </div>

                  {/* Angle Control */}
                  <div className="mb-5">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="fw-black text-dark m-0" style={{ fontSize: '14px', letterSpacing: '1px' }}>BEND ANGLE</h5>
                      <span className="fs-3 fw-900 text-primary">{Math.round(config.angle)}°</span>
                    </div>

                    <div className="p-4 bg-light rounded-5 mb-3">
                      <input
                        type="range"
                        className="form-range custom-range"
                        min="0"
                        max="180"
                        step="1"
                        value={config.angle}
                        onChange={(e) => onUpdateBend(activeBendId, { ...config, angle: parseFloat(e.target.value) })}
                      />
                    </div>

                    <div className="d-grid grid-cols-2 gap-3">
                      {[45, 90, 135, 180].map(deg => (
                        <button
                          key={deg}
                          className={`btn rounded-4 py-2 fw-black transition-all ${config.angle === deg ? 'btn-primary' : 'btn-outline-light text-dark'}`}
                          onClick={() => onUpdateBend(activeBendId, { ...config, angle: deg })}
                        >
                          {deg}°
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Directional Toggle */}
                  <div className="mb-5">
                    <h5 className="fw-black text-dark mb-3" style={{ fontSize: '14px', letterSpacing: '1px' }}>FOLD DIRECTION</h5>
                    <div className="d-flex gap-3 bg-light p-2 rounded-5">
                      <button
                        className={`btn flex-grow-1 rounded-4 py-3 d-flex align-items-center justify-content-center gap-2 border-0 transition-all ${config.direction === 'up' ? 'bg-white text-primary shadow-sm fw-black' : 'text-muted fw-bold'}`}
                        onClick={() => onUpdateBend(activeBendId, { ...config, direction: 'up' })}
                      >
                        <ArrowUp size={18} /> FOLD UP
                      </button>
                      <button
                        className={`btn flex-grow-1 rounded-4 py-3 d-flex align-items-center justify-content-center gap-2 border-0 transition-all ${config.direction === 'down' ? 'bg-white text-primary shadow-sm fw-black' : 'text-muted fw-bold'}`}
                        onClick={() => onUpdateBend(activeBendId, { ...config, direction: 'down' })}
                      >
                        <ArrowDown size={18} /> FOLD DOWN
                      </button>
                    </div>
                  </div>

                  <div className="mt-auto pt-5 border-top">
                    <div className="bg-warning bg-opacity-10 rounded-4 p-4 d-flex gap-3 border border-warning border-opacity-20 mb-4">
                      <HelpCircle className="text-warning flex-shrink-0" />
                      <p className="small text-warning-emphasis fw-bold m-0">Live bending affects the 3D model and quote total in real-time.</p>
                    </div>
                    <button
                      className="btn btn-dark w-100 py-4 rounded-pill fw-black letter-spacing-1 shadow-lg hover-translate-y transition-all"
                      onClick={() => setActiveBendId(null)}
                    >
                      APPLY CHANGES
                    </button>
                  </div>
                </div>
              );
            })() : (
              <div className="h-100 d-flex flex-column align-items-center justify-content-center text-center px-4 animate-fade-in">
                <div className="bg-light rounded-circle p-5 mb-4 shadow-sm animate-pulse-slow">
                  <Sliders size={48} className="text-muted opacity-40" />
                </div>
                <h4 className="fw-black text-dark mb-2">Select a Bend Segment</h4>
                <p className="text-muted fw-bold small opacity-75">Click on a segment in the list or in the 3D viewer to start precise geometric configuration.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-top bg-light-subtle d-flex justify-content-between align-items-center">
          <div className="d-flex gap-4">
            <div className="d-flex flex-column">
              <span className="text-muted fw-bold small uppercase letter-spacing-1" style={{ fontSize: '10px' }}>Total Bends</span>
              <span className="fw-black text-dark">{bendList.length} Units</span>
            </div>
            <div className="d-flex flex-column">
              <span className="text-muted fw-bold small uppercase letter-spacing-1" style={{ fontSize: '10px' }}>Complexity Factor</span>
              <span className="fw-black text-primary">High Precision</span>
            </div>
          </div>
          <button
            className="btn btn-dark px-5 py-3 rounded-pill fw-black shadow-lg"
            onClick={onClose}
          >
            SAVE CONFIGURATION
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default BendingModal;

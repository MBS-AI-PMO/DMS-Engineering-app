import React, { useMemo } from 'react';
import { X, ChevronUp, ChevronDown, GitBranch } from 'lucide-react';

/**
 * BendPanel — inline right-side overlay on the 3D viewer.
 *
 * Props:
 *   bendTree      {object}   hierarchical bend tree from Python backend
 *   selectedBends {object}   { [id]: { angle: number, direction: 'up'|'down' } }
 *   onUpdateBend  {function} (id, { angle, direction }) => void
 *   onClose       {function} () => void
 */
const BendPanel = ({ bendTree, selectedBends = {}, onUpdateBend, onClose }) => {
  // Flatten tree into ordered list for display
  const bendList = useMemo(() => {
    const list = [];
    const traverse = (node, depth = 0) => {
      if (node.bendAxis) {
        list.push({ ...node, depth });
      }
      if (node.children) node.children.forEach(c => traverse(c, depth + 1));
    };
    if (bendTree) traverse(bendTree);
    return list;
  }, [bendTree]);

  const handleAngleChange = (id, raw) => {
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    const clamped = Math.max(0, Math.min(180, num));
    const prev = selectedBends[id] || { angle: 90, direction: 'up' };
    onUpdateBend(id, { ...prev, angle: clamped });
  };

  const handleDirection = (id, dir) => {
    const prev = selectedBends[id] || { angle: 90, direction: 'up' };
    onUpdateBend(id, { ...prev, direction: dir });
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: 272,
      height: '100%',
      background: 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(12px)',
      borderLeft: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 20,
      boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px',
        borderBottom: '1px solid #f1f5f9',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg,#ef4444,#dc2626)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GitBranch size={13} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1e293b', letterSpacing: '0.4px' }}>
              BENDS
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
              {bendList.length} detected
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 4, borderRadius: 6, color: '#94a3b8',
            display: 'flex', alignItems: 'center',
          }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Bend list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {bendList.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
            No bends detected in this model.
          </div>
        ) : (
          bendList.map((node, idx) => {
            const config = selectedBends[node.id] || { angle: node.initialAngle ?? 90, direction: 'up' };
            const lengthMm = node.bendAxis?.length ? `${node.bendAxis.length.toFixed(1)} mm` : '';
            return (
              <div
                key={node.id}
                style={{
                  margin: '4px 10px',
                  background: '#f8fafc',
                  border: '1px solid #e8eaed',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              >
                {/* Bend label row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 5,
                      background: '#fef2f2', border: '1px solid #fecaca',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 800, color: '#ef4444',
                    }}>
                      {idx + 1}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>
                      Bend {idx + 1}
                    </span>
                  </div>
                  {lengthMm && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: '#64748b',
                      background: '#f1f5f9', padding: '2px 6px', borderRadius: 10,
                    }}>
                      {lengthMm}
                    </span>
                  )}
                </div>

                {/* Angle + direction row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', minWidth: 38 }}>
                    ANGLE
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    step={1}
                    value={config.angle}
                    onChange={e => handleAngleChange(node.id, e.target.value)}
                    style={{
                      width: 58,
                      height: 28,
                      border: '1.5px solid #e2e8f0',
                      borderRadius: 7,
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#1e293b',
                      textAlign: 'center',
                      background: '#fff',
                      outline: 'none',
                      padding: '0 4px',
                    }}
                  />
                  <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>°</span>
                  <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                    <button
                      title="Bend Up"
                      onClick={() => handleDirection(node.id, 'up')}
                      style={{
                        width: 28, height: 28,
                        borderRadius: 7,
                        border: `1.5px solid ${config.direction === 'up' ? '#ef4444' : '#e2e8f0'}`,
                        background: config.direction === 'up' ? '#fef2f2' : '#fff',
                        color: config.direction === 'up' ? '#ef4444' : '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      title="Bend Down"
                      onClick={() => handleDirection(node.id, 'down')}
                      style={{
                        width: 28, height: 28,
                        borderRadius: 7,
                        border: `1.5px solid ${config.direction === 'down' ? '#ef4444' : '#e2e8f0'}`,
                        background: config.direction === 'down' ? '#fef2f2' : '#fff',
                        color: config.direction === 'down' ? '#ef4444' : '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid #f1f5f9',
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: 600,
        letterSpacing: '0.3px',
        flexShrink: 0,
      }}>
        CHANGES UPDATE THE 3D VIEW LIVE
      </div>
    </div>
  );
};

export default BendPanel;

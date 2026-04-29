import React from 'react';
import {
  Info, FileText, ChevronRight, Loader2, TrendingDown
} from 'lucide-react';

const PricingSidebar = ({
  selectedFile,
  dimensions,
  unit,
  measurementMetrics,
  dimensionSourceLabel,
  thicknessSourceLabel,
  selectedThickness,
  selectedThicknessDisplay,
  selectedThicknessMM,
  isCalculatingPrice,
  priceEstimate,
  quantity,
  handleProceedToReview,
  setIsQuoteFlowActive,
  isQuoteFlowActive
}) => {
  if (!selectedFile) return null;

  const activeUnit = unit === 'inch' ? 'inch' : 'mm';
  const metrics = measurementMetrics || {};

  const areaValue = activeUnit === 'mm'
    ? (Number(metrics.areaMm2 || 0) / 100)
    : (Number(metrics.areaMm2 || 0) / (25.4 * 25.4));
  const areaUnitLabel = activeUnit === 'mm' ? 'cm²' : 'in²';

  const perimeterValue = activeUnit === 'mm'
    ? Number(metrics.perimeterMm || 0)
    : (Number(metrics.perimeterMm || 0) / 25.4);
  const perimeterUnitLabel = activeUnit === 'mm' ? 'mm' : 'in';

  const diagonalValue = activeUnit === 'mm'
    ? Number(metrics.diagonalMm || 0)
    : (Number(metrics.diagonalMm || 0) / 25.4);
  const diagonalUnitLabel = activeUnit === 'mm' ? 'mm' : 'in';

  return (
    <aside className="ip-sidebar" style={{
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      boxSizing: 'border-box',
      boxShadow: 'none'
    }}>
      {/* Header (only in initial view) */}
      {!isQuoteFlowActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#ef4444,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Info size={15} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', letterSpacing: '0.5px' }}>Model Details</div>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>Extracted from CAD file</div>
          </div>
        </div>
      )}

      {/* File Info (only in initial view) */}
      {!isQuoteFlowActive && (
        <div style={{ marginBottom: 16 }}>
          <div className="ip-section-title">File Info</div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={16} color="#64748b" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFile.file.name}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 2, alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>STEP MODEL</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {dimensions ? (
        <>
          {/* Dimensions Section */}
          <div style={{ marginBottom: isQuoteFlowActive ? 0 : 12 }}>
            {!isQuoteFlowActive && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="ip-section-title" style={{ margin: 0 }}>Dimensions</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Length', symbol: 'L', key: 'l', bg: '#eff6ff', color: '#3b82f6' },
                { label: 'Width', symbol: 'W', key: 'w', bg: '#f0fdf4', color: '#22c55e' },
                { label: 'Thick', symbol: 'T', key: 't', bg: '#fff7ed', color: '#f97316' },
              ].map(item => (
                <div key={item.key} style={{ background: item.bg, border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: '10px', fontWeight: 950, color: item.color, background: '#fff', width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${item.color}30` }}>
                      {item.symbol}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                    <span style={{ fontSize: '15px', fontWeight: 900, color: item.color, fontFamily: 'monospace' }}>
                      {parseFloat(activeUnit === 'mm' ? dimensions.mm[item.key] : dimensions.inches[item.key]).toFixed(3)}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>{activeUnit}</span>
                  </div>
                </div>
              ))}
            </div>

            {selectedThickness && !isQuoteFlowActive && (
              <div style={{ marginTop: 6, background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#a855f7', textTransform: 'uppercase' }}>Selected Stock</div>
                <div style={{ fontSize: '12px', fontWeight: 900, color: '#7e22ce', fontFamily: 'monospace' }}>
                  {selectedThicknessDisplay || `${Number(selectedThicknessMM || 0).toFixed(3)} mm`}
                </div>
              </div>
            )}

            {!isQuoteFlowActive && (
              <div style={{ marginTop: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Size source: {dimensionSourceLabel || 'Model'}</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', marginTop: 2 }}>Thickness source: {thicknessSourceLabel || 'Model'}</div>
              </div>
            )}
          </div>

          {/* Analysis Section (only in initial view) */}
          {!isQuoteFlowActive && (
            <div style={{ marginBottom: 20 }}>
              <div className="ip-section-title">Analysis</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 950, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Volume</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                    <span style={{ fontSize: '13px', fontWeight: 900, color: '#1e293b', fontFamily: 'monospace' }}>
                      {parseFloat(activeUnit === 'mm' ? dimensions.mm.volume : dimensions.inches.volume).toFixed(3)}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>{activeUnit === 'mm' ? 'mm³' : 'in³'}</span>
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 950, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Footprint</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                    <span style={{ fontSize: '13px', fontWeight: 900, color: '#1e293b', fontFamily: 'monospace' }}>
                      {parseFloat(areaValue).toFixed(3)}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>{areaUnitLabel}</span>
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 950, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Perimeter</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                    <span style={{ fontSize: '13px', fontWeight: 900, color: '#1e293b', fontFamily: 'monospace' }}>
                      {parseFloat(perimeterValue).toFixed(3)}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>{perimeterUnitLabel}</span>
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 950, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Diagonal</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                    <span style={{ fontSize: '13px', fontWeight: 900, color: '#1e293b', fontFamily: 'monospace' }}>
                      {parseFloat(diagonalValue).toFixed(3)}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>{diagonalUnitLabel}</span>
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 950, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Pierces</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                    <span style={{ fontSize: '13px', fontWeight: 900, color: '#1e293b', fontFamily: 'monospace' }}>
                      {Number(metrics.pierceCount || 0)}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>count</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pricing Breakdown (Quote Flow Mode) */}
          {isQuoteFlowActive && (
            <div style={{ marginTop: 24 }}>
              <div className="ip-section-title">Cost Breakdown</div>
              <div style={{ background: '#f8fafc', border: '1.5px solid #e8eaed', borderRadius: 12, padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Unit Price</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>
                    ${priceEstimate?.breakdown?.final_unit_price ? priceEstimate.breakdown.final_unit_price.toFixed(2) : '0.00'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Quantity</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>× {quantity}</span>
                </div>

                <div style={{ height: '1px', background: '#e2e8f0', margin: '14px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b' }}>Total Batch</span>
                  <div style={{ textAlign: 'right' }}>
                    {isCalculatingPrice ? (
                      <div className="skeleton-price" style={{ width: '100px', height: '24px', borderRadius: '6px' }} />
                    ) : (
                      <div style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b' }}>
                        ${priceEstimate?.total_price ? priceEstimate.total_price.toFixed(2) : '0.00'}
                      </div>
                    )}
                  </div>
                </div>

                {priceEstimate?.breakdown?.discount_percent > 0 && (
                  <div style={{ marginTop: 12, padding: '8px 12px', background: '#ecfdf5', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #a7f3d0' }}>
                    <TrendingDown size={14} color="#059669" strokeWidth={3} />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                      {priceEstimate.breakdown.discount_percent}% Volume Discount Included
                    </span>
                  </div>
                )}
              </div>

              <button className="ip-proceed-btn" style={{ marginTop: 24, padding: '16px' }} onClick={handleProceedToReview}>
                ADD TO CART
              </button>
            </div>
          )}

          {/* Spacer to push pricing to bottom */}
          <div style={{ flex: 1 }} />


          {/* Proceed Button (only in initial view) */}
          {!isQuoteFlowActive && (
            <button className="ip-proceed-btn" onClick={() => setIsQuoteFlowActive(true)}>
              PROCEED TO QUOTE <ChevronRight size={16} />
            </button>
          )}
        </>
      ) : (
        !isQuoteFlowActive && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 40 }}>
            <Loader2 size={28} style={{ color: '#ef4444', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>CALCULATING DIMENSIONS...</div>
          </div>
        )
      )}
    </aside>
  );
};

export default PricingSidebar;

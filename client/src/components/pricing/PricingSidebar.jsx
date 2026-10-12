import React from 'react';
import { ArrowRight, TrendingDown } from 'lucide-react';

/**
 * The right-hand "Model Details" panel of the Instant Pricing page: a short
 * header with the analysis state, then Dimensions and Analysis as a spec
 * sheet (label and where it came from on the left, the figure on the
 * right), then the button that starts the quote. Values come from the page
 * (dimensions, measurement metrics, source labels); this panel only formats
 * them.
 */

const formatLinear = (value) => {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number.toFixed(3) : '--';
};

const formatAmount = (value) => {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number.toFixed(2) : '--';
};

function GeoRow({ label, value, unit, caption, tone }) {
  return (
    <div className={`ipw-geo-row${tone ? ` is-${tone}` : ''}`}>
      <dt>
        <span>{label}</span>
        {caption ? <small>{caption}</small> : null}
      </dt>
      <dd>
        {value}
        {unit ? <i>{unit}</i> : null}
      </dd>
    </div>
  );
}

function GeoSkeleton({ count }) {
  return Array.from({ length: count }, (_, index) => (
    <div key={index} className="ipw-geo-row is-skeleton" aria-hidden="true">
      <dt><span /><small /></dt>
      <dd><span /></dd>
    </div>
  ));
}

const PricingSidebar = ({
  selectedFile,
  dimensions,
  unit,
  measurementMetrics,
  holeCount = null,
  isDetectingHoles = false,
  // A STEP file whose 2D flat pattern is still being worked out: its size,
  // thickness and cutting figures come from that pattern, so they wait.
  isFlatPending = false,
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
  const isMm = activeUnit === 'mm';
  const metrics = measurementMetrics || {};
  const linearUnit = isMm ? 'mm' : 'in';

  // The quote wizard draws its own breakdown; this branch is kept for any
  // caller that mounts the panel while a quote is open.
  if (isQuoteFlowActive) {
    return (
      <aside className="ip-sidebar" style={{ background: '#fff', display: 'flex', flexDirection: 'column', padding: '24px', boxSizing: 'border-box' }}>
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
      </aside>
    );
  }

  const dims = dimensions ? (isMm ? dimensions.mm : dimensions.inches) : null;
  const areaMm2 = Number(metrics.areaMm2 || 0);
  const perimeterMm = Number(metrics.perimeterMm || 0);
  const diagonalMm = Number(metrics.diagonalMm || 0);
  const pierceCount = Number(metrics.pierceCount || 0);
  const pending = <span className="ipw-geo-pending">Working out…</span>;
  const flatCaption = 'From the 2D flat pattern';
  const flat = (value, caption) => (isFlatPending ? { value: pending, unit: null, caption: flatCaption } : { value, caption });
  const ready = Boolean(dimensions) && !isFlatPending;

  return (
    <aside className="ipw-geo" aria-label="Model details">
      <header className="ipw-geo-hero">
        <div className="ipw-geo-hero-top">
          <span className="ipw-geo-kicker">CAD details</span>
          <span className={`ipw-geo-badge${ready ? ' is-ready' : ''}`}>
            {ready ? 'Ready' : 'Analyzing'}
          </span>
        </div>
        <h2>Geometry</h2>
        <p>
          {ready
            ? 'Size, thickness and cutting figures read from your CAD file.'
            : isFlatPending
              ? 'Working out the 2D flat pattern from your CAD file…'
              : 'Reading size and thickness from your CAD file…'}
        </p>
      </header>

      <section className="ipw-geo-section" aria-busy={!dimensions}>
        <div className="ipw-geo-head">
          <span>Dimensions</span>
          <em>{linearUnit}</em>
        </div>
        <dl className="ipw-geo-list">
          {dims ? (
            <>
              <GeoRow label="Length" unit={linearUnit} {...flat(formatLinear(dims.l), dimensionSourceLabel || 'Model')} />
              <GeoRow label="Width" unit={linearUnit} {...flat(formatLinear(dims.w), dimensionSourceLabel || 'Model')} />
              <GeoRow label="Thickness" unit={linearUnit} {...flat(formatLinear(dims.t), thicknessSourceLabel || 'Model')} />
              {selectedThickness ? (
                <GeoRow
                  label="Selected stock"
                  value={selectedThicknessDisplay || `${Number(selectedThicknessMM || 0).toFixed(3)} mm`}
                  caption="Material you picked"
                  tone="accent"
                />
              ) : null}
            </>
          ) : (
            <GeoSkeleton count={3} />
          )}
        </dl>
      </section>

      <section className="ipw-geo-section" aria-busy={!dimensions}>
        <div className="ipw-geo-head">
          <span>Analysis</span>
          <em>{linearUnit}</em>
        </div>
        <dl className="ipw-geo-list">
          {dims ? (
            <>
              <GeoRow label="Volume" value={formatAmount(dims.volume)} unit={isMm ? 'mm³' : 'in³'} caption="Material" />
              <GeoRow
                label="Footprint"
                unit={isMm ? 'mm²' : 'in²'}
                {...flat(formatAmount(isMm ? areaMm2 : areaMm2 / (25.4 * 25.4)), 'Length × width')}
              />
              <GeoRow label="Perimeter" unit={linearUnit} {...flat(formatLinear(isMm ? perimeterMm : perimeterMm / 25.4), 'Cut length')} />
              <GeoRow label="Diagonal" unit={linearUnit} {...flat(formatLinear(isMm ? diagonalMm : diagonalMm / 25.4), 'Corner to corner')} />
              {holeCount != null ? (
                <GeoRow label="Holes" value={isDetectingHoles ? '…' : String(holeCount)} caption="Fully round" />
              ) : null}
              <GeoRow label="Pierces" {...flat(String(pierceCount), 'Every cut-out inside the part')} />
            </>
          ) : (
            <GeoSkeleton count={4} />
          )}
        </dl>
      </section>

      <div className="ipw-geo-spacer" />

      <button
        type="button"
        className="ipw-proceed"
        onClick={() => setIsQuoteFlowActive(true)}
        disabled={!ready}
      >
        <span className="ipw-proceed-text">
          <strong>Proceed to quote</strong>
          <small>{isFlatPending ? 'Working out the flat pattern…' : 'Choose method, material and finish'}</small>
        </span>
        <span className="ipw-proceed-arrow" aria-hidden="true">
          <ArrowRight size={16} />
        </span>
      </button>
    </aside>
  );
};

export default PricingSidebar;

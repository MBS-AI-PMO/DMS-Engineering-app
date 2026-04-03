import React from 'react';

const DiscountTable = ({ allDiscounts, currentQuantity }) => {
  if (!allDiscounts || allDiscounts.length === 0) return null;

  const targetQuantities = [2, 10, 50, 100, 1000];

  // Filter only quantities that have at least one discount trigger <= that quantity
  const activeTiers = targetQuantities.filter(q =>
    allDiscounts.some(d => (d.quantities || []).some(trigger => trigger <= q))
  );

  if (activeTiers.length === 0) return null;

  return (
    <div className="discount-table-mini mt-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-muted fw-bold text-uppercase" style={{ fontSize: '10px', letterSpacing: '1px' }}>
          Volume Discounts
        </span>
      </div>
      <div className="d-flex flex-wrap gap-2">
        {activeTiers.map(qty => {
          const applicableTiers = allDiscounts.filter(d => (d.quantities || []).some(q => q <= qty));
          if (applicableTiers.length === 0) return null;

          // Find the best percentage for this quantity
          const bestTier = applicableTiers.reduce((prev, current) =>
            (prev.discount_percent > current.discount_percent) ? prev : current
          );

          // Check if this tier is currently active for the selected quantity
          // A tier is active if the current quantity is >= the tier's quantity
          // and either it's the highest tier or less than the next tier
          const isActive = currentQuantity >= qty && (
            activeTiers.indexOf(qty) === activeTiers.length - 1 ||
            currentQuantity < activeTiers[activeTiers.indexOf(qty) + 1]
          );

          return (
            <div
              key={qty}
              className={`discount-tier-chip ${isActive ? 'active' : ''}`}
            >
              <span className="qty">{qty}+</span>
              <span className="percent">-{bestTier.discount_percent}%</span>
            </div>
          );
        })}
      </div>

      <style>{`
        .discount-table-mini {
          width: 100%;
        }
        .discount-tier-chip {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          min-width: 65px;
          transition: all 0.2s ease;
        }
        .discount-tier-chip.active {
          background: rgba(227, 27, 35, 0.1);
          border-color: #e31b23;
          box-shadow: 0 0 15px rgba(227, 27, 35, 0.15);
        }
        .discount-tier-chip .qty {
          font-size: 10px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
        }
        .discount-tier-chip.active .qty {
          color: #e31b23;
        }
        .discount-tier-chip .percent {
          font-size: 13px;
          font-weight: 900;
          color: #fff;
        }
        .discount-tier-chip.active .percent {
          color: #e31b23;
        }
      `}</style>
    </div>
  );
};

export default DiscountTable;

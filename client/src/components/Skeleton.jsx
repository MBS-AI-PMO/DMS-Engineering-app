import React from 'react';

const Skeleton = ({ className = '', style = {}, variant = 'rectangle', dark = false }) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'circle':
        return { borderRadius: '50%' };
      case 'text':
        return { height: '1em', borderRadius: '4px' };
      default:
        return { borderRadius: '8px' };
    }
  };

  const themeClass = dark ? 'premium-skeleton-dark' : 'premium-skeleton';

  return (
    <>
      <style>{`
        .premium-skeleton {
          position: relative !important;
          overflow: hidden !important;
          background: linear-gradient(90deg, #f1f5f9 25%, #e8edf2 50%, #f1f5f9 75%) !important;
          background-size: 200% 100% !important;
          display: inline-block !important;
          vertical-align: middle !important;
          min-height: 12px;
          animation: ps-shimmer 1.4s infinite !important;
        }
        .premium-skeleton-dark {
          position: relative !important;
          overflow: hidden !important;
          background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 75%) !important;
          background-size: 200% 100% !important;
          display: inline-block !important;
          vertical-align: middle !important;
          min-height: 12px;
          border-radius: 6px;
          animation: ps-shimmer 1.4s infinite !important;
        }
        @keyframes ps-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div
        className={`${themeClass} ${className}`}
        style={{
          ...getVariantStyles(),
          ...style
        }}
      />
    </>
  );
};

export default Skeleton;

import React from 'react';

const Skeleton = ({ className = '', style = {}, variant = 'rectangle' }) => {
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

  return (
    <>
      <style>{`
        .premium-skeleton {
          position: relative !important;
          overflow: hidden !important;
          background-color: rgba(255, 255, 255, 0.06) !important;
          display: inline-block !important;
          vertical-align: middle !important;
          min-height: 12px;
        }
        .premium-skeleton::after {
          content: '' !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          transform: translateX(-100%);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.08),
            transparent
          ) !important;
          animation: premium-shimmer 1.5s infinite !important;
        }
        @keyframes premium-shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
      <div
        className={`premium-skeleton ${className}`}
        style={{
          ...getVariantStyles(),
          ...style
        }}
      />
    </>
  );
};

export default Skeleton;


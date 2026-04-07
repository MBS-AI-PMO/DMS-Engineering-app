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
    <div
      className={`skeleton ${className}`}
      style={{
        ...getVariantStyles(),
        ...style
      }}
    />
  );
};

export default Skeleton;


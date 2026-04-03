import React from 'react';

const Skeleton = ({ className = '', style = {} }) => {
  return (
    <div
      className={`skeleton-pulse ${className}`}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        ...style
      }}
    />
  );
};

export default Skeleton;

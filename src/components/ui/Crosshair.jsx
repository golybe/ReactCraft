// Прицел в центре экрана
import React from 'react';

export const Crosshair = () => {
  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: 100
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24">
        <line x1="12" y1="8" x2="12" y2="16" stroke="white" strokeWidth="2" />
        <line x1="8" y1="12" x2="16" y2="12" stroke="white" strokeWidth="2" />
      </svg>
    </div>
  );
};

export default Crosshair;

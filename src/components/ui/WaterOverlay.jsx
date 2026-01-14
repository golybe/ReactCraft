import React from 'react';

/**
 * WaterOverlay - визуальный эффект нахождения под водой
 * 
 * Отображает синеватый полупрозрачный оверлей, когда голова игрока под водой.
 * Использует CSS анимацию для плавного появления/исчезновения и
 * волнистый эффект для реалистичности.
 */
const WaterOverlay = ({ isUnderwater }) => {
    if (!isUnderwater) return null;

    return (
        <div className="water-overlay">
            <div className="water-overlay-gradient" />
            <div className="water-overlay-bubbles" />
        </div>
    );
};

// Styles in CSS module or inline
const styles = `
.water-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
  animation: waterFadeIn 0.3s ease-out;
}

@keyframes waterFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.water-overlay-gradient {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    ellipse at center,
    rgba(20, 80, 150, 0.35) 0%,
    rgba(10, 50, 100, 0.5) 50%,
    rgba(5, 30, 70, 0.65) 100%
  );
  animation: waterPulse 3s ease-in-out infinite;
}

@keyframes waterPulse {
  0%, 100% {
    opacity: 0.9;
  }
  50% {
    opacity: 1;
  }
}

.water-overlay-bubbles {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: 
    radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.1) 2px, transparent 2px),
    radial-gradient(circle at 30% 70%, rgba(255, 255, 255, 0.08) 3px, transparent 3px),
    radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.06) 4px, transparent 4px),
    radial-gradient(circle at 70% 80%, rgba(255, 255, 255, 0.1) 2px, transparent 2px),
    radial-gradient(circle at 90% 10%, rgba(255, 255, 255, 0.08) 3px, transparent 3px),
    radial-gradient(circle at 20% 90%, rgba(255, 255, 255, 0.06) 2px, transparent 2px),
    radial-gradient(circle at 80% 50%, rgba(255, 255, 255, 0.07) 3px, transparent 3px);
  animation: bubblesRise 4s linear infinite;
}

@keyframes bubblesRise {
  0% {
    transform: translateY(0);
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(-30px);
    opacity: 0.3;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    if (!document.querySelector('style[data-water-overlay]')) {
        styleEl.setAttribute('data-water-overlay', 'true');
        document.head.appendChild(styleEl);
    }
}

export default WaterOverlay;

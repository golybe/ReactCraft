/**
 * DeathScreen - экран смерти игрока
 */
import React from 'react';
import './DeathScreen.css';

const DeathScreen = ({ onRespawn, deathMessage = 'You died!' }) => {
  return (
    <div className="death-screen">
      <div className="death-screen-overlay" />

      <div className="death-screen-content">
        <h1 className="death-title">{deathMessage}</h1>

        <div className="death-buttons">
          <button
            className="death-button respawn-button"
            onClick={onRespawn}
          >
            Respawn
          </button>
        </div>

        <p className="death-hint">
          Press ESC to open menu
        </p>
      </div>
    </div>
  );
};

export default DeathScreen;

/**
 * GameUI - UI компоненты игры (пауза, сообщения, debug)
 */
import React from 'react';
import { GAME_MODES, GAME_MODE_NAMES } from '../../constants/gameMode';

// Компонент кнопки в стиле Minecraft
const MCButton = ({ children, onClick, style, className }) => (
  <button
    className={`mc-button ${className || ''}`}
    onClick={onClick}
    style={style}
  >
    {children}
  </button>
);

/**
 * Экран загрузки
 */
export const LoadingScreen = ({ worldName, progress }) => {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1a1a2e',
      color: 'white',
      fontFamily: "'VT323', monospace"
    }}>
      <h1 style={{ marginBottom: '20px', fontSize: '48px', color: '#fff', textShadow: '2px 2px 0 #000' }}>
        {worldName || 'Minecraft React'}
      </h1>
      <div style={{
        width: '300px',
        height: '24px',
        border: '2px solid #fff',
        backgroundColor: '#000',
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          backgroundColor: '#4CAF50',
          transition: 'width 0.1s'
        }} />
      </div>
      <p style={{ marginTop: '10px', fontSize: '24px' }}>Генерация чанков... {progress}%</p>
    </div>
  );
};

/**
 * Меню паузы
 */
export const PauseMenu = ({
  onResume,
  onSaveAndExit,
  onExitToMenu,
  onSaveWorld
}) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        alignItems: 'center',
        width: '100%',
        maxWidth: '350px'
      }}>
        <h2 style={{
          marginBottom: '20px',
          color: '#fff',
          fontSize: '40px',
          fontFamily: "'VT323', monospace",
          textShadow: '2px 2px 0 #000'
        }}>
          Меню игры
        </h2>

        <MCButton onClick={onResume}>
          Вернуться в игру
        </MCButton>

        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          <MCButton onClick={() => alert('Достижения пока недоступны')}>
            Достижения
          </MCButton>
          <MCButton onClick={() => alert('Статистика пока недоступна')}>
            Статистика
          </MCButton>
        </div>

        <MCButton onClick={() => alert('Настройки пока недоступны')}>
          Настройки
        </MCButton>

        {onSaveWorld && (
          <MCButton onClick={onSaveAndExit}>
            Сохранить и выйти
          </MCButton>
        )}

        {onExitToMenu && (
          <MCButton onClick={onExitToMenu} style={{ marginTop: '10px' }}>
            Выйти в меню
          </MCButton>
        )}
      </div>
    </div>
  );
};

/**
 * Сообщение о сохранении
 */
export const SaveMessage = ({ message }) => {
  if (!message) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      color: '#4CAF50',
      padding: '15px 30px',
      border: '2px solid #fff',
      fontFamily: "'VT323', monospace",
      fontSize: '24px',
      zIndex: 1001,
      animation: 'fadeIn 0.2s ease'
    }}>
      {message}
    </div>
  );
};

/**
 * Debug информация
 */
export const DebugInfo = ({
  fps,
  playerPos,
  chunksCount,
  blocksCount,
  biome,
  gameMode,
  isInWater,
  isHeadUnderwater,
  canFly,
  isFlying
}) => {
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      color: 'white',
      fontFamily: "'VT323', monospace",
      fontSize: '20px',
      textShadow: '1px 1px 0 #000',
      zIndex: 100,
      lineHeight: '1.2'
    }}>
      <div>Minecraft React 1.0</div>
      <div>{Math.round(fps)} fps</div>
      <div>XYZ: {playerPos.x.toFixed(3)} / {playerPos.y.toFixed(3)} / {playerPos.z.toFixed(3)}</div>
      <div>Chunk: {Math.floor(playerPos.x / 16)} {Math.floor(playerPos.y / 16)} {Math.floor(playerPos.z / 16)}</div>
      <div>Chunks loaded: {chunksCount}</div>
      <div>Entities: {blocksCount} blocks</div>
      <div style={{ color: '#aaa' }}>Biome: {biome}</div>
      <div style={{ color: gameMode === GAME_MODES.CREATIVE ? '#6aadbd' : '#6abd6e' }}>
        Mode: {GAME_MODE_NAMES[gameMode]}
      </div>
      {(canFly || isFlying) && (
        <div style={{ color: isFlying ? '#f1c40f' : '#bdc3c7' }}>
          Fly: {isFlying ? 'ON' : 'OFF'} {canFly && !isFlying && '(Ability)'}
        </div>
      )}
      {isInWater && (
        <div style={{ color: isHeadUnderwater ? '#4488ff' : '#66aaff' }}>
          {isHeadUnderwater ? '🌊 Underwater' : '💧 In water'}
        </div>
      )}
    </div>
  );
};

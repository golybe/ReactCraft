/**
 * GameProvider - Context провайдер для GameEngine
 */
import React, { createContext, useContext, useRef, useEffect, useState } from 'react';
import { GameEngine } from '../../core/engine/GameEngine';

const GameContext = createContext(null);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};

export const GameProvider = ({ 
  worldInfo, 
  initialChunks, 
  initialPlayerPos, 
  children,
  onChunksUpdate,
  onStateChange 
}) => {
  const engineRef = useRef(null);
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    // Создаем GameEngine
    engineRef.current = new GameEngine(worldInfo, initialChunks, initialPlayerPos);
    
    // Устанавливаем callback для обновления чанков
    if (onChunksUpdate) {
      engineRef.current.onChunksUpdate = onChunksUpdate;
    }
    
    // Устанавливаем callback для изменений состояния
    engineRef.current.onStateChange = (newState) => {
      setGameState(newState);
      if (onStateChange) {
        onStateChange(newState);
      }
    };
    
    // Инициализируем игру
    engineRef.current.initialize();
    
    // Первое уведомление о состоянии
    engineRef.current.notifyStateChange();
    
    return () => {
      // Очистка при размонтировании
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, [worldInfo, initialChunks, initialPlayerPos, onChunksUpdate, onStateChange]);

  return (
    <GameContext.Provider value={{ engine: engineRef.current, gameState }}>
      {children}
    </GameContext.Provider>
  );
};

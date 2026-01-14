import { useState, useRef, useEffect, useCallback } from 'react';
import { GAME_MODES, getGameModeDefaults } from '../constants/gameMode';

/**
 * Hook for managing core game state (pause, game mode, save)
 * 
 * Note: UI state (inventory, crafting, etc.) is now managed separately via activeUI
 */
export function useGameState({
  initialGameMode = GAME_MODES.SURVIVAL,
  onSaveWorld,
  worldRef,
  inventoryRef,
  onExitToMenu
}) {
  const [gameMode, setGameMode] = useState(initialGameMode);
  const [isPaused, setIsPaused] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');

  const pauseGame = useCallback(() => {
    setIsPaused(true);
    setShowInstructions(true);
  }, []);

  const resumeGame = useCallback(() => {
    document.body.requestPointerLock();
  }, []);

  const handleSaveGame = useCallback(async (inventory, playerPos) => {
    if (worldRef?.current && onSaveWorld) {
      setSaveMessage('Сохранение...');
      const modifiedData = worldRef.current.getSaveData();
      const inventoryData = inventoryRef?.current ? inventoryRef.current.serialize() : inventory;
      console.log('[SAVE] Saving player position:', playerPos);
      await onSaveWorld(modifiedData, playerPos, { gameMode, inventory: inventoryData });
      setSaveMessage('Мир сохранён!');
      setTimeout(() => setSaveMessage(''), 2000);
    }
  }, [worldRef, onSaveWorld, gameMode, inventoryRef]);

  const handleSaveAndExit = useCallback(async (inventory, playerPos) => {
    if (worldRef?.current && onSaveWorld) {
      setSaveMessage('Сохранение...');
      const modifiedData = worldRef.current.getSaveData();
      const inventoryData = inventoryRef?.current ? inventoryRef.current.serialize() : inventory;
      await onSaveWorld(modifiedData, playerPos, { gameMode, inventory: inventoryData });

      if (onExitToMenu) {
        onExitToMenu();
      }
    }
  }, [worldRef, onSaveWorld, gameMode, inventoryRef, onExitToMenu]);

  const handleExitToMenu = useCallback((inventory, playerPos) => {
    handleSaveGame(inventory, playerPos);
    if (onExitToMenu) {
      onExitToMenu();
    }
  }, [handleSaveGame, onExitToMenu]);

  return {
    gameMode,
    setGameMode,
    isPaused,
    setIsPaused,
    showInstructions,
    setShowInstructions,
    saveMessage,
    pauseGame,
    resumeGame,
    handleSaveGame,
    handleSaveAndExit,
    handleExitToMenu
  };
}

export default useGameState;

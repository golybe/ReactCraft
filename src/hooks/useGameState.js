import { useState, useRef, useEffect, useCallback } from 'react';
import { GAME_MODES, getGameModeDefaults } from '../constants/gameMode';

/**
 * Hook for managing core game state (pause, game mode, UI visibility)
 */
export function useGameState({
  initialGameMode = GAME_MODES.SURVIVAL,
  onSaveWorld,
  worldRef,
  playerPos,
  inventoryRef,
  onExitToMenu
}) {
  const [gameMode, setGameMode] = useState(initialGameMode);
  const [isPaused, setIsPaused] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const isInventoryOpenRef = useRef(isInventoryOpen);

  // Sync ref with state
  useEffect(() => {
    isInventoryOpenRef.current = isInventoryOpen;
  }, [isInventoryOpen]);

  const pauseGame = useCallback(() => {
    setIsPaused(true);
    setShowInstructions(true);
  }, []);

  const resumeGame = useCallback(() => {
    document.body.requestPointerLock();
  }, []);

  const toggleInventory = useCallback((isChatOpen) => {
    if (isChatOpen) return;

    if (!isInventoryOpen && !isPaused) {
      setIsInventoryOpen(true);
      isInventoryOpenRef.current = true;
      document.exitPointerLock();
    } else if (isInventoryOpen) {
      setIsInventoryOpen(false);
      isInventoryOpenRef.current = false;
      document.body.requestPointerLock();
    }
  }, [isInventoryOpen, isPaused]);

  const closeInventory = useCallback(() => {
    setIsInventoryOpen(false);
    isInventoryOpenRef.current = false;
    document.body.requestPointerLock();
  }, []);

  const handleSaveGame = useCallback(async (inventory) => {
    if (worldRef?.current && onSaveWorld) {
      setSaveMessage('Сохранение...');
      const modifiedData = worldRef.current.getSaveData();
      const inventoryData = inventoryRef?.current ? inventoryRef.current.serialize() : inventory;
      await onSaveWorld(modifiedData, playerPos, { gameMode, inventory: inventoryData });
      setSaveMessage('Мир сохранён!');
      setTimeout(() => setSaveMessage(''), 2000);
    }
  }, [worldRef, onSaveWorld, playerPos, gameMode, inventoryRef]);

  const handleSaveAndExit = useCallback(async (inventory) => {
    if (worldRef?.current && onSaveWorld) {
      setSaveMessage('Сохранение...');
      const modifiedData = worldRef.current.getSaveData();
      const inventoryData = inventoryRef?.current ? inventoryRef.current.serialize() : inventory;
      await onSaveWorld(modifiedData, playerPos, { gameMode, inventory: inventoryData });

      if (onExitToMenu) {
        onExitToMenu();
      }
    }
  }, [worldRef, onSaveWorld, playerPos, gameMode, inventoryRef, onExitToMenu]);

  const handleExitToMenu = useCallback((inventory) => {
    handleSaveGame(inventory);
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
    isInventoryOpen,
    setIsInventoryOpen,
    isInventoryOpenRef,
    saveMessage,
    pauseGame,
    resumeGame,
    toggleInventory,
    closeInventory,
    handleSaveGame,
    handleSaveAndExit,
    handleExitToMenu
  };
}

export default useGameState;

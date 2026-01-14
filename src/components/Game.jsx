// Рефакторенный главный игровой компонент
import React, { useEffect, useCallback } from 'react';
import { BLOCK_TYPES, HOTBAR_BLOCKS } from '../constants/blocks';
import { GAME_MODES } from '../constants/gameMode';
import Crosshair from './ui/Crosshair';
import Hotbar from './ui/Hotbar';
import Chat from './ui/Chat';
import Inventory from './inventory/Inventory';
import { GameCanvas } from './game/GameCanvas';
import { LoadingScreen, PauseMenu, SaveMessage, DebugInfo } from './game/GameUI';
import { InputManager, INPUT_ACTIONS } from '../core/input/InputManager';

// Custom hooks
import {
  useDebugInfo,
  useGameState,
  useWorldLoading,
  usePlayerMovement,
  useInventoryManagement,
  useChatCommands,
  useBlockInteraction
} from '../hooks';

const Game = ({ worldInfo, initialChunks, initialPlayerPos, onSaveWorld, onExitToMenu }) => {
  // === SHARED ENTITY STATE (Dropped items, Debris) ===
  const [droppedItems, setDroppedItems] = React.useState([]);
  const [debrisList, setDebrisList] = React.useState([]);

  // === DEBUG INFO ===
  const { debugInfo, setChunksCount, setBlocksCount } = useDebugInfo();

  // === PLAYER MOVEMENT ===
  const {
    playerPos,
    setPlayerPos,
    playerYaw,
    playerPitch,
    isFlying,
    canFly,
    setCanFly,
    noclipMode,
    setNoclipMode,
    speedMultiplier,
    setSpeedMultiplier,
    teleportPos,
    handlePlayerMove,
    teleportTo
  } = usePlayerMovement({
    initialPlayerPos,
    gameMode: worldInfo?.gameMode ?? GAME_MODES.SURVIVAL
  });

  // === WORLD LOADING ===
  const {
    chunks,
    setChunks,
    isLoading,
    loadingProgress,
    currentBiome,
    worldRef
  } = useWorldLoading({
    worldInfo,
    initialChunks,
    playerPos,
    onChunksCountChange: setChunksCount
  });

  // === GAME STATE ===
  const {
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
    resumeGame,
    handleSaveGame,
    handleSaveAndExit,
    handleExitToMenu
  } = useGameState({
    initialGameMode: worldInfo?.gameMode ?? GAME_MODES.SURVIVAL,
    onSaveWorld,
    worldRef,
    playerPos,
    onExitToMenu
  });

  // === CHAT COMMANDS ===
  const {
    isChatOpen,
    setIsChatOpen,
    isChatOpenRef,
    chatMessages,
    openChat,
    closeChat,
    handleSendMessage
  } = useChatCommands({
    worldInfo,
    playerPos,
    setGameMode,
    setNoclipMode,
    setCanFly,
    setSpeedMultiplier,
    teleportTo
  });

  // === INVENTORY MANAGEMENT ===
  const {
    inventory,
    setInventory,
    hotbar,
    selectedSlot,
    setSelectedSlot,
    inventoryRef,
    getSelectedBlockType,
    handleSelectSlot,
    scrollHotbar,
    handleDropItem
  } = useInventoryManagement({
    worldInfo,
    gameMode,
    playerPos,
    playerYaw,
    playerPitch,
    isChatOpen,
    isInventoryOpen,
    isPaused,
    setDroppedItems
  });

  // === BLOCK INTERACTION ===
  const {
    miningState,
    isMouseDown,
    lastPunchTime,
    miningManagerRef,
    handleBlockDestroy,
    handleBlockPlace,
    handlePunch,
    handleMouseStateChange,
    handleStopMining,
    handleLookingAtBlock,
    handleItemPickup,
    getBlockAt
  } = useBlockInteraction({
    gameMode,
    playerPos,
    worldRef,
    inventoryRef,
    selectedSlot,
    setChunks,
    setInventory,
    debrisList,
    setDebrisList,
    droppedItems,
    setDroppedItems
  });

  // Обновляем inventoryRef в useGameState для сохранения
  useEffect(() => {
    if (inventoryRef.current) {
      // Хук useGameState нуждается в доступе к inventoryRef для сохранения
    }
  }, [inventoryRef]);

  // === INPUT MANAGER ===
  const inputManagerRef = React.useRef(null);

  useEffect(() => {
    const inputManager = new InputManager();
    inputManagerRef.current = inputManager;
    inputManager.attach();

    return () => {
      inputManager.destroy();
    };
  }, []);

  // Update InputManager handlers when state changes
  useEffect(() => {
    if (!inputManagerRef.current) return;

    const inputManager = inputManagerRef.current;

    // Update UI state in InputManager
    inputManager.setUIState({
      isChatOpen,
      isInventoryOpen,
      isPaused
    });

    // Clear old handlers
    inputManager.off(INPUT_ACTIONS.DROP_ITEM);
    inputManager.off(INPUT_ACTIONS.OPEN_CHAT);
    inputManager.off(INPUT_ACTIONS.TOGGLE_INVENTORY);
    inputManager.off(INPUT_ACTIONS.HOTBAR_SCROLL_DOWN);
    inputManager.off(INPUT_ACTIONS.HOTBAR_SCROLL_UP);
    for (let i = 1; i <= 9; i++) {
      inputManager.off(INPUT_ACTIONS[`SELECT_SLOT_${i}`]);
    }

    // Register action handlers with current state
    inputManager.on(INPUT_ACTIONS.DROP_ITEM, handleDropItem);

    inputManager.on(INPUT_ACTIONS.OPEN_CHAT, () => {
      openChat(isInventoryOpen, isPaused);
    });

    inputManager.on(INPUT_ACTIONS.TOGGLE_INVENTORY, () => {
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
    });

    // Hotbar slot selection
    for (let i = 1; i <= 9; i++) {
      inputManager.on(INPUT_ACTIONS[`SELECT_SLOT_${i}`], () => {
        setSelectedSlot(i - 1);
      });
    }

    // Hotbar scroll
    inputManager.on(INPUT_ACTIONS.HOTBAR_SCROLL_DOWN, () => scrollHotbar(1));
    inputManager.on(INPUT_ACTIONS.HOTBAR_SCROLL_UP, () => scrollHotbar(-1));
  }, [isChatOpen, isPaused, isInventoryOpen, handleDropItem, openChat, scrollHotbar, setSelectedSlot, setIsInventoryOpen, isInventoryOpenRef]);

  // Pointer lock handling
  useEffect(() => {
    const handleChange = () => {
      const locked = document.pointerLockElement === document.body;

      if (inputManagerRef.current) {
        inputManagerRef.current.setPointerLocked(locked);
      }

      if (locked) {
        setIsPaused(false);
        setShowInstructions(false);

        if (isInventoryOpenRef.current) {
          setIsInventoryOpen(false);
          isInventoryOpenRef.current = false;
        }
      } else {
        if (!isChatOpenRef.current && !isInventoryOpenRef.current) {
          setIsPaused(true);
          setShowInstructions(true);
        }
      }
    };

    const handleError = () => {
      console.error('Pointer lock failed');
      if (!isChatOpenRef.current && !isInventoryOpenRef.current) {
        setIsPaused(true);
        setShowInstructions(true);
      }
    };

    document.addEventListener('pointerlockchange', handleChange);
    document.addEventListener('pointerlockerror', handleError);

    return () => {
      document.removeEventListener('pointerlockchange', handleChange);
      document.removeEventListener('pointerlockerror', handleError);
    };
  }, [setIsPaused, setShowInstructions, setIsInventoryOpen, isInventoryOpenRef, isChatOpenRef]);

  // Blocks count callback
  const handleBlocksCount = useCallback((count) => {
    setBlocksCount(count);
  }, [setBlocksCount]);

  // Save handlers with inventory
  const onSaveGame = useCallback(async () => {
    await handleSaveGame(inventory);
  }, [handleSaveGame, inventory]);

  const onSaveAndExit = useCallback(async () => {
    await handleSaveAndExit(inventory);
  }, [handleSaveAndExit, inventory]);

  const onExit = useCallback(() => {
    handleExitToMenu(inventory);
  }, [handleExitToMenu, inventory]);

  // Loading screen
  if (isLoading) {
    return <LoadingScreen worldName={worldInfo?.name} progress={loadingProgress} />;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <GameCanvas
        chunks={chunks}
        chunkManager={worldRef.current?.getChunkManager()}
        liquidSimulator={worldRef.current?.getLiquidSimulator()}
        miningManager={miningManagerRef.current}
        gameMode={gameMode}
        isMouseDown={isMouseDown}
        miningState={miningState}
        droppedItems={droppedItems}
        debrisList={debrisList}
        playerPos={playerPos}
        selectedBlock={getSelectedBlockType()}
        isFlying={isFlying}
        lastPunchTime={lastPunchTime}
        initialPlayerPos={initialPlayerPos}
        noclipMode={noclipMode}
        canFly={canFly}
        speedMultiplier={speedMultiplier}
        isChatOpen={isChatOpen}
        teleportPos={teleportPos}
        onPlayerMove={handlePlayerMove}
        onBlocksCount={handleBlocksCount}
        onBlockDestroy={handleBlockDestroy}
        onBlockPlace={handleBlockPlace}
        onPunch={handlePunch}
        onMouseStateChange={handleMouseStateChange}
        onStopMining={handleStopMining}
        onLookingAtBlock={handleLookingAtBlock}
        onItemPickup={handleItemPickup}
        getBlockAt={getBlockAt}
        onChunksUpdate={setChunks}
      />

      <Crosshair />
      <Hotbar
        selectedSlot={selectedSlot}
        onSelectSlot={handleSelectSlot}
        hotbarItems={hotbar}
        showCount={gameMode === GAME_MODES.SURVIVAL}
      />

      <Inventory
        isOpen={isInventoryOpen}
        onClose={() => {
          setIsInventoryOpen(false);
          document.body.requestPointerLock();
        }}
        inventory={inventory}
        onInventoryChange={setInventory}
        isCreativeMode={gameMode === GAME_MODES.CREATIVE}
      />

      <Chat
        isOpen={isChatOpen}
        onClose={closeChat}
        onSendMessage={handleSendMessage}
        messages={chatMessages}
      />

      <SaveMessage message={saveMessage} />

      {showInstructions && (
        <PauseMenu
          onResume={resumeGame}
          onSaveAndExit={onSaveAndExit}
          onExitToMenu={onExit}
          onSaveWorld={onSaveWorld}
        />
      )}

      {!showInstructions && (
        <DebugInfo
          fps={debugInfo.fps}
          playerPos={playerPos}
          chunksCount={debugInfo.chunksCount}
          blocksCount={debugInfo.blocksCount}
          biome={currentBiome}
          gameMode={gameMode}
        />
      )}
    </div>
  );
};

export default Game;

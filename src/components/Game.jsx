// Рефакторенный главный игровой компонент
import React, { useEffect, useCallback } from 'react';
import { BLOCK_TYPES, HOTBAR_BLOCKS } from '../constants/blocks';
import { GAME_MODES } from '../constants/gameMode';
import { UI_TYPES, isUIBlocking } from '../constants/uiTypes';
import Crosshair from './ui/Crosshair';
import Hotbar from './ui/Hotbar';
import Chat from './ui/Chat';
import UIManager from './ui/UIManager';
import WaterOverlay from './ui/WaterOverlay';
import HealthBar from './ui/HealthBar';
import DeathScreen from './ui/DeathScreen';
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

  // === UNIFIED UI STATE ===
  const [activeUI, setActiveUI] = React.useState(UI_TYPES.NONE);
  const activeUIRef = React.useRef(UI_TYPES.NONE);

  // === DEATH STATE ===
  const [isDead, setIsDead] = React.useState(false);
  const [deathMessage, setDeathMessage] = React.useState('You died!');
  const playerInstanceRef = React.useRef(null);

  // === DEBUG INFO ===
  const { debugInfo, setChunksCount, setBlocksCount } = useDebugInfo();

  // === PLAYER MOVEMENT === (создаём playerPos первым)
  const {
    playerPos,
    setPlayerPos,
    playerYaw,
    playerPitch,
    isFlying,
    setIsFlying,
    canFly,
    setCanFly,
    noclipMode,
    setNoclipMode,
    speedMultiplier,
    setSpeedMultiplier,
    teleportPos,
    isInWater,
    isHeadUnderwater,
    health,
    maxHealth,
    handlePlayerMove,
    teleportTo
  } = usePlayerMovement({
    initialPlayerPos,
    gameMode: worldInfo?.gameMode ?? GAME_MODES.SURVIVAL, // Используем начальный режим
    worldInfo // Передаём worldInfo для загрузки сохраненных данных
  });

  // === WORLD LOADING ===
  const {
    chunks,
    setChunks,
    isLoading,
    loadingProgress,
    currentBiome,
    worldRef,
    entityManager
  } = useWorldLoading({
    worldInfo,
    initialChunks,
    playerPos, // Теперь используем актуальный playerPos
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
    saveMessage,
    resumeGame,
    handleSaveGame,
    handleSaveAndExit,
    handleExitToMenu
  } = useGameState({
    initialGameMode: worldInfo?.gameMode ?? GAME_MODES.SURVIVAL,
    onSaveWorld,
    worldRef,
    onExitToMenu
  });

  // Обновляем gameMode в usePlayerMovement при изменении
  useEffect(() => {
    // gameMode изменился, обновляем способности
  }, [gameMode]);

  // Helper to check if any UI is open
  const isUIOpen = isUIBlocking(activeUI);

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
    playerYaw,
    setGameMode,
    noclipMode,
    setNoclipMode,
    canFly,
    setCanFly,
    setIsFlying,
    setSpeedMultiplier,
    teleportTo,
    player: playerInstanceRef.current,
    entityManager,
    world: worldRef.current
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
    handleDropItem,
    handleInventoryChangeFromUI, // Для изменений из UI
    craftingGrid,
    setCraftingGrid,
    craftingResult,
    handleCraftResultPickup,
    handleShiftCraftResult,
    // 3x3 crafting (crafting table)
    craftingGrid3x3,
    setCraftingGrid3x3,
    craftingResult3x3,
    handleCraftResult3x3Pickup,
    handleShiftCraftResult3x3
  } = useInventoryManagement({
    worldInfo,
    gameMode,
    playerPos,
    playerYaw,
    playerPitch,
    isChatOpen,
    isInventoryOpen: isUIOpen, // Use unified UI state
    isPaused,
    setDroppedItems
  });

  // === BLOCK INTERACTION ===
  const {
    miningState,
    isMouseDown,
    lastPunchTime,
    miningManagerRef,
    handleBlockDestroy: handleBlockBreak,
    handleBlockPlace,
    handlePunch,
    handleStopMining,
    handleMouseStateChange,
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

  // Sync inventoryRef for save handlers
  useEffect(() => {
    if (inventoryRef.current) {
      // Hook useGameState needs access to inventoryRef for saving
    }
  }, [inventoryRef]);

  // === INPUT MANAGER ===
  const inputManagerRef = React.useRef(null);

  // Close any open UI (returns items to inventory if needed)
  const closeUI = useCallback(() => {
    const prevUI = activeUIRef.current;

    // Return items from crafting grids to inventory
    if (prevUI === UI_TYPES.CRAFTING) {
      const itemsToReturn = craftingGrid3x3.filter(item => item && item.count > 0);
      if (itemsToReturn.length > 0 && inventoryRef.current) {
        itemsToReturn.forEach(item => {
          inventoryRef.current.addToFullInventory(item.type, item.count);
        });
        setInventory(inventoryRef.current.getSlots());
        setCraftingGrid3x3(Array(9).fill(null));
      }
    } else if (prevUI === UI_TYPES.INVENTORY) {
      const itemsToReturn = craftingGrid.filter(item => item && item.count > 0);
      if (itemsToReturn.length > 0 && inventoryRef.current) {
        itemsToReturn.forEach(item => {
          inventoryRef.current.addToFullInventory(item.type, item.count);
        });
        setInventory(inventoryRef.current.getSlots());
        setCraftingGrid(Array(4).fill(null));
      }
    }

    setActiveUI(UI_TYPES.NONE);
    activeUIRef.current = UI_TYPES.NONE;
    document.body.requestPointerLock();
  }, [craftingGrid3x3, craftingGrid, inventoryRef, setInventory, setCraftingGrid3x3, setCraftingGrid]);

  // Open specific UI
  const openUI = useCallback((uiType) => {
    setActiveUI(uiType);
    activeUIRef.current = uiType;
    document.exitPointerLock();
  }, []);

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
      isInventoryOpen: isUIOpen,
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
      openChat(isUIOpen, isPaused);
    });

    inputManager.on(INPUT_ACTIONS.TOGGLE_INVENTORY, () => {
      if (isChatOpen) return;

      // If any UI is open - close it
      if (isUIOpen) {
        closeUI();
        return;
      }

      // Open inventory if not paused
      if (!isPaused) {
        openUI(UI_TYPES.INVENTORY);
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
  }, [isChatOpen, isPaused, isUIOpen, handleDropItem, openChat, closeUI, openUI, scrollHotbar, setSelectedSlot]);

  // Pointer lock handling
  useEffect(() => {
    const handleChange = () => {
      const locked = document.pointerLockElement === document.body;

      if (inputManagerRef.current) {
        inputManagerRef.current.setPointerLocked(locked);
      }

      if (locked) {
        // Не разрешаем lock если игрок мертв
        if (isDead) {
          document.exitPointerLock();
          return;
        }

        setIsPaused(false);
        setShowInstructions(false);

        // Close any UI when pointer is locked
        if (activeUIRef.current !== UI_TYPES.NONE) {
          setActiveUI(UI_TYPES.NONE);
          activeUIRef.current = UI_TYPES.NONE;
        }
      } else {
        // Pause if no UI is open (но не если игрок мертв)
        if (!isDead && !isChatOpenRef.current && activeUIRef.current === UI_TYPES.NONE) {
          setIsPaused(true);
          setShowInstructions(true);
        }
      }
    };

    const handleError = () => {
      console.error('Pointer lock failed');
      if (!isDead && !isChatOpenRef.current && activeUIRef.current === UI_TYPES.NONE) {
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
  }, [isDead, setIsPaused, setShowInstructions, isChatOpenRef]);

  // Освобождаем pointer lock при смерти
  useEffect(() => {
    if (isDead && document.pointerLockElement === document.body) {
      document.exitPointerLock();
    }
  }, [isDead]);



  // Save handlers with inventory
  const onSaveGame = useCallback(async () => {
    await handleSaveGame(inventory, playerPos, health, maxHealth, playerYaw, playerPitch);
  }, [handleSaveGame, inventory, playerPos, health, maxHealth, playerYaw, playerPitch]);

  const onSaveAndExit = useCallback(async () => {
    await handleSaveAndExit(inventory, playerPos, health, maxHealth, playerYaw, playerPitch);
  }, [handleSaveAndExit, inventory, playerPos, health, maxHealth, playerYaw, playerPitch]);

  const onExit = useCallback(() => {
    handleExitToMenu(inventory, playerPos, health, maxHealth, playerYaw, playerPitch);
  }, [handleExitToMenu, inventory, playerPos, health, maxHealth, playerYaw, playerPitch]);

  // === DEATH / RESPAWN HANDLERS ===
  const handlePlayerDeath = useCallback((source) => {
    setIsDead(true);
    // Устанавливаем сообщение в зависимости от источника урона
    if (source === 'fall') {
      setDeathMessage('You fell to your death!');
    } else if (source === 'command') {
      setDeathMessage('You died!');
    } else {
      setDeathMessage('You died!');
    }
    // Освобождаем pointer lock
    document.exitPointerLock();
  }, []);

  const handleRespawn = useCallback(() => {
    if (playerInstanceRef.current) {
      playerInstanceRef.current.respawnPlayer();
      setIsDead(false);
      setDeathMessage('You died!');
      // Возвращаем pointer lock
      document.body.requestPointerLock();
    }
  }, []);

  const handlePlayerRef = useCallback((player) => {
    playerInstanceRef.current = player;
  }, []);

  // === FOOD EATING ===
  const [isEating, setIsEating] = React.useState(false);
  const [eatingProgress, setEatingProgress] = React.useState(0);
  const isEatingRef = React.useRef(false);
  const eatingIntervalRef = React.useRef(null);
  const eatingStartTimeRef = React.useRef(0);
  const eatingDataRef = React.useRef({ foodType: null, healAmount: 0 });

  const handleStartEating = useCallback((foodType, healAmount) => {
    if (!playerInstanceRef.current || isDead || isEatingRef.current) return;
    if (!inventoryRef?.current) return;

    // Проверяем, есть ли еда в инвентаре
    const slots = inventoryRef.current.getSlots();
    const selectedSlotData = slots[selectedSlot];
    if (!selectedSlotData || selectedSlotData.type !== foodType || selectedSlotData.count <= 0) {
      return;
    }

    // Начинаем анимацию поедания
    setIsEating(true);
    isEatingRef.current = true;
    setEatingProgress(0);
    eatingStartTimeRef.current = Date.now();
    eatingDataRef.current = { foodType, healAmount };

    // Анимация поедания (1.5 секунды как в Minecraft)
    const eatDuration = 1500;

    eatingIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - eatingStartTimeRef.current;
      const progress = Math.min(elapsed / eatDuration, 1);
      setEatingProgress(progress);

      if (progress >= 1) {
        // Завершаем поедание успешно
        clearInterval(eatingIntervalRef.current);
        eatingIntervalRef.current = null;

        setIsEating(false);
        isEatingRef.current = false;
        setEatingProgress(0);

        // Исцеляем игрока
        if (playerInstanceRef.current) {
          playerInstanceRef.current.heal(eatingDataRef.current.healAmount);
        }

        // Убираем 1 еду из инвентаря
        inventoryRef.current.removeItem(eatingDataRef.current.foodType, 1);
        setInventory(inventoryRef.current.getSlots());
      }
    }, 16); // ~60 FPS
  }, [isDead, selectedSlot, inventoryRef, setInventory]);

  const handleStopEating = useCallback(() => {
    // Отменяем поедание (отпустили ПКМ раньше времени)
    if (eatingIntervalRef.current) {
      clearInterval(eatingIntervalRef.current);
      eatingIntervalRef.current = null;
    }

    setIsEating(false);
    isEatingRef.current = false;
    setEatingProgress(0);
  }, []);

  // Останавливаем поедание при смене слота или открытии UI
  React.useEffect(() => {
    if (isEating) {
      handleStopEating();
    }
  }, [selectedSlot, activeUI, handleStopEating]);

  // Очистка при размонтировании
  React.useEffect(() => {
    return () => {
      if (eatingIntervalRef.current) {
        clearInterval(eatingIntervalRef.current);
      }
    };
  }, []);

  // === FURNACE STATE ===
  // Временное состояние печки (в будущем будет храниться в мире по координатам)
  const [furnacePosition, setFurnacePosition] = React.useState(null);

  // === CRAFTING TABLE INTERACTION ===
  // Wrapper for handleBlockPlace that checks for crafting table
  const handleBlockPlaceOrInteract = useCallback((x, y, z, breakPos, faceNormal) => {
    if (!worldRef?.current) return;

    // If breakPos is provided, check if it's a crafting table
    if (breakPos) {
      const hitBlock = worldRef.current.getBlock(breakPos.x, breakPos.y, breakPos.z);

      // Check if clicked block is a crafting table
      if (hitBlock === BLOCK_TYPES.CRAFTING_TABLE) {
        // Open crafting interface using unified UI system
        openUI(UI_TYPES.CRAFTING);
        return;
      }

      // Check if clicked block is a furnace
      if (hitBlock === BLOCK_TYPES.FURNACE) {
        // Сохраняем позицию печки для FurnaceManager
        setFurnacePosition({ x: breakPos.x, y: breakPos.y, z: breakPos.z });
        // Open furnace interface
        openUI(UI_TYPES.FURNACE);
        return;
      }
    }

    // Otherwise, place block as usual (pass faceNormal for torches)
    handleBlockPlace(x, y, z, faceNormal);
  }, [worldRef, handleBlockPlace, openUI]);

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
        entityManager={entityManager}
        miningState={miningState}
        isMouseDown={isMouseDown}
        lastPunchTime={lastPunchTime}
        playerPos={playerPos}
        playerYaw={playerYaw}
        playerPitch={playerPitch}
        selectedSlot={selectedSlot}
        selectedBlock={getSelectedBlockType()}
        droppedItems={droppedItems}
        debrisList={debrisList}
        gameMode={gameMode}
        noclipMode={noclipMode}
        isFlying={isFlying}
        canFly={canFly}
        speedMultiplier={speedMultiplier}
        isChatOpen={isChatOpen}
        isInventoryOpen={isUIOpen}
        isDead={isDead}
        teleportPos={teleportPos}
        initialPlayerPos={initialPlayerPos}
        initialHealth={health}
        initialMaxHealth={maxHealth}
        onPlayerMove={handlePlayerMove}
        onBlockDestroy={handleBlockBreak}
        onBlockPlace={handleBlockPlaceOrInteract}
        onPunch={handlePunch}
        onMouseStateChange={handleMouseStateChange}
        onStopMining={handleStopMining}
        onLookingAtBlock={handleLookingAtBlock}
        onItemPickup={handleItemPickup}
        getBlockAt={getBlockAt}
        onChunksUpdate={setChunks}
        onPlayerDeath={handlePlayerDeath}
        onPlayerRef={handlePlayerRef}
        onStartEating={handleStartEating}
        onStopEating={handleStopEating}
        isEating={isEating}
        eatingProgress={eatingProgress}
      />

      {/* Water effect overlay */}
      <WaterOverlay isUnderwater={isHeadUnderwater} />

      {/* Death screen overlay */}
      {isDead && (
        <DeathScreen onRespawn={handleRespawn} deathMessage={deathMessage} />
      )}

      {!isDead && <Crosshair />}

      {/* Health bar (only in survival mode when not dead) */}
      {gameMode === GAME_MODES.SURVIVAL && !isDead && (
        <div style={{
          position: 'fixed',
          bottom: '62px',
          left: '52.8%',
          transform: 'translateX(-50%)',
          marginLeft: '-176px', // Выравнивание слева от хотбара (половина ширины хотбара ~352px)
          zIndex: 100
        }}>
          <HealthBar health={health} maxHealth={maxHealth} />
        </div>
      )}

      <Hotbar
        selectedSlot={selectedSlot}
        onSelectSlot={handleSelectSlot}
        hotbarItems={hotbar}
        showCount={true}
      />

      {/* Unified UI Manager */}
      <UIManager
        activeUI={activeUI}
        onClose={closeUI}
        inventory={inventory}
        onInventoryChange={handleInventoryChangeFromUI}
        isCreativeMode={gameMode === GAME_MODES.CREATIVE}
        craftingGrid={craftingGrid}
        onCraftingGridChange={setCraftingGrid}
        craftingResult={craftingResult}
        onCraftResultPickup={handleCraftResultPickup}
        onShiftCraft={handleShiftCraftResult}
        craftingGrid3x3={craftingGrid3x3}
        onCraftingGrid3x3Change={setCraftingGrid3x3}
        craftingResult3x3={craftingResult3x3}
        onCraftResult3x3Pickup={handleCraftResult3x3Pickup}
        onShiftCraft3x3={handleShiftCraftResult3x3}
        furnacePosition={furnacePosition}
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
          isInWater={isInWater}
          isHeadUnderwater={isHeadUnderwater}
          canFly={canFly}
          isFlying={isFlying}
          lightLevel={worldRef?.current?.getLightLevel(
            Math.floor(playerPos.x),
            Math.floor(playerPos.y + 1.6), // На уровне глаз
            Math.floor(playerPos.z)
          )}
        />
      )}
    </div>
  );
};

export default Game;

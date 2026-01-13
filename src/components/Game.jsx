// Главный игровой компонент с улучшенной системой теней и освещения
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BLOCK_TYPES, HOTBAR_BLOCKS, isSolid, getBlockProperties, BlockRegistry } from '../constants/blocks';
import { SEA_LEVEL, REACH_DISTANCE, CHUNK_SIZE, CHUNK_HEIGHT, PLAYER_WIDTH, PLAYER_HEIGHT } from '../constants/world';
import { GAME_MODES, GAME_MODE_NAMES, getGameModeDefaults, isCreativeMode as isCreative } from '../constants/gameMode';
import Crosshair from './ui/Crosshair';
import Hotbar from './ui/Hotbar';
import Chat from './ui/Chat';
import Inventory from './inventory/Inventory';
import { World } from '../core/world/World';
import { getBlock } from '../utils/noise';
import { BlockMiningManager } from '../core/physics/BlockMining';
import { Inventory as InventoryClass } from '../core/inventory/Inventory';
import { TOTAL_INVENTORY_SIZE, HOTBAR_SIZE } from '../utils/inventory';
import { GameCanvas } from './game/GameCanvas';
import { LoadingScreen, PauseMenu, SaveMessage, DebugInfo } from './game/GameUI';

// Компоненты PhysicsLoop, MiningLoop, GameLights и BlockInteraction теперь в GameCanvas.jsx

const Game = ({ worldInfo, initialChunks, initialPlayerPos, onSaveWorld, onExitToMenu }) => {
  const [chunks, setChunks] = useState({});
  
  // === GAME MODE ===
  const initialGameMode = worldInfo?.gameMode ?? GAME_MODES.SURVIVAL;
  const [gameMode, setGameMode] = useState(initialGameMode);
  const gameModeDefaults = getGameModeDefaults(gameMode);
  
  // === FULL INVENTORY (36 slots: 0-8 hotbar, 9-35 main inventory) ===
  const inventoryRef = useRef(null);
  const [inventory, setInventory] = useState(() => {
    // Создаем Inventory класс из сохранения или пустой
    if (worldInfo?.inventory) {
      inventoryRef.current = InventoryClass.deserialize(worldInfo.inventory, TOTAL_INVENTORY_SIZE);
    } else {
      inventoryRef.current = new InventoryClass(TOTAL_INVENTORY_SIZE);
    }
    return inventoryRef.current.getSlots();
  });

  // Синхронизируем inventoryRef с React state
  useEffect(() => {
    if (inventoryRef.current) {
      inventoryRef.current.setSlots(inventory);
    }
  }, [inventory]);

  // Hotbar is slots 0-8 of inventory
  const hotbar = inventory.slice(0, HOTBAR_SIZE);
  
  const [selectedSlot, setSelectedSlot] = useState(0);
  
  // Синхронизируем selectedSlot с Inventory классом
  useEffect(() => {
    if (inventoryRef.current) {
      inventoryRef.current.setSelectedSlot(selectedSlot);
    }
  }, [selectedSlot]);
  const [playerPos, setPlayerPos] = useState(initialPlayerPos || { x: 0, y: SEA_LEVEL + 10, z: 0 });
  const [playerYaw, setPlayerYaw] = useState(0);
  const [playerPitch, setPlayerPitch] = useState(0);
  const [isFlying, setIsFlying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [debugInfo, setDebugInfo] = useState({ chunksCount: 0, blocksCount: 0, fps: 0 });
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const isLoadingRef = useRef(true);
  const [currentBiome, setCurrentBiome] = useState('Unknown');

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [noclipMode, setNoclipMode] = useState(false);
  // canFly инициализируется в зависимости от режима игры
  const [canFly, setCanFly] = useState(gameModeDefaults.canFly);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [teleportPos, setTeleportPos] = useState(null);
  const [lastPunchTime, setLastPunchTime] = useState(0);
  const [debrisList, setDebrisList] = useState([]);
  
  // === SURVIVAL MODE: Dropped Items ===
  const [droppedItems, setDroppedItems] = useState([]);
  
  // === SURVIVAL MODE: Block Mining ===
  const [miningState, setMiningState] = useState({ target: null, progress: 0, stage: 0 });
  const miningManagerRef = useRef(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  
  const frameTimesRef = useRef([]);
  const lastFrameTimeRef = useRef(performance.now());
  const worldRef = useRef(null);
  const isChatOpenRef = useRef(isChatOpen);
  const isInventoryOpenRef = useRef(isInventoryOpen);

  useEffect(() => {
      isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  useEffect(() => {
      isInventoryOpenRef.current = isInventoryOpen;
  }, [isInventoryOpen]);

  // Инициализация Mining Manager
  useEffect(() => {
    miningManagerRef.current = new BlockMiningManager();
    miningManagerRef.current.onProgressChange = (state) => {
      setMiningState(state);
    };
    
    return () => {
      if (miningManagerRef.current) {
        miningManagerRef.current.reset();
      }
    };
  }, []);

  // Обновление canFly при смене режима
  useEffect(() => {
    const defaults = getGameModeDefaults(gameMode);
    setCanFly(defaults.canFly);
  }, [gameMode]);

  useEffect(() => {
    if (!worldRef.current && worldInfo) {
      // Создаем World (включает ChunkManager и LiquidSimulator)
      worldRef.current = new World(worldInfo.seed, initialChunks || {});
      
      // Устанавливаем коллбек для обновления React при загрузке чанков
      worldRef.current.setOnChunksUpdate((updatedChunks) => {
        const chunksCount = Object.keys(updatedChunks).length;
        setChunks(updatedChunks);
        setDebugInfo(prev => ({ 
          ...prev, 
          chunksCount
        }));
        
        // --- ЛОГИКА ПРЕДЗАГРУЗКИ ---
        // Ждем загрузки области 5x5 (радиус 2) вокруг игрока = 25 чанков
        const TARGET_INITIAL_CHUNKS = 25; 
        
        if (isLoadingRef.current) {
            const progress = Math.min(100, Math.floor((chunksCount / TARGET_INITIAL_CHUNKS) * 100));
            setLoadingProgress(progress);
            
            if (chunksCount >= TARGET_INITIAL_CHUNKS) {
                // Небольшая задержка для плавности
                setTimeout(() => {
                    setIsLoading(false);
                }, 500);
            }
        }
      });
      
      // Запускаем первую загрузку
      worldRef.current.update(playerPos);
      
      // Fallback: через 15 секунд снимаем экран загрузки в любом случае (если что-то зависло)
      setTimeout(() => {
        if (isLoadingRef.current) {
            console.warn('[Game] Loading timeout reached, forcing start');
            setLoadingProgress(100);
            setIsLoading(false);
        }
      }, 15000);
    }
    
    // Cleanup при размонтировании
    return () => {
      if (worldRef.current) {
        worldRef.current.destroy();
      }
    };
  }, [worldInfo, initialChunks]);

  useEffect(() => {
    const checkChunks = () => {
      if (!worldRef.current) return;
      // update возвращает hasChanges только если чанки были удалены (выгружены)
      // или если были добавлены новые через update loop (не через async)
      const { hasChanges, activeChunks } = worldRef.current.update(playerPos);
      if (hasChanges) {
        setChunks(activeChunks);
        setDebugInfo(prev => ({ 
            ...prev, 
            chunksCount: Object.keys(activeChunks).length 
        }));
      }
    };
    const intervalId = setInterval(checkChunks, 1000); // 200 -> 1000
    checkChunks();
    return () => clearInterval(intervalId);
  }, [playerPos]);

  useEffect(() => {
    const updateBiome = () => {
      if (!playerPos || !worldRef.current) return;
      const biome = worldRef.current.getBiome(
        Math.floor(playerPos.x), 
        Math.floor(playerPos.z)
      );
      if (biome && biome.name) {
        setCurrentBiome(biome.name);
      }
    };
    const interval = setInterval(updateBiome, 500);
    updateBiome();
    return () => clearInterval(interval);
  }, [playerPos]);

  useEffect(() => {
    let animationId;
    const updateFPS = () => {
      const now = performance.now();
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      frameTimesRef.current.push(delta);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      const avgDelta = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
      const fps = Math.round(1000 / avgDelta);

      setDebugInfo(prev => ({ ...prev, fps }));
      animationId = requestAnimationFrame(updateFPS);
    };

    animationId = requestAnimationFrame(updateFPS);
    return () => cancelAnimationFrame(animationId);
  }, []);

  const handleSaveGame = useCallback(async () => {
    if (worldRef.current && onSaveWorld) {
      setSaveMessage('Сохранение...');
      const modifiedData = worldRef.current.getSaveData();
      // Сохраняем gameMode и inventory
      const inventoryData = inventoryRef.current ? inventoryRef.current.serialize() : inventory;
      await onSaveWorld(modifiedData, playerPos, { gameMode, inventory: inventoryData });
      setSaveMessage('Мир сохранён!');
      setTimeout(() => setSaveMessage(''), 2000);
    }
  }, [playerPos, onSaveWorld, gameMode, inventory]);

  const handleSaveAndExit = useCallback(async () => {
      if (worldRef.current && onSaveWorld) {
          setSaveMessage('Сохранение...');
          const modifiedData = worldRef.current.getSaveData();
          const inventoryData = inventoryRef.current ? inventoryRef.current.serialize() : inventory;
          await onSaveWorld(modifiedData, playerPos, { gameMode, inventory: inventoryData });

          if (onExitToMenu) {
              onExitToMenu();
          }
      }
  }, [playerPos, onSaveWorld, onExitToMenu, gameMode, inventory]);

  // Фактическое разрушение блока (вызывается мгновенно в Creative или после добычи в Survival)
  const destroyBlock = useCallback((x, y, z, blockId) => {
    if (!worldRef.current) return;
    
    const block = BlockRegistry.get(blockId);
    
    const success = worldRef.current.setBlock(x, y, z, BLOCK_TYPES.AIR);
    if (success) {
       setChunks({ ...worldRef.current.getChunks() });
       
       // Частицы разрушения
       if (blockId) {
            const lightLevel = worldRef.current.getLightLevel(x, y, z);
            const id = Date.now() + Math.random();
            setDebrisList(prev => [...prev, { id, x, y, z, blockType: blockId, lightLevel }]);
            setTimeout(() => {
                setDebrisList(prev => prev.filter(d => d.id !== id));
            }, 1000);
       }
       
       // В Survival режиме создаем выпавший предмет
       if (gameMode === GAME_MODES.SURVIVAL && block) {
         const drops = block.getDrops();
         drops.forEach(drop => {
           if (drop.type && drop.count > 0) {
             const itemId = Date.now() + Math.random();
             // Случайное смещение в сторону от центра блока
             const angle = Math.random() * Math.PI * 2;
             const offsetDist = 0.25;
             const offsetX = Math.cos(angle) * offsetDist;
             const offsetZ = Math.sin(angle) * offsetDist;
             
             // Небольшая горизонтальная скорость, БЕЗ вертикального подброса
             const hSpeed = 0.5 + Math.random() * 0.5;
             
             setDroppedItems(prev => [...prev, {
               id: itemId,
               blockType: drop.type,
               count: drop.count,
               position: { 
                 x: x + 0.5 + offsetX, 
                 y: y + 0.3, // Ниже центра, чтобы сразу падал
                 z: z + 0.5 + offsetZ 
               },
               velocity: { 
                 x: Math.cos(angle) * hSpeed, 
                 y: 0, // НЕ подбрасываем вверх!
                 z: Math.sin(angle) * hSpeed 
               },
               noPickupTime: 0.3
             }]);
           }
         });
       }
    }
  }, [gameMode]);

  const handleBlockDestroy = useCallback((x, y, z) => {
    if (!worldRef.current) return;
    if (y < 0 || y >= CHUNK_HEIGHT) return;

    const dx = x + 0.5 - playerPos.x;
    const dy = y + 0.5 - playerPos.y;
    const dz = z + 0.5 - playerPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > REACH_DISTANCE) return;

    // Получаем blockId через World API
    const blockId = worldRef.current.getBlock(x, y, z);

    if (!blockId || blockId === BLOCK_TYPES.AIR) return;
    
    const block = BlockRegistry.get(blockId);
    if (block?.unbreakable) return;

    // === CREATIVE MODE: Мгновенное разрушение ===
    if (gameMode === GAME_MODES.CREATIVE) {
      destroyBlock(x, y, z, blockId);
      setLastPunchTime(Date.now());
      return;
    }

    // === SURVIVAL MODE: Запуск добычи ===
    // Mining Manager обрабатывает прогресс
    if (miningManagerRef.current) {
      miningManagerRef.current.onBlockBroken = (bx, by, bz, bid) => {
        destroyBlock(bx, by, bz, bid);
      };
      miningManagerRef.current.startMining(x, y, z, blockId);
    }
    
    setLastPunchTime(Date.now());
  }, [playerPos, gameMode, destroyBlock]);

  const handleBlockPlace = useCallback((x, y, z) => {
    if (!worldRef.current) return;
    if (y < 0 || y >= CHUNK_HEIGHT) return;

    // Получаем блок из хотбара (поддерживаем оба формата)
    const blockType = inventoryRef.current?.getBlockType(selectedSlot) || null;
    
    if (!blockType) return; // Нельзя ставить "ничего"

    // Проверка коллизии с игроком
    if (isSolid(blockType)) {
      const pMinX = playerPos.x - PLAYER_WIDTH / 2;
      const pMaxX = playerPos.x + PLAYER_WIDTH / 2;
      const pMinY = playerPos.y;
      const pMaxY = playerPos.y + PLAYER_HEIGHT;
      const pMinZ = playerPos.z - PLAYER_WIDTH / 2;
      const pMaxZ = playerPos.z + PLAYER_WIDTH / 2;

      const bMinX = x;
      const bMaxX = x + 1;
      const bMinY = y;
      const bMaxY = y + 1;
      const bMinZ = z;
      const bMaxZ = z + 1;

      const overlapX = (pMinX < bMaxX) && (pMaxX > bMinX);
      const overlapY = (pMinY < bMaxY) && (pMaxY > bMinY);
      const overlapZ = (pMinZ < bMaxZ) && (pMaxZ > bMinZ);

      if (overlapX && overlapY && overlapZ) {
        return;
      }
    }

    const success = worldRef.current.setBlock(x, y, z, blockType);
    if (success) {
       setChunks({ ...worldRef.current.getChunks() });
       
       // В Survival режиме расходуем блок из инвентаря
       if (gameMode === GAME_MODES.SURVIVAL && inventoryRef.current) {
         inventoryRef.current.removeFromSlot(selectedSlot, 1);
         setInventory(inventoryRef.current.getSlots());
       }
    }

    setLastPunchTime(Date.now());
  }, [playerPos, selectedSlot, inventory, gameMode]);

  // Обработчик простого клика (удара по воздуху)
  const handlePunch = useCallback(() => {
      setLastPunchTime(Date.now());
  }, []);

  // Обработчик подбора предметов (Survival)
  const handleItemPickup = useCallback((itemId, count, blockType) => {
    if (count === 0) {
      // Просто удаляем (despawn)
      setDroppedItems(prev => prev.filter(item => item.id !== itemId));
      return;
    }

    // Добавляем в инвентарь (36 слотов, приоритет хотбару)
    if (inventoryRef.current) {
      const { remaining } = inventoryRef.current.addToFullInventory(blockType, count);
      setInventory(inventoryRef.current.getSlots());

      // Если все подобрали - удаляем
      if (remaining === 0) {
        setDroppedItems(prev => prev.filter(item => item.id !== itemId));
      } else {
        // Остались лишние - обновляем количество
        setDroppedItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, count: remaining } : item
        ));
      }
    }

    // Если все подобрали - удаляем
    if (remaining === 0) {
      setDroppedItems(prev => prev.filter(item => item.id !== itemId));
    } else {
      // Остались лишние - обновляем количество
      setDroppedItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, count: remaining } : item
      ));
    }
  }, [inventory]);

  // Функция getBlock для DroppedItem (коллизии)
  const getBlockAt = useCallback((x, y, z) => {
    if (!worldRef.current) return BLOCK_TYPES.AIR;
    return worldRef.current.getBlock(x, y, z);
  }, []);

  // Остановка добычи (когда отпустили кнопку мыши или отвели взгляд)
  const handleStopMining = useCallback(() => {
    if (miningManagerRef.current) {
      miningManagerRef.current.stopMining();
    }
  }, []);

  // Обработчик состояния мыши
  const handleMouseStateChange = useCallback((isDown) => {
    setIsMouseDown(isDown);
    if (!isDown && miningManagerRef.current) {
      miningManagerRef.current.stopMining();
    }
  }, []);

  // Обработчик для отслеживания блока при зажатом ЛКМ (Survival)
  const handleLookingAtBlock = useCallback((x, y, z) => {
    if (gameMode !== GAME_MODES.SURVIVAL) return;
    if (!worldRef.current) return;
    
    // Получаем blockId через World API
    const blockId = worldRef.current.getBlock(x, y, z);
    
    if (!blockId || blockId === BLOCK_TYPES.AIR) {
      handleStopMining();
      return;
    }
    
    const block = BlockRegistry.get(blockId);
    if (block?.unbreakable) {
      handleStopMining();
      return;
    }
    
    // Начать/продолжить добычу этого блока
    if (miningManagerRef.current) {
      miningManagerRef.current.onBlockBroken = (bx, by, bz, bid) => {
        destroyBlock(bx, by, bz, bid);
      };
      miningManagerRef.current.startMining(x, y, z, blockId);
    }
  }, [gameMode, destroyBlock, handleStopMining]);

  const handleSendMessage = useCallback((text) => {
    setChatMessages(prev => [...prev, { text, type: 'text', timestamp: Date.now() }]);

    if (text.startsWith('/')) {
      const [cmd, ...args] = text.slice(1).split(' ');
      
      switch (cmd.toLowerCase()) {
        case 'tp':
          if (args.length === 3) {
            const x = parseFloat(args[0]);
            const y = parseFloat(args[1]);
            const z = parseFloat(args[2]);
            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
              setTeleportPos({ x, y, z });
              setPlayerPos({ x, y, z });
              setChatMessages(prev => [...prev, { text: `Teleported to ${x}, ${y}, ${z}`, type: 'success', timestamp: Date.now() }]);
            } else {
               setChatMessages(prev => [...prev, { text: 'Invalid coordinates', type: 'error', timestamp: Date.now() }]);
            }
          } else {
             setChatMessages(prev => [...prev, { text: 'Usage: /tp <x> <y> <z>', type: 'error', timestamp: Date.now() }]);
          }
          break;
          
        case 'noclip':
            setNoclipMode(prev => {
                const newVal = !prev;
                setChatMessages(prevMsgs => [...prevMsgs, { 
                    text: `Noclip mode ${newVal ? 'enabled' : 'disabled'}`, 
                    type: 'info', 
                    timestamp: Date.now() 
                }]);
                return newVal;
            });
            break;

        case 'fly':
            setCanFly(prev => {
                const newVal = !prev;
                setChatMessages(prevMsgs => [...prevMsgs, { 
                    text: `Flight capability ${newVal ? 'enabled' : 'disabled'} (Double-tap SPACE to fly)`, 
                    type: 'info', 
                    timestamp: Date.now() 
                }]);
                return newVal;
            });
            break;

        case 'speed':
            const speed = parseFloat(args[0]);
            if (!isNaN(speed) && speed > 0) {
                setSpeedMultiplier(speed);
                setChatMessages(prev => [...prev, { text: `Speed set to ${speed}x`, type: 'success', timestamp: Date.now() }]);
            } else {
                setChatMessages(prev => [...prev, { text: 'Usage: /speed <value>', type: 'error', timestamp: Date.now() }]);
            }
            break;

        case 'seed':
            setChatMessages(prev => [...prev, { text: `World Seed: ${worldInfo.seed}`, type: 'info', timestamp: Date.now() }]);
            break;
            
        case 'pos':
            setChatMessages(prev => [...prev, { 
                text: `X: ${playerPos.x.toFixed(1)}, Y: ${playerPos.y.toFixed(1)}, Z: ${playerPos.z.toFixed(1)}`, 
                type: 'info', 
                timestamp: Date.now() 
            }]);
            break;
            
        case 'gm':
        case 'gamemode':
            const modeArg = args[0];
            if (modeArg === '0' || modeArg?.toLowerCase() === 'survival' || modeArg?.toLowerCase() === 's') {
                setGameMode(GAME_MODES.SURVIVAL);
                setChatMessages(prev => [...prev, { 
                    text: `Режим игры изменен на: ${GAME_MODE_NAMES[GAME_MODES.SURVIVAL]}`, 
                    type: 'success', 
                    timestamp: Date.now() 
                }]);
            } else if (modeArg === '1' || modeArg?.toLowerCase() === 'creative' || modeArg?.toLowerCase() === 'c') {
                setGameMode(GAME_MODES.CREATIVE);
                setChatMessages(prev => [...prev, { 
                    text: `Режим игры изменен на: ${GAME_MODE_NAMES[GAME_MODES.CREATIVE]}`, 
                    type: 'success', 
                    timestamp: Date.now() 
                }]);
            } else {
                setChatMessages(prev => [...prev, { 
                    text: 'Usage: /gm <0|1|survival|creative>', 
                    type: 'error', 
                    timestamp: Date.now() 
                }]);
            }
            break;
            
        case 'help':
            const helpMsg = "Commands: /tp, /noclip, /fly, /speed, /seed, /pos, /gm";
            setChatMessages(prev => [...prev, { text: helpMsg, type: 'info', timestamp: Date.now() }]);
            break;

        default:
          setChatMessages(prev => [...prev, { text: `Unknown command: ${cmd}`, type: 'error', timestamp: Date.now() }]);
      }
    }
  }, [playerPos, worldInfo]);

  // Выброс предмета (Q)
  const handleDropItem = useCallback(() => {
    if (isChatOpen || isInventoryOpen || isPaused) return;

    if (!inventoryRef.current) return;
    
    const blockType = inventoryRef.current.getBlockType(selectedSlot);
    if (!blockType) return;

    // Удаляем 1 предмет из слота
    const { removed } = inventoryRef.current.removeFromSlot(selectedSlot, 1);
    if (removed === 0) return;

    setInventory(inventoryRef.current.getSlots());

    // Направление взгляда (используем yaw и pitch)
    const throwSpeed = 8;
    const dirX = -Math.sin(playerYaw) * Math.cos(playerPitch);
    const dirY = Math.sin(playerPitch);
    const dirZ = -Math.cos(playerYaw) * Math.cos(playerPitch);

    // Небольшой разброс
    const spread = 0.15;
    const randX = (Math.random() - 0.5) * spread;
    const randZ = (Math.random() - 0.5) * spread;

    const itemId = Date.now() + Math.random();
    setDroppedItems(prev => [...prev, {
      id: itemId,
      blockType: blockType,
      count: 1,
      position: {
        x: playerPos.x + dirX * 1.2,
        y: playerPos.y + 1.5,
        z: playerPos.z + dirZ * 1.2
      },
      velocity: {
        x: dirX * throwSpeed + randX,
        y: dirY * throwSpeed + 1.5,
        z: dirZ * throwSpeed + randZ
      },
      noPickupTime: 1.0 // Нельзя подобрать 1 секунду
    }]);
  }, [inventory, selectedSlot, playerPos, playerYaw, playerPitch, isChatOpen, isInventoryOpen, isPaused]);

  // Обработка клавиш (Чат, Инвентарь, Выброс)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Выброс предмета
      if (e.code === 'KeyQ' && document.pointerLockElement === document.body) {
        e.preventDefault();
        handleDropItem();
        return;
      }
      
      // Чат
      if (e.code === 'KeyT' && !isChatOpen && !isInventoryOpen && !isPaused) {
        e.preventDefault();
        setIsChatOpen(true);
        isChatOpenRef.current = true;
        document.exitPointerLock();
      }
      
      // Инвентарь
      if (e.code === 'KeyE') {
          if (isChatOpen) return;
          e.preventDefault();
          
          if (!isInventoryOpen && !isPaused) {
              setIsInventoryOpen(true);
              isInventoryOpenRef.current = true;
              document.exitPointerLock();
          } else if (isInventoryOpen) {
              setIsInventoryOpen(false);
              isInventoryOpenRef.current = false;
              document.body.requestPointerLock();
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatOpen, isPaused, isInventoryOpen, handleDropItem]);

  useEffect(() => {
    const handleChange = () => {
      if (document.pointerLockElement === document.body) {
        setIsPaused(false);
        setShowInstructions(false);
        
        // Если захватили курсор, закрываем UI
        if (isInventoryOpenRef.current) {
            setIsInventoryOpen(false);
            isInventoryOpenRef.current = false;
        }
      } else {
        // Если открыт чат ИЛИ инвентарь, не включаем паузу
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
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        setSelectedSlot(num - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleWheel = (e) => {
      if (document.pointerLockElement !== document.body) return;

      e.preventDefault();
      setSelectedSlot(prev => {
        if (e.deltaY > 0) {
          return (prev + 1) % HOTBAR_BLOCKS.length;
        } else {
          return (prev - 1 + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
        }
      });
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  const handleSelectSlot = useCallback((slot) => {
    setSelectedSlot(slot);
  }, []);

  const handlePlayerMove = useCallback((data) => {
    if (data.type === 'position') {
      setPlayerPos({ x: data.x, y: data.y, z: data.z });
      setIsFlying(data.isFlying);
      if (data.yaw !== undefined) setPlayerYaw(data.yaw);
      if (data.pitch !== undefined) setPlayerPitch(data.pitch);
    }
  }, []);

  const handleBlocksCount = useCallback((count) => {
    setDebugInfo(prev => ({ ...prev, blocksCount: count }));
  }, []);

  const resumeGame = () => {
    document.body.requestPointerLock();
  };

  const handleExitToMenu = () => {
    handleSaveGame();
    if (onExitToMenu) {
      onExitToMenu();
    }
  };

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
        selectedBlock={inventoryRef.current?.getBlockType(selectedSlot) || null}
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
        onClose={() => {
            setIsChatOpen(false);
            document.body.requestPointerLock();
        }}
        onSendMessage={handleSendMessage}
        messages={chatMessages}
      />

      <SaveMessage message={saveMessage} />

      {showInstructions && (
        <PauseMenu
          onResume={resumeGame}
          onSaveAndExit={handleSaveAndExit}
          onExitToMenu={handleExitToMenu}
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

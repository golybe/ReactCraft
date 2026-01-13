// Главный игровой компонент с улучшенной системой теней и освещения
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import { BLOCK_TYPES, HOTBAR_BLOCKS, isSolid, getBlockProperties, BlockRegistry } from '../constants/blocks';
import { SEA_LEVEL, REACH_DISTANCE, CHUNK_SIZE, CHUNK_HEIGHT, PLAYER_WIDTH, PLAYER_HEIGHT } from '../constants/world';
import { GAME_MODES, GAME_MODE_NAMES, getGameModeDefaults, isCreativeMode as isCreative } from '../constants/gameMode';
import World from './World';
import Player from './Player';
import Crosshair from './Crosshair';
import Hotbar from './Hotbar';
import BlockHighlight from './BlockHighlight';
import HeldItem from './HeldItem';
import Debris from './Debris';
import Chat from './Chat';
import Inventory from './Inventory';
import BlockBreakOverlay from './BlockBreakOverlay';
import { DroppedItemsManager } from './DroppedItem';
import { ChunkManager } from '../utils/chunkManager';
import { getBlock } from '../utils/noise';
import { LiquidSimulator } from '../core/physics/LiquidSimulator';
import { PerformanceMetrics } from '../utils/performance';
import { BlockMiningManager } from '../core/physics/BlockMining';
import { addToFullInventory, removeFromSlot, getBlockType, getSlot, TOTAL_INVENTORY_SIZE, HOTBAR_SIZE } from '../utils/inventory';

// --- КОМПОНЕНТ ФИЗИКИ ---
const PhysicsLoop = ({ simulator, onChanges }) => {
  useFrame(() => {
    PerformanceMetrics.startFrame();
    
    PerformanceMetrics.measure('physics', () => {
        if (simulator && simulator.update()) {
           PerformanceMetrics.measure('chunkUpdate', onChanges);
        }
    });
    
    PerformanceMetrics.endFrame();
  });
  return null;
};

// --- КОМПОНЕНТ ДОБЫЧИ БЛОКОВ (Survival) ---
const MiningLoop = ({ miningManager, isMouseDown }) => {
  const lastTimeRef = useRef(performance.now());
  
  useFrame(() => {
    if (!miningManager) return;
    
    const now = performance.now();
    const delta = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;
    
    if (isMouseDown && miningManager.currentTarget) {
      miningManager.update(delta);
    }
  });
  
  return null;
};

// --- КОМПОНЕНТ ОСВЕЩЕНИЯ (MINECRAFT-STYLE) ---
// В настоящем Minecraft НЕТ realtime-теней!
// Вся глубина и объём достигаются через:
// 1. Статическое затемнение граней (faceShade в ChunkMesher)
// 2. Воксельный skylight (пещеры/навесы темнее)
// 3. Мягкий AO в углах
//
// Мы используем MeshBasicMaterial с vertexColors — никакого внешнего света не нужно.
// Только Sky для красивого неба.
const GameLights = () => {
  return (
    <>
      <Sky
        sunPosition={[100, 60, 100]}
        turbidity={0.8}
        rayleigh={0.5}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      {/* Внешний свет НЕ нужен — всё через vertex colors */}
    </>
  );
};

// Компонент для raycasting кликов
const BlockInteraction = ({ 
  chunks, 
  onBlockDestroy, 
  onBlockPlace, 
  selectedBlock, 
  onPunch,
  onMouseStateChange,
  onStopMining,
  onLookingAtBlock, // NEW: callback when looking at a block while mining
  isMouseDown // NEW: current mouse state
}) => {
  const { camera, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const lastLookTarget = useRef(null);

  useEffect(() => {
    raycaster.current.far = REACH_DISTANCE;
  }, []);

  // Raycast helper function
  const doRaycast = useCallback(() => {
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.current.intersectObjects(scene.children, true);

    for (const hit of intersects) {
      if (hit.distance > REACH_DISTANCE) continue;
      if (hit.object.name !== 'block-mesh' && !hit.object.isInstancedMesh) continue;
      if (hit.object.userData?.isLiquid) continue;

      const point = hit.point;
      const normal = hit.face?.normal;

      if (!normal) continue;

      return {
        breakPos: {
          x: Math.floor(point.x - normal.x * 0.5),
          y: Math.floor(point.y - normal.y * 0.5),
          z: Math.floor(point.z - normal.z * 0.5)
        },
        placePos: {
          x: Math.floor(point.x + normal.x * 0.5),
          y: Math.floor(point.y + normal.y * 0.5),
          z: Math.floor(point.z + normal.z * 0.5)
        }
      };
    }
    return null;
  }, [camera, scene]);

  // Continuous raycast while mining (useFrame)
  useFrame(() => {
    if (!isMouseDown) {
      lastLookTarget.current = null;
      return;
    }
    
    if (document.pointerLockElement !== document.body) return;

    const target = doRaycast();
    
    if (target) {
      const { breakPos } = target;
      const key = `${breakPos.x},${breakPos.y},${breakPos.z}`;
      
      // If looking at a different block, notify
      if (lastLookTarget.current !== key) {
        lastLookTarget.current = key;
        if (onLookingAtBlock) {
          onLookingAtBlock(breakPos.x, breakPos.y, breakPos.z);
        }
      }
    } else {
      // Looking at nothing
      if (lastLookTarget.current !== null) {
        lastLookTarget.current = null;
        if (onStopMining) onStopMining();
      }
    }
  });

  useEffect(() => {
    const handleMouseDown = (e) => {
      if (document.pointerLockElement !== document.body) return;

      if (e.button === 0) {
          if (onPunch) onPunch();
          if (onMouseStateChange) onMouseStateChange(true);
          
          // Initial raycast on mousedown
          const target = doRaycast();
          if (target) {
            onBlockDestroy(target.breakPos.x, target.breakPos.y, target.breakPos.z);
          }
      } else if (e.button === 2) {
          const target = doRaycast();
          if (target) {
            onBlockPlace(target.placePos.x, target.placePos.y, target.placePos.z);
          }
      }
    };

    const handleMouseUp = (e) => {
      if (e.button === 0) {
        if (onMouseStateChange) onMouseStateChange(false);
        if (onStopMining) onStopMining();
        lastLookTarget.current = null;
      }
    };

    const handleContextMenu = (e) => {
      if (document.pointerLockElement === document.body) {
        e.preventDefault();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [camera, scene, onBlockDestroy, onBlockPlace, onMouseStateChange, onStopMining, doRaycast, onPunch]);

  return null;
};

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

const Game = ({ worldInfo, initialChunks, initialPlayerPos, onSaveWorld, onExitToMenu }) => {
  const [chunks, setChunks] = useState({});
  
  // === GAME MODE ===
  const initialGameMode = worldInfo?.gameMode ?? GAME_MODES.SURVIVAL;
  const [gameMode, setGameMode] = useState(initialGameMode);
  const gameModeDefaults = getGameModeDefaults(gameMode);
  
  // === FULL INVENTORY (36 slots: 0-8 hotbar, 9-35 main inventory) ===
  const [inventory, setInventory] = useState(() => {
    // Загружаем из сохранения или создаем пустой
    if (worldInfo?.inventory) {
      // Migrate old 9-slot inventory to 36-slot
      if (worldInfo.inventory.length === 9) {
        const newInv = Array(TOTAL_INVENTORY_SIZE).fill(null);
        for (let i = 0; i < 9; i++) {
          newInv[i] = worldInfo.inventory[i];
        }
        return newInv;
      }
      return worldInfo.inventory;
    }
    return Array(TOTAL_INVENTORY_SIZE).fill(null);
  });

  // Hotbar is slots 0-8 of inventory
  const hotbar = inventory.slice(0, HOTBAR_SIZE);
  
  const [selectedSlot, setSelectedSlot] = useState(0);
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
  const chunkManagerRef = useRef(null);
  const liquidSimulatorRef = useRef(null);
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
    if (!chunkManagerRef.current && worldInfo) {
      // console.log('[Game] Creating ChunkManager with seed:', worldInfo.seed);
      
      // Создаем ChunkManager (воркеры инициализируются автоматически)
      chunkManagerRef.current = new ChunkManager(worldInfo.seed, initialChunks || {});
      // console.log('[Game] ChunkManager created:', chunkManagerRef.current);
      
      liquidSimulatorRef.current = new LiquidSimulator(chunkManagerRef.current);
      
      // Устанавливаем коллбек для обновления React при загрузке чанков
      chunkManagerRef.current.setOnChunksUpdated(() => {
        const chunksCount = Object.keys(chunkManagerRef.current.chunks).length;
        setChunks({ ...chunkManagerRef.current.chunks });
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
      // console.log('[Game] Starting initial chunk load at:', playerPos);
      chunkManagerRef.current.update(playerPos);
      
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
      if (chunkManagerRef.current) {
        chunkManagerRef.current.terminate();
      }
    };
  }, [worldInfo, initialChunks]);

  useEffect(() => {
    const checkChunks = () => {
      if (!chunkManagerRef.current) return;
      // update возвращает hasChanges только если чанки были удалены (выгружены)
      // или если были добавлены новые через update loop (не через async)
      const { hasChanges, activeChunks } = chunkManagerRef.current.update(playerPos);
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
      if (!playerPos || !chunkManagerRef.current) return;
      const biome = chunkManagerRef.current.getBiome(
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
    if (chunkManagerRef.current && onSaveWorld) {
      setSaveMessage('Сохранение...');
      const modifiedData = chunkManagerRef.current.getSaveData();
      // Сохраняем gameMode и inventory
      await onSaveWorld(modifiedData, playerPos, { gameMode, inventory: inventory });
      setSaveMessage('Мир сохранён!');
      setTimeout(() => setSaveMessage(''), 2000);
    }
  }, [playerPos, onSaveWorld, gameMode, inventory]);

  const handleSaveAndExit = useCallback(async () => {
      if (chunkManagerRef.current && onSaveWorld) {
          setSaveMessage('Сохранение...');
          const modifiedData = chunkManagerRef.current.getSaveData();
          await onSaveWorld(modifiedData, playerPos, { gameMode, inventory: inventory });

          if (onExitToMenu) {
              onExitToMenu();
          }
      }
  }, [playerPos, onSaveWorld, onExitToMenu, gameMode, inventory]);

  // Фактическое разрушение блока (вызывается мгновенно в Creative или после добычи в Survival)
  const destroyBlock = useCallback((x, y, z, blockId) => {
    if (!chunkManagerRef.current) return;
    
    const block = BlockRegistry.get(blockId);
    
    const success = chunkManagerRef.current.setBlock(x, y, z, BLOCK_TYPES.AIR);
    if (success) {
       setChunks({ ...chunkManagerRef.current.chunks });
       liquidSimulatorRef.current?.onBlockUpdate(x, y, z);
       
       // Частицы разрушения
       if (blockId) {
            const lightLevel = chunkManagerRef.current.getLightLevel(x, y, z);
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
    if (!chunkManagerRef.current) return;
    if (y < 0 || y >= CHUNK_HEIGHT) return;

    const dx = x + 0.5 - playerPos.x;
    const dy = y + 0.5 - playerPos.y;
    const dz = z + 0.5 - playerPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > REACH_DISTANCE) return;

    // Получаем blockId
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = `${cx},${cz}`;
    const chunk = chunkManagerRef.current.chunks[key];
    
    let blockId = null;
    if (chunk) {
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        blockId = chunk.getBlock(lx, y, lz);
    }

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
    if (!chunkManagerRef.current) return;
    if (y < 0 || y >= CHUNK_HEIGHT) return;

    // Получаем блок из хотбара (поддерживаем оба формата)
    const slot = inventory[selectedSlot];
    const blockType = getBlockType(inventory, selectedSlot);
    
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

    const success = chunkManagerRef.current.setBlock(x, y, z, blockType);
    if (success) {
       setChunks({ ...chunkManagerRef.current.chunks });
       liquidSimulatorRef.current?.onBlockUpdate(x, y, z);
       
       // В Survival режиме расходуем блок из инвентаря
       if (gameMode === GAME_MODES.SURVIVAL) {
         const { inventory: newInventory } = removeFromSlot(inventory, selectedSlot, 1);
         setInventory(newInventory);
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
    const { inventory: newInventory, remaining } = addToFullInventory(inventory, blockType, count);
    setInventory(newInventory);

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
    if (!chunkManagerRef.current) return BLOCK_TYPES.AIR;
    return chunkManagerRef.current.getBlock(x, y, z);
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
    if (!chunkManagerRef.current) return;
    
    // Получаем blockId
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = `${cx},${cz}`;
    const chunk = chunkManagerRef.current.chunks[key];
    
    let blockId = null;
    if (chunk) {
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        blockId = chunk.getBlock(lx, y, lz);
    }
    
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

    const blockType = getBlockType(inventory, selectedSlot);
    if (!blockType) return;

    // Удаляем 1 предмет из слота
    const { inventory: newInventory, removed } = removeFromSlot(inventory, selectedSlot, 1);
    if (removed === 0) return;

    setInventory(newInventory);

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
          {worldInfo?.name || 'Minecraft React'}
        </h1>
        <div style={{
          width: '300px',
          height: '24px',
          border: '2px solid #fff',
          backgroundColor: '#000',
        }}>
          <div style={{
            width: `${loadingProgress}%`,
            height: '100%',
            backgroundColor: '#4CAF50',
            transition: 'width 0.1s'
          }} />
        </div>
        <p style={{ marginTop: '10px', fontSize: '24px' }}>Генерация чанков... {loadingProgress}%</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0, SEA_LEVEL + 12, 0], fov: 75 }}
        gl={{
          antialias: false,
          powerPreference: 'high-performance'
        }}
        onCreated={({ gl, scene }) => {
          // Небесно-голубой фон
          gl.setClearColor(new THREE.Color(0x87CEEB));

          // Туман для глубины и скрытия границ рендера
          scene.fog = new THREE.Fog(0x87CEEB, 80, 180);

          // sRGB для правильных цветов
          gl.outputColorSpace = THREE.SRGBColorSpace;

          // Без тонмаппинга — чистые цвета как в Minecraft
          gl.toneMapping = THREE.NoToneMapping;
        }}
      >
        {/* Только небо, внешний свет не нужен — всё через vertex colors */}
        <GameLights />
        <PhysicsLoop 
            simulator={liquidSimulatorRef.current} 
            onChanges={() => setChunks({ ...chunkManagerRef.current.chunks })} 
        />
        
        {/* Mining loop для Survival */}
        {gameMode === GAME_MODES.SURVIVAL && (
          <MiningLoop 
            miningManager={miningManagerRef.current}
            isMouseDown={isMouseDown}
          />
        )}

        {chunks && (
          <>
            <World
              chunks={chunks}
              chunkManager={chunkManagerRef.current}
              onBlocksCount={handleBlocksCount}
            />
            <Player
              onMove={handlePlayerMove}
              chunks={chunks}
              initialPosition={initialPlayerPos}
              noclipMode={noclipMode}
              canFly={canFly}
              speedMultiplier={speedMultiplier}
              isChatOpen={isChatOpen}
              teleportPos={teleportPos}
            />
            <BlockHighlight chunks={chunks} />
            
            {/* Анимация трещин при добыче (Survival) */}
            {gameMode === GAME_MODES.SURVIVAL && miningState.target && (
              <BlockBreakOverlay 
                target={miningState.target}
                stage={miningState.stage}
              />
            )}
            
            {/* Выпавшие предметы (Survival) */}
            {gameMode === GAME_MODES.SURVIVAL && droppedItems.length > 0 && (
              <DroppedItemsManager
                items={droppedItems}
                playerPos={playerPos}
                onPickup={handleItemPickup}
                getBlock={getBlockAt}
              />
            )}
            
            {/* Рендеринг эффектов разрушения */}
            {debrisList.map(debris => (
                <Debris key={debris.id} {...debris} />
            ))}
            
            <BlockInteraction
              chunks={chunks}
              onBlockDestroy={handleBlockDestroy}
              onBlockPlace={handleBlockPlace}
              onPunch={handlePunch}
              selectedBlock={getBlockType(inventory, selectedSlot)}
              onMouseStateChange={handleMouseStateChange}
              onStopMining={handleStopMining}
              onLookingAtBlock={handleLookingAtBlock}
              isMouseDown={isMouseDown}
            />
            <HeldItem 
              selectedBlock={getBlockType(inventory, selectedSlot)}
              isMining={gameMode === GAME_MODES.SURVIVAL && isMouseDown && miningState.target !== null} 
              lastPunchTime={lastPunchTime}
              isFlying={isFlying}
              lightLevel={chunkManagerRef.current ? 
                chunkManagerRef.current.getLightLevel(
                  Math.floor(playerPos?.x || 0), 
                  Math.floor(playerPos?.y || 64), 
                  Math.floor(playerPos?.z || 0)
                ) : 15
              }
            />
          </>
        )}
      </Canvas>

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

      {saveMessage && (
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
          {saveMessage}
        </div>
      )}

      {showInstructions && (
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

            <MCButton onClick={resumeGame}>
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
               <MCButton onClick={handleSaveAndExit}>
                 Сохранить и выйти
               </MCButton>
            )}

             {onExitToMenu && (
                <MCButton onClick={handleExitToMenu} style={{ marginTop: '10px' }}>
                  Выйти в меню
                </MCButton>
             )}
          </div>
        </div>
      )}

      {!showInstructions && (
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
          <div>{Math.round(debugInfo.fps)} fps</div>
          <div>XYZ: {playerPos.x.toFixed(3)} / {playerPos.y.toFixed(3)} / {playerPos.z.toFixed(3)}</div>
          <div>Chunk: {Math.floor(playerPos.x / 16)} {Math.floor(playerPos.y / 16)} {Math.floor(playerPos.z / 16)}</div>
          <div>Chunks loaded: {debugInfo.chunksCount}</div>
          <div>Entities: {debugInfo.blocksCount} blocks</div>
          <div style={{ color: '#aaa' }}>Biome: {currentBiome}</div>
          <div style={{ color: gameMode === GAME_MODES.CREATIVE ? '#6aadbd' : '#6abd6e' }}>
            Mode: {GAME_MODE_NAMES[gameMode]}
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;

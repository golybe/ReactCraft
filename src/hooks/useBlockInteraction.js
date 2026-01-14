import { useState, useRef, useEffect, useCallback } from 'react';
import { BLOCK_TYPES, isSolid, BlockRegistry } from '../constants/blocks';
import { CHUNK_HEIGHT, REACH_DISTANCE, PLAYER_WIDTH, PLAYER_HEIGHT } from '../constants/world';
import { GAME_MODES } from '../constants/gameMode';
import { BlockMiningManager } from '../core/physics/BlockMining';

/**
 * Hook for managing block interaction (mining, placing, debris, dropped items)
 */
export function useBlockInteraction({
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
}) {
  const [miningState, setMiningState] = useState({ target: null, progress: 0, stage: 0 });
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [lastPunchTime, setLastPunchTime] = useState(0);

  const miningManagerRef = useRef(null);

  // Initialize Mining Manager
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

  // Actual block destruction (instant in Creative, after mining in Survival)
  const destroyBlock = useCallback((x, y, z, blockId) => {
    if (!worldRef?.current) return;

    const block = BlockRegistry.get(blockId);

    const success = worldRef.current.setBlock(x, y, z, BLOCK_TYPES.AIR);
    if (success) {
      setChunks({ ...worldRef.current.getChunks() });

      // Debris particles
      if (blockId) {
        const lightLevel = worldRef.current.getLightLevel(x, y, z);
        const id = Date.now() + Math.random();
        setDebrisList(prev => [...prev, { id, x, y, z, blockType: blockId, lightLevel }]);
        setTimeout(() => {
          setDebrisList(prev => prev.filter(d => d.id !== id));
        }, 1000);
      }

      // In Survival mode create dropped item
      if (gameMode === GAME_MODES.SURVIVAL && block) {
        const drops = block.getDrops();
        drops.forEach(drop => {
          if (drop.type && drop.count > 0) {
            const itemId = Date.now() + Math.random();
            const angle = Math.random() * Math.PI * 2;
            const offsetDist = 0.25;
            const offsetX = Math.cos(angle) * offsetDist;
            const offsetZ = Math.sin(angle) * offsetDist;

            const hSpeed = 0.5 + Math.random() * 0.5;

            setDroppedItems(prev => [...prev, {
              id: itemId,
              blockType: drop.type,
              count: drop.count,
              position: {
                x: x + 0.5 + offsetX,
                y: y + 0.3,
                z: z + 0.5 + offsetZ
              },
              velocity: {
                x: Math.cos(angle) * hSpeed,
                y: 0,
                z: Math.sin(angle) * hSpeed
              },
              noPickupTime: 0.3
            }]);
          }
        });
      }
    }
  }, [gameMode, worldRef, setChunks, setDebrisList, setDroppedItems]);

  const handleBlockDestroy = useCallback((x, y, z) => {
    if (!worldRef?.current) return;
    if (y < 0 || y >= CHUNK_HEIGHT) return;

    const dx = x + 0.5 - playerPos.x;
    const dy = y + 0.5 - playerPos.y;
    const dz = z + 0.5 - playerPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > REACH_DISTANCE) return;

    const blockId = worldRef.current.getBlock(x, y, z);
    if (!blockId || blockId === BLOCK_TYPES.AIR) return;

    const block = BlockRegistry.get(blockId);
    if (block?.unbreakable) return;

    // Creative Mode: Instant destruction
    if (gameMode === GAME_MODES.CREATIVE) {
      destroyBlock(x, y, z, blockId);
      setLastPunchTime(Date.now());
      return;
    }

    // Survival Mode: Start mining
    if (miningManagerRef.current) {
      miningManagerRef.current.onBlockBroken = (bx, by, bz, bid) => {
        destroyBlock(bx, by, bz, bid);
      };
      miningManagerRef.current.startMining(x, y, z, blockId);
    }

    setLastPunchTime(Date.now());
  }, [playerPos, gameMode, destroyBlock, worldRef]);

  const handleBlockPlace = useCallback((x, y, z) => {
    if (!worldRef?.current) return;
    if (y < 0 || y >= CHUNK_HEIGHT) return;

    const blockType = inventoryRef?.current?.getBlockType(selectedSlot) || null;
    if (!blockType) return;

    // ПРОВЕРКА: Можно ли ставить этот предмет как блок?
    const blockProps = BlockRegistry.get(blockType);
    if (blockProps && blockProps.isPlaceable === false) {
      return;
    }

    // Check collision with player
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

      // In Survival mode consume block from inventory
      if (gameMode === GAME_MODES.SURVIVAL && inventoryRef?.current) {
        inventoryRef.current.removeFromSlot(selectedSlot, 1);
        setInventory(inventoryRef.current.getSlots());
      }
    }

    setLastPunchTime(Date.now());
  }, [playerPos, selectedSlot, gameMode, worldRef, inventoryRef, setChunks, setInventory]);

  const handlePunch = useCallback(() => {
    setLastPunchTime(Date.now());
  }, []);

  const handleStopMining = useCallback(() => {
    if (miningManagerRef.current) {
      miningManagerRef.current.stopMining();
    }
  }, []);

  const handleMouseStateChange = useCallback((isDown) => {
    setIsMouseDown(isDown);
    if (!isDown && miningManagerRef.current) {
      miningManagerRef.current.stopMining();
    }
  }, []);

  const handleLookingAtBlock = useCallback((x, y, z) => {
    if (gameMode !== GAME_MODES.SURVIVAL) return;
    if (!worldRef?.current) return;

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

    // Start/continue mining this block
    if (miningManagerRef.current) {
      miningManagerRef.current.onBlockBroken = (bx, by, bz, bid) => {
        destroyBlock(bx, by, bz, bid);
      };
      miningManagerRef.current.startMining(x, y, z, blockId);
    }
  }, [gameMode, destroyBlock, handleStopMining, worldRef]);

  const handleItemPickup = useCallback((itemId, count, blockType) => {
    if (count === 0) {
      setDroppedItems(prev => prev.filter(item => item.id !== itemId));
      return;
    }

    if (inventoryRef?.current) {
      const { remaining } = inventoryRef.current.addToFullInventory(blockType, count);
      setInventory(inventoryRef.current.getSlots());

      if (remaining === 0) {
        setDroppedItems(prev => prev.filter(item => item.id !== itemId));
      } else {
        setDroppedItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, count: remaining } : item
        ));
      }
    }
  }, [inventoryRef, setInventory, setDroppedItems]);

  const getBlockAt = useCallback((x, y, z) => {
    if (!worldRef?.current) return BLOCK_TYPES.AIR;
    return worldRef.current.getBlock(x, y, z);
  }, [worldRef]);

  return {
    miningState,
    isMouseDown,
    lastPunchTime,
    miningManagerRef,
    handleBlockDestroy,
    handleBlockPlace,
    handlePunch,
    handleStopMining,
    handleMouseStateChange,
    handleLookingAtBlock,
    handleItemPickup,
    getBlockAt
  };
}

export default useBlockInteraction;

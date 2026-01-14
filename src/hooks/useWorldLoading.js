import { useState, useRef, useEffect, useCallback } from 'react';
import { World } from '../core/world/World';
import { EntityManager } from '../core/entities/EntityManager';
import { BLOCK_TYPES } from '../constants/blocks';
import { registerDefaultMobs } from '../constants/mobs';

/**
 * Hook for managing world loading and chunk updates
 */
export function useWorldLoading({
  worldInfo,
  initialChunks,
  playerPos,
  onChunksCountChange
}) {
  const [chunks, setChunks] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentBiome, setCurrentBiome] = useState('Unknown');

  const worldRef = useRef(null);
  const entityManagerRef = useRef(null);
  const isLoadingRef = useRef(true);
  const playerPosRef = useRef(playerPos);

  // Инициализируем EntityManager и регистрируем мобов
  if (!entityManagerRef.current) {
    entityManagerRef.current = new EntityManager();
    registerDefaultMobs();
  }

  // Sync loading ref
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // Sync player position ref
  useEffect(() => {
    playerPosRef.current = playerPos;
  }, [playerPos]);

  // Initialize World
  useEffect(() => {
    if (!worldRef.current && worldInfo) {
      worldRef.current = new World(worldInfo.seed, initialChunks || {});

      // Set callback for chunk updates
      worldRef.current.setOnChunksUpdate((updatedChunks) => {
        const chunksCount = Object.keys(updatedChunks).length;
        setChunks(updatedChunks);

        if (onChunksCountChange) {
          onChunksCountChange(chunksCount);
        }

        // Preloading logic - wait for 5x5 area (25 chunks)
        const TARGET_INITIAL_CHUNKS = 25;

        if (isLoadingRef.current) {
          const progress = Math.min(100, Math.floor((chunksCount / TARGET_INITIAL_CHUNKS) * 100));
          setLoadingProgress(progress);

          if (chunksCount >= TARGET_INITIAL_CHUNKS) {
            setTimeout(() => {
              setIsLoading(false);
            }, 500);
          }
        }
      });

      // Start first load
      worldRef.current.update(playerPos);

      // Fallback timeout - force start after 15 seconds
      setTimeout(() => {
        if (isLoadingRef.current) {
          console.warn('[useWorldLoading] Loading timeout reached, forcing start');
          setLoadingProgress(100);
          setIsLoading(false);
        }
      }, 15000);
    }

    return () => {
      if (worldRef.current) {
        worldRef.current.destroy();
      }
    };
  }, [worldInfo, initialChunks]);

  // Periodic chunk check
  useEffect(() => {
    const checkChunks = () => {
      if (!worldRef.current || !playerPosRef.current) return;

      const { hasChanges, activeChunks } = worldRef.current.update(playerPosRef.current);
      if (hasChanges) {
        setChunks(activeChunks);
        if (onChunksCountChange) {
          onChunksCountChange(Object.keys(activeChunks).length);
        }
      }
    };

    const intervalId = setInterval(checkChunks, 1000);
    checkChunks();
    return () => clearInterval(intervalId);
  }, [onChunksCountChange]); // Убираем playerPos из зависимостей, используем ref

  // Update current biome
  useEffect(() => {
    const updateBiome = () => {
      if (!playerPosRef.current || !worldRef.current) return;

      const biome = worldRef.current.getBiome(
        Math.floor(playerPosRef.current.x),
        Math.floor(playerPosRef.current.z)
      );
      if (biome && biome.name) {
        setCurrentBiome(biome.name);
      }
    };

    const interval = setInterval(updateBiome, 500);
    updateBiome();
    return () => clearInterval(interval);
  }, []); // Убираем playerPos из зависимостей, используем ref

  // Block operations
  const setBlock = useCallback((x, y, z, blockType) => {
    if (!worldRef.current) return false;
    const success = worldRef.current.setBlock(x, y, z, blockType);
    if (success) {
      setChunks({ ...worldRef.current.getChunks() });
    }
    return success;
  }, []);

  const getBlock = useCallback((x, y, z) => {
    if (!worldRef.current) return BLOCK_TYPES.AIR;
    return worldRef.current.getBlock(x, y, z);
  }, []);

  const getLightLevel = useCallback((x, y, z) => {
    if (!worldRef.current) return 15;
    return worldRef.current.getLightLevel(x, y, z);
  }, []);

  const getSaveData = useCallback(() => {
    if (!worldRef.current) return {};
    return worldRef.current.getSaveData();
  }, []);

  const updateChunksState = useCallback(() => {
    if (worldRef.current) {
      setChunks({ ...worldRef.current.getChunks() });
    }
  }, []);

  return {
    chunks,
    setChunks,
    isLoading,
    loadingProgress,
    currentBiome,
    worldRef,
    entityManager: entityManagerRef.current,
    setBlock,
    getBlock,
    getLightLevel,
    getSaveData,
    updateChunksState
  };
}

export default useWorldLoading;

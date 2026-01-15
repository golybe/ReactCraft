import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants/world';
import { BLOCK_PROPERTIES, BLOCK_TYPES } from '../../constants/blocks';
import { PerformanceMetrics } from '../../utils/performance';

// 6 directions for BFS propagation
const DIRECTIONS = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1]
];

/**
 * Manages lighting computation for chunks.
 * Extracted from ChunkManager for better separation of concerns.
 *
 * Supports incremental lighting updates for all block types (Minecraft-style).
 */
export class LightingManager {
  constructor() {
    this.lightMaps = {}; // Light maps for chunks (Uint8Array)
    this.fullyLit = new Set(); // Chunks that have been lit with all neighbors present
    this.getBlockCallback = null; // Callback to get block at world coordinates
  }

  /**
   * Set callback for getting blocks at world coordinates
   * @param {Function} callback - (worldX, worldY, worldZ) => blockId
   */
  setBlockCallback(callback) {
    this.getBlockCallback = callback;
  }

  // === WORLD COORDINATE HELPERS ===

  /**
   * Get chunk key from world coordinates
   */
  getChunkKey(worldX, worldZ) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    return `${cx},${cz}`;
  }

  /**
   * Get local coordinates within chunk
   */
  getLocalCoords(worldX, worldZ) {
    return {
      lx: ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
      lz: ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    };
  }

  /**
   * Get light index from local coordinates
   */
  getLightIndex(lx, y, lz) {
    return y * CHUNK_SIZE * CHUNK_SIZE + lx * CHUNK_SIZE + lz;
  }

  /**
   * Get light at world coordinates (internal helper)
   */
  getLightAt(worldX, worldY, worldZ) {
    if (worldY < 0) return 0;
    if (worldY >= CHUNK_HEIGHT) return 15;

    const key = this.getChunkKey(worldX, worldZ);
    const lightMap = this.lightMaps[key];
    if (!lightMap) return 0;

    const { lx, lz } = this.getLocalCoords(worldX, worldZ);
    const index = this.getLightIndex(lx, worldY, lz);
    return lightMap[index] || 0;
  }

  /**
   * Set light at world coordinates (internal helper)
   * @returns {boolean} true if light was changed
   */
  setLightAt(worldX, worldY, worldZ, value, affectedChunks) {
    if (worldY < 0 || worldY >= CHUNK_HEIGHT) return false;

    const key = this.getChunkKey(worldX, worldZ);
    const lightMap = this.lightMaps[key];
    if (!lightMap) return false;

    const { lx, lz } = this.getLocalCoords(worldX, worldZ);
    const index = this.getLightIndex(lx, worldY, lz);

    if (lightMap[index] !== value) {
      lightMap[index] = value;
      if (affectedChunks) affectedChunks.add(key);
      return true;
    }
    return false;
  }

  /**
   * Check if block at world coordinates is opaque
   */
  isOpaqueAt(worldX, worldY, worldZ) {
    if (!this.getBlockCallback) return false;
    if (worldY < 0 || worldY >= CHUNK_HEIGHT) return false;

    const block = this.getBlockCallback(worldX, worldY, worldZ);
    if (!block || block === BLOCK_TYPES.AIR) return false;

    const props = BLOCK_PROPERTIES[block];
    return props && !props.transparent;
  }

  /**
   * Get light decay for block at position (water/leaves = 2, others = 1)
   */
  getLightDecay(worldX, worldY, worldZ) {
    if (!this.getBlockCallback) return 1;

    const block = this.getBlockCallback(worldX, worldY, worldZ);
    if (block === BLOCK_TYPES.WATER || block === BLOCK_TYPES.LEAVES) return 2;
    return 1;
  }

  // === INCREMENTAL LIGHTING UPDATE (Minecraft-style) ===

  /**
   * Main dispatcher for block changes - handles all block types
   * @param {number} worldX - World X coordinate
   * @param {number} worldY - World Y coordinate
   * @param {number} worldZ - World Z coordinate
   * @param {number} oldBlockId - Previous block ID
   * @param {number} newBlockId - New block ID
   * @returns {Set<string>} Set of affected chunk keys
   */
  onBlockPlaced(worldX, worldY, worldZ, oldBlockId, newBlockId) {
    const oldProps = BLOCK_PROPERTIES[oldBlockId];
    const newProps = BLOCK_PROPERTIES[newBlockId];

    const wasTransparent = !oldProps || oldProps.transparent;
    const isTransparent = !newProps || newProps.transparent;
    const oldIsTorch = oldProps?.renderType === 'torch';
    const newIsTorch = newProps?.renderType === 'torch';

    // Handle torch removal first
    if (oldIsTorch && !newIsTorch) {
      return this.removeLightSource(worldX, worldY, worldZ, 14);
    }

    // Handle torch placement
    if (newIsTorch) {
      return this.addLightSource(worldX, worldY, worldZ, 14);
    }

    // Transparent -> Opaque: block now blocks light
    if (wasTransparent && !isTransparent) {
      return this.onOpaqueBlockPlaced(worldX, worldY, worldZ);
    }

    // Opaque -> Transparent: block now allows light through
    if (!wasTransparent && isTransparent) {
      return this.onOpaqueBlockRemoved(worldX, worldY, worldZ);
    }

    // Transparent -> Transparent (e.g., air to water) - minimal update
    // or Opaque -> Opaque - no light change needed
    return new Set();
  }

  /**
   * Handle placement of opaque block - removes light that passed through this position
   * @returns {Set<string>} Set of affected chunk keys
   */
  onOpaqueBlockPlaced(worldX, worldY, worldZ) {
    const affectedChunks = new Set();

    // Get current light at this position before blocking
    const currentLight = this.getLightAt(worldX, worldY, worldZ);

    // Set light to 0 at this position (opaque block)
    this.setLightAt(worldX, worldY, worldZ, 0, affectedChunks);

    if (currentLight === 0) {
      return affectedChunks; // No light was here anyway
    }

    // BFS removal queue and propagation queue
    const removeQueue = [];
    const propagateQueue = [];

    // Check neighbors - they might have received light through this block
    for (const [dx, dy, dz] of DIRECTIONS) {
      const nx = worldX + dx;
      const ny = worldY + dy;
      const nz = worldZ + dz;

      if (ny < 0 || ny >= CHUNK_HEIGHT) continue;
      if (this.isOpaqueAt(nx, ny, nz)) continue;

      const neighborLight = this.getLightAt(nx, ny, nz);
      if (neighborLight > 0 && neighborLight < currentLight) {
        // Neighbor's light was dependent on this block - add to removal queue
        removeQueue.push({ x: nx, y: ny, z: nz, light: neighborLight });
      } else if (neighborLight >= currentLight && neighborLight > 0) {
        // Neighbor has independent light source - add to propagation queue
        propagateQueue.push({ x: nx, y: ny, z: nz, light: neighborLight });
      }
    }

    // Phase 1: BFS light removal
    this.bfsRemoveLight(removeQueue, propagateQueue, affectedChunks);

    // Phase 2: BFS light propagation from remaining sources
    this.bfsPropagate(propagateQueue, affectedChunks);

    return affectedChunks;
  }

  /**
   * Handle removal of opaque block - allows light to pass through
   * @returns {Set<string>} Set of affected chunk keys
   */
  onOpaqueBlockRemoved(worldX, worldY, worldZ) {
    const affectedChunks = new Set();
    const propagateQueue = [];

    // Check for skylight from above
    let skyLight = 0;
    let hasDirectSky = true;

    for (let y = worldY + 1; y < CHUNK_HEIGHT; y++) {
      if (this.isOpaqueAt(worldX, y, worldZ)) {
        hasDirectSky = false;
        break;
      }
      // Check if there's full skylight above
      const lightAbove = this.getLightAt(worldX, y, worldZ);
      if (lightAbove === 15) {
        skyLight = 15;
        break;
      }
    }

    // If direct sky access and at top of world or light above is 15
    if (hasDirectSky && (worldY === CHUNK_HEIGHT - 1 || skyLight === 15)) {
      skyLight = 15;
    }

    // Find max light from neighbors
    let maxNeighborLight = 0;
    for (const [dx, dy, dz] of DIRECTIONS) {
      const nx = worldX + dx;
      const ny = worldY + dy;
      const nz = worldZ + dz;

      if (ny < 0 || ny >= CHUNK_HEIGHT) continue;

      const neighborLight = this.getLightAt(nx, ny, nz);
      if (neighborLight > maxNeighborLight) {
        maxNeighborLight = neighborLight;
      }
    }

    // New light is max of skylight or (neighbor - 1)
    const newLight = Math.max(skyLight, maxNeighborLight > 0 ? maxNeighborLight - 1 : 0);

    if (newLight > 0) {
      this.setLightAt(worldX, worldY, worldZ, newLight, affectedChunks);
      propagateQueue.push({ x: worldX, y: worldY, z: worldZ, light: newLight });

      // BFS propagate from this position
      this.bfsPropagate(propagateQueue, affectedChunks);
    }

    // If skylight opened up, propagate it downward
    if (skyLight === 15) {
      this.propagateSkylight(worldX, worldY - 1, worldZ, affectedChunks);
    }

    return affectedChunks;
  }

  /**
   * BFS light removal - removes light that was dependent on a removed source
   */
  bfsRemoveLight(removeQueue, propagateQueue, affectedChunks) {
    let head = 0;

    while (head < removeQueue.length) {
      const { x, y, z, light } = removeQueue[head++];

      // Set this position to 0
      this.setLightAt(x, y, z, 0, affectedChunks);

      for (const [dx, dy, dz] of DIRECTIONS) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;

        if (ny < 0 || ny >= CHUNK_HEIGHT) continue;
        if (this.isOpaqueAt(nx, ny, nz)) continue;

        const neighborLight = this.getLightAt(nx, ny, nz);

        if (neighborLight > 0 && neighborLight < light) {
          // This neighbor received light from the removed area - remove it
          removeQueue.push({ x: nx, y: ny, z: nz, light: neighborLight });
        } else if (neighborLight >= light && neighborLight > 0) {
          // This neighbor has independent light - add to propagation
          propagateQueue.push({ x: nx, y: ny, z: nz, light: neighborLight });
        }
      }
    }
  }

  /**
   * BFS light propagation - spreads light from sources
   */
  bfsPropagate(queue, affectedChunks) {
    let head = 0;

    while (head < queue.length) {
      const { x, y, z, light } = queue[head++];

      if (light <= 1) continue;

      for (const [dx, dy, dz] of DIRECTIONS) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;

        if (ny < 0 || ny >= CHUNK_HEIGHT) continue;
        if (this.isOpaqueAt(nx, ny, nz)) continue;

        const decay = this.getLightDecay(nx, ny, nz);
        const newLight = light - decay;
        const currentLight = this.getLightAt(nx, ny, nz);

        if (newLight > currentLight) {
          this.setLightAt(nx, ny, nz, newLight, affectedChunks);
          queue.push({ x: nx, y: ny, z: nz, light: newLight });
        }
      }
    }
  }

  /**
   * Propagate skylight downward when a block is removed
   */
  propagateSkylight(worldX, startY, worldZ, affectedChunks) {
    let light = 15;

    for (let y = startY; y >= 0; y--) {
      if (this.isOpaqueAt(worldX, y, worldZ)) break;

      const decay = this.getLightDecay(worldX, y, worldZ);
      // Skylight doesn't decay going straight down through air
      if (decay > 1) {
        light = Math.max(0, light - (decay - 1));
      }

      const currentLight = this.getLightAt(worldX, y, worldZ);
      if (light > currentLight) {
        this.setLightAt(worldX, y, worldZ, light, affectedChunks);

        // Also propagate horizontally from this skylight column
        const propagateQueue = [{ x: worldX, y, z: worldZ, light }];
        this.bfsPropagate(propagateQueue, affectedChunks);
      } else {
        // If existing light is already >= our skylight, stop
        break;
      }
    }
  }

  /**
   * Check if chunk needs relighting (neighbors changed)
   */
  needsRelight(chunkKey) {
    return !this.fullyLit.has(chunkKey);
  }

  /**
   * Mark chunk as needing relight
   */
  markDirty(chunkKey) {
    this.fullyLit.delete(chunkKey);
  }

  /**
   * Get light from neighboring chunk
   */
  getNeighborLight(chunkX, chunkZ, localX, localY, localZ) {
    const key = `${chunkX},${chunkZ}`;
    const lightMap = this.lightMaps[key];
    if (!lightMap) return -1;
    if (localY < 0 || localY >= CHUNK_HEIGHT) return localY >= CHUNK_HEIGHT ? 15 : 0;
    const index = localY * CHUNK_SIZE * CHUNK_SIZE + localX * CHUNK_SIZE + localZ;
    return lightMap[index] || 0;
  }

  /**
   * Compute lighting for a chunk using BFS propagation
   */
  computeLighting(chunk, chunkKey) {
    return PerformanceMetrics.measure('lighting', () => {
      const [chunkX, chunkZ] = chunkKey.split(',').map(Number);
      const lightMap = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);

      const getIndex = (x, y, z) => y * CHUNK_SIZE * CHUNK_SIZE + x * CHUNK_SIZE + z;

      // Phase 1: Sky Light + Light Sources
      const queue = [];

      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          let sunlight = 15;

          for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
            const index = getIndex(x, y, z);
            const block = chunk.getBlock(x, y, z);
            const props = BLOCK_PROPERTIES[block];

            // Проверяем, является ли блок источником света
            if (props && props.renderType === 'torch') {
              const lightLevel = 14;
              lightMap[index] = Math.max(lightMap[index] || 0, lightLevel);
              queue.push({ x, y, z, light: lightLevel });
            }

            if (!props || props.transparent) {
              if (block === BLOCK_TYPES.LEAVES) {
                sunlight = Math.max(0, sunlight - 2);
              } else if (block === BLOCK_TYPES.WATER) {
                sunlight = Math.max(0, sunlight - 2);
              }

              lightMap[index] = Math.max(lightMap[index] || 0, sunlight);
              if (sunlight > 0) {
                queue.push({ x, y, z, light: sunlight });
              }
            } else {
              // Solid block
              if (!props.renderType || props.renderType === 'block') {
                lightMap[index] = 0;
              }
              sunlight = 0;
            }
          }
        }
      }

      // Phase 2: Border light from neighbors
      let head = 0;
      const neighborOffsets = [
        { cx: -1, cz: 0, edgeX: 0, edgeZ: null, sourceX: CHUNK_SIZE - 1 },
        { cx: 1, cz: 0, edgeX: CHUNK_SIZE - 1, edgeZ: null, sourceX: 0 },
        { cx: 0, cz: -1, edgeX: null, edgeZ: 0, sourceZ: CHUNK_SIZE - 1 },
        { cx: 0, cz: 1, edgeX: null, edgeZ: CHUNK_SIZE - 1, sourceZ: 0 }
      ];

      for (const { cx, cz, edgeX, edgeZ, sourceX, sourceZ } of neighborOffsets) {
        const neighborChunkX = chunkX + cx;
        const neighborChunkZ = chunkZ + cz;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          for (let i = 0; i < CHUNK_SIZE; i++) {
            const srcX = edgeX !== null ? sourceX : i;
            const srcZ = edgeZ !== null ? sourceZ : i;
            const localX = edgeX !== null ? edgeX : i;
            const localZ = edgeZ !== null ? edgeZ : i;

            const neighborLight = this.getNeighborLight(neighborChunkX, neighborChunkZ, srcX, y, srcZ);

            if (neighborLight > 1) {
              const block = chunk.getBlock(localX, y, localZ);
              const props = BLOCK_PROPERTIES[block];

              if (!props || props.transparent) {
                const index = getIndex(localX, y, localZ);
                const newLight = neighborLight - 1;

                if (newLight > lightMap[index]) {
                  lightMap[index] = newLight;
                  queue.push({ x: localX, y, z: localZ, light: newLight });
                }
              }
            }
          }
        }
      }

      // Phase 3: BFS propagation
      const directions = [
        { dx: 1, dy: 0, dz: 0 }, { dx: -1, dy: 0, dz: 0 },
        { dx: 0, dy: 1, dz: 0 }, { dx: 0, dy: -1, dz: 0 },
        { dx: 0, dy: 0, dz: 1 }, { dx: 0, dy: 0, dz: -1 }
      ];

      while (head < queue.length) {
        const { x, y, z, light } = queue[head++];

        if (light <= 1) continue;

        for (const { dx, dy, dz } of directions) {
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;

          if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) {
            continue;
          }

          const nIndex = getIndex(nx, ny, nz);
          const nBlock = chunk.getBlock(nx, ny, nz);
          const nProps = BLOCK_PROPERTIES[nBlock];

          if (nProps && !nProps.transparent) continue;

          let decay = 1;
          if (nBlock === BLOCK_TYPES.WATER) decay = 2;
          if (nBlock === BLOCK_TYPES.LEAVES) decay = 1;

          const newLight = light - decay;

          if (newLight > lightMap[nIndex]) {
            lightMap[nIndex] = newLight;
            queue.push({ x: nx, y: ny, z: nz, light: newLight });
          }
        }
      }

      this.lightMaps[chunkKey] = lightMap;
      
      // Проверяем, все ли соседи существуют для полного освещения
      const hasAllNeighbors = [
        `${chunkX - 1},${chunkZ}`,
        `${chunkX + 1},${chunkZ}`,
        `${chunkX},${chunkZ - 1}`,
        `${chunkX},${chunkZ + 1}`
      ].every(key => this.lightMaps[key] !== undefined);
      
      if (hasAllNeighbors) {
        this.fullyLit.add(chunkKey);
      }
      
      return lightMap;
    });
  }

  /**
   * Get light level at world coordinates
   */
  getLightLevel(worldX, worldY, worldZ) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = `${cx},${cz}`;

    const lightMap = this.lightMaps[key];
    if (!lightMap) return 15;

    const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = Math.floor(worldY);

    if (ly < 0 || ly >= CHUNK_HEIGHT) return 15;

    const index = ly * CHUNK_SIZE * CHUNK_SIZE + lx * CHUNK_SIZE + lz;
    return lightMap[index] || 0;
  }

  /**
   * Check if chunk has light map
   */
  hasLightMap(key) {
    return !!this.lightMaps[key];
  }

  /**
   * Инкрементальное удаление света (при удалении факела)
   * Использует BFS для удаления света и повторного распространения
   * @returns {Set<string>} Set ключей затронутых чанков
   */
  removeLightSource(worldX, worldY, worldZ, lightLevel) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = `${cx},${cz}`;
    
    const lightMap = this.lightMaps[key];
    if (!lightMap) return new Set();

    const affectedChunks = new Set([key]);
    const getIndex = (x, y, z) => y * CHUNK_SIZE * CHUNK_SIZE + x * CHUNK_SIZE + z;
    const getKey = (wx, wz) => `${Math.floor(wx / CHUNK_SIZE)},${Math.floor(wz / CHUNK_SIZE)}`;
    const getLocal = (w) => ((w % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    // Очередь для удаления света: {x, y, z, light}
    const removeQueue = [];
    // Очередь для повторного распространения света
    const propagateQueue = [];
    
    // Начинаем с позиции удалённого факела
    const lx = getLocal(worldX);
    const lz = getLocal(worldZ);
    const startIndex = getIndex(lx, worldY, lz);
    const startLight = lightMap[startIndex];
    
    lightMap[startIndex] = 0;
    removeQueue.push({ x: worldX, y: worldY, z: worldZ, light: startLight });

    const directions = [
      { dx: 1, dy: 0, dz: 0 }, { dx: -1, dy: 0, dz: 0 },
      { dx: 0, dy: 1, dz: 0 }, { dx: 0, dy: -1, dz: 0 },
      { dx: 0, dy: 0, dz: 1 }, { dx: 0, dy: 0, dz: -1 }
    ];

    // Фаза 1: Удаление света (BFS)
    let head = 0;
    while (head < removeQueue.length) {
      const { x, y, z, light } = removeQueue[head++];

      for (const { dx, dy, dz } of directions) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;

        if (ny < 0 || ny >= CHUNK_HEIGHT) continue;
        if (this.isOpaqueAt(nx, ny, nz)) continue;

        const nKey = getKey(nx, nz);
        const nLightMap = this.lightMaps[nKey];
        if (!nLightMap) continue;

        const nlx = getLocal(nx);
        const nlz = getLocal(nz);
        const nIndex = getIndex(nlx, ny, nlz);
        const neighborLight = nLightMap[nIndex];

        if (neighborLight > 0 && neighborLight < light) {
          // Этот блок получал свет от удалённого источника - удаляем
          nLightMap[nIndex] = 0;
          affectedChunks.add(nKey);
          removeQueue.push({ x: nx, y: ny, z: nz, light: neighborLight });
        } else if (neighborLight >= light) {
          // Этот блок имеет свой источник света или получает от другого - добавляем для повторного распространения
          propagateQueue.push({ x: nx, y: ny, z: nz, light: neighborLight });
        }
      }
    }

    // Фаза 2: Повторное распространение света (BFS)
    head = 0;
    while (head < propagateQueue.length) {
      const { x, y, z, light } = propagateQueue[head++];

      if (light <= 1) continue;

      for (const { dx, dy, dz } of directions) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;

        if (ny < 0 || ny >= CHUNK_HEIGHT) continue;
        if (this.isOpaqueAt(nx, ny, nz)) continue;

        const nKey = getKey(nx, nz);
        const nLightMap = this.lightMaps[nKey];
        if (!nLightMap) continue;

        const nlx = getLocal(nx);
        const nlz = getLocal(nz);
        const nIndex = getIndex(nlx, ny, nlz);

        // Apply decay based on block type
        const decay = this.getLightDecay(nx, ny, nz);
        const newLight = light - decay;

        if (newLight > nLightMap[nIndex]) {
          nLightMap[nIndex] = newLight;
          affectedChunks.add(nKey);
          propagateQueue.push({ x: nx, y: ny, z: nz, light: newLight });
        }
      }
    }

    return affectedChunks;
  }

  /**
   * Инкрементальное добавление света (при установке факела)
   * @returns {Set<string>} Set ключей затронутых чанков
   */
  addLightSource(worldX, worldY, worldZ, lightLevel) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = `${cx},${cz}`;
    
    const lightMap = this.lightMaps[key];
    if (!lightMap) return new Set();

    const affectedChunks = new Set([key]);
    const getIndex = (x, y, z) => y * CHUNK_SIZE * CHUNK_SIZE + x * CHUNK_SIZE + z;
    const getKey = (wx, wz) => `${Math.floor(wx / CHUNK_SIZE)},${Math.floor(wz / CHUNK_SIZE)}`;
    const getLocal = (w) => ((w % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    const lx = getLocal(worldX);
    const lz = getLocal(worldZ);
    const startIndex = getIndex(lx, worldY, lz);
    
    lightMap[startIndex] = lightLevel;
    
    const queue = [{ x: worldX, y: worldY, z: worldZ, light: lightLevel }];
    let head = 0;

    const directions = [
      { dx: 1, dy: 0, dz: 0 }, { dx: -1, dy: 0, dz: 0 },
      { dx: 0, dy: 1, dz: 0 }, { dx: 0, dy: -1, dz: 0 },
      { dx: 0, dy: 0, dz: 1 }, { dx: 0, dy: 0, dz: -1 }
    ];

    while (head < queue.length) {
      const { x, y, z, light } = queue[head++];

      if (light <= 1) continue;

      for (const { dx, dy, dz } of directions) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;

        if (ny < 0 || ny >= CHUNK_HEIGHT) continue;

        // Check if neighbor block is opaque - light cannot pass through
        if (this.isOpaqueAt(nx, ny, nz)) continue;

        const nKey = getKey(nx, nz);
        const nLightMap = this.lightMaps[nKey];
        if (!nLightMap) continue;

        const nlx = getLocal(nx);
        const nlz = getLocal(nz);
        const nIndex = getIndex(nlx, ny, nlz);

        // Apply decay based on block type (water/leaves = 2, others = 1)
        const decay = this.getLightDecay(nx, ny, nz);
        const newLight = light - decay;

        if (newLight > nLightMap[nIndex]) {
          nLightMap[nIndex] = newLight;
          affectedChunks.add(nKey);
          queue.push({ x: nx, y: ny, z: nz, light: newLight });
        }
      }
    }

    return affectedChunks;
  }

  /**
   * Remove light map for chunk
   */
  removeLightMap(key) {
    delete this.lightMaps[key];
    this.fullyLit.delete(key);
    
    // Пометить соседей как требующие пересчёта
    const [cx, cz] = key.split(',').map(Number);
    [`${cx - 1},${cz}`, `${cx + 1},${cz}`, `${cx},${cz - 1}`, `${cx},${cz + 1}`].forEach(nKey => {
      this.fullyLit.delete(nKey);
    });
  }

  /**
   * Clear all light maps
   */
  clear() {
    this.lightMaps = {};
    this.fullyLit.clear();
  }
}

export default LightingManager;

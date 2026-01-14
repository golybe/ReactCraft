import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants/world';
import { BLOCK_PROPERTIES, BLOCK_TYPES } from '../../constants/blocks';
import { PerformanceMetrics } from '../../utils/performance';

/**
 * Manages lighting computation for chunks.
 * Extracted from ChunkManager for better separation of concerns.
 */
export class LightingManager {
  constructor() {
    this.lightMaps = {}; // Light maps for chunks (Uint8Array)
    this.fullyLit = new Set(); // Chunks that have been lit with all neighbors present
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

        const nKey = getKey(nx, nz);
        const nLightMap = this.lightMaps[nKey];
        if (!nLightMap) continue;

        const nlx = getLocal(nx);
        const nlz = getLocal(nz);
        const nIndex = getIndex(nlx, ny, nlz);
        const newLight = light - 1;

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

        const nKey = getKey(nx, nz);
        const nLightMap = this.lightMaps[nKey];
        if (!nLightMap) continue;

        const nlx = getLocal(nx);
        const nlz = getLocal(nz);
        const nIndex = getIndex(nlx, ny, nlz);
        const newLight = light - 1;

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

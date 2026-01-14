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

      // Phase 1: Sky Light
      const sunlitBlocks = [];

      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          let sunlight = 15;

          for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
            const index = getIndex(x, y, z);
            const block = chunk.getBlock(x, y, z);
            const props = BLOCK_PROPERTIES[block];

            if (!props || props.transparent) {
              if (block === BLOCK_TYPES.LEAVES) {
                sunlight = Math.max(0, sunlight - 2);
              } else if (block === BLOCK_TYPES.WATER) {
                sunlight = Math.max(0, sunlight - 2);
              }

              lightMap[index] = sunlight;
              if (sunlight > 0) {
                sunlitBlocks.push({ x, y, z, light: sunlight });
              }
            } else {
              lightMap[index] = 0;
              sunlight = 0;
            }
          }
        }
      }

      // Phase 2: Light propagation (BFS)
      const queue = [...sunlitBlocks];
      let head = 0;

      // Border light from neighbors
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

      // BFS propagation
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
   * Remove light map for chunk
   */
  removeLightMap(key) {
    delete this.lightMaps[key];
  }

  /**
   * Clear all light maps
   */
  clear() {
    this.lightMaps = {};
  }
}

export default LightingManager;

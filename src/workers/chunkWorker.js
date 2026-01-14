/**
 * Chunk Generation Web Worker
 *
 * Handles terrain generation in a separate thread.
 * All dependencies are imported as ES modules.
 */

import { NoiseGenerators, SeededRandom } from '../utils/noise.js';
import { TerrainDensitySampler } from '../utils/terrain.js';
import { CaveCarver, ThresholdCaveCarver } from '../utils/caves.js';
import { OreGenerator } from '../utils/ores.js';
import { getBiome, BIOMES, BIOME_IDS } from '../utils/biomes.js';
import { structureManager } from '../core/world/structures/StructureManager.js';
// Используем простые константы без BlockRegistry для совместимости с воркерами
import { BLOCK_TYPES } from '../constants/blockTypes.js';
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from '../constants/world.js';

// =====================================================
// CACHED GENERATORS (per-seed)
// =====================================================

let cachedSeed = null;
let noiseGenerators = null;
let terrainSampler = null;
let caveCarver = null;
let thresholdCaves = null;
let oreGenerator = null;

function initGenerators(seed) {
  if (cachedSeed === seed) return;

  cachedSeed = seed;
  noiseGenerators = new NoiseGenerators(seed);
  terrainSampler = new TerrainDensitySampler(noiseGenerators);
  caveCarver = new CaveCarver(seed);
  thresholdCaves = new ThresholdCaveCarver(noiseGenerators);
  oreGenerator = new OreGenerator(seed);
}

// =====================================================
// CHUNK GENERATION
// =====================================================

function generateChunk(chunkX, chunkZ, seed) {
  initGenerators(seed);

  const startX = chunkX * CHUNK_SIZE;
  const startZ = chunkZ * CHUNK_SIZE;

  // Allocate chunk data arrays
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  const metadata = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);

  // Generate density field (optimized sampling)
  const densityField = terrainSampler.generateDensityField(chunkX, chunkZ);

  // Get cave positions (Perlin worms)
  const carvedPositions = caveCarver.getCarvedPositions(chunkX, chunkZ);

  // Get ore positions
  const oreMap = oreGenerator.getOreMap(chunkX, chunkZ);

  // Helper functions
  const setBlock = (x, y, z, blockId, meta = 0) => {
    const index = y * CHUNK_SIZE * CHUNK_SIZE + x * CHUNK_SIZE + z;
    blocks[index] = blockId;
    metadata[index] = meta;
  };

  const getIndex = (x, y, z) => y * CHUNK_SIZE * CHUNK_SIZE + x * CHUNK_SIZE + z;

  // Track surface heights for tree placement
  const surfaceHeights = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);
  const surfaceBiomes = new Array(CHUNK_SIZE * CHUNK_SIZE);

  // =========================================================
  // PASS 1: Generate base terrain from density
  // =========================================================

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const worldX = startX + x;
      const worldZ = startZ + z;

      // Get terrain data for this column
      const terrainData = terrainSampler.getTerrainAt(densityField, x, z);
      const biome = terrainData?.biome || BIOMES[BIOME_IDS.PLAINS];
      const cliffFactor = terrainData?.cliffFactor || 0;
      const surfaceDetail = terrainData?.surfaceDetail || 0;
      const beachNoise = terrainData?.beachNoise || 0;
      const isOceanBiome = terrainData?.isOceanBiome || false;
      const isBeachTerrain = terrainData?.isBeach || false;

      // Find surface height by scanning from top
      let surfaceY = 0;
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        const density = terrainSampler.interpolateDensity(densityField, x, y, z);
        if (density > 0) {
          surfaceY = y;
          break;
        }
      }

      // Store for tree placement
      surfaceHeights[x * CHUNK_SIZE + z] = surfaceY;
      surfaceBiomes[x * CHUNK_SIZE + z] = biome;

      // Calculate slope (gradient) for cliff detection
      // Sample neighbors to detect steep terrain
      let slope = 0;
      if (x > 0 && x < CHUNK_SIZE - 1 && z > 0 && z < CHUNK_SIZE - 1) {
        const neighborData = [
          terrainSampler.getTerrainAt(densityField, x - 1, z),
          terrainSampler.getTerrainAt(densityField, x + 1, z),
          terrainSampler.getTerrainAt(densityField, x, z - 1),
          terrainSampler.getTerrainAt(densityField, x, z + 1)
        ];
        const heights = neighborData.map(d => d?.baseHeight || surfaceY);
        const maxDiff = Math.max(
          Math.abs(heights[0] - heights[1]),
          Math.abs(heights[2] - heights[3])
        );
        slope = maxDiff / 8; // Normalize: 8 blocks difference = slope 1.0
      }

      // Generate column
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        let block = BLOCK_TYPES.AIR;
        let meta = 0;

        // Bedrock layer (with variation)
        if (y === 0) {
          block = BLOCK_TYPES.BEDROCK;
        } else if (y < 3 && Math.random() < 0.5) {
          block = BLOCK_TYPES.BEDROCK;
        }
        // Below or at surface
        else if (y <= surfaceY) {
          const density = terrainSampler.interpolateDensity(densityField, x, y, z);

          if (density > 0) {
            // Check caves (worm + threshold)
            const isCaved = carvedPositions.has(`${worldX},${y},${worldZ}`) ||
                           thresholdCaves.isCave(worldX, y, worldZ);

            if (isCaved) {
              // Cave - fill with water if below sea level
              if (y <= SEA_LEVEL) {
                block = BLOCK_TYPES.WATER;
                meta = 255;
              } else {
                block = BLOCK_TYPES.AIR;
              }
            } else {
              // Solid terrain - determine block type
              const depthFromSurface = surfaceY - y;
              const isUnderwater = surfaceY < SEA_LEVEL;

              if (y === surfaceY) {
                // === SURFACE BLOCK ===
                if (isUnderwater) {
                  // Underwater surface
                  if (beachNoise > 0.3) {
                    block = BLOCK_TYPES.GRAVEL; // Gravel patches underwater
                  } else {
                    block = BLOCK_TYPES.SAND;
                  }
                } else if (surfaceY < SEA_LEVEL + 3) {
                  // Beach zone
                  if (beachNoise > 0.6) {
                    block = BLOCK_TYPES.GRAVEL; // Gravel beach patches
                  } else {
                    block = BLOCK_TYPES.SAND;
                  }
                } else if (slope > 0.6 || cliffFactor > 0.7) {
                  // Steep cliff - exposed stone
                  block = BLOCK_TYPES.STONE;
                } else if (slope > 0.35 && surfaceDetail > 0.4) {
                  // Moderate slope - stone patches
                  block = BLOCK_TYPES.STONE;
                } else if (surfaceDetail > 0.7 && biome.surfaceBlock === BLOCK_TYPES.GRASS) {
                  // Random dirt patches in grass biomes
                  block = BLOCK_TYPES.DIRT;
                } else {
                  // Normal surface
                  block = biome.surfaceBlock || BLOCK_TYPES.GRASS;
                }
              } else if (depthFromSurface <= 3) {
                // === SUBSURFACE (1-3 blocks below) ===
                if (isUnderwater || surfaceY < SEA_LEVEL + 3) {
                  // Beach/underwater subsurface
                  if (depthFromSurface <= 2) {
                    block = BLOCK_TYPES.SAND;
                  } else {
                    block = BLOCK_TYPES.SANDSTONE;
                  }
                } else if (slope > 0.5 || cliffFactor > 0.6) {
                  // Cliff subsurface - stone
                  block = BLOCK_TYPES.STONE;
                } else {
                  // Normal subsurface
                  block = biome.subsurfaceBlock || BLOCK_TYPES.DIRT;
                }
              } else {
                // === DEEP STONE ===
                block = BLOCK_TYPES.STONE;

                // Check for ore replacement
                const oreKey = `${x},${y},${z}`;
                const ore = oreMap.get(oreKey);
                if (ore) {
                  block = ore;
                }
              }
            }
          }
        }
        // Above surface but at/below sea level = WATER
        else if (y <= SEA_LEVEL) {
          block = BLOCK_TYPES.WATER;
          meta = 255;
        }

        if (block !== BLOCK_TYPES.AIR) {
          setBlock(x, y, z, block, meta);
        }
      }

      // Определяем реальную высоту поверхности ПОСЛЕ генерации (сверху вниз)
      let realSurfaceY = -1;
      for (let y = Math.min(surfaceY + 5, CHUNK_HEIGHT - 1); y >= 0; y--) {
        const idx = y * CHUNK_SIZE * CHUNK_SIZE + x * CHUNK_SIZE + z;
        const blockId = blocks[idx];
        // Ищем первый ТВЕРДЫЙ блок (не воздух, не вода)
        if (blockId !== BLOCK_TYPES.AIR && blockId !== BLOCK_TYPES.WATER) {
          realSurfaceY = y;
          break;
        }
      }

      surfaceHeights[x * CHUNK_SIZE + z] = realSurfaceY;
      surfaceBiomes[x * CHUNK_SIZE + z] = biome;
    }
  }

  // =========================================================
  // PASS 2: Decorate (trees, etc.)
  // =========================================================

  const treeSeed = seed + chunkX * 1000 + chunkZ;
  const treeRng = new SeededRandom(treeSeed);

  // Используем сетку 4x4 для равномерного распределения
  const STEP = 4;
  for (let cx = 0; cx < CHUNK_SIZE; cx += STEP) {
    for (let cz = 0; cz < CHUNK_SIZE; cz += STEP) {
      // Выбираем случайную точку внутри ячейки 4x4 (jitter)
      const x = cx + Math.floor(treeRng.next() * STEP);
      const z = cz + Math.floor(treeRng.next() * STEP);

      // Проверка границ (с учетом отступа для листвы)
      if (x < 2 || x >= CHUNK_SIZE - 2 || z < 2 || z >= CHUNK_SIZE - 2) continue;

      const idx = x * CHUNK_SIZE + z;
      const surfaceY = surfaceHeights[idx];
      const biome = surfaceBiomes[idx];

      if (!biome) continue;

      // Шанс дерева теперь масштабируется (так как мы проверяем реже)
      // Если STEP=4, мы проверяем в 16 раз меньше блоков, значит шанс нужно умножить на коэффициент
      const adjustedChance = (biome.treeChance || 0) * (STEP * STEP * 0.8);

      if (treeRng.next() < adjustedChance) {
        // Только на суше выше уровня моря, и surfaceY должен быть валидным
        if (surfaceY > SEA_LEVEL && surfaceY > 0 && surfaceY < 250) {
          // Передаем координату ЗЕМЛИ (не +1), проверки делаются внутри TreeStructure
          structureManager.generate('tree', blocks, x, surfaceY, z, treeRng, { biome });
        }
      }
    }
  }

  // Clear terrain sampler cache
  terrainSampler.clearCache();

  // Return transferable ArrayBuffers
  return {
    blocks: blocks.buffer,
    metadata: metadata.buffer
  };
}

// =====================================================
// MESSAGE HANDLER
// =====================================================

self.onmessage = function(e) {
  const { taskId, type, chunkX, chunkZ, seed } = e.data;

  // console.log(`[ChunkWorker] Received task ${taskId}: ${type} (${chunkX}, ${chunkZ})`);

  try {
    if (type === 'generateChunk') {
      // console.log(`[ChunkWorker] Generating chunk (${chunkX}, ${chunkZ}) with seed ${seed}`);
      const result = generateChunk(chunkX, chunkZ, seed);
      // console.log(`[ChunkWorker] Chunk generated, blocks size: ${result.blocks.byteLength}`);

      // Transfer ArrayBuffers for zero-copy
      self.postMessage(
        { taskId, result },
        [result.blocks, result.metadata]
      );
      // console.log(`[ChunkWorker] Result sent for task ${taskId}`);
    }
  } catch (error) {
    console.error('[ChunkWorker] Error:', error);
    console.error('[ChunkWorker] Stack:', error.stack);
    self.postMessage({
      taskId,
      error: error.message
    });
  }
};

// Signal that worker is ready
self.postMessage({ type: 'ready' });

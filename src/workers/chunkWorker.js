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

      // Find surface height
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

      // Generate column
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        let block = BLOCK_TYPES.AIR;
        let meta = 0;

        // Bedrock layer
        if (y === 0) {
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
              // Solid terrain
              if (y === surfaceY) {
                // Surface block
                if (surfaceY < SEA_LEVEL + 2) {
                  block = BLOCK_TYPES.SAND; // Beach/underwater
                } else {
                  block = biome.surfaceBlock || BLOCK_TYPES.GRASS;
                }
              } else if (y > surfaceY - 4) {
                // Subsurface (1-3 blocks below surface)
                block = biome.subsurfaceBlock || BLOCK_TYPES.DIRT;
              } else {
                // Deep stone
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
        // Above surface but at/below sea level
        else if (y <= SEA_LEVEL) {
          block = BLOCK_TYPES.WATER;
          meta = 255;
        }

        if (block !== BLOCK_TYPES.AIR) {
          setBlock(x, y, z, block, meta);
        }
      }
    }
  }

  // =========================================================
  // PASS 2: Decorate (trees, etc.)
  // =========================================================

  const treeSeed = seed + chunkX * 1000 + chunkZ;
  const treeRng = new SeededRandom(treeSeed);

  for (let x = 2; x < CHUNK_SIZE - 2; x++) {
    for (let z = 2; z < CHUNK_SIZE - 2; z++) {
      const idx = x * CHUNK_SIZE + z;
      const surfaceY = surfaceHeights[idx];
      const biome = surfaceBiomes[idx];

      if (!biome) continue;

      if (treeRng.next() < (biome.treeChance || 0)) {
        // Only place tree on land above water
        if (surfaceY > SEA_LEVEL) {
          const groundBlock = blocks[getIndex(x, surfaceY, z)];
          if (groundBlock === BLOCK_TYPES.GRASS || groundBlock === BLOCK_TYPES.DIRT) {
            placeTree(blocks, x, surfaceY + 1, z, treeRng, biome);
          }
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
// TREE PLACEMENT
// =====================================================

function placeTree(blocks, x, y, z, rng, biome) {
  const setBlock = (bx, by, bz, blockId) => {
    if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && by >= 0 && by < CHUNK_HEIGHT) {
      const index = by * CHUNK_SIZE * CHUNK_SIZE + bx * CHUNK_SIZE + bz;
      if (blocks[index] === BLOCK_TYPES.AIR) {
        blocks[index] = blockId;
      }
    }
  };

  // Desert = cactus
  if (biome.id === 'desert') {
    const height = 2 + Math.floor(rng.next() * 2);
    for (let i = 0; i < height; i++) {
      setBlock(x, y + i, z, BLOCK_TYPES.LEAVES);
    }
    return;
  }

  // Snowy biomes = spruce style
  const isSnowy = biome.id?.includes('snow') || biome.id?.includes('taiga');

  // Standard tree
  const trunkHeight = 4 + Math.floor(rng.next() * 2);

  // Trunk
  for (let i = 0; i < trunkHeight; i++) {
    setBlock(x, y + i, z, BLOCK_TYPES.WOOD);
  }

  // Leaves (spherical canopy or conical for spruce)
  if (isSnowy) {
    // Spruce-style conical
    for (let dy = 1; dy <= trunkHeight + 1; dy++) {
      const radius = Math.max(0, 2 - Math.floor((dy - 1) / 2));
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx === 0 && dz === 0 && dy < trunkHeight) continue;
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && rng.next() > 0.5) continue;
          setBlock(x + dx, y + dy, z + dz, BLOCK_TYPES.LEAVES);
        }
      }
    }
  } else {
    // Standard oak-style
    const leafStart = trunkHeight - 2;
    for (let dy = leafStart; dy <= trunkHeight + 1; dy++) {
      const radius = dy <= trunkHeight - 1 ? 2 : 1;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx === 0 && dz === 0 && dy < trunkHeight) continue;
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          if (rng.next() > 0.15) {
            setBlock(x + dx, y + dy, z + dz, BLOCK_TYPES.LEAVES);
          }
        }
      }
    }
  }
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

/**
 * Minecraft 1.12.2-style Terrain Generation
 *
 * Features:
 * - 3D Density-based terrain
 * - Spline-based height mapping
 * - Optimized 4x8x4 density field sampling
 * - Trilinear interpolation
 */

import { NoiseGenerators } from './noise.js';
import { CubicSpline } from './spline.js';
import { getBiome, BIOMES, BIOME_IDS } from './biomes.js';
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from '../constants/world.js';

// =====================================================
// HEIGHT SPLINES (Minecraft 1.12 style)
// =====================================================

// Continentalness -> Base Height (relative to SEA_LEVEL)
export const CONTINENTALNESS_SPLINE = new CubicSpline([
  [-1.1, -60],   // Deep ocean floor
  [-0.7, -30],   // Ocean
  [-0.45, -10],  // Shallow ocean
  [-0.2, 0],     // Beach/coast
  [0.0, 5],      // Low plains
  [0.3, 10],     // Hills
  [0.5, 30],     // Mountains base
  [0.7, 50],     // High mountains
  [1.0, 80]      // Peaks
]);

// Erosion -> Height modifier
export const EROSION_SPLINE = new CubicSpline([
  [-1.0, 15],    // Plateau (erosion-resistant)
  [-0.5, 8],
  [0.0, 0],      // Normal
  [0.5, -8],     // Eroded valleys
  [1.0, -20]     // Deep erosion
]);

// Peaks/Valleys -> Fine detail
export const PV_SPLINE = new CubicSpline([
  [-1.0, -15],   // Valley
  [-0.5, -5],
  [0.0, 0],
  [0.5, 10],
  [0.8, 25],
  [1.0, 40]      // Peak
]);

// =====================================================
// TERRAIN DENSITY SAMPLER
// =====================================================

export class TerrainDensitySampler {
  constructor(noiseGenerators) {
    this.noise = noiseGenerators;
    this.biomeCache = new Map();
    this.terrainCache = new Map();
  }

  /**
   * Sample terrain parameters at world position
   * Uses 4-block grid caching for performance
   */
  sampleTerrainAt(worldX, worldZ) {
    // Round to 4-block grid
    const gridX = Math.floor(worldX / 4) * 4;
    const gridZ = Math.floor(worldZ / 4) * 4;
    const key = `${gridX},${gridZ}`;

    if (!this.terrainCache.has(key)) {
      // Sample noise values
      const params = this.noise.sampleTerrainParams(gridX, gridZ);

      // Get biome
      const biome = getBiome(params.temperature, params.humidity, params.continentalness);

      // Calculate base terrain height from splines
      let baseHeight = SEA_LEVEL + CONTINENTALNESS_SPLINE.getValue(params.continentalness);
      baseHeight += EROSION_SPLINE.getValue(params.erosion);

      // Apply PV only on land with continent weight
      if (params.continentalness > -0.2) {
        const pvWeight = Math.min(1, (params.continentalness + 0.2) / 0.5);
        baseHeight += PV_SPLINE.getValue(params.pv) * pvWeight;
      }

      // Apply biome height offset
      baseHeight += biome.heightOffset || 0;

      // Check for river
      const riverVal = this.noise.sampleRiver(gridX, gridZ);
      const riverThreshold = 0.85; // High values = river
      const isRiver = riverVal > riverThreshold && baseHeight > SEA_LEVEL - 2;

      if (isRiver) {
        // River cuts into terrain
        const riverDepth = (riverVal - riverThreshold) / (1 - riverThreshold);
        const riverBed = SEA_LEVEL - 4;
        baseHeight = riverBed + (baseHeight - riverBed) * (1 - riverDepth * 0.8);
      }

      this.terrainCache.set(key, {
        ...params,
        biome,
        baseHeight: Math.floor(baseHeight),
        isRiver
      });
    }

    return this.terrainCache.get(key);
  }

  /**
   * Interpolate terrain data between 4x4 grid points
   */
  interpolateTerrainData(worldX, worldZ) {
    const gridX = Math.floor(worldX / 4) * 4;
    const gridZ = Math.floor(worldZ / 4) * 4;

    const fx = (worldX - gridX) / 4;
    const fz = (worldZ - gridZ) / 4;

    // Sample 4 corners
    const c00 = this.sampleTerrainAt(gridX, gridZ);
    const c10 = this.sampleTerrainAt(gridX + 4, gridZ);
    const c01 = this.sampleTerrainAt(gridX, gridZ + 4);
    const c11 = this.sampleTerrainAt(gridX + 4, gridZ + 4);

    // Bilinear interpolation of height
    const h0 = c00.baseHeight + (c10.baseHeight - c00.baseHeight) * fx;
    const h1 = c01.baseHeight + (c11.baseHeight - c01.baseHeight) * fx;
    const baseHeight = h0 + (h1 - h0) * fz;

    // Use nearest biome for block decisions
    const nearestTerrain = fx < 0.5
      ? (fz < 0.5 ? c00 : c01)
      : (fz < 0.5 ? c10 : c11);

    return {
      baseHeight: Math.floor(baseHeight),
      biome: nearestTerrain.biome,
      continentalness: nearestTerrain.continentalness,
      isRiver: nearestTerrain.isRiver
    };
  }

  /**
   * Sample 3D density at a point
   * density > 0 means solid block
   */
  sampleDensity3D(worldX, worldY, worldZ, terrainData) {
    const biome = terrainData.biome;

    // Base density from height difference
    let density = terrainData.baseHeight - worldY;

    // Add 3D noise for terrain variation
    const noiseScale = biome.scale || 0.1;
    const noise3d = this.noise.sampleDensityNoise(worldX, worldY, worldZ);

    // Scale noise by biome parameters
    density += noise3d * noiseScale * 20;

    // Apply depth modifier
    density += (biome.depth || 0) * 10;

    return density;
  }

  /**
   * Generate density field for a chunk
   * Samples on 4x8x4 grid for optimization
   */
  generateDensityField(chunkX, chunkZ) {
    const startX = chunkX * CHUNK_SIZE;
    const startZ = chunkZ * CHUNK_SIZE;

    // Sample at 4-block intervals: 5x17x5 samples
    const SAMPLE_X = 5;  // 0, 4, 8, 12, 16
    const SAMPLE_Y = 17; // 0, 8, 16, ..., 128
    const SAMPLE_Z = 5;

    const densityField = new Float32Array(SAMPLE_X * SAMPLE_Y * SAMPLE_Z);
    const biomeField = new Array(SAMPLE_X * SAMPLE_Z);
    const heightField = new Int32Array(SAMPLE_X * SAMPLE_Z);

    // Pre-sample terrain data on 4x4 grid
    for (let sx = 0; sx < SAMPLE_X; sx++) {
      for (let sz = 0; sz < SAMPLE_Z; sz++) {
        const worldX = startX + sx * 4;
        const worldZ = startZ + sz * 4;
        const idx = sx * SAMPLE_Z + sz;
        const terrain = this.interpolateTerrainData(worldX, worldZ);
        biomeField[idx] = terrain;
        heightField[idx] = terrain.baseHeight;
      }
    }

    // Sample 3D density field
    let idx = 0;
    for (let sy = 0; sy < SAMPLE_Y; sy++) {
      const worldY = sy * 8;

      for (let sx = 0; sx < SAMPLE_X; sx++) {
        for (let sz = 0; sz < SAMPLE_Z; sz++) {
          const worldX = startX + sx * 4;
          const worldZ = startZ + sz * 4;
          const terrainIdx = sx * SAMPLE_Z + sz;
          const terrainData = biomeField[terrainIdx];

          densityField[idx++] = this.sampleDensity3D(worldX, worldY, worldZ, terrainData);
        }
      }
    }

    return {
      densityField,
      biomeField,
      heightField,
      SAMPLE_X,
      SAMPLE_Y,
      SAMPLE_Z
    };
  }

  /**
   * Trilinear interpolation for density at any point
   */
  interpolateDensity(field, localX, localY, localZ) {
    const { densityField, SAMPLE_X, SAMPLE_Y, SAMPLE_Z } = field;

    // Map local coords to sample space
    const sx = localX / 4;
    const sy = localY / 8;
    const sz = localZ / 4;

    const sx0 = Math.floor(sx);
    const sy0 = Math.floor(sy);
    const sz0 = Math.floor(sz);

    const fx = sx - sx0;
    const fy = sy - sy0;
    const fz = sz - sz0;

    // Clamp indices
    const sx1 = Math.min(sx0 + 1, SAMPLE_X - 1);
    const sy1 = Math.min(sy0 + 1, SAMPLE_Y - 1);
    const sz1 = Math.min(sz0 + 1, SAMPLE_Z - 1);

    const getIdx = (x, y, z) => y * SAMPLE_X * SAMPLE_Z + x * SAMPLE_Z + z;

    // Trilinear interpolation
    const c000 = densityField[getIdx(sx0, sy0, sz0)];
    const c100 = densityField[getIdx(sx1, sy0, sz0)];
    const c010 = densityField[getIdx(sx0, sy1, sz0)];
    const c110 = densityField[getIdx(sx1, sy1, sz0)];
    const c001 = densityField[getIdx(sx0, sy0, sz1)];
    const c101 = densityField[getIdx(sx1, sy0, sz1)];
    const c011 = densityField[getIdx(sx0, sy1, sz1)];
    const c111 = densityField[getIdx(sx1, sy1, sz1)];

    const c00 = c000 + (c100 - c000) * fx;
    const c01 = c001 + (c101 - c001) * fx;
    const c10 = c010 + (c110 - c010) * fx;
    const c11 = c011 + (c111 - c011) * fx;

    const c0 = c00 + (c10 - c00) * fy;
    const c1 = c01 + (c11 - c01) * fy;

    return c0 + (c1 - c0) * fz;
  }

  /**
   * Get biome at local position within chunk
   */
  getBiomeAt(field, localX, localZ) {
    const { biomeField, SAMPLE_Z } = field;

    const sx = Math.floor(localX / 4);
    const sz = Math.floor(localZ / 4);

    const idx = Math.min(sx, 4) * SAMPLE_Z + Math.min(sz, 4);
    return biomeField[idx]?.biome || BIOMES[BIOME_IDS.PLAINS];
  }

  /**
   * Get terrain data at local position
   */
  getTerrainAt(field, localX, localZ) {
    const { biomeField, SAMPLE_Z } = field;

    const sx = Math.floor(localX / 4);
    const sz = Math.floor(localZ / 4);

    const idx = Math.min(sx, 4) * SAMPLE_Z + Math.min(sz, 4);
    return biomeField[idx];
  }

  /**
   * Find surface height at position using density
   */
  findSurfaceHeight(field, localX, localZ) {
    // Start from top and scan down
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const density = this.interpolateDensity(field, localX, y, localZ);
      if (density > 0) {
        return y;
      }
    }
    return 0;
  }

  /**
   * Clear caches
   */
  clearCache() {
    this.biomeCache.clear();
    this.terrainCache.clear();
  }
}

// =====================================================
// FACTORY
// =====================================================

let cachedSampler = null;
let cachedSeed = null;

export function getTerrainSampler(seed) {
  if (cachedSeed !== seed) {
    const noise = new NoiseGenerators(seed);
    cachedSampler = new TerrainDensitySampler(noise);
    cachedSeed = seed;
  }
  return cachedSampler;
}

export function clearTerrainCache() {
  if (cachedSampler) {
    cachedSampler.clearCache();
  }
  cachedSampler = null;
  cachedSeed = null;
}

export default {
  TerrainDensitySampler,
  getTerrainSampler,
  clearTerrainCache,
  CONTINENTALNESS_SPLINE,
  EROSION_SPLINE,
  PV_SPLINE
};

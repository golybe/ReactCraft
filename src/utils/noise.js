/**
 * Minecraft 1.12.2-style Noise Generation System
 *
 * Self-contained implementation without external dependencies
 * for Web Worker compatibility.
 *
 * Features:
 * - Seeded Perlin Noise with permutation table
 * - Fractal Brownian Motion (FBM) with octaves
 * - Ridge Noise for mountains and rivers
 * - Multiple noise generators for terrain features
 */

// =====================================================
// SEEDED RANDOM NUMBER GENERATOR (LCG)
// =====================================================

export class SeededRandom {
  constructor(seed) {
    this.seed = seed >>> 0;
  }

  next() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  nextInt(max) {
    return Math.floor(this.next() * max);
  }

  nextFloat(min = 0, max = 1) {
    return min + this.next() * (max - min);
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  clone() {
    const cloned = new SeededRandom(0);
    cloned.seed = this.seed;
    return cloned;
  }
}

// =====================================================
// PERLIN NOISE (Ken Perlin's Improved Noise)
// =====================================================

export class PerlinNoise {
  constructor(seed) {
    const rng = new SeededRandom(seed);

    const base = Array.from({ length: 256 }, (_, i) => i);
    rng.shuffle(base);

    this.perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
      this.perm[i] = this.perm[i + 256] = base[i];
    }

    this.grad3 = [
      [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(a, b, t) {
    return a + t * (b - a);
  }

  grad(hash, x, y, z) {
    const g = this.grad3[hash % 12];
    return g[0] * x + g[1] * y + g[2] * z;
  }

  noise3D(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);

    const A = this.perm[X] + Y;
    const AA = this.perm[A] + Z;
    const AB = this.perm[A + 1] + Z;
    const B = this.perm[X + 1] + Y;
    const BA = this.perm[B] + Z;
    const BB = this.perm[B + 1] + Z;

    return this.lerp(
      this.lerp(
        this.lerp(
          this.grad(this.perm[AA], x, y, z),
          this.grad(this.perm[BA], x - 1, y, z),
          u
        ),
        this.lerp(
          this.grad(this.perm[AB], x, y - 1, z),
          this.grad(this.perm[BB], x - 1, y - 1, z),
          u
        ),
        v
      ),
      this.lerp(
        this.lerp(
          this.grad(this.perm[AA + 1], x, y, z - 1),
          this.grad(this.perm[BA + 1], x - 1, y, z - 1),
          u
        ),
        this.lerp(
          this.grad(this.perm[AB + 1], x, y - 1, z - 1),
          this.grad(this.perm[BB + 1], x - 1, y - 1, z - 1),
          u
        ),
        v
      ),
      w
    );
  }

  noise2D(x, z) {
    const X = Math.floor(x) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    z -= Math.floor(z);

    const u = this.fade(x);
    const v = this.fade(z);

    const A = this.perm[X] + Z;
    const B = this.perm[X + 1] + Z;

    const grad2 = (hash, dx, dz) => {
      const h = hash & 3;
      const gx = (h & 1) ? 1 : -1;
      const gz = (h & 2) ? 1 : -1;
      return gx * dx + gz * dz;
    };

    return this.lerp(
      this.lerp(
        grad2(this.perm[A], x, z),
        grad2(this.perm[B], x - 1, z),
        u
      ),
      this.lerp(
        grad2(this.perm[A + 1], x, z - 1),
        grad2(this.perm[B + 1], x - 1, z - 1),
        u
      ),
      v
    );
  }
}

// =====================================================
// FRACTAL BROWNIAN MOTION (FBM)
// =====================================================

export class FBMNoise {
  constructor(seed, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
    this.perlin = new PerlinNoise(seed);
    this.octaves = octaves;
    this.persistence = persistence;
    this.lacunarity = lacunarity;

    this.amplitudes = new Float32Array(octaves);
    let amp = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      this.amplitudes[i] = amp;
      maxValue += amp;
      amp *= persistence;
    }

    this.normalizeFactor = 1 / maxValue;
  }

  sample2D(x, z) {
    let total = 0;
    let frequency = 1.0;

    for (let i = 0; i < this.octaves; i++) {
      total += this.amplitudes[i] * this.perlin.noise2D(
        x * frequency,
        z * frequency
      );
      frequency *= this.lacunarity;
    }

    return total * this.normalizeFactor;
  }

  sample3D(x, y, z) {
    let total = 0;
    let frequency = 1.0;

    for (let i = 0; i < this.octaves; i++) {
      total += this.amplitudes[i] * this.perlin.noise3D(
        x * frequency,
        y * frequency,
        z * frequency
      );
      frequency *= this.lacunarity;
    }

    return total * this.normalizeFactor;
  }
}

// =====================================================
// RIDGE NOISE (for mountains and rivers)
// =====================================================

export class RidgeNoise {
  constructor(seed, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
    this.perlin = new PerlinNoise(seed);
    this.octaves = octaves;
    this.persistence = persistence;
    this.lacunarity = lacunarity;
  }

  sample2D(x, z) {
    let total = 0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxValue = 0;

    for (let i = 0; i < this.octaves; i++) {
      const noise = this.perlin.noise2D(x * frequency, z * frequency);
      const ridge = 1 - Math.abs(noise);
      total += ridge * ridge * amplitude;

      maxValue += amplitude;
      amplitude *= this.persistence;
      frequency *= this.lacunarity;
    }

    return total / maxValue;
  }

  sample3D(x, y, z) {
    let total = 0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxValue = 0;

    for (let i = 0; i < this.octaves; i++) {
      const noise = this.perlin.noise3D(x * frequency, y * frequency, z * frequency);
      const ridge = 1 - Math.abs(noise);
      total += ridge * ridge * amplitude;

      maxValue += amplitude;
      amplitude *= this.persistence;
      frequency *= this.lacunarity;
    }

    return total / maxValue;
  }
}

// =====================================================
// NOISE GENERATORS FACTORY
// =====================================================

export class NoiseGenerators {
  constructor(worldSeed) {
    this.seed = worldSeed;

    // Large-scale terrain (6 octaves)
    this.continentalnessNoise = new FBMNoise(worldSeed + 0, 6, 0.5, 2.0);
    this.erosionNoise = new FBMNoise(worldSeed + 1000, 4, 0.5, 2.0);
    this.peaksValleysNoise = new FBMNoise(worldSeed + 2000, 4, 0.6, 2.0);

    // Climate (4 octaves)
    this.temperatureNoise = new FBMNoise(worldSeed + 3000, 4, 0.5, 2.0);
    this.humidityNoise = new FBMNoise(worldSeed + 4000, 4, 0.5, 2.0);

    // 3D terrain density
    this.terrainNoise3D = new FBMNoise(worldSeed + 5000, 4, 0.5, 2.0);

    // Cave systems
    this.caveNoise = new FBMNoise(worldSeed + 6000, 3, 0.5, 2.0);
    this.caveNoise2 = new FBMNoise(worldSeed + 6500, 3, 0.5, 2.0);
    this.caveWormNoise = new FBMNoise(worldSeed + 7000, 2, 0.5, 2.0);

    // Ore distribution
    this.oreNoise = new PerlinNoise(worldSeed + 8000);

    // Surface detail
    this.detailNoise = new FBMNoise(worldSeed + 9000, 2, 0.5, 2.0);

    // River paths (ridge noise)
    this.riverNoise = new RidgeNoise(worldSeed + 10000, 3, 0.5, 2.0);
  }

  static SCALES = {
    CONTINENTALNESS: 0.0008,
    EROSION: 0.002,
    PEAKS_VALLEYS: 0.003,
    TEMPERATURE: 0.001,
    HUMIDITY: 0.001,
    TERRAIN_3D: 0.02,
    TERRAIN_3D_Y: 0.03,
    CAVE: 0.04,
    RIVER: 0.002,
    DETAIL: 0.05
  };

  sampleTerrainParams(worldX, worldZ) {
    const S = NoiseGenerators.SCALES;

    return {
      continentalness: this.continentalnessNoise.sample2D(
        worldX * S.CONTINENTALNESS,
        worldZ * S.CONTINENTALNESS
      ),
      erosion: this.erosionNoise.sample2D(
        worldX * S.EROSION,
        worldZ * S.EROSION
      ),
      pv: this.peaksValleysNoise.sample2D(
        worldX * S.PEAKS_VALLEYS,
        worldZ * S.PEAKS_VALLEYS
      ),
      temperature: this.temperatureNoise.sample2D(
        worldX * S.TEMPERATURE,
        worldZ * S.TEMPERATURE
      ),
      humidity: this.humidityNoise.sample2D(
        worldX * S.HUMIDITY,
        worldZ * S.HUMIDITY
      )
    };
  }

  sampleDensityNoise(worldX, worldY, worldZ) {
    const S = NoiseGenerators.SCALES;
    return this.terrainNoise3D.sample3D(
      worldX * S.TERRAIN_3D,
      worldY * S.TERRAIN_3D_Y,
      worldZ * S.TERRAIN_3D
    );
  }

  isCave(worldX, worldY, worldZ) {
    const S = NoiseGenerators.SCALES;

    const noise1 = this.caveNoise.sample3D(
      worldX * S.CAVE,
      worldY * S.CAVE * 1.5,
      worldZ * S.CAVE
    );

    const noise2 = this.caveNoise2.sample3D(
      worldX * S.CAVE * 2 + 100,
      worldY * S.CAVE * 2,
      worldZ * S.CAVE * 2 + 100
    );

    return noise1 > 0.5 && noise2 > 0.5;
  }

  sampleRiver(worldX, worldZ) {
    const S = NoiseGenerators.SCALES;
    return this.riverNoise.sample2D(
      worldX * S.RIVER,
      worldZ * S.RIVER
    );
  }
}

// =====================================================
// CACHED INSTANCE
// =====================================================

let cachedGenerators = null;
let cachedSeed = null;

export function getNoiseGenerators(seed) {
  if (cachedSeed !== seed) {
    cachedGenerators = new NoiseGenerators(seed);
    cachedSeed = seed;
  }
  return cachedGenerators;
}

export function clearNoiseCache() {
  cachedGenerators = null;
  cachedSeed = null;
}

// =====================================================
// LEGACY EXPORTS (backward compatibility)
// =====================================================

import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL } from '../constants/world.js';
// Используем простые константы для совместимости с Web Workers
import { BLOCK_TYPES } from '../constants/blockTypes.js';

// Helper для получения блока из словаря чанков (используется в Player.jsx)
export function getBlock(chunks, worldX, worldY, worldZ) {
  if (worldY < 0 || worldY >= WORLD_HEIGHT) return BLOCK_TYPES.AIR;
  const chunkX = Math.floor(worldX / CHUNK_SIZE);
  const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
  const key = `${chunkX},${chunkZ}`;
  const chunk = chunks[key];
  if (!chunk) return BLOCK_TYPES.AIR;
  const localX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const localZ = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  return chunk.getBlock(localX, worldY, localZ);
}

// Helper для установки блока (legacy)
export function setBlock(chunks, worldX, worldY, worldZ, blockType) {
  if (worldY < 0 || worldY >= WORLD_HEIGHT) return false;
  const chunkX = Math.floor(worldX / CHUNK_SIZE);
  const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
  const key = `${chunkX},${chunkZ}`;
  if (!chunks[key]) return false;
  const localX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const localZ = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  chunks[key].setBlock(localX, worldY, localZ, blockType);
  return true;
}

// Stub functions
export const getTerrainHeight = () => SEA_LEVEL + 5;
export const getBiome = () => ({ id: 'plains', name: 'Plains' });
export const setWorldSeed = () => {}; // Workers initialize automatically
export const getWorldSeed = () => cachedSeed;
export const clearHeightCache = clearNoiseCache;

export default {
  SeededRandom,
  PerlinNoise,
  FBMNoise,
  RidgeNoise,
  NoiseGenerators,
  getNoiseGenerators,
  clearNoiseCache,
  getBlock,
  setBlock,
  getTerrainHeight,
  getBiome
};

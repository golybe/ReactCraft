/**
 * Minecraft 1.12.2-style Biome System
 *
 * Features:
 * - 5x5 Temperature × Humidity matrix
 * - Euclidean distance for smooth biome selection
 * - Biome parameters for terrain generation
 */

// Используем простые константы для совместимости с Web Workers
import { BLOCK_TYPES } from '../constants/blockTypes.js';

// =====================================================
// BIOME TYPE IDs
// =====================================================

export const BIOME_IDS = {
  // Ocean variants
  DEEP_OCEAN: 0,
  OCEAN: 1,
  WARM_OCEAN: 2,

  // Beach
  BEACH: 3,
  STONY_BEACH: 4,

  // Low elevation
  DESERT: 5,
  BADLANDS: 6,
  PLAINS: 7,
  SUNFLOWER_PLAINS: 8,
  SWAMP: 9,
  FOREST: 10,
  BIRCH_FOREST: 11,
  DARK_FOREST: 12,
  TAIGA: 13,
  SNOWY_TAIGA: 14,
  SNOWY_PLAINS: 15,

  // High elevation
  SAVANNA: 16,
  JUNGLE: 17,
  MOUNTAINS: 18,
  SNOWY_MOUNTAINS: 19,
  PEAKS: 20,
  FROZEN_PEAKS: 21,

  // River
  RIVER: 22,
  FROZEN_RIVER: 23
};

// =====================================================
// BIOME DATA DEFINITIONS
// =====================================================

export const BIOMES = {
  [BIOME_IDS.DEEP_OCEAN]: {
    id: 'deep_ocean',
    name: 'Deep Ocean',
    surfaceBlock: BLOCK_TYPES.SAND,
    subsurfaceBlock: BLOCK_TYPES.SAND,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.6,      // Solid ocean floor
    scale: 0.03,     // Very low variation for flat floor
    heightOffset: 0, // Height is handled by continentalness spline
    treeChance: 0,
    temperature: 0.5,
    humidity: 0.5,
    color: '#000033'
  },

  [BIOME_IDS.OCEAN]: {
    id: 'ocean',
    name: 'Ocean',
    surfaceBlock: BLOCK_TYPES.SAND,
    subsurfaceBlock: BLOCK_TYPES.SAND,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.5,      // Solid ocean floor
    scale: 0.04,     // Low variation
    heightOffset: 0, // Height is handled by continentalness spline
    treeChance: 0,
    temperature: 0.5,
    humidity: 0.5,
    color: '#000066'
  },

  [BIOME_IDS.WARM_OCEAN]: {
    id: 'warm_ocean',
    name: 'Warm Ocean',
    surfaceBlock: BLOCK_TYPES.SAND,
    subsurfaceBlock: BLOCK_TYPES.SAND,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.5,      // Solid ocean floor
    scale: 0.04,     // Low variation
    heightOffset: 0, // Height is handled by continentalness spline
    treeChance: 0,
    temperature: 0.8,
    humidity: 0.5,
    color: '#000099'
  },

  [BIOME_IDS.BEACH]: {
    id: 'beach',
    name: 'Beach',
    surfaceBlock: BLOCK_TYPES.SAND,
    subsurfaceBlock: BLOCK_TYPES.SAND,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.0,
    scale: 0.025,
    heightOffset: 1,
    treeChance: 0.001,
    temperature: 0.6,
    humidity: 0.4,
    color: '#F0E68C'
  },

  [BIOME_IDS.STONY_BEACH]: {
    id: 'stony_beach',
    name: 'Stony Beach',
    surfaceBlock: BLOCK_TYPES.STONE,
    subsurfaceBlock: BLOCK_TYPES.STONE,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.1,
    scale: 0.05,
    heightOffset: 2,
    treeChance: 0,
    temperature: 0.3,
    humidity: 0.3,
    color: '#808080'
  },

  [BIOME_IDS.DESERT]: {
    id: 'desert',
    name: 'Desert',
    surfaceBlock: BLOCK_TYPES.SAND,
    subsurfaceBlock: BLOCK_TYPES.SAND,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.125,
    scale: 0.05,
    heightOffset: 3,
    treeChance: 0.002,
    temperature: 0.95,
    humidity: 0.0,
    color: '#FA8072'
  },

  [BIOME_IDS.BADLANDS]: {
    id: 'badlands',
    name: 'Badlands',
    surfaceBlock: BLOCK_TYPES.SAND,
    subsurfaceBlock: BLOCK_TYPES.DIRT,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.1,
    scale: 0.2,
    heightOffset: 10,
    treeChance: 0,
    temperature: 0.9,
    humidity: 0.0,
    color: '#FF4500'
  },

  [BIOME_IDS.PLAINS]: {
    id: 'plains',
    name: 'Plains',
    surfaceBlock: BLOCK_TYPES.GRASS,
    subsurfaceBlock: BLOCK_TYPES.DIRT,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.0,
    scale: 0.05,
    heightOffset: 5,
    treeChance: 0.005,
    temperature: 0.5,
    humidity: 0.4,
    color: '#7CFC00'
  },

  [BIOME_IDS.SUNFLOWER_PLAINS]: {
    id: 'sunflower_plains',
    name: 'Sunflower Plains',
    surfaceBlock: BLOCK_TYPES.GRASS,
    subsurfaceBlock: BLOCK_TYPES.DIRT,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.0,
    scale: 0.05,
    heightOffset: 5,
    treeChance: 0.003,
    temperature: 0.6,
    humidity: 0.5,
    color: '#ADFF2F'
  },

  [BIOME_IDS.SWAMP]: {
    id: 'swamp',
    name: 'Swamp',
    surfaceBlock: BLOCK_TYPES.GRASS,
    subsurfaceBlock: BLOCK_TYPES.DIRT,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: -0.2,
    scale: 0.1,
    heightOffset: 0,
    treeChance: 0.02,
    temperature: 0.6,
    humidity: 0.9,
    color: '#2F4F4F'
  },

  [BIOME_IDS.FOREST]: {
    id: 'forest',
    name: 'Forest',
    surfaceBlock: BLOCK_TYPES.GRASS,
    subsurfaceBlock: BLOCK_TYPES.DIRT,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.1,
    scale: 0.2,
    heightOffset: 8,
    treeChance: 0.08,
    temperature: 0.5,
    humidity: 0.7,
    color: '#228B22'
  },

  [BIOME_IDS.BIRCH_FOREST]: {
    id: 'birch_forest',
    name: 'Birch Forest',
    surfaceBlock: BLOCK_TYPES.GRASS,
    subsurfaceBlock: BLOCK_TYPES.DIRT,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.1,
    scale: 0.2,
    heightOffset: 8,
    treeChance: 0.07,
    temperature: 0.55,
    humidity: 0.65,
    color: '#32CD32'
  },

  [BIOME_IDS.DARK_FOREST]: {
    id: 'dark_forest',
    name: 'Dark Forest',
    surfaceBlock: BLOCK_TYPES.GRASS,
    subsurfaceBlock: BLOCK_TYPES.DIRT,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.1,
    scale: 0.2,
    heightOffset: 10,
    treeChance: 0.12,
    temperature: 0.5,
    humidity: 0.8,
    color: '#006400'
  },

  [BIOME_IDS.TAIGA]: {
    id: 'taiga',
    name: 'Taiga',
    surfaceBlock: BLOCK_TYPES.GRASS,
    subsurfaceBlock: BLOCK_TYPES.DIRT,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.2,
    scale: 0.2,
    heightOffset: 10,
    treeChance: 0.06,
    temperature: 0.3,
    humidity: 0.6,
    color: '#008080'
  },

  [BIOME_IDS.SNOWY_TAIGA]: {
    id: 'snowy_taiga',
    name: 'Snowy Taiga',
    surfaceBlock: BLOCK_TYPES.SNOW,
    subsurfaceBlock: BLOCK_TYPES.DIRT,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.2,
    scale: 0.2,
    heightOffset: 10,
    treeChance: 0.04,
    temperature: 0.0,
    humidity: 0.5,
    color: '#AFEEEE'
  },

  [BIOME_IDS.SNOWY_PLAINS]: {
    id: 'snowy_plains',
    name: 'Snowy Plains',
    surfaceBlock: BLOCK_TYPES.SNOW,
    subsurfaceBlock: BLOCK_TYPES.DIRT,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.0,
    scale: 0.05,
    heightOffset: 5,
    treeChance: 0.01,
    temperature: 0.0,
    humidity: 0.3,
    color: '#FFFFFF'
  },

  [BIOME_IDS.SAVANNA]: {
    id: 'savanna',
    name: 'Savanna',
    surfaceBlock: BLOCK_TYPES.GRASS,
    subsurfaceBlock: BLOCK_TYPES.DIRT,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.0,
    scale: 0.05,
    heightOffset: 5,
    treeChance: 0.015,
    temperature: 0.8,
    humidity: 0.2,
    color: '#DAA520'
  },

  [BIOME_IDS.JUNGLE]: {
    id: 'jungle',
    name: 'Jungle',
    surfaceBlock: BLOCK_TYPES.GRASS,
    subsurfaceBlock: BLOCK_TYPES.DIRT,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 0.1,
    scale: 0.2,
    heightOffset: 12,
    treeChance: 0.15,
    temperature: 0.85,
    humidity: 0.95,
    color: '#00FF00'
  },

  [BIOME_IDS.MOUNTAINS]: {
    id: 'mountains',
    name: 'Mountains',
    surfaceBlock: BLOCK_TYPES.STONE,
    subsurfaceBlock: BLOCK_TYPES.STONE,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 1.2,       // More dramatic terrain
    scale: 0.6,       // Higher variation
    heightOffset: 15, // Reduced - height comes from splines now
    treeChance: 0.01,
    temperature: 0.3,
    humidity: 0.3,
    color: '#A9A9A9'
  },

  [BIOME_IDS.SNOWY_MOUNTAINS]: {
    id: 'snowy_mountains',
    name: 'Snowy Mountains',
    surfaceBlock: BLOCK_TYPES.SNOW,
    subsurfaceBlock: BLOCK_TYPES.STONE,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 1.2,
    scale: 0.6,
    heightOffset: 18,
    treeChance: 0.005,
    temperature: 0.0,
    humidity: 0.3,
    color: '#F0FFFF'
  },

  [BIOME_IDS.PEAKS]: {
    id: 'peaks',
    name: 'Jagged Peaks',
    surfaceBlock: BLOCK_TYPES.STONE,
    subsurfaceBlock: BLOCK_TYPES.STONE,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 1.8,       // Very dramatic
    scale: 0.9,       // High variation for jagged look
    heightOffset: 20, // Reduced - height comes from splines
    treeChance: 0,
    temperature: 0.2,
    humidity: 0.2,
    color: '#D3D3D3'
  },

  [BIOME_IDS.FROZEN_PEAKS]: {
    id: 'frozen_peaks',
    name: 'Frozen Peaks',
    surfaceBlock: BLOCK_TYPES.SNOW,
    subsurfaceBlock: BLOCK_TYPES.STONE,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: 1.8,
    scale: 0.9,
    heightOffset: 22,
    treeChance: 0,
    temperature: 0.0,
    humidity: 0.2,
    color: '#E0FFFF'
  },

  [BIOME_IDS.RIVER]: {
    id: 'river',
    name: 'River',
    surfaceBlock: BLOCK_TYPES.SAND,
    subsurfaceBlock: BLOCK_TYPES.SAND,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: -0.5,
    scale: 0.0,
    heightOffset: -5,
    treeChance: 0,
    temperature: 0.5,
    humidity: 0.5,
    color: '#4169E1'
  },

  [BIOME_IDS.FROZEN_RIVER]: {
    id: 'frozen_river',
    name: 'Frozen River',
    surfaceBlock: BLOCK_TYPES.SAND,
    subsurfaceBlock: BLOCK_TYPES.SAND,
    stoneBlock: BLOCK_TYPES.STONE,
    depth: -0.5,
    scale: 0.0,
    heightOffset: -5,
    treeChance: 0,
    temperature: 0.0,
    humidity: 0.5,
    color: '#B0C4DE'
  }
};

// =====================================================
// 5×5 BIOME MATRIX (Temperature × Humidity)
// =====================================================
// Temperature: 0=FROZEN, 1=COLD, 2=TEMPERATE, 3=WARM, 4=HOT
// Humidity: 0=ARID, 1=DRY, 2=NORMAL, 3=WET, 4=HUMID

const BIOME_MATRIX = [
  // FROZEN (temp=0)
  [BIOME_IDS.SNOWY_PLAINS, BIOME_IDS.SNOWY_PLAINS, BIOME_IDS.SNOWY_PLAINS, BIOME_IDS.SNOWY_TAIGA, BIOME_IDS.SNOWY_TAIGA],
  // COLD (temp=1)
  [BIOME_IDS.TAIGA, BIOME_IDS.TAIGA, BIOME_IDS.TAIGA, BIOME_IDS.TAIGA, BIOME_IDS.DARK_FOREST],
  // TEMPERATE (temp=2)
  [BIOME_IDS.PLAINS, BIOME_IDS.PLAINS, BIOME_IDS.FOREST, BIOME_IDS.FOREST, BIOME_IDS.DARK_FOREST],
  // WARM (temp=3)
  [BIOME_IDS.SAVANNA, BIOME_IDS.PLAINS, BIOME_IDS.FOREST, BIOME_IDS.BIRCH_FOREST, BIOME_IDS.JUNGLE],
  // HOT (temp=4)
  [BIOME_IDS.DESERT, BIOME_IDS.DESERT, BIOME_IDS.BADLANDS, BIOME_IDS.SAVANNA, BIOME_IDS.JUNGLE]
];

// =====================================================
// BIOME SELECTION FUNCTIONS
// =====================================================

function normalizeToIndex(value, count) {
  const normalized = (value + 1) * 0.5;
  return Math.max(0, Math.min(count - 1, Math.floor(normalized * count)));
}

function euclideanDistance(t1, h1, t2, h2) {
  const dt = t1 - t2;
  const dh = h1 - h2;
  return Math.sqrt(dt * dt + dh * dh);
}

export function getBiomeId(temperature, humidity, continentalness) {
  // Deep ocean (aligned with spline: < -0.5 is deep underwater)
  if (continentalness < -0.5) {
    return BIOME_IDS.DEEP_OCEAN;
  }

  // Ocean (aligned with spline: -0.5 to -0.3)
  if (continentalness < -0.3) {
    return temperature < 0.3 ? BIOME_IDS.OCEAN : BIOME_IDS.WARM_OCEAN;
  }

  // Beach (aligned with spline: -0.3 to -0.05)
  if (continentalness < -0.05) {
    return temperature < 0.3 ? BIOME_IDS.STONY_BEACH : BIOME_IDS.BEACH;
  }

  // Frozen peaks (very high continentalness + cold)
  if (continentalness > 0.7 && temperature < -0.3) {
    return BIOME_IDS.FROZEN_PEAKS;
  }

  // Peaks (very high continentalness)
  if (continentalness > 0.7) {
    return BIOME_IDS.PEAKS;
  }

  // Snowy mountains
  if (continentalness > 0.5 && temperature < -0.2) {
    return BIOME_IDS.SNOWY_MOUNTAINS;
  }

  // Mountains
  if (continentalness > 0.5) {
    return BIOME_IDS.MOUNTAINS;
  }

  // Matrix lookup for regular land biomes
  const tempIndex = normalizeToIndex(temperature, 5);
  const humIndex = normalizeToIndex(humidity, 5);

  return BIOME_MATRIX[tempIndex][humIndex];
}

export function getBiome(temperature, humidity, continentalness) {
  const biomeId = getBiomeId(temperature, humidity, continentalness);
  return BIOMES[biomeId] || BIOMES[BIOME_IDS.PLAINS];
}

export function getBiomeById(id) {
  return BIOMES[id] || BIOMES[BIOME_IDS.PLAINS];
}

// =====================================================
// BIOME BLEND FACTORS (for smooth terrain transitions)
// =====================================================

export function getBiomeBlendFactors(temperature, humidity, continentalness) {
  const neighbors = [];
  const tempNorm = (temperature + 1) * 0.5 * 4;
  const humNorm = (humidity + 1) * 0.5 * 4;

  const tempBase = Math.floor(tempNorm);
  const humBase = Math.floor(humNorm);

  const tempFrac = tempNorm - tempBase;
  const humFrac = humNorm - humBase;

  for (let dt = 0; dt <= 1; dt++) {
    for (let dh = 0; dh <= 1; dh++) {
      const ti = Math.min(4, Math.max(0, tempBase + dt));
      const hi = Math.min(4, Math.max(0, humBase + dh));

      const wt = dt === 0 ? (1 - tempFrac) : tempFrac;
      const wh = dh === 0 ? (1 - humFrac) : humFrac;

      neighbors.push({
        biomeId: BIOME_MATRIX[ti][hi],
        weight: wt * wh
      });
    }
  }

  return neighbors;
}

// =====================================================
// LEGACY EXPORTS (backward compatibility)
// =====================================================

export const getBiomeFromNoise = getBiome;

export default {
  BIOME_IDS,
  BIOMES,
  getBiomeId,
  getBiome,
  getBiomeById,
  getBiomeBlendFactors,
  getBiomeFromNoise
};

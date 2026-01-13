/**
 * Minecraft 1.12.2-style Ore Generation
 *
 * Features:
 * - Cluster-based ore veins
 * - Elliptical vein shapes
 * - Height-based distribution
 * - Configurable ore parameters
 */

import { SeededRandom } from './noise.js';
// Используем простые константы для совместимости с Web Workers
import { BLOCK_TYPES } from '../constants/blockTypes.js';

// =====================================================
// ORE CONFIGURATION
// =====================================================

export const ORE_CONFIG = {
  COAL_ORE: {
    id: BLOCK_TYPES.COAL_ORE,
    minY: 5,
    maxY: 128,
    veinsPerChunk: 20,
    veinSize: 17,
    spawnWeight: 1.0
  },
  IRON_ORE: {
    id: BLOCK_TYPES.IRON_ORE,
    minY: 5,
    maxY: 64,
    veinsPerChunk: 20,
    veinSize: 9,
    spawnWeight: 1.0
  },
  GOLD_ORE: {
    id: BLOCK_TYPES.GOLD_ORE,
    minY: 5,
    maxY: 32,
    veinsPerChunk: 2,
    veinSize: 9,
    spawnWeight: 1.0
  },
  DIAMOND_ORE: {
    id: BLOCK_TYPES.DIAMOND_ORE,
    minY: 5,
    maxY: 16,
    veinsPerChunk: 1,
    veinSize: 8,
    spawnWeight: 1.0
  }
};

// =====================================================
// ORE GENERATOR
// =====================================================

export class OreGenerator {
  constructor(worldSeed) {
    this.seed = worldSeed;
  }

  /**
   * Hash function for chunk coordinates
   */
  hashChunk(cx, cz) {
    return (this.seed + cx * 341873128712 + cz * 132897987541) >>> 0;
  }

  /**
   * Generate an elliptical ore vein (Minecraft style)
   */
  generateVein(rng, centerX, centerY, centerZ, oreId, veinSize, orePositions) {
    // Random ellipsoid orientation
    const angle = rng.next() * Math.PI * 2;
    const length = veinSize / 2;

    // Vein shape parameters
    const sinAngle = Math.sin(angle);
    const cosAngle = Math.cos(angle);

    for (let i = 0; i < veinSize; i++) {
      const t = i / veinSize;

      // Position along vein axis
      const axisOffset = (t - 0.5) * length * 2;
      const axisX = cosAngle * axisOffset;
      const axisZ = sinAngle * axisOffset;

      // Random offset from axis (thickest in middle)
      const spread = Math.sin(t * Math.PI) * 1.5;
      const offX = (rng.next() - 0.5) * spread * 2;
      const offY = (rng.next() - 0.5) * spread * 2;
      const offZ = (rng.next() - 0.5) * spread * 2;

      const x = Math.floor(centerX + axisX + offX);
      const y = Math.floor(centerY + offY);
      const z = Math.floor(centerZ + axisZ + offZ);

      orePositions.push({ x, y, z, oreId });
    }
  }

  /**
   * Generate all ores for a chunk
   */
  generateOresForChunk(chunkX, chunkZ) {
    const orePositions = [];
    const startX = chunkX * 16;
    const startZ = chunkZ * 16;

    // Seed based on chunk position
    const chunkSeed = this.hashChunk(chunkX, chunkZ);

    for (const [oreName, config] of Object.entries(ORE_CONFIG)) {
      const oreSeed = chunkSeed + config.id * 1000;
      const rng = new SeededRandom(oreSeed);

      const veins = Math.floor(config.veinsPerChunk * config.spawnWeight);

      for (let v = 0; v < veins; v++) {
        // Random position within chunk and Y range
        const x = startX + Math.floor(rng.next() * 16);
        const y = config.minY + Math.floor(rng.next() * (config.maxY - config.minY));
        const z = startZ + Math.floor(rng.next() * 16);

        // Generate the vein
        this.generateVein(rng, x, y, z, config.id, config.veinSize, orePositions);
      }
    }

    return orePositions;
  }

  /**
   * Convert to lookup map for fast access during chunk generation
   */
  getOreMap(chunkX, chunkZ) {
    const positions = this.generateOresForChunk(chunkX, chunkZ);
    const map = new Map();

    const startX = chunkX * 16;
    const startZ = chunkZ * 16;

    for (const { x, y, z, oreId } of positions) {
      // Only include ores within this chunk
      if (x >= startX && x < startX + 16 && z >= startZ && z < startZ + 16) {
        const localX = x - startX;
        const localZ = z - startZ;
        const key = `${localX},${y},${localZ}`;

        // Don't overwrite (first ore wins in case of overlap)
        if (!map.has(key)) {
          map.set(key, oreId);
        }
      }
    }

    return map;
  }

  /**
   * Check if position should be an ore (returns ore ID or null)
   */
  getOreAt(oreMap, localX, y, localZ) {
    const key = `${localX},${y},${localZ}`;
    return oreMap.get(key) || null;
  }
}

// =====================================================
// FACTORY
// =====================================================

let cachedOreGenerator = null;
let cachedSeed = null;

export function getOreGenerator(seed) {
  if (cachedSeed !== seed) {
    cachedOreGenerator = new OreGenerator(seed);
    cachedSeed = seed;
  }
  return cachedOreGenerator;
}

export function clearOreCache() {
  cachedOreGenerator = null;
  cachedSeed = null;
}

export default {
  ORE_CONFIG,
  OreGenerator,
  getOreGenerator,
  clearOreCache
};

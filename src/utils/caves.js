/**
 * Minecraft 1.12.2-style Cave Generation
 *
 * Features:
 * - Perlin Worm cave carvers (tunnel system)
 * - Swiss cheese caves (3D noise threshold)
 * - Variable tunnel radius
 * - Cross-chunk worm propagation
 */

import { SeededRandom, PerlinNoise } from './noise.js';
import { SEA_LEVEL } from '../constants/world.js';

// =====================================================
// PERLIN WORM CAVE CARVER
// =====================================================

export class CaveCarver {
  constructor(worldSeed) {
    this.seed = worldSeed;
    this.directionNoise = new PerlinNoise(worldSeed + 10000);
    this.radiusNoise = new PerlinNoise(worldSeed + 11000);
    this.yawNoise = new PerlinNoise(worldSeed + 12000);
    this.pitchNoise = new PerlinNoise(worldSeed + 13000);
  }

  /**
   * Generate cave worms that may affect a specific chunk
   * Checks this chunk and surrounding chunks for worm origins
   */
  getCaveWormsForChunk(chunkX, chunkZ) {
    const worms = [];

    // Check 3x3 area of chunks (worms can extend across boundaries)
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const cx = chunkX + dx;
        const cz = chunkZ + dz;

        // Deterministic seed based on chunk position
        const chunkSeed = this.hashChunk(cx, cz);
        const rng = new SeededRandom(chunkSeed);

        // 0-3 worms per chunk (average ~1.5)
        const wormCount = Math.floor(rng.next() * 4);

        for (let w = 0; w < wormCount; w++) {
          // Random origin within chunk
          const startX = cx * 16 + Math.floor(rng.next() * 16);
          const startY = 8 + Math.floor(rng.next() * 45); // 8-52
          const startZ = cz * 16 + Math.floor(rng.next() * 16);

          // Worm parameters
          const length = 40 + Math.floor(rng.next() * 80); // 40-120 segments
          const baseRadius = 1.2 + rng.next() * 2.5; // 1.2-3.7 radius
          const wormSeed = chunkSeed + w * 1000;

          // Initial direction
          const yaw = rng.next() * Math.PI * 2;
          const pitch = (rng.next() - 0.5) * 0.5; // Slight vertical bias

          worms.push({
            startX, startY, startZ,
            length,
            baseRadius,
            wormSeed,
            yaw,
            pitch
          });
        }
      }
    }

    return worms;
  }

  /**
   * Hash function for chunk coordinates
   */
  hashChunk(cx, cz) {
    return (this.seed + cx * 341873128712 + cz * 132897987541) >>> 0;
  }

  /**
   * Carve a single worm path
   */
  carveWorm(worm, chunkX, chunkZ, carvedSet) {
    const { startX, startY, startZ, length, baseRadius, wormSeed, yaw: initYaw, pitch: initPitch } = worm;

    const chunkMinX = chunkX * 16;
    const chunkMaxX = chunkMinX + 16;
    const chunkMinZ = chunkZ * 16;
    const chunkMaxZ = chunkMinZ + 16;

    let x = startX;
    let y = startY;
    let z = startZ;
    let yaw = initYaw;
    let pitch = initPitch;

    for (let i = 0; i < length; i++) {
      const progress = i / length;

      // Modulate direction using Perlin noise for smooth turning
      const noiseScale = 0.05;
      const yawDelta = this.yawNoise.noise3D(
        wormSeed * 0.001,
        i * noiseScale,
        0
      ) * 0.3;
      const pitchDelta = this.pitchNoise.noise3D(
        wormSeed * 0.001,
        i * noiseScale,
        1
      ) * 0.2;

      yaw += yawDelta;
      pitch += pitchDelta;

      // Clamp pitch to prevent vertical-only tunnels
      pitch = Math.max(-0.5, Math.min(0.5, pitch));

      // Gradually push toward horizontal
      pitch *= 0.95;

      // Move in direction
      const cosP = Math.cos(pitch);
      x += Math.cos(yaw) * cosP;
      y += Math.sin(pitch);
      z += Math.sin(yaw) * cosP;

      // Variable radius along tunnel
      const radiusMod = this.radiusNoise.noise2D(wormSeed * 0.01, i * 0.1);
      let radius = baseRadius * (0.7 + radiusMod * 0.6);

      // Taper at ends
      if (progress < 0.1) {
        radius *= progress * 10;
      } else if (progress > 0.9) {
        radius *= (1 - progress) * 10;
      }

      // Occasional widening for "rooms"
      if (i % 20 < 3 && radiusMod > 0.3) {
        radius *= 1.5;
      }

      // Don't carve too close to surface or below y=5
      if (y < 5 || y > SEA_LEVEL + 25) continue;

      // Carve sphere at current position
      this.carveSphere(x, y, z, radius, chunkMinX, chunkMaxX, chunkMinZ, chunkMaxZ, carvedSet);
    }
  }

  /**
   * Carve a sphere of air at position
   */
  carveSphere(cx, cy, cz, radius, minX, maxX, minZ, maxZ, carvedSet) {
    const r2 = radius * radius;
    const rCeil = Math.ceil(radius);

    for (let dx = -rCeil; dx <= rCeil; dx++) {
      for (let dy = -rCeil; dy <= rCeil; dy++) {
        for (let dz = -rCeil; dz <= rCeil; dz++) {
          // Elliptical shape (slightly taller)
          const dist = dx * dx + dy * dy * 0.8 + dz * dz;
          if (dist <= r2) {
            const bx = Math.floor(cx + dx);
            const by = Math.floor(cy + dy);
            const bz = Math.floor(cz + dz);

            // Only record if within chunk bounds
            if (bx >= minX && bx < maxX && bz >= minZ && bz < maxZ && by >= 1 && by < 120) {
              carvedSet.add(`${bx},${by},${bz}`);
            }
          }
        }
      }
    }
  }

  /**
   * Get all carved positions for a chunk
   */
  getCarvedPositions(chunkX, chunkZ) {
    const carvedSet = new Set();

    const worms = this.getCaveWormsForChunk(chunkX, chunkZ);
    for (const worm of worms) {
      this.carveWorm(worm, chunkX, chunkZ, carvedSet);
    }

    return carvedSet;
  }

  /**
   * Check if position is carved
   */
  isCaved(carvedSet, worldX, worldY, worldZ) {
    return carvedSet.has(`${worldX},${worldY},${worldZ}`);
  }
}

// =====================================================
// THRESHOLD CAVE CARVER (Swiss cheese)
// =====================================================

export class ThresholdCaveCarver {
  constructor(noiseGenerators) {
    this.noise = noiseGenerators;
  }

  /**
   * Check if position is a cave using 3D noise threshold
   */
  isCave(worldX, worldY, worldZ) {
    // Only generate caves in certain height range
    if (worldY < 5 || worldY > SEA_LEVEL + 20) return false;

    const scale1 = 0.04;
    const scale2 = 0.08;

    // Two overlapping noise fields create "Swiss cheese" pattern
    const noise1 = this.noise.caveNoise.sample3D(
      worldX * scale1,
      worldY * scale1 * 1.5,
      worldZ * scale1
    );

    const noise2 = this.noise.caveNoise2.sample3D(
      worldX * scale2 + 100,
      worldY * scale2,
      worldZ * scale2 + 100
    );

    // Both must exceed threshold for a cave
    return noise1 > 0.45 && noise2 > 0.45;
  }
}

// =====================================================
// COMBINED CAVE SYSTEM
// =====================================================

export class CaveSystem {
  constructor(worldSeed, noiseGenerators) {
    this.wormCarver = new CaveCarver(worldSeed);
    this.thresholdCarver = noiseGenerators ? new ThresholdCaveCarver(noiseGenerators) : null;
  }

  /**
   * Get carved positions (worm caves only)
   */
  getWormCaves(chunkX, chunkZ) {
    return this.wormCarver.getCarvedPositions(chunkX, chunkZ);
  }

  /**
   * Check if position is any type of cave
   */
  isCave(carvedSet, worldX, worldY, worldZ) {
    // Check worm caves first (Set lookup is O(1))
    if (carvedSet.has(`${worldX},${worldY},${worldZ}`)) {
      return true;
    }

    // Check threshold caves
    if (this.thresholdCarver && this.thresholdCarver.isCave(worldX, worldY, worldZ)) {
      return true;
    }

    return false;
  }
}

// =====================================================
// FACTORY
// =====================================================

let cachedCaveSystem = null;
let cachedSeed = null;

export function getCaveSystem(seed, noiseGenerators) {
  if (cachedSeed !== seed) {
    cachedCaveSystem = new CaveSystem(seed, noiseGenerators);
    cachedSeed = seed;
  }
  return cachedCaveSystem;
}

export function clearCaveCache() {
  cachedCaveSystem = null;
  cachedSeed = null;
}

export default {
  CaveCarver,
  ThresholdCaveCarver,
  CaveSystem,
  getCaveSystem,
  clearCaveCache
};

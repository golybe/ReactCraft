import { CHUNK_SIZE, CHUNK_HEIGHT, RENDER_DISTANCE } from '../constants/world';
import { BLOCK_TYPES } from '../constants/blocks';
import { LightingManager } from '../core/world/LightingManager';
import { ChunkGenerator } from '../core/world/ChunkGenerator';
import { ChunkBatcher } from '../core/world/ChunkBatcher';
import { log } from './logger';

/**
 * ChunkManager - Orchestrator for chunk operations.
 * Delegates to specialized managers:
 * - LightingManager: Light calculations
 * - ChunkGenerator: Async chunk generation
 * - ChunkBatcher: Batch operations
 */
export class ChunkManager {
  constructor(seed, savedChunks = {}) {
    log('ChunkManager', `Constructor called with seed: ${seed}`);

    this.seed = seed;
    this.chunks = {};
    this.storedChunks = savedChunks || {};
    this.modifiedChunkKeys = new Set(Object.keys(this.storedChunks));
    this.currentChunk = { x: null, z: null };

    // Specialized managers
    this.lightingManager = new LightingManager();
    this.chunkGenerator = new ChunkGenerator(seed);
    this.batcher = new ChunkBatcher(this.lightingManager);

    // Set callback for LightingManager to access blocks
    this.lightingManager.setBlockCallback((x, y, z) => this.getBlock(x, y, z));

    // Pending lighting queue
    this.pendingLighting = new Set();

    // React update callback
    this.onChunksUpdated = null;
    this.updateTimeout = null;

    log('ChunkManager', 'Initialized with specialized managers');
  }

  // === CHUNK KEY UTILITIES ===

  getChunkKey(x, z) {
    return `${x},${z}`;
  }

  isChunkLoaded(worldX, worldZ) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    return !!this.chunks[this.getChunkKey(cx, cz)];
  }

  // === BATCH OPERATIONS (delegate to ChunkBatcher) ===

  startBatch() {
    this.batcher.startBatch();
  }

  commitBatch() {
    return this.batcher.commitBatch(this.chunks);
  }

  // === NOTIFICATION ===

  notifyUpdate() {
    if (this.updateTimeout) return;

    this.updateTimeout = setTimeout(() => {
      if (this.onChunksUpdated) {
        this.onChunksUpdated();
      }
      this.updateTimeout = null;
    }, 100);
  }

  /**
   * Notify immediately without delay (for block changes)
   */
  notifyUpdateImmediate() {
    if (this.onChunksUpdated) {
      this.onChunksUpdated();
    }
  }

  setOnChunksUpdated(callback) {
    this.onChunksUpdated = callback;
  }

  // === MAIN UPDATE LOOP ===

  update(playerPos) {
    const chunkX = Math.floor(playerPos.x / CHUNK_SIZE);
    const chunkZ = Math.floor(playerPos.z / CHUNK_SIZE);

    // Process pending lighting
    this.processPendingLighting();
    
    // Check for chunks that need relighting (neighbors loaded since last calculation)
    this.checkForRelighting();

    if (this.currentChunk.x === chunkX && this.currentChunk.z === chunkZ && Object.keys(this.chunks).length > 0) {
      return { hasChanges: false };
    }

    this.currentChunk = { x: chunkX, z: chunkZ };
    this.chunkGenerator.setCurrentChunk(chunkX, chunkZ);

    let hasChanges = false;
    const chunksToRemove = new Set(Object.keys(this.chunks));

    // Load needed chunks
    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
      for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
        const cx = chunkX + x;
        const cz = chunkZ + z;
        const key = this.getChunkKey(cx, cz);

        chunksToRemove.delete(key);

        if (this.chunks[key] || this.chunkGenerator.isPending(key)) {
          continue;
        }

        this.loadChunkAsync(cx, cz, key);
      }
    }

    // Unload old chunks
    for (const key of chunksToRemove) {
      if (this.modifiedChunkKeys.has(key)) {
        this.storedChunks[key] = this.chunks[key].serialize();
      }
      delete this.chunks[key];
      this.lightingManager.removeLightMap(key);
      this.pendingLighting.delete(key);
      hasChanges = true;
    }

    return { hasChanges, activeChunks: this.chunks };
  }

  // === CHUNK LOADING ===

  async loadChunkAsync(cx, cz, key) {
    this.chunkGenerator.markPending(key);
    log('ChunkManager', `Loading chunk ${key}...`);

    try {
      let chunk;

      if (this.storedChunks[key]) {
        log('ChunkManager', `Loading chunk ${key} from storage`);
        chunk = this.chunkGenerator.loadFromStorage(this.storedChunks[key]);
      } else {
        log('ChunkManager', `Generating chunk ${key} via worker`);
        chunk = await this.chunkGenerator.generateChunk(cx, cz);
      }

      this.chunks[key] = chunk;
      this.chunkGenerator.clearPending(key);
      this.pendingLighting.add(key);

      log('ChunkManager', `Chunk ${key} loaded successfully`);
      this.notifyUpdate();
    } catch (error) {
      log('ChunkManager', `Failed to load chunk ${key}: ${error.message}`);
      console.error(`[ChunkManager] Failed to load chunk ${key}:`, error);
      this.chunkGenerator.clearPending(key);
    }
  }

  // === LIGHTING ===

  processPendingLighting() {
    if (this.pendingLighting.size === 0) return;

    // Увеличиваем лимит для более быстрого освещения
    const MAX_PER_TICK = 8;
    const processed = [];

    // Сначала сортируем по приоритету - ближе к игроку = важнее
    const sortedKeys = Array.from(this.pendingLighting).sort((a, b) => {
      if (!this.currentChunk.x) return 0;
      const [ax, az] = a.split(',').map(Number);
      const [bx, bz] = b.split(',').map(Number);
      const distA = Math.abs(ax - this.currentChunk.x) + Math.abs(az - this.currentChunk.z);
      const distB = Math.abs(bx - this.currentChunk.x) + Math.abs(bz - this.currentChunk.z);
      return distA - distB;
    });

    for (const key of sortedKeys) {
      if (processed.length >= MAX_PER_TICK) break;

      if (this.chunks[key]) {
        this.lightingManager.computeLighting(this.chunks[key], key);
        processed.push(key);
      }
    }

    for (const key of processed) {
      this.pendingLighting.delete(key);
    }

    // После обработки партии, добавляем соседей в очередь для пересчёта
    // Только если сосед ещё НЕ был полностью освещён (needsRelight)
    // Это предотвращает каскадный полный пересчёт уже освещённых чанков
    if (processed.length > 0) {
      for (const key of processed) {
        const [cx, cz] = key.split(',').map(Number);
        const neighbors = [
          `${cx - 1},${cz}`, `${cx + 1},${cz}`,
          `${cx},${cz - 1}`, `${cx},${cz + 1}`
        ];

        for (const nKey of neighbors) {
          // Only add neighbor if it exists, not in queue, and needs relight (not fully lit)
          if (this.chunks[nKey] &&
              !this.pendingLighting.has(nKey) &&
              !processed.includes(nKey) &&
              this.lightingManager.needsRelight(nKey)) {
            this.pendingLightingNeighbors = this.pendingLightingNeighbors || new Set();
            this.pendingLightingNeighbors.add(nKey);
          }
        }
      }

      // Переносим соседей в основную очередь
      if (this.pendingLightingNeighbors && this.pendingLightingNeighbors.size > 0) {
        for (const nKey of this.pendingLightingNeighbors) {
          this.pendingLighting.add(nKey);
        }
        this.pendingLightingNeighbors.clear();
      }

      this.notifyUpdate();
    }
  }

  /**
   * Check for chunks that need relighting because neighbors are now available
   */
  checkForRelighting() {
    // Limit how many we check per frame
    const MAX_CHECK = 4;
    let checked = 0;
    
    for (const key of Object.keys(this.chunks)) {
      if (checked >= MAX_CHECK) break;
      
      if (this.lightingManager.needsRelight(key) && !this.pendingLighting.has(key)) {
        // Check if all neighbors now exist
        const [cx, cz] = key.split(',').map(Number);
        const neighbors = [
          `${cx - 1},${cz}`, `${cx + 1},${cz}`,
          `${cx},${cz - 1}`, `${cx},${cz + 1}`
        ];
        
        const allNeighborsExist = neighbors.every(nKey => 
          this.chunks[nKey] && this.lightingManager.hasLightMap(nKey)
        );
        
        if (allNeighborsExist) {
          this.pendingLighting.add(key);
          checked++;
        }
      }
    }
  }

  getLightLevel(worldX, worldY, worldZ) {
    return this.lightingManager.getLightLevel(worldX, worldY, worldZ);
  }

  // === BLOCK OPERATIONS ===

  setBlock(worldX, worldY, worldZ, blockType, metadata = 0) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);

    if (!this.chunks[key]) return false;

    const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    // Batch mode
    if (this.batcher.isInBatch()) {
      let targetChunk = this.chunks[key];

      if (!this.batcher.isModified(key)) {
        targetChunk = targetChunk.clone();
        this.chunks[key] = targetChunk;
        this.batcher.markModified(key);
        this.modifiedChunkKeys.add(key);
      }

      const oldId = targetChunk.getBlock(lx, worldY, lz);
      targetChunk.setBlock(lx, worldY, lz, blockType, metadata);

      // Collect border neighbors for mesh rebuild (fixes X-RAY bug)
      const borderNeighbors = [];
      if (lx === 0) borderNeighbors.push(`${cx - 1},${cz}`);
      if (lx === CHUNK_SIZE - 1) borderNeighbors.push(`${cx + 1},${cz}`);
      if (lz === 0) borderNeighbors.push(`${cx},${cz - 1}`);
      if (lz === CHUNK_SIZE - 1) borderNeighbors.push(`${cx},${cz + 1}`);

      // Add border neighbors for mesh rebuild
      for (const neighborKey of borderNeighbors) {
        if (this.chunks[neighborKey]) {
          this.batcher.markModified(neighborKey);
          this.modifiedChunkKeys.add(neighborKey);
        }
      }

      // Incremental lighting update (Minecraft-style)
      const affectedChunks = this.lightingManager.onBlockPlaced(
        worldX, worldY, worldZ,
        oldId, blockType
      );

      for (const chunkKey of affectedChunks) {
        this.batcher.markModified(chunkKey);
        this.modifiedChunkKeys.add(chunkKey);
      }

      return true;
    }

    // Standard mode
    const newChunk = this.chunks[key].clone();
    const oldBlockType = newChunk.getBlock(lx, worldY, lz);
    newChunk.setBlock(lx, worldY, lz, blockType, metadata);
    this.chunks[key] = newChunk;
    this.modifiedChunkKeys.add(key);

    // Collect border neighbors for mesh rebuild (fixes X-RAY bug)
    // When a block is placed/removed on chunk border, adjacent chunk needs mesh update
    const borderNeighbors = [];
    if (lx === 0) borderNeighbors.push(`${cx - 1},${cz}`);
    if (lx === CHUNK_SIZE - 1) borderNeighbors.push(`${cx + 1},${cz}`);
    if (lz === 0) borderNeighbors.push(`${cx},${cz - 1}`);
    if (lz === CHUNK_SIZE - 1) borderNeighbors.push(`${cx},${cz + 1}`);

    // Add border neighbors for mesh rebuild
    for (const neighborKey of borderNeighbors) {
      if (this.chunks[neighborKey]) {
        this.chunks[neighborKey] = this.chunks[neighborKey].clone();
        this.modifiedChunkKeys.add(neighborKey);
      }
    }

    // Incremental lighting update (Minecraft-style)
    const affectedChunks = this.lightingManager.onBlockPlaced(
      worldX, worldY, worldZ,
      oldBlockType, blockType
    );

    // Clone all affected chunks so React sees the changes immediately
    for (const chunkKey of affectedChunks) {
      if (this.chunks[chunkKey] && chunkKey !== key && !borderNeighbors.includes(chunkKey)) {
        this.chunks[chunkKey] = this.chunks[chunkKey].clone();
      }
      this.modifiedChunkKeys.add(chunkKey);
    }

    // Notify React immediately about chunk changes
    this.notifyUpdateImmediate();

    return true;
  }

  getBlock(worldX, worldY, worldZ) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);

    if (!this.chunks[key]) return BLOCK_TYPES.AIR;

    const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    return this.chunks[key].getBlock(lx, worldY, lz);
  }

  getMetadata(worldX, worldY, worldZ) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);

    if (!this.chunks[key]) return 0;

    const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    return this.chunks[key].getMetadata(lx, worldY, lz);
  }

  // === BIOME ===

  getBiome(worldX, worldZ) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);
    const chunk = this.chunks[key];

    if (!chunk) return { id: 'loading', name: 'Loading...' };

    const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    // Use stored biome from chunk's biomeMap
    const biomeId = chunk.getBiomeId(lx, lz);
    return this.getBiomeData(biomeId);
  }

  // Get biome data by ID
  getBiomeData(biomeId) {
    // Biome names mapping based on BIOME_IDS from biomes.js
    const BIOME_NAMES = {
      0: { id: 'deep_ocean', name: 'Deep Ocean' },
      1: { id: 'ocean', name: 'Ocean' },
      2: { id: 'warm_ocean', name: 'Warm Ocean' },
      3: { id: 'beach', name: 'Beach' },
      4: { id: 'stony_beach', name: 'Stony Beach' },
      5: { id: 'desert', name: 'Desert' },
      6: { id: 'badlands', name: 'Badlands' },
      7: { id: 'plains', name: 'Plains' },
      8: { id: 'sunflower_plains', name: 'Sunflower Plains' },
      9: { id: 'swamp', name: 'Swamp' },
      10: { id: 'forest', name: 'Forest' },
      11: { id: 'birch_forest', name: 'Birch Forest' },
      12: { id: 'dark_forest', name: 'Dark Forest' },
      13: { id: 'taiga', name: 'Taiga' },
      14: { id: 'snowy_taiga', name: 'Snowy Taiga' },
      15: { id: 'snowy_plains', name: 'Snowy Plains' },
      16: { id: 'savanna', name: 'Savanna' },
      17: { id: 'jungle', name: 'Jungle' },
      18: { id: 'mountains', name: 'Mountains' },
      19: { id: 'snowy_mountains', name: 'Snowy Mountains' },
      20: { id: 'peaks', name: 'Jagged Peaks' },
      21: { id: 'frozen_peaks', name: 'Frozen Peaks' },
      22: { id: 'river', name: 'River' },
      23: { id: 'frozen_river', name: 'Frozen River' }
    };
    return BIOME_NAMES[biomeId] || { id: 'plains', name: 'Plains' };
  }

  // === SAVE/LOAD ===

  getSaveData() {
    for (const key of this.modifiedChunkKeys) {
      if (this.chunks[key]) {
        this.storedChunks[key] = this.chunks[key].serialize();
      }
    }
    return this.storedChunks;
  }

  // === CLEANUP ===

  terminate() {
    log('ChunkManager', 'Terminate called - clearing local state');
    this.chunks = {};
    this.lightingManager.clear();
    this.chunkGenerator.clear();
    this.batcher.clear();
    this.pendingLighting.clear();
  }
}

export default ChunkManager;

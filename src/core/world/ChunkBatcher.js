import { BLOCK_TYPES } from '../../constants/blocks';

/**
 * Manages batch operations for chunk modifications.
 * Extracted from ChunkManager for better separation of concerns.
 */
export class ChunkBatcher {
  constructor(lightingManager) {
    this.lightingManager = lightingManager;
    this.isBatching = false;
    this.batchModifiedKeys = new Set();
    this.batchLightingDirtyKeys = new Set();

    // Max chunks to process lighting per batch (optimization)
    this.MAX_LIGHTING_CHUNKS_PER_BATCH = 1;
  }

  /**
   * Start batch operation
   */
  startBatch() {
    this.isBatching = true;
    this.batchModifiedKeys.clear();
    // Don't clear batchLightingDirtyKeys - accumulate unprocessed chunks between batches
  }

  /**
   * Check if currently in batch mode
   */
  isInBatch() {
    return this.isBatching;
  }

  /**
   * Mark chunk as modified in current batch
   */
  markModified(key) {
    this.batchModifiedKeys.add(key);
  }

  /**
   * Check if chunk was modified in current batch
   */
  isModified(key) {
    return this.batchModifiedKeys.has(key);
  }

  /**
   * Mark chunk as needing lighting recalculation
   */
  markLightingDirty(key) {
    this.batchLightingDirtyKeys.add(key);
  }

  /**
   * Check if block change requires lighting update
   */
  shouldUpdateLighting(oldBlockId, newBlockId) {
    // Ignore AIR <-> WATER changes - they don't affect lighting
    const isWaterChange =
      (oldBlockId === BLOCK_TYPES.AIR && newBlockId === BLOCK_TYPES.WATER) ||
      (oldBlockId === BLOCK_TYPES.WATER && newBlockId === BLOCK_TYPES.AIR);

    return oldBlockId !== newBlockId && !isWaterChange;
  }

  /**
   * Commit batch and apply changes
   * @param {Object} chunks - Reference to chunks object
   * @returns {boolean} - True if changes were made
   */
  commitBatch(chunks) {
    this.isBatching = false;

    if (this.batchModifiedKeys.size === 0) return false;

    const lightingKeys = new Set(this.batchLightingDirtyKeys);
    const processedLightingKeys = [];

    // Limit lighting calculations per batch
    let count = 0;
    for (const key of lightingKeys) {
      if (count >= this.MAX_LIGHTING_CHUNKS_PER_BATCH) break;
      processedLightingKeys.push(key);
      this.batchLightingDirtyKeys.delete(key);
      count++;
    }

    // 1. Recalculate lighting for processed chunks
    for (const key of processedLightingKeys) {
      if (chunks[key]) {
        this.lightingManager.computeLighting(chunks[key], key);
      }
    }

    // 2. Update neighbor lighting
    if (processedLightingKeys.length > 0) {
      const neighborsToUpdate = new Set();

      for (const key of processedLightingKeys) {
        const [cx, cz] = key.split(',').map(Number);
        neighborsToUpdate.add(`${cx - 1},${cz}`);
        neighborsToUpdate.add(`${cx + 1},${cz}`);
        neighborsToUpdate.add(`${cx},${cz - 1}`);
        neighborsToUpdate.add(`${cx},${cz + 1}`);
      }

      // Exclude already processed chunks
      for (const key of processedLightingKeys) {
        neighborsToUpdate.delete(key);
      }

      // Recalculate lighting for neighbors
      for (const key of neighborsToUpdate) {
        if (chunks[key]) {
          chunks[key] = chunks[key].clone();
          this.lightingManager.computeLighting(chunks[key], key);
          this.batchModifiedKeys.add(key);
        }
      }
    }

    // 3. Clone all modified chunks for React immutability
    for (const key of this.batchModifiedKeys) {
      if (chunks[key]) {
        chunks[key] = chunks[key].clone();
      }
    }

    this.batchModifiedKeys.clear();
    return true;
  }

  /**
   * Clear all state
   */
  clear() {
    this.isBatching = false;
    this.batchModifiedKeys.clear();
    this.batchLightingDirtyKeys.clear();
  }
}

export default ChunkBatcher;

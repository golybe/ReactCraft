/**
 * Manages batch operations for chunk modifications.
 * Extracted from ChunkManager for better separation of concerns.
 *
 * Note: Lighting is now handled incrementally by LightingManager.onBlockPlaced()
 * during setBlock() calls, so no batch lighting recalculation is needed.
 */
export class ChunkBatcher {
  constructor(lightingManager) {
    this.lightingManager = lightingManager;
    this.isBatching = false;
    this.batchModifiedKeys = new Set();
  }

  /**
   * Start batch operation
   */
  startBatch() {
    this.isBatching = true;
    this.batchModifiedKeys.clear();
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
   * Commit batch and apply changes
   * @param {Object} chunks - Reference to chunks object
   * @returns {boolean} - True if changes were made
   */
  commitBatch(chunks) {
    this.isBatching = false;

    if (this.batchModifiedKeys.size === 0) return false;

    // Clone all modified chunks for React immutability
    // Lighting was already updated incrementally during setBlock() calls
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
  }
}

export default ChunkBatcher;

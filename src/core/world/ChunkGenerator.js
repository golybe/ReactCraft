import { Chunk } from './Chunk';
import { getWorkerPool } from '../../utils/workerPool';
import { log } from '../../utils/logger';
import ChunkWorker from '../../workers/chunkWorker.js?worker';

/**
 * Handles async chunk generation using Web Workers.
 * Extracted from ChunkManager for better separation of concerns.
 */
export class ChunkGenerator {
  constructor(seed) {
    this.seed = seed;
    this.workerPool = getWorkerPool(ChunkWorker);
    this.pendingChunks = new Set();
    this.currentChunk = { x: 0, z: 0 };

    log('ChunkGenerator', `Initialized with seed: ${seed}`);
  }

  /**
   * Set current player chunk position for priority calculation
   */
  setCurrentChunk(x, z) {
    this.currentChunk = { x, z };
  }

  /**
   * Check if chunk is being generated
   */
  isPending(key) {
    return this.pendingChunks.has(key);
  }

  /**
   * Add chunk to pending set
   */
  markPending(key) {
    this.pendingChunks.add(key);
  }

  /**
   * Remove chunk from pending set
   */
  clearPending(key) {
    this.pendingChunks.delete(key);
  }

  /**
   * Calculate priority for chunk (closer = higher priority)
   */
  calculatePriority(cx, cz) {
    const dx = cx - this.currentChunk.x;
    const dz = cz - this.currentChunk.z;
    const distSq = dx * dx + dz * dz;
    return 100 - Math.min(100, distSq);
  }

  /**
   * Generate chunk asynchronously via Web Worker
   */
  async generateChunk(cx, cz) {
    const key = `${cx},${cz}`;
    log('ChunkGenerator', `Generating chunk ${key} via worker`);

    const priority = this.calculatePriority(cx, cz);
    const result = await this.workerPool.generateChunk(cx, cz, this.seed, priority);

    // Create Chunk from transferable buffers
    const blocksArray = new Uint8Array(result.blocks);
    const metadataArray = new Uint8Array(result.metadata);
    const biomeMapArray = result.biomeMap ? new Uint8Array(result.biomeMap) : null;

    log('ChunkGenerator', `Chunk ${key} generated, blocks: ${blocksArray.length}`);

    return new Chunk({ blocks: blocksArray, metadata: metadataArray, biomeMap: biomeMapArray });
  }

  /**
   * Load chunk from stored data
   */
  loadFromStorage(serializedData) {
    return Chunk.deserialize(serializedData);
  }

  /**
   * Clear pending chunks
   */
  clear() {
    this.pendingChunks.clear();
  }
}

export default ChunkGenerator;

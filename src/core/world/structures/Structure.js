/**
 * Base class for all world structures (trees, houses, dungeons, etc.)
 * Inspired by Minecraft structure system.
 */
export class Structure {
  constructor(id) {
    this.id = id;
  }

  /**
   * Generates the structure in the provided block array.
   * @param {Uint8Array} blocks - The chunk blocks array.
   * @param {number} x, y, z - Local coordinates within the chunk (0-15).
   * @param {object} rng - Seeded random generator.
   * @param {object} context - Additional data (biome, chunk metadata, etc.)
   */
  generate(blocks, x, y, z, rng, context) {
    throw new Error('generate() must be implemented by subclasses');
  }

  /**
   * Helper to set a block with bounds checking.
   */
  setBlock(blocks, bx, by, bz, blockId) {
    // CHUNK_SIZE и CHUNK_HEIGHT берем из констант внутри, так надежнее
    const SIZE = 16; 
    const HEIGHT = 256;

    if (bx >= 0 && bx < SIZE && bz >= 0 && bz < SIZE && by >= 0 && by < HEIGHT) {
      const index = by * SIZE * SIZE + bx * SIZE + bz;
      blocks[index] = blockId;
      return true;
    }
    return false;
  }

  /**
   * Helper to set a block only if it's currently AIR or LEAVES.
   */
  setBlockIfReplaceable(blocks, bx, by, bz, blockId) {
    const SIZE = 16;
    const HEIGHT = 256;
    const AIR = 0;
    const LEAVES = 6; // В воркере LEAVES обычно 6

    if (bx >= 0 && bx < SIZE && bz >= 0 && bz < SIZE && by >= 0 && by < HEIGHT) {
      const index = by * SIZE * SIZE + bx * SIZE + bz;
      const current = blocks[index];
      if (current === AIR || current === LEAVES) {
        blocks[index] = blockId;
        return true;
      }
    }
    return false;
  }

  /**
   * Helper to set a leaf block. Replaces AIR, LEAVES, and WOOD blocks (to cover trunk tops).
   * This is specifically for tree leaves that should cover the upper trunk blocks.
   */
  setLeafBlock(blocks, bx, by, bz, blockId) {
    const SIZE = 16;
    const HEIGHT = 256;
    const AIR = 0;
    const LEAVES = 5; // BLOCK_TYPES.LEAVES
    const WOOD = 4;   // BLOCK_TYPES.WOOD

    if (bx >= 0 && bx < SIZE && bz >= 0 && bz < SIZE && by >= 0 && by < HEIGHT) {
      const index = by * SIZE * SIZE + bx * SIZE + bz;
      const current = blocks[index];
      // Заменяем AIR, LEAVES и WOOD (чтобы покрыть верхние блоки ствола листвой)
      if (current === AIR || current === LEAVES || current === WOOD) {
        blocks[index] = blockId;
        return true;
      }
    }
    return false;
  }
}

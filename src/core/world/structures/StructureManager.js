import { TreeStructure } from './TreeStructure.js';

/**
 * Manages all structures in the world.
 */
export class StructureManager {
  constructor() {
    this.structures = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    this.structures.set('tree', new TreeStructure());
    this.structures.set('tree_oak', new TreeStructure('oak'));
    this.structures.set('tree_spruce', new TreeStructure('spruce'));
    this.structures.set('tree_jungle', new TreeStructure('jungle'));
  }

  getStructure(id) {
    return this.structures.get(id);
  }

  /**
   * Attempts to generate a structure at the given coordinates.
   */
  generate(id, blocks, x, y, z, rng, context) {
    const structure = this.getStructure(id);
    if (structure) {
      return structure.generate(blocks, x, y, z, rng, context);
    }
    return false;
  }
}

// Export a singleton instance for easier use in workers
export const structureManager = new StructureManager();

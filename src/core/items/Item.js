/**
 * Base class for all items in the game.
 * Items are objects that can be held in inventory and used by the player.
 */
export class Item {
  /**
   * @param {string} id - Unique identifier for the item
   * @param {Object} options - Item configuration options
   * @param {string} options.name - Display name
   * @param {number} options.maxStackSize - Maximum stack size (default: 64)
   * @param {string} options.texture - Texture name for rendering
   * @param {string} options.category - Category for creative menu
   * @param {string} options.rarity - Rarity level for name color
   */
  constructor(id, options = {}) {
    this.id = id;
    this.name = options.name || id;
    this.maxStackSize = options.maxStackSize ?? 64;
    this.texture = options.texture || id;

    // Category for creative inventory grouping
    this.category = options.category || 'misc';

    // Rarity affects name color display
    // common (white), uncommon (yellow), rare (aqua), epic (purple)
    this.rarity = options.rarity || 'common';

    // Whether item is consumed on use
    this.consumable = options.consumable || false;
  }

  /**
   * Called when player uses item (right-click in air)
   * @param {Player} player - The player using the item
   * @param {World} world - The world instance
   * @returns {boolean} - Whether the use was successful
   */
  onUse(player, world) {
    return false;
  }

  /**
   * Called when player uses item on a block (right-click on block)
   * @param {Player} player - The player using the item
   * @param {World} world - The world instance
   * @param {number} x - Block X coordinate
   * @param {number} y - Block Y coordinate
   * @param {number} z - Block Z coordinate
   * @param {string} face - Which face of the block was clicked
   * @returns {boolean} - Whether the use was successful
   */
  onUseOnBlock(player, world, x, y, z, face) {
    return false;
  }

  /**
   * Called when player attacks an entity with this item
   * @param {Player} player - The attacking player
   * @param {Entity} target - The target entity
   * @returns {number} - Damage dealt
   */
  onAttack(player, target) {
    return 1; // Base hand damage
  }

  /**
   * Check if this item can harvest the given block
   * @param {Block} block - The block to check
   * @returns {boolean}
   */
  canHarvest(block) {
    return true; // Most items can harvest any block (just slowly)
  }

  /**
   * Get mining speed multiplier for a block
   * @param {Block} block - The block being mined
   * @returns {number} - Speed multiplier (1.0 = normal)
   */
  getMiningSpeed(block) {
    return 1.0;
  }

  /**
   * Get attack damage for this item
   * @returns {number}
   */
  getAttackDamage() {
    return 1;
  }

  /**
   * Get attack speed for this item
   * @returns {number}
   */
  getAttackSpeed() {
    return 4.0; // Hits per second
  }

  /**
   * Called when item is crafted
   * @param {Player} player - The player who crafted it
   */
  onCraft(player) {}

  /**
   * Called when item is dropped
   * @param {Player} player - The player who dropped it
   */
  onDrop(player) {}

  /**
   * Serialize item for saving
   * @returns {Object}
   */
  serialize() {
    return {
      id: this.id
    };
  }

  /**
   * Get rarity color for display
   * @returns {string} - CSS color string
   */
  getRarityColor() {
    const colors = {
      common: '#FFFFFF',
      uncommon: '#FFFF55',
      rare: '#55FFFF',
      epic: '#FF55FF',
      legendary: '#FFB300'
    };
    return colors[this.rarity] || colors.common;
  }
}

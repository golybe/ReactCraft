/**
 * Константы типов блоков для Web Workers
 * 
 * Этот файл не зависит от BlockRegistry и может безопасно
 * использоваться в Web Workers без инициализации DOM.
 */

export const BLOCK_TYPES = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
  WATER: 7,
  BRICK: 8,
  COAL_ORE: 9,
  IRON_ORE: 10,
  GOLD_ORE: 11,
  DIAMOND_ORE: 12,
  SNOW: 13,
  PLANKS: 14,
  BEDROCK: 15,
  
  // RESERVED FOR FUTURE BLOCKS: 16 - 511
  
  // ITEMS (Non-block entities): 512+
  STICK: 512
};

export default BLOCK_TYPES;

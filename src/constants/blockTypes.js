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
  
  CRAFTING_TABLE: 16,
  COBBLESTONE: 17,
  GRAVEL: 18,
  SANDSTONE: 19,
  LAPIS_ORE: 20,
  
  // Plants
  TALL_GRASS: 21,  // Short grass (декоративная трава)
  
  // Light sources
  TORCH: 22,

  // RESERVED FOR FUTURE BLOCKS: 23 - 511

  // ITEMS (Non-block entities): 512+
  STICK: 512,
  APPLE: 513,
  COAL: 514,
  DIAMOND: 515,
  
  // TOOLS: 520+
  // Wooden tools
  WOODEN_AXE: 520,
  WOODEN_PICKAXE: 521,
  WOODEN_SHOVEL: 522,
  
  // Stone tools
  STONE_AXE: 523,
  STONE_PICKAXE: 524,
  STONE_SHOVEL: 525
};

export default BLOCK_TYPES;

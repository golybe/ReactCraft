import { BLOCK_TYPES } from '../constants/blockTypes';

const texPath = (name) => `/textures/${name}`;

// Пути к текстурам в папке public/textures
export const textures = {
  grassTop: texPath('grass_top.png'),
  grassSide: texPath('grass_side_overlay.png'),
  dirt: texPath('dirt.png'),
  stone: texPath('stone.png'),
  woodSide: texPath('wood_side.png'),
  woodTop: texPath('wood_top.png'),
  leaves: texPath('leaves.png'),
  sand: texPath('sand.png'),
  water: texPath('water.png'),
  brick: texPath('brick.png'),
  coalOre: texPath('coal_ore.png'),
  ironOre: texPath('iron_ore.png'),
  goldOre: texPath('gold_ore.png'),
  diamondOre: texPath('diamond_ore.png'),
  snow: texPath('snow.png'),
  planks: texPath('planks.png'),
  bedrock: texPath('bedrock.png'),
  stick: texPath('stick.png'),
  apple: texPath('apple.png'),
  coal: texPath('coal.png'),
  diamond: texPath('diamond.png'),
  woodenAxe: texPath('wooden_axe.png'),
  woodenPickaxe: texPath('wooden_pickaxe.png'),
  woodenShovel: texPath('wooden_shovel.png'),
  cobblestone: texPath('cobblestone.png'),
  stoneAxe: texPath('stone_axe.png'),
  stonePickaxe: texPath('stone_pickaxe.png'),
  stoneShovel: texPath('stone_shovel.png'),
  // Workbench textures
  craftingTableTop: texPath('crafting_table_top.png'),
  craftingTableSide: texPath('crafting_table_side.png'),
  craftingTableFront: texPath('crafting_table_front.png'),
  // New textures
  gravel: texPath('gravel.png'),
  sandstone: texPath('sandstone.png'),
  sandstoneTop: texPath('sandstone_top.png'),
  sandstoneBottom: texPath('sandstone_bottom.png'),
  lapisOre: texPath('lapis_ore.png'),
  // Plants
  shortGrass: texPath('short_grass.png'),
  // Light sources
  torch: texPath('torch.png')
};

export const getBlockTexture = (name) => {
  return textures[name];
};

const blockTextureMap = {
  [BLOCK_TYPES.GRASS]: { top: 'grassTop', side: 'grassSide', bottom: 'dirt' },
  [BLOCK_TYPES.DIRT]: { all: 'dirt' },
  [BLOCK_TYPES.STONE]: { all: 'stone' },
  [BLOCK_TYPES.WOOD]: { top: 'woodTop', bottom: 'woodTop', side: 'woodSide' },
  [BLOCK_TYPES.LEAVES]: { all: 'leaves' },
  [BLOCK_TYPES.SAND]: { all: 'sand' },
  [BLOCK_TYPES.WATER]: { all: 'water' },
  [BLOCK_TYPES.BRICK]: { all: 'brick' },
  [BLOCK_TYPES.COAL_ORE]: { all: 'coalOre' },
  [BLOCK_TYPES.IRON_ORE]: { all: 'ironOre' },
  [BLOCK_TYPES.GOLD_ORE]: { all: 'goldOre' },
  [BLOCK_TYPES.DIAMOND_ORE]: { all: 'diamondOre' },
  [BLOCK_TYPES.SNOW]: { all: 'snow' },
  [BLOCK_TYPES.PLANKS]: { all: 'planks' },
  [BLOCK_TYPES.BEDROCK]: { all: 'bedrock' },
  [BLOCK_TYPES.STICK]: { all: 'stick', isItem: true },
  [BLOCK_TYPES.APPLE]: { all: 'apple', isItem: true },
  [BLOCK_TYPES.COAL]: { all: 'coal', isItem: true },
  [BLOCK_TYPES.DIAMOND]: { all: 'diamond', isItem: true },
  [BLOCK_TYPES.WOODEN_AXE]: { all: 'woodenAxe', isItem: true },
  [BLOCK_TYPES.WOODEN_PICKAXE]: { all: 'woodenPickaxe', isItem: true },
  [BLOCK_TYPES.WOODEN_SHOVEL]: { all: 'woodenShovel', isItem: true },
  [BLOCK_TYPES.CRAFTING_TABLE]: {
    top: 'craftingTableTop',
    side: 'craftingTableSide',
    front: 'craftingTableFront',
    bottom: 'planks'
  },
  [BLOCK_TYPES.COBBLESTONE]: { all: 'cobblestone' },
  [BLOCK_TYPES.GRAVEL]: { all: 'gravel' },
  [BLOCK_TYPES.SANDSTONE]: { top: 'sandstoneTop', side: 'sandstone', bottom: 'sandstoneBottom' },
  [BLOCK_TYPES.LAPIS_ORE]: { all: 'lapisOre' },
  [BLOCK_TYPES.STONE_AXE]: { all: 'stoneAxe', isItem: true },
  [BLOCK_TYPES.STONE_PICKAXE]: { all: 'stonePickaxe', isItem: true },
  [BLOCK_TYPES.STONE_SHOVEL]: { all: 'stoneShovel', isItem: true },
  // Plants
  [BLOCK_TYPES.TALL_GRASS]: { all: 'shortGrass', renderType: 'cross' },
  // Light sources
  [BLOCK_TYPES.TORCH]: { all: 'torch', renderType: 'torch', isItem: true }
};

export const getBlockTextureInfo = (blockType) => blockTextureMap[blockType];

// Новая функция для получения URL всех сторон
export const getResolvedBlockTextures = (blockType) => {
  const mapping = blockTextureMap[blockType];
  if (!mapping) {
    return { top: null, side: null, front: null };
  }

  const resolve = (name) => textures[name];

  if (mapping.all) {
    const url = resolve(mapping.all);
    return { top: url, side: url, front: url };
  }

  return {
    top: resolve(mapping.top),
    side: resolve(mapping.side),
    front: resolve(mapping.front) || resolve(mapping.side),
    bottom: resolve(mapping.bottom)
  };
};

export default textures;

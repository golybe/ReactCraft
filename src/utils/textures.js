import { BLOCK_TYPES } from '../constants/blocks';

const texPath = (name) => `/textures/${name}`;

// Пути к текстурам в папке public/textures
export const textures = {
  grassTop: texPath('grass_top.png'),
  grassSide: texPath('grass_side_overlay.png'), // Используем оверлей как основную текстуру для логики композитинга
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
  stick: texPath('stick.png')
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
  [BLOCK_TYPES.STICK]: { all: 'stick', isItem: true }
};

export const getBlockTextureInfo = (blockType) => blockTextureMap[blockType];

// Новая функция для получения URL всех сторон
export const getResolvedBlockTextures = (blockType) => {
    const mapping = blockTextureMap[blockType];
    if (!mapping) {
        // Fallback for unknown blocks (or air)
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
        front: resolve(mapping.side), // Front is same as side usually
        bottom: resolve(mapping.bottom)
    };
};

export default textures;

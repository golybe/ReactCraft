import { BlockRegistry } from '../core/blocks/BlockRegistry';
import { initBlocks } from '../core/initBlocks';

// Инициализируем реестр блоков (заполняем данными)
initBlocks();

// Генерируем константы для обратной совместимости
export const BLOCK_TYPES = {};
export const BLOCK_PROPERTIES = {};

BlockRegistry.getAll().forEach(block => {
  // Генерируем ключи типа GRASS, COAL_ORE из имени
  const key = block.name.toUpperCase();
  BLOCK_TYPES[key] = block.id;
  
  // Заполняем свойства
  BLOCK_PROPERTIES[block.id] = block.properties;
});

// Блоки, доступные в хотбаре (сохраняем старый порядок для привычности)
export const HOTBAR_BLOCKS = [
  BLOCK_TYPES.GRASS,
  BLOCK_TYPES.DIRT,
  BLOCK_TYPES.STONE,
  BLOCK_TYPES.WOOD,
  BLOCK_TYPES.PLANKS,
  BLOCK_TYPES.BRICK,
  BLOCK_TYPES.SAND,
  BLOCK_TYPES.SNOW,
  BLOCK_TYPES.LEAVES
];

// Получить свойства блока по ID
export const getBlockProperties = (blockId) => {
  return BLOCK_PROPERTIES[blockId] || BLOCK_PROPERTIES[BLOCK_TYPES.AIR];
};

// Проверить, является ли блок твердым
export const isSolid = (blockId) => {
  return getBlockProperties(blockId).solid;
};

// Проверить, является ли блок прозрачным
export const isTransparent = (blockId) => {
  return getBlockProperties(blockId).transparent;
};

// Экспортируем также сам реестр для нового кода
export { BlockRegistry };

export default {
  BLOCK_TYPES,
  BLOCK_PROPERTIES,
  HOTBAR_BLOCKS,
  getBlockProperties,
  isSolid,
  isTransparent,
  BlockRegistry
};

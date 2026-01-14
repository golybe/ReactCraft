import { BlockRegistry } from '../core/blocks/BlockRegistry';
import { initBlocks } from '../core/initBlocks';
import { BLOCK_TYPES as STATIC_BLOCK_TYPES } from './blockTypes';

// Гарантируем инициализацию при загрузке модуля
let initialized = false;

export const ensureBlocksInitialized = () => {
  if (initialized) return;
  initBlocks();

  // Пополняем наши локальные объекты из реестра
  BlockRegistry.getAll().forEach(block => {
    const key = block.name.toUpperCase();
    if (!BLOCK_TYPES[key]) {
      BLOCK_TYPES[key] = block.id;
    }
    BLOCK_PROPERTIES[block.id] = block.properties;
  });

  // Пересоздаем HOTBAR_BLOCKS если они были пустыми
  if (HOTBAR_BLOCKS.length === 0 || HOTBAR_BLOCKS[0] === undefined) {
    HOTBAR_BLOCKS.length = 0;
    HOTBAR_BLOCKS.push(
      BLOCK_TYPES.GRASS,
      BLOCK_TYPES.DIRT,
      BLOCK_TYPES.STONE,
      BLOCK_TYPES.WOOD,
      BLOCK_TYPES.PLANKS,
      BLOCK_TYPES.BRICK,
      BLOCK_TYPES.SAND,
      BLOCK_TYPES.SNOW,
      BLOCK_TYPES.LEAVES
    );
  }

  initialized = true;
};

// Экспортируем константы (сначала пустые или статические, потом наполним)
export const BLOCK_TYPES = { ...STATIC_BLOCK_TYPES };
export const BLOCK_PROPERTIES = {};
export const HOTBAR_BLOCKS = [];

// Сразу вызываем инициализацию
ensureBlocksInitialized();

// Получить свойства блока по ID
export const getBlockProperties = (blockId) => {
  ensureBlocksInitialized();
  return BLOCK_PROPERTIES[blockId] || { solid: false, transparent: true, name: 'air' };
};

// Проверить, является ли блок твердым
export const isSolid = (blockId) => {
  return getBlockProperties(blockId).solid;
};

// Проверить, является ли блок прозрачным
export const isTransparent = (blockId) => {
  return getBlockProperties(blockId).transparent;
};

export { BlockRegistry };

export default {
  BLOCK_TYPES,
  BLOCK_PROPERTIES,
  HOTBAR_BLOCKS,
  getBlockProperties,
  isSolid,
  isTransparent,
  BlockRegistry,
  ensureBlocksInitialized
};

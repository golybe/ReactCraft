import { BLOCK_TYPES } from './blockTypes';

/**
 * Crafting Recipes Registry
 * Supports shaped and shapeless recipes.
 */
export const RECIPES = [
  // 1 Wood -> 4 Planks
  {
    id: 'oak_planks',
    result: { type: BLOCK_TYPES.PLANKS, count: 4 },
    ingredients: [
      { type: BLOCK_TYPES.WOOD, count: 1 }
    ],
    type: 'shapeless'
  },
  // 2 Planks (vertical) -> 4 Sticks
  {
    id: 'sticks',
    result: { type: BLOCK_TYPES.STICK, count: 4 },
    pattern: [
      [BLOCK_TYPES.PLANKS],
      [BLOCK_TYPES.PLANKS]
    ],
    type: 'shaped'
  },
  // 4 Planks (2x2) -> Crafting Table
  {
    id: 'crafting_table',
    result: { type: BLOCK_TYPES.CRAFTING_TABLE, count: 1 },
    pattern: [
      [BLOCK_TYPES.PLANKS, BLOCK_TYPES.PLANKS],
      [BLOCK_TYPES.PLANKS, BLOCK_TYPES.PLANKS]
    ],
    type: 'shaped'
  },
  // 3 Planks + 2 Sticks -> Wooden Axe
  {
    id: 'wooden_axe',
    result: { type: BLOCK_TYPES.WOODEN_AXE, count: 1 },
    pattern: [
      [BLOCK_TYPES.PLANKS, BLOCK_TYPES.PLANKS, null],
      [BLOCK_TYPES.PLANKS, BLOCK_TYPES.STICK, null],
      [null, BLOCK_TYPES.STICK, null]
    ],
    type: 'shaped'
  },
  // 3 Planks + 2 Sticks -> Wooden Pickaxe
  {
    id: 'wooden_pickaxe',
    result: { type: BLOCK_TYPES.WOODEN_PICKAXE, count: 1 },
    pattern: [
      [BLOCK_TYPES.PLANKS, BLOCK_TYPES.PLANKS, BLOCK_TYPES.PLANKS],
      [null, BLOCK_TYPES.STICK, null],
      [null, BLOCK_TYPES.STICK, null]
    ],
    type: 'shaped'
  },
  // 1 Plank + 2 Sticks -> Wooden Shovel
  {
    id: 'wooden_shovel',
    result: { type: BLOCK_TYPES.WOODEN_SHOVEL, count: 1 },
    pattern: [
      [null, BLOCK_TYPES.PLANKS, null],
      [null, BLOCK_TYPES.STICK, null],
      [null, BLOCK_TYPES.STICK, null]
    ],
    type: 'shaped'
  },

  // === STONE TOOLS ===
  // Stone Axe
  {
    id: 'stone_axe',
    result: { type: BLOCK_TYPES.STONE_AXE, count: 1 },
    pattern: [
      [BLOCK_TYPES.COBBLESTONE, BLOCK_TYPES.COBBLESTONE, null],
      [BLOCK_TYPES.COBBLESTONE, BLOCK_TYPES.STICK, null],
      [null, BLOCK_TYPES.STICK, null]
    ],
    type: 'shaped'
  },
  // Stone Pickaxe
  {
    id: 'stone_pickaxe',
    result: { type: BLOCK_TYPES.STONE_PICKAXE, count: 1 },
    pattern: [
      [BLOCK_TYPES.COBBLESTONE, BLOCK_TYPES.COBBLESTONE, BLOCK_TYPES.COBBLESTONE],
      [null, BLOCK_TYPES.STICK, null],
      [null, BLOCK_TYPES.STICK, null]
    ],
    type: 'shaped'
  },
  // Stone Shovel
  {
    id: 'stone_shovel',
    result: { type: BLOCK_TYPES.STONE_SHOVEL, count: 1 },
    pattern: [
      [null, BLOCK_TYPES.COBBLESTONE, null],
      [null, BLOCK_TYPES.STICK, null],
      [null, BLOCK_TYPES.STICK, null]
    ],
    type: 'shaped'
  },

  // === DIAMOND TOOLS ===
  // Diamond Axe
  {
    id: 'diamond_axe',
    result: { type: BLOCK_TYPES.DIAMOND_AXE, count: 1 },
    pattern: [
      [BLOCK_TYPES.DIAMOND, BLOCK_TYPES.DIAMOND, null],
      [BLOCK_TYPES.DIAMOND, BLOCK_TYPES.STICK, null],
      [null, BLOCK_TYPES.STICK, null]
    ],
    type: 'shaped'
  },
  // Diamond Pickaxe
  {
    id: 'diamond_pickaxe',
    result: { type: BLOCK_TYPES.DIAMOND_PICKAXE, count: 1 },
    pattern: [
      [BLOCK_TYPES.DIAMOND, BLOCK_TYPES.DIAMOND, BLOCK_TYPES.DIAMOND],
      [null, BLOCK_TYPES.STICK, null],
      [null, BLOCK_TYPES.STICK, null]
    ],
    type: 'shaped'
  },
  // Diamond Shovel
  {
    id: 'diamond_shovel',
    result: { type: BLOCK_TYPES.DIAMOND_SHOVEL, count: 1 },
    pattern: [
      [null, BLOCK_TYPES.DIAMOND, null],
      [null, BLOCK_TYPES.STICK, null],
      [null, BLOCK_TYPES.STICK, null]
    ],
    type: 'shaped'
  },

  // === TORCH (4 torches from 1 coal + 1 stick) ===
  {
    id: 'torch',
    result: { type: BLOCK_TYPES.TORCH, count: 4 },
    pattern: [
      [BLOCK_TYPES.COAL],
      [BLOCK_TYPES.STICK]
    ],
    type: 'shaped'
  }
];

export default RECIPES;

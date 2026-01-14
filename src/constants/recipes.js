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
  }
];

export default RECIPES;

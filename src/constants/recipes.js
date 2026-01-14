import { BLOCK_TYPES } from './blockTypes';

/**
 * Crafting Recipes Registry
 * Supports shaped and shapeless recipes.
 */
export const RECIPES = [
  {
    id: 'oak_planks',
    result: { type: BLOCK_TYPES.PLANKS, count: 4 },
    ingredients: [
      { type: BLOCK_TYPES.WOOD, count: 1 }
    ],
    type: 'shapeless'
  },
  {
    id: 'sticks',
    result: { type: BLOCK_TYPES.STICK, count: 4 },
    pattern: [
      [BLOCK_TYPES.PLANKS],
      [BLOCK_TYPES.PLANKS]
    ],
    type: 'shaped'
  }
];

export default RECIPES;

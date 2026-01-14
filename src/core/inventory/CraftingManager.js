import { RECIPES } from '../../constants/recipes';

export class CraftingManager {
  /**
   * Checks if the current crafting grid matches any recipe.
   * @param {Array} grid - Array of items in the crafting grid (e.g., 4 or 9 items).
   * @returns {Object|null} The result item {type, count} or null if no match.
   */
  static checkRecipe(grid) {
    // 1. Filter out empty slots from grid
    const activeItems = grid
      .filter(item => item && item.type !== null && item.count > 0)
      .map(item => ({ type: item.type, count: item.count }));

    if (activeItems.length === 0) return null;

    // 2. Check shapeless recipes first
    for (const recipe of RECIPES) {
      if (recipe.type === 'shapeless') {
        if (this.matchShapeless(activeItems, recipe.ingredients)) {
          return { ...recipe.result };
        }
      } else if (recipe.type === 'shaped') {
        if (this.matchShaped(grid, recipe.pattern)) {
          return { ...recipe.result };
        }
      }
    }

    return null;
  }

  /**
   * Matches a crafting grid against a shaped pattern.
   */
  static matchShaped(grid, pattern) {
    const gridSize = Math.sqrt(grid.length); // 2 or 3
    const patternHeight = pattern.length;
    const patternWidth = pattern[0].length;

    if (patternHeight > gridSize || patternWidth > gridSize) return false;

    // Try all possible offsets within the grid
    for (let rowOffset = 0; rowOffset <= gridSize - patternHeight; rowOffset++) {
      for (let colOffset = 0; colOffset <= gridSize - patternWidth; colOffset++) {
        if (this.checkShapedAtOffset(grid, pattern, rowOffset, colOffset, gridSize)) {
          // Found a match! Now ensure EVERYTHING ELSE in the grid is empty.
          if (this.isGridEmptyExcept(grid, rowOffset, colOffset, patternWidth, patternHeight, gridSize)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  static checkShapedAtOffset(grid, pattern, rowOffset, colOffset, gridSize) {
    for (let row = 0; row < pattern.length; row++) {
      for (let col = 0; col < pattern[row].length; col++) {
        const gridIdx = (row + rowOffset) * gridSize + (col + colOffset);
        const gridItem = grid[gridIdx];
        const patternType = pattern[row][col];

        if (patternType === null) {
          if (gridItem && gridItem.type !== null) return false;
        } else {
          if (!gridItem || gridItem.type !== patternType) return false;
        }
      }
    }
    return true;
  }

  static isGridEmptyExcept(grid, rOff, cOffset, pWidth, pHeight, gridSize) {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        // If this cell is WITHIN the matched pattern area, skip it (already checked)
        if (r >= rOff && r < rOff + pHeight && c >= cOffset && c < cOffset + pWidth) continue;

        const idx = r * gridSize + c;
        if (grid[idx] && grid[idx].type !== null && grid[idx].count > 0) return false;
      }
    }
    return true;
  }

  /**
   * Matches a list of items against a list of required ingredients (shapeless).
   */
  static matchShapeless(gridItems, ingredients) {
    if (gridItems.length !== ingredients.length) return false;

    // Simple match: for each ingredient, find one match in gridItems
    const remaining = [...gridItems];
    
    for (const ing of ingredients) {
      const index = remaining.findIndex(item => item.type === ing.type && item.count >= ing.count);
      if (index === -1) return false;
      remaining.splice(index, 1);
    }

    return remaining.length === 0;
  }
}

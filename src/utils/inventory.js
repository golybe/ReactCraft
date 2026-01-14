/**
 * Inventory Constants
 *
 * Константы для работы с инвентарём.
 * Вся логика инвентаря находится в классе Inventory (src/core/inventory/Inventory.js)
 */

// Максимальный размер стека
export const MAX_STACK_SIZE = 64;

// Размеры инвентаря
export const HOTBAR_SIZE = 9;              // Слоты 0-8
export const MAIN_INVENTORY_SIZE = 27;     // Слоты 9-35 (3 ряда по 9)
export const TOTAL_INVENTORY_SIZE = HOTBAR_SIZE + MAIN_INVENTORY_SIZE; // 36 всего

// Размеры крафтинга
export const CRAFTING_GRID_SIZE = 4;       // 2x2 для инвентаря игрока
export const CRAFTING_3X3_SIZE = 9;        // 3x3 для верстака
export const CRAFTING_RESULT_SLOT = 1;

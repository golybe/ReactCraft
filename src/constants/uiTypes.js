/**
 * Типы интерфейсов в игре
 * 
 * Используется для централизованного управления открытыми UI
 */
export const UI_TYPES = {
    NONE: 'none',           // Нет открытого интерфейса
    INVENTORY: 'inventory', // Инвентарь игрока (E)
    CRAFTING: 'crafting',   // Верстак (3x3)
    FURNACE: 'furnace',     // Печь (будущее)
    CHEST: 'chest',         // Сундук (будущее)
    ANVIL: 'anvil',         // Наковальня (будущее)
};

/**
 * Проверка, является ли интерфейс открытым (блокирует игру)
 */
export const isUIBlocking = (uiType) => {
    return uiType !== UI_TYPES.NONE;
};

/**
 * Настройки для каждого типа интерфейса
 */
export const UI_CONFIG = {
    [UI_TYPES.INVENTORY]: {
        title: 'Inventory',
        exitOnE: true,        // Закрывается на E
        pausesGame: false,    // Не ставит паузу
        blocksInput: true,    // Блокирует игровой ввод
    },
    [UI_TYPES.CRAFTING]: {
        title: 'Crafting',
        exitOnE: true,
        pausesGame: false,
        blocksInput: true,
    },
    [UI_TYPES.FURNACE]: {
        title: 'Furnace',
        exitOnE: true,
        pausesGame: false,
        blocksInput: true,
    },
    [UI_TYPES.CHEST]: {
        title: 'Chest',
        exitOnE: true,
        pausesGame: false,
        blocksInput: true,
    },
};

export default UI_TYPES;

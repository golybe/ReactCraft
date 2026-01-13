/**
 * Game Mode Constants and Utilities
 */

export const GAME_MODES = {
  SURVIVAL: 0,
  CREATIVE: 1
};

export const GAME_MODE_NAMES = {
  [GAME_MODES.SURVIVAL]: 'Выживание',
  [GAME_MODES.CREATIVE]: 'Творческий'
};

// Стандартные настройки для каждого режима
export const GAME_MODE_DEFAULTS = {
  [GAME_MODES.SURVIVAL]: {
    canFly: false,
    instantBreak: false,
    infiniteBlocks: false,
    showBreakProgress: true,
    dropItems: true
  },
  [GAME_MODES.CREATIVE]: {
    canFly: true,
    instantBreak: true,
    infiniteBlocks: true,
    showBreakProgress: false,
    dropItems: false
  }
};

/**
 * Получить настройки по умолчанию для режима
 */
export const getGameModeDefaults = (mode) => {
  return GAME_MODE_DEFAULTS[mode] || GAME_MODE_DEFAULTS[GAME_MODES.SURVIVAL];
};

/**
 * Проверить, является ли режим Creative
 */
export const isCreativeMode = (mode) => mode === GAME_MODES.CREATIVE;

/**
 * Проверить, является ли режим Survival
 */
export const isSurvivalMode = (mode) => mode === GAME_MODES.SURVIVAL;

export default {
  GAME_MODES,
  GAME_MODE_NAMES,
  GAME_MODE_DEFAULTS,
  getGameModeDefaults,
  isCreativeMode,
  isSurvivalMode
};

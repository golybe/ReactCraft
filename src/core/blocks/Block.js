/**
 * Tool types for block mining
 */
export const TOOL_TYPES = {
  HAND: 'hand',
  PICKAXE: 'pickaxe',
  AXE: 'axe',
  SHOVEL: 'shovel',
  SHEARS: 'shears'
};

/**
 * Tool effectiveness multipliers
 */
export const TOOL_MULTIPLIERS = {
  [TOOL_TYPES.HAND]: 1.0,
  [TOOL_TYPES.PICKAXE]: 6.0,
  [TOOL_TYPES.AXE]: 6.0,
  [TOOL_TYPES.SHOVEL]: 6.0,
  [TOOL_TYPES.SHEARS]: 15.0
};

/**
 * Базовый класс для всех блоков в игре
 */
export class Block {
  constructor(id, settings) {
    this.id = id;
    this.name = settings.name || 'unknown';
    this.isSolid = settings.solid !== undefined ? settings.solid : true;
    this.isTransparent = settings.transparent !== undefined ? settings.transparent : false;
    this.texture = settings.texture || null;
    this.color = settings.color || 0xffffff;
    this.hardness = settings.hardness || 0;
    this.isLiquid = settings.liquid || false;
    this.unbreakable = settings.unbreakable || false;
    
    // Новые свойства для системы добычи
    this.preferredTool = settings.preferredTool || TOOL_TYPES.HAND;
    this.requiresTool = settings.requiresTool || false; // Если true, без инструмента не ломается
    this.drops = settings.drops !== undefined ? settings.drops : id; // По умолчанию дропает себя
    this.dropCount = settings.dropCount || 1;
    this.xp = settings.xp || 0; // Опыт за добычу (для будущего)
    
    // Кастомные дропы с шансом (например, яблоки с листвы)
    // Формат: [{ type: blockId, chance: 0.05, count: 1 }]
    this.customDrops = settings.customDrops || [];
    
    // Свойства для еды
    this.isFood = settings.isFood || false;
    this.healAmount = settings.healAmount || 0;
  }

  /**
   * Свойства для обратной совместимости с BLOCK_PROPERTIES
   */
  get properties() {
    return {
      name: this.name,
      solid: this.isSolid,
      transparent: this.isTransparent,
      texture: this.texture,
      color: this.color,
      hardness: this.hardness,
      liquid: this.isLiquid,
      unbreakable: this.unbreakable,
      preferredTool: this.preferredTool,
      requiresTool: this.requiresTool,
      drops: this.drops,
      dropCount: this.dropCount,
      xp: this.xp
    };
  }

  /**
   * Рассчитать время добычи блока в секундах
   * Формула из Minecraft: breakTime = hardness * 1.5 / toolMultiplier
   * @param {string} toolType - тип инструмента
   * @param {number} toolEfficiency - модификатор эффективности инструмента (1.0 = базовый)
   * @returns {number} время в секундах
   */
  getBreakTime(toolType = TOOL_TYPES.HAND, toolEfficiency = 1.0) {
    if (this.unbreakable) return Infinity;
    if (this.hardness <= 0) return 0;
    
    // Базовая формула: hardness * 1.5 секунды голой рукой
    let baseTime = this.hardness * 1.5;
    
    // Применяем множитель инструмента
    let multiplier = 1.0;
    
    if (toolType === this.preferredTool) {
      // Правильный инструмент дает большой бонус
      multiplier = TOOL_MULTIPLIERS[toolType] || 1.0;
      // Применяем эффективность ТОЛЬКО для правильного инструмента
      multiplier *= toolEfficiency;
    } else if (toolType !== TOOL_TYPES.HAND) {
      // Неправильный инструмент дает небольшой бонус (но без toolEfficiency!)
      multiplier = 1.5;
    }
    
    // Если блок требует инструмент, но его нет - ломаем очень медленно
    if (this.requiresTool && toolType === TOOL_TYPES.HAND) {
      multiplier = 0.3; // В 3 раза медленнее
    }
    
    return Math.max(0.05, baseTime / multiplier); // Минимум 50мс
  }

  /**
   * Получить дроп при разрушении
   * @returns {{ type: number, count: number }[]}
   */
  getDrops() {
    const drops = [];
    
    // Основной дроп
    if (this.drops !== null && this.drops !== 0) {
      drops.push({ type: this.drops, count: this.dropCount });
    }
    
    // Кастомные дропы с шансом (например, яблоки с листвы)
    if (this.customDrops && this.customDrops.length > 0) {
      this.customDrops.forEach(customDrop => {
        const chance = customDrop.chance || 1.0;
        if (Math.random() < chance) {
          drops.push({
            type: customDrop.type,
            count: customDrop.count || 1
          });
        }
      });
    }
    
    return drops;
  }

  /**
   * Метод, вызываемый при разрушении блока
   * @param {World} world 
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   */
  onBreak(world, x, y, z) {
    // Базовая логика: создать частицы, звук и т.д.
    // Пока пустая реализация, но архитектурно готова
  }

  /**
   * Метод, вызываемый при установке блока
   */
  onPlace(world, x, y, z) {
    // Базовая логика
  }
}

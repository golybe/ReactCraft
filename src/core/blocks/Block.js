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
 * Базовые множители для инструментов (более реалистичные значения)
 */
export const TOOL_MULTIPLIERS = {
  [TOOL_TYPES.HAND]: 1.0,
  [TOOL_TYPES.PICKAXE]: 2.0,  // Было 6.0 - слишком быстро
  [TOOL_TYPES.AXE]: 2.0,       // Было 6.0 - слишком быстро
  [TOOL_TYPES.SHOVEL]: 2.0,    // Было 6.0 - слишком быстро
  [TOOL_TYPES.SHEARS]: 5.0     // Было 15.0 - слишком быстро
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
    this.isGravity = settings.gravity || false;
    this.renderAsItem = settings.renderAsItem || false;
    
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

    // Свойства предмета
    this.maxStackSize = settings.maxStackSize || 64; // По умолчанию стакается до 64
    this.isTool = settings.isTool || false;
    this.renderType = settings.renderType || 'block'; // 'block' | 'cross' | 'liquid'
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
      gravity: this.isGravity,
      renderAsItem: this.renderAsItem,
      preferredTool: this.preferredTool,
      requiresTool: this.requiresTool,
      drops: this.drops,
      dropCount: this.dropCount,
      xp: this.xp,
      renderType: this.renderType
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
    
    // ВАЖНО: эффективность инструмента (toolEfficiency) должна применяться 
    // ТОЛЬКО если это правильный инструмент для этого блока.
    if (this.preferredTool !== TOOL_TYPES.HAND && toolType === this.preferredTool) {
      // Правильный инструмент (например, кирка по камню)
      multiplier = (TOOL_MULTIPLIERS[toolType] || 1.0) * toolEfficiency;
    } else if (this.preferredTool === TOOL_TYPES.HAND && toolType !== TOOL_TYPES.HAND) {
      // Если блок можно копать рукой (земля/трава), но мы используем инструмент
      // Проверяем, подходит ли этот инструмент (например, лопата для земли)
      if (toolType === this.preferredTool) { // Это условие выше уже покрыто, но для ясности
         multiplier = (TOOL_MULTIPLIERS[toolType] || 1.0) * toolEfficiency;
      } else {
         // Инструмент не предназначен для этого (топор по земле) -> как рука
         multiplier = 1.0;
      }
    } else if (toolType !== TOOL_TYPES.HAND && toolType === this.preferredTool) {
       // Любой другой случай совпадения инструмента
       multiplier = (TOOL_MULTIPLIERS[toolType] || 1.0) * toolEfficiency;
    }
    
    // Если блок требует инструмент (requiresTool), а мы бьем не тем или рукой
    if (this.requiresTool && toolType !== this.preferredTool) {
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

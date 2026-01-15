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
 * Мы ставим здесь 1.0, потому что реальное ускорение
 * должно приходить из самого инструмента (свойства toolEfficiency: 2, 4, 8...),
 * а не умножаться еще раз на константу типа.
 */
export const TOOL_MULTIPLIERS = {
  [TOOL_TYPES.HAND]: 1.0,
  [TOOL_TYPES.PICKAXE]: 1.0,  // Было 2.0. Ставим 1.0, чтобы скорость зависела чисто от материала
  [TOOL_TYPES.AXE]: 1.0,      // Было 2.0
  [TOOL_TYPES.SHOVEL]: 1.0,   // Было 2.0
  [TOOL_TYPES.SHEARS]: 1.0    // Ножницы обычно имеют фиксированную скорость или работают мгновенно на шерсти
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
   * Формула: hardness * 1.5 / multiplier
   * @param {string} toolType - тип инструмента
   * @param {number} toolEfficiency - эффективность инструмента (2.0, 4.0, 8.0...)
   * @returns {number} время в секундах
   */
  getBreakTime(toolType = TOOL_TYPES.HAND, toolEfficiency = 1.0) {
    if (this.unbreakable) return Infinity;
    if (this.hardness <= 0) return 0; // Мгновенное разрушение (трава, цветы)

    // 1. Проверяем, является ли инструмент правильным для этого блока
    // Если preferredTool === HAND, значит блок не требует инструментов (земля, доски) - любой инструмент подходит
    const isCorrectTool = 
        (this.preferredTool === TOOL_TYPES.HAND) || 
        (toolType === this.preferredTool);

    // 2. Рассчитываем множитель скорости
    let multiplier = 1.0;

    if (isCorrectTool) {
        // Если инструмент правильный, берем его эффективность (2.0, 4.0, 8.0...)
        // Если бьем рукой, toolEfficiency будет 1.0 (передается извне)
        multiplier = toolEfficiency;
    } else {
        // Если инструмент неправильный (например, кирка по дереву),
        // то скорость = 1.0 (как рукой), даже если у кирки efficiency 8.0
        multiplier = 1.0;
    }

    // 3. Рассчитываем базовое время
    // Если блок ТРЕБУЕТ инструмент (камень, руда), но мы бьем неправильным (рукой или топором),
    // то время увеличивается значительно (в майне это hardness * 5, то есть 3.33x от базы)
    let baseTime = this.hardness * 1.5;

    if (this.requiresTool && !isCorrectTool) {
        // Штраф за отсутствие инструмента: время увеличивается в 3.33 раза
        // Пример: Обсидиан рукой ломается 250 секунд
        baseTime = this.hardness * 5.0; 
    }

    // 4. Итоговое время
    const time = baseTime / multiplier;

    return Math.max(0.05, time); // Минимум 50мс (1 тик игры)
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

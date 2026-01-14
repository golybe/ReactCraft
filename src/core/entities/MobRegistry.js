/**
 * MobRegistry - реестр типов мобов
 * Синглтон по аналогии с BlockRegistry
 */

// Определение типа моба
export class MobDefinition {
  constructor(config) {
    this.id = config.id;                          // Уникальный ID (например, 'zombie')
    this.name = config.name;                      // Отображаемое имя
    this.maxHealth = config.maxHealth || 20;      // Максимальное здоровье
    this.moveSpeed = config.moveSpeed || 4.3;     // Скорость передвижения (блоков/сек)
    this.attackDamage = config.attackDamage || 2; // Урон от атаки
    this.attackRange = config.attackRange || 1.5; // Дальность атаки
    this.detectionRange = config.detectionRange || 16; // Дальность обнаружения игрока
    this.width = config.width || 0.6;             // Ширина хитбокса
    this.height = config.height || 1.8;           // Высота хитбокса
    this.hostile = config.hostile !== false;      // Враждебный? (по умолчанию true)
    this.texture = config.texture || null;        // Текстура/спрайт
    this.drops = config.drops || [];              // Дроп при смерти [{type, count, chance}]
    this.xp = config.xp || 5;                     // Опыт за убийство

    // Дополнительные свойства для будущего AI
    this.canSwim = config.canSwim || false;
    this.burnInSunlight = config.burnInSunlight || false;
    this.knockbackResistance = config.knockbackResistance || 0;
  }
}

class MobRegistryClass {
  constructor() {
    this.mobs = new Map();
  }

  /**
   * Зарегистрировать новый тип моба
   * @param {MobDefinition|Object} definition - определение моба
   */
  register(definition) {
    const mobDef = definition instanceof MobDefinition
      ? definition
      : new MobDefinition(definition);

    if (this.mobs.has(mobDef.id)) {
      console.warn(`[MobRegistry] Mob '${mobDef.id}' is already registered, overwriting`);
    }

    this.mobs.set(mobDef.id, mobDef);
    return mobDef;
  }

  /**
   * Получить определение моба по ID
   * @param {string} id - ID моба
   * @returns {MobDefinition|null}
   */
  get(id) {
    return this.mobs.get(id) || null;
  }

  /**
   * Проверить существование моба
   * @param {string} id - ID моба
   * @returns {boolean}
   */
  exists(id) {
    return this.mobs.has(id);
  }

  /**
   * Получить все определения мобов
   * @returns {MobDefinition[]}
   */
  getAll() {
    return Array.from(this.mobs.values());
  }

  /**
   * Получить все ID мобов
   * @returns {string[]}
   */
  getAllIds() {
    return Array.from(this.mobs.keys());
  }

  /**
   * Получить всех враждебных мобов
   * @returns {MobDefinition[]}
   */
  getHostile() {
    return this.getAll().filter(mob => mob.hostile);
  }

  /**
   * Получить всех мирных мобов
   * @returns {MobDefinition[]}
   */
  getPassive() {
    return this.getAll().filter(mob => !mob.hostile);
  }

  /**
   * Количество зарегистрированных мобов
   * @returns {number}
   */
  count() {
    return this.mobs.size;
  }

  /**
   * Очистить реестр
   */
  clear() {
    this.mobs.clear();
  }
}

// Экспортируем синглтон
export const MobRegistry = new MobRegistryClass();

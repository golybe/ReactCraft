/**
 * MobRegistry - регистрация мобов (аналог Minecraft EntityRenderers)
 * 
 * Централизованное место для регистрации всех типов мобов.
 * Позволяет легко добавлять новых мобов без изменения основного кода.
 * 
 * Поддерживает два формата регистрации:
 * 1. register({ id: 'sheep', name: 'Sheep', ... }) - старый формат
 * 2. register('sheep', { ModelClass, ... }) - новый формат с моделью
 * 
 * @example
 * // Старый формат (для параметров моба):
 * MobRegistry.register({
 *   id: 'cow',
 *   name: 'Cow',
 *   maxHealth: 10,
 *   ...
 * });
 * 
 * // Новый формат (для модели рендеринга):
 * MobRegistry.registerModel('cow', {
 *   ModelClass: CowModel,
 *   defaultColor: 0x8b4513,
 * });
 * 
 * // Получение данных:
 * const mobDef = MobRegistry.get('sheep');      // Параметры моба
 * const model = MobRegistry.getModel('sheep');  // Модель рендеринга
 */
import { SheepModel } from './models/SheepModel';

// Реестр параметров мобов (старый формат)
const mobDefinitions = new Map();

// Реестр моделей рендеринга (новый формат)
const modelRegistry = new Map();

// Кэш экземпляров моделей (singleton pattern)
const modelInstances = new Map();

/**
 * Конфигурация модели по умолчанию
 */
const defaultModelConfig = {
  ModelClass: null,
  RendererComponent: null,
  defaultColor: 0xff00ff, // Magenta для незарегистрированных
  texturePath: null,
};

/**
 * Регистрация моделей рендеринга встроенных мобов
 */
function registerBuiltinModels() {
  // Овца - модель рендеринга
  MobRegistry.registerModel('sheep', {
    ModelClass: SheepModel,
    defaultColor: 0xf5f5dc,
    texturePath: '/textures/entity/sheep.png',
  });

  // TODO: Добавить модели других мобов
  // MobRegistry.registerModel('cow', { ModelClass: CowModel, ... });
}

/**
 * Регистр мобов
 */
export const MobRegistry = {
  /**
   * Регистрирует параметры моба (старый формат)
   * @param {Object} definition - Определение моба с полем id
   */
  register(definition) {
    if (typeof definition === 'object' && definition.id) {
      mobDefinitions.set(definition.id, definition);
    } else {
      console.warn('[MobRegistry] Invalid definition format:', definition);
    }
  },

  /**
   * Регистрирует модель рендеринга моба (новый формат)
   * @param {string} mobType - Тип моба
   * @param {Object} config - Конфигурация модели
   */
  registerModel(mobType, config) {
    modelRegistry.set(mobType, { ...defaultModelConfig, ...config });
  },

  /**
   * Проверяет, зарегистрирован ли моб (параметры)
   * @deprecated Используйте has() вместо exists()
   */
  exists(mobType) {
    return mobDefinitions.has(mobType);
  },

  /**
   * Проверяет, зарегистрирован ли моб (параметры)
   */
  has(mobType) {
    return mobDefinitions.has(mobType);
  },

  /**
   * Проверяет, есть ли модель рендеринга для моба
   */
  hasModel(mobType) {
    return modelRegistry.has(mobType);
  },

  /**
   * Получает параметры моба (старый формат)
   * @param {string} mobType - Тип моба
   * @returns {Object|undefined} Определение моба
   */
  get(mobType) {
    return mobDefinitions.get(mobType);
  },

  /**
   * Получает конфигурацию модели рендеринга
   * @param {string} mobType - Тип моба
   * @returns {Object} Конфигурация модели
   */
  getModelConfig(mobType) {
    return modelRegistry.get(mobType) || defaultModelConfig;
  },

  /**
   * Получает или создаёт экземпляр модели моба (singleton)
   * @param {string} mobType - Тип моба
   * @returns {MobModel|null} Экземпляр модели или null
   */
  getModel(mobType) {
    // Возвращаем кэшированный экземпляр если есть
    if (modelInstances.has(mobType)) {
      return modelInstances.get(mobType);
    }

    // Создаём новый экземпляр
    const config = this.getModelConfig(mobType);
    if (config.ModelClass) {
      const model = new config.ModelClass();
      modelInstances.set(mobType, model);
      return model;
    }

    return null;
  },

  /**
   * Получает цвет по умолчанию для моба
   */
  getDefaultColor(mobType) {
    // Сначала проверяем модель рендеринга
    const modelConfig = this.getModelConfig(mobType);
    if (modelConfig.defaultColor !== 0xff00ff) {
      return modelConfig.defaultColor;
    }

    // Fallback на старые цвета
    const defaultColors = {
      zombie: 0x4a7c4a,
      skeleton: 0xd4d4d4,
      spider: 0x3d3d3d,
      creeper: 0x2d8a2d,
      pig: 0xf5b6b0,
      cow: 0x8b4513,
      sheep: 0xf5f5dc,
      chicken: 0xffffff,
    };
    return defaultColors[mobType] || 0xff00ff;
  },

  /**
   * Получает список всех зарегистрированных типов мобов
   */
  getAllTypes() {
    return Array.from(mobDefinitions.keys());
  },

  /**
   * Получает список мобов с моделями рендеринга
   */
  getTypesWithModels() {
    return Array.from(modelRegistry.keys());
  },

  /**
   * Очищает кэш моделей (для hot reload)
   */
  clearCache() {
    modelInstances.forEach(model => model.dispose?.());
    modelInstances.clear();
  },

  /**
   * Удаляет регистрацию моба
   */
  unregister(mobType) {
    if (modelInstances.has(mobType)) {
      modelInstances.get(mobType).dispose?.();
      modelInstances.delete(mobType);
    }
    mobDefinitions.delete(mobType);
    modelRegistry.delete(mobType);
  },
};

// Регистрируем модели рендеринга при загрузке модуля
registerBuiltinModels();

export default MobRegistry;

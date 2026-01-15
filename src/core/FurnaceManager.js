/**
 * FurnaceManager - глобальный менеджер состояния печек
 * Хранит информацию о горящих печках для рендеринга и освещения
 * Интегрируется с LightingManager для динамического освещения
 * Выполняет логику плавки глобально (даже когда UI закрыт)
 */

import { SMELTING_RECIPES, FUEL_VALUES } from '../constants/recipes';

// Уровень света от горящей печки (как в Minecraft - 13)
const FURNACE_LIGHT_LEVEL = 13;

// Время плавки по умолчанию (в мс)
const DEFAULT_SMELT_TIME = 10000;

// Получить рецепт плавки
const getSmeltingRecipe = (inputType) => {
  return SMELTING_RECIPES.find(r => r.input === inputType) || null;
};

// Получить время горения топлива
const getFuelBurnTime = (fuelType) => {
  return FUEL_VALUES[fuelType] || 0;
};

class FurnaceManagerClass {
  constructor() {
    // Map: "x,y,z" -> FurnaceState
    // FurnaceState: { 
    //   position: {x,y,z}, 
    //   inputSlot: {type, count} | null,
    //   fuelSlot: {type, count} | null,
    //   outputSlot: {type, count} | null,
    //   burnTime: number, 
    //   maxBurnTime: number,
    //   smeltProgress: number,
    //   currentRecipe: object | null
    // }
    this.furnaces = new Map();
    this.listeners = new Set();
    this.version = 0; // Для триггера React re-renders

    // Callback для обновления освещения в LightingManager
    this.lightingCallback = null;
    // Callback для пересчёта мешей чанков
    this.chunkUpdateCallback = null;

    // Глобальный update loop
    this.updateInterval = null;
    this.startUpdateLoop();
  }

  /**
   * Запустить глобальный update loop для плавки
   */
  startUpdateLoop() {
    if (this.updateInterval) return;

    this.updateInterval = setInterval(() => {
      this.updateAllFurnaces();
    }, 100); // Обновление каждые 100мс
  }

  /**
   * Остановить update loop
   */
  stopUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Обновить все печки (логика плавки)
   */
  updateAllFurnaces() {
    let hasChanges = false;

    for (const [key, furnace] of this.furnaces.entries()) {
      const changed = this.updateFurnace(key, furnace);
      if (changed) hasChanges = true;
    }

    if (hasChanges) {
      this.version++;
      this.notifyListeners();
    }
  }

  /**
   * Обновить одну печку
   */
  updateFurnace(key, furnace) {
    let changed = false;
    const wasBurning = furnace.burnTime > 0;

    // Проверяем рецепт для текущего входного предмета
    const inputType = furnace.inputSlot?.type;
    const recipe = inputType ? getSmeltingRecipe(inputType) : null;

    if (furnace.currentRecipe !== recipe) {
      furnace.currentRecipe = recipe;
      changed = true;
    }

    // Уменьшаем время горения если есть
    if (furnace.burnTime > 0) {
      furnace.burnTime = Math.max(0, furnace.burnTime - 100);
      changed = true;
    }

    // Если топливо только что закончилось (burnTime стало 0) - сразу пытаемся взять новое
    // Это предотвращает моргание света
    if (furnace.burnTime === 0 && furnace.fuelSlot && recipe && furnace.inputSlot) {
      const fuelTime = getFuelBurnTime(furnace.fuelSlot.type);

      if (fuelTime > 0) {
        // Проверяем, можно ли положить результат
        const canOutput = !furnace.outputSlot ||
          (furnace.outputSlot.type === recipe.output.type &&
            furnace.outputSlot.count < 64);

        if (canOutput) {
          // Зажигаем топливо
          furnace.burnTime = fuelTime;
          furnace.maxBurnTime = fuelTime;

          // Забираем 1 топливо
          if (furnace.fuelSlot.count > 1) {
            furnace.fuelSlot = {
              type: furnace.fuelSlot.type,
              count: furnace.fuelSlot.count - 1
            };
          } else {
            furnace.fuelSlot = null;
          }

          changed = true;
        }
      }
    }

    // Прогресс плавки (только если топливо горит)
    if (furnace.burnTime > 0 && recipe && furnace.inputSlot && furnace.inputSlot.count > 0) {
      // Проверяем, можно ли положить результат в выходной слот
      const canOutput = !furnace.outputSlot ||
        (furnace.outputSlot.type === recipe.output.type &&
          furnace.outputSlot.count < 64);

      if (canOutput) {
        // Прогресс плавки
        furnace.smeltProgress += 100;

        if (furnace.smeltProgress >= (recipe.time || DEFAULT_SMELT_TIME)) {
          // Плавка завершена!
          // Забираем 1 предмет из входа
          if (furnace.inputSlot.count > 1) {
            furnace.inputSlot = {
              type: furnace.inputSlot.type,
              count: furnace.inputSlot.count - 1
            };
          } else {
            furnace.inputSlot = null;
          }

          // Добавляем результат в выход
          if (furnace.outputSlot) {
            furnace.outputSlot = {
              type: furnace.outputSlot.type,
              count: furnace.outputSlot.count + (recipe.output.count || 1)
            };
          } else {
            furnace.outputSlot = {
              type: recipe.output.type,
              count: recipe.output.count || 1
            };
          }

          furnace.smeltProgress = 0;
        }
        changed = true;
      }
    } else {
      // Нет рецепта или входа - сбрасываем прогресс
      if (furnace.smeltProgress > 0 && furnace.burnTime === 0) {
        furnace.smeltProgress = Math.max(0, furnace.smeltProgress - 50);
        changed = true;
      }
    }

    // Обновляем освещение если состояние горения изменилось
    // Проверяем ПОСЛЕ попытки взять новое топливо, чтобы избежать моргания
    const isBurning = furnace.burnTime > 0;
    if (wasBurning !== isBurning) {
      this.updateLighting(furnace.position, isBurning);
    }

    return changed;
  }

  /**
   * Обновить освещение для печки
   */
  updateLighting(position, isBurning) {
    if (this.lightingCallback) {
      const affectedChunks = this.lightingCallback(
        position.x, position.y, position.z,
        FURNACE_LIGHT_LEVEL,
        isBurning
      );

      if (this.chunkUpdateCallback && affectedChunks && affectedChunks.size > 0) {
        this.chunkUpdateCallback(affectedChunks);
      }
    }
  }

  /**
   * Установить callback для обновления освещения
   */
  setLightingCallback(callback) {
    this.lightingCallback = callback;
  }

  /**
   * Установить callback для пересчёта чанков
   */
  setChunkUpdateCallback(callback) {
    this.chunkUpdateCallback = callback;
  }

  /**
   * Получить ключ позиции
   */
  getKey(x, y, z) {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
  }

  /**
   * Получить состояние печки БЕЗ создания новой (возвращает null если не существует)
   */
  getExistingFurnaceState(x, y, z) {
    const key = this.getKey(x, y, z);
    return this.furnaces.get(key) || null;
  }

  /**
   * Получить или создать состояние печки
   */
  getFurnaceState(x, y, z) {
    const key = this.getKey(x, y, z);
    let furnace = this.furnaces.get(key);

    if (!furnace) {
      furnace = {
        position: { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) },
        inputSlot: null,
        fuelSlot: null,
        outputSlot: null,
        burnTime: 0,
        maxBurnTime: 0,
        smeltProgress: 0,
        currentRecipe: null
      };
      this.furnaces.set(key, furnace);
    }

    return furnace;
  }

  /**
   * Обновить данные печки (из UI)
   */
  updateFurnaceData(x, y, z, data) {
    const furnace = this.getFurnaceState(x, y, z);

    if (data.inputSlot !== undefined) furnace.inputSlot = data.inputSlot;
    if (data.fuelSlot !== undefined) furnace.fuelSlot = data.fuelSlot;
    if (data.outputSlot !== undefined) furnace.outputSlot = data.outputSlot;
    if (data.burnTime !== undefined) furnace.burnTime = data.burnTime;
    if (data.maxBurnTime !== undefined) furnace.maxBurnTime = data.maxBurnTime;
    if (data.smeltProgress !== undefined) furnace.smeltProgress = data.smeltProgress;

    this.version++;
    this.notifyListeners();
  }

  /**
   * Проверить, горит ли печка
   */
  isBurning(x, y, z) {
    const key = this.getKey(x, y, z);
    const furnace = this.furnaces.get(key);
    return furnace ? furnace.burnTime > 0 : false;
  }

  /**
   * Получить все горящие печки (для рендеринга текстуры)
   */
  getBurningFurnaces() {
    return Array.from(this.furnaces.values()).filter(f => f.burnTime > 0);
  }

  /**
   * Получить версию для React
   */
  getVersion() {
    return this.version;
  }

  /**
   * Подписаться на изменения
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Уведомить подписчиков
   */
  notifyListeners() {
    this.listeners.forEach(cb => cb(this.version));
  }

  /**
   * Удалить печку (когда блок сломан)
   */
  removeFurnace(x, y, z) {
    const key = this.getKey(x, y, z);
    const furnace = this.furnaces.get(key);

    if (furnace && furnace.burnTime > 0) {
      this.updateLighting(furnace.position, false);
    }

    this.furnaces.delete(key);
    this.version++;
    this.notifyListeners();
  }

  /**
   * Очистить все состояния
   */
  clear() {
    // Убираем освещение от всех печек
    for (const furnace of this.furnaces.values()) {
      if (furnace.burnTime > 0) {
        this.updateLighting(furnace.position, false);
      }
    }

    this.furnaces.clear();
    this.version++;
    this.notifyListeners();
  }
}

// Singleton
export const FurnaceManager = new FurnaceManagerClass();
export default FurnaceManager;

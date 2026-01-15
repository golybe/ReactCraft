/**
 * FurnaceManager - глобальный менеджер состояния печек
 * Хранит информацию о горящих печках для рендеринга и освещения
 */

class FurnaceManagerClass {
  constructor() {
    // Map: "x,y,z" -> { burning: boolean, burnTime: number, position: {x,y,z} }
    this.furnaces = new Map();
    this.listeners = new Set();
    this.version = 0; // Для триггера React re-renders
  }

  /**
   * Получить ключ позиции
   */
  getKey(x, y, z) {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
  }

  /**
   * Установить состояние печки
   */
  setFurnaceState(x, y, z, burning, burnTime = 0) {
    const key = this.getKey(x, y, z);
    const wasBurning = this.furnaces.get(key)?.burning || false;

    if (burning) {
      this.furnaces.set(key, {
        burning,
        burnTime,
        position: { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) }
      });
    } else {
      this.furnaces.delete(key);
    }

    // Уведомляем только если состояние изменилось
    if (wasBurning !== burning) {
      this.version++;
      this.notifyListeners();
    }
  }

  /**
   * Проверить, горит ли печка
   */
  isBurning(x, y, z) {
    const key = this.getKey(x, y, z);
    return this.furnaces.get(key)?.burning || false;
  }

  /**
   * Получить все горящие печки
   */
  getBurningFurnaces() {
    return Array.from(this.furnaces.values()).filter(f => f.burning);
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
   * Очистить все состояния
   */
  clear() {
    this.furnaces.clear();
    this.version++;
    this.notifyListeners();
  }
}

// Singleton
export const FurnaceManager = new FurnaceManagerClass();
export default FurnaceManager;

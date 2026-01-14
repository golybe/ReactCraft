import { BLOCK_TYPES } from '../../constants/blocks';
import { BlockRegistry } from '../blocks/BlockRegistry';

/**
 * Симулятор осыпания листвы
 * Листва постепенно разрушается если нет рядом блоков дерева
 */
export class LeafDecaySimulator {
  constructor(chunkManager) {
    this.chunkManager = chunkManager;
    this.decayingLeaves = new Map(); // key -> { x, y, z, timer }
    this.CHECK_RADIUS = 6; // Радиус поиска древесины (как в Minecraft - 6 блоков)
    this.DECAY_TIME = 1.5; // Время до осыпания в секундах (1.5 секунды - быстрее)
    this.lastUpdateTime = performance.now();
  }

  /**
   * Добавить листву для проверки на осыпание
   */
  checkLeaf(x, y, z) {
    const blockId = this.chunkManager.getBlock(x, y, z);
    if (blockId !== BLOCK_TYPES.LEAVES) return;

    const key = `${x},${y},${z}`;
    
    // Проверяем, есть ли рядом дерево
    if (this.hasNearbyWood(x, y, z)) {
      // Есть дерево - убираем из очереди на осыпание
      this.decayingLeaves.delete(key);
    } else {
      // Нет дерева - добавляем в очередь если еще не добавлен
      if (!this.decayingLeaves.has(key)) {
        // Случайная задержка от 0 до 1 секунды для естественности
        const randomDelay = Math.random();
        this.decayingLeaves.set(key, {
          x, y, z,
          timer: randomDelay
        });
      }
    }
  }

  /**
   * Проверить наличие древесины рядом с листвой
   * Использует Manhattan distance (как в Minecraft)
   */
  hasNearbyWood(x, y, z) {
    const radius = this.CHECK_RADIUS;
    
    // Простая проверка в кубе вокруг листа
    // Это быстрее и правильнее чем BFS
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          // Проверяем Manhattan distance (как в Minecraft)
          const manhattanDist = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
          if (manhattanDist > radius) continue;
          
          const checkX = x + dx;
          const checkY = y + dy;
          const checkZ = z + dz;
          
          const blockId = this.chunkManager.getBlock(checkX, checkY, checkZ);
          
          // Нашли дерево!
          if (blockId === BLOCK_TYPES.WOOD) {
            return true;
          }
        }
      }
    }
    
    return false; // Дерево не найдено
  }

  /**
   * Добавить соседние листья для проверки
   */
  addNeighboringLeaves(x, y, z) {
    // Проверяем в большом радиусе (листва может быть далеко)
    // Используем радиус 7 чтобы покрыть все листья которые были на расстоянии 6 от дерева
    const radius = 7;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;
          
          const blockId = this.chunkManager.getBlock(nx, ny, nz);
          if (blockId === BLOCK_TYPES.LEAVES) {
            this.checkLeaf(nx, ny, nz);
          }
        }
      }
    }
  }

  /**
   * Обновление симулятора (вызывается каждый кадр)
   */
  update() {
    if (this.decayingLeaves.size === 0) return false;

    const now = performance.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000; // в секундах
    this.lastUpdateTime = now;

    const toDecay = [];
    
    // Обновляем таймеры
    for (const [key, data] of this.decayingLeaves) {
      data.timer += deltaTime;
      
      // Если время вышло, добавляем в список на осыпание
      if (data.timer >= this.DECAY_TIME) {
        toDecay.push({ key, ...data });
      }
    }

    // Осыпаем листву
    let hasChanges = false;
    for (const { key, x, y, z } of toDecay) {
      const blockId = this.chunkManager.getBlock(x, y, z);
      
      // Проверяем что блок все еще листва
      if (blockId === BLOCK_TYPES.LEAVES) {
        // Удаляем блок (он автоматически дропнет яблоко с шансом 5%)
        this.chunkManager.setBlock(x, y, z, BLOCK_TYPES.AIR, 0);
        hasChanges = true;
      }
      
      // Убираем из очереди
      this.decayingLeaves.delete(key);
    }

    return hasChanges;
  }

  /**
   * Оповещение об удалении блока дерева
   */
  onWoodRemoved(x, y, z) {
    // Когда дерево срублено, проверяем все соседние листья
    this.addNeighboringLeaves(x, y, z);
  }

  /**
   * Очистить все данные
   */
  clear() {
    this.decayingLeaves.clear();
  }
}

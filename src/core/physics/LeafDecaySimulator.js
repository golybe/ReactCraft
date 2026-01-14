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
    this.CHECK_RADIUS = 5; // Радиус поиска древесины (как в Minecraft)
    this.DECAY_TIME = 2.0; // Время до осыпания в секундах (2 секунды)
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
   */
  hasNearbyWood(x, y, z) {
    const radius = this.CHECK_RADIUS;
    
    // BFS поиск древесины в радиусе
    const queue = [[x, y, z, 0]]; // [x, y, z, distance]
    const visited = new Set([`${x},${y},${z}`]);
    
    while (queue.length > 0) {
      const [cx, cy, cz, dist] = queue.shift();
      
      // Если вышли за радиус, пропускаем
      if (dist > radius) continue;
      
      const blockId = this.chunkManager.getBlock(cx, cy, cz);
      
      // Нашли дерево!
      if (blockId === BLOCK_TYPES.WOOD) {
        return true;
      }
      
      // Продолжаем поиск только через листву и воздух
      if (blockId === BLOCK_TYPES.LEAVES || blockId === BLOCK_TYPES.AIR) {
        // Проверяем соседние блоки (6 направлений)
        const neighbors = [
          [cx + 1, cy, cz],
          [cx - 1, cy, cz],
          [cx, cy + 1, cz],
          [cx, cy - 1, cz],
          [cx, cy, cz + 1],
          [cx, cy, cz - 1]
        ];
        
        for (const [nx, ny, nz] of neighbors) {
          const nKey = `${nx},${ny},${nz}`;
          if (!visited.has(nKey)) {
            visited.add(nKey);
            queue.push([nx, ny, nz, dist + 1]);
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
    const radius = this.CHECK_RADIUS + 1;
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

import { BLOCK_TYPES } from '../../constants/blocks';
import { BlockRegistry } from '../blocks/BlockRegistry';

/**
 * Симулятор осыпания листвы (Optimized BFS version)
 * Реализует цепную реакцию разрушения как в Minecraft
 */
export class LeafDecaySimulator {
  constructor(chunkManager) {
    this.chunkManager = chunkManager;
    
    // Очередь листьев, которые нужно проверить "на прочность"
    // Используем Set, чтобы не дублировать проверки одних и тех же координат
    this.checkQueue = new Set(); 
    
    // Листья, которые уже обречены и ждут таймера
    this.decayingLeaves = new Map(); // key -> { x, y, z, timer }
    
    this.CHECK_RADIUS = 6; // Максимальная длина ветки
    this.DECAY_TIME_MIN = 0.5;
    this.DECAY_TIME_MAX = 2.0;
    
    // Ограничение: сколько тяжелых проверок (BFS) делать за один кадр.
    // Это спасет от лагов при рубке огромных джунглей.
    this.MAX_CHECKS_PER_FRAME = 50; 
    
    this.lastUpdateTime = performance.now();
  }

  /**
   * Добавить блок в очередь на проверку связности
   */
  scheduleCheck(x, y, z) {
    const key = `${x},${y},${z}`;
    // Если уже в процессе разрушения или уже в очереди - пропускаем
    if (this.decayingLeaves.has(key) || this.checkQueue.has(key)) return;
    
    this.checkQueue.add(key);
  }

  /**
   * Обновление симулятора (вызывается каждый кадр)
   */
  update() {
    const now = performance.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;
    let hasChanges = false;

    // 1. Обрабатываем очередь проверок (Heavy Logic)
    // Делаем это порционно, чтобы не фризить игру
    let checksCount = 0;
    for (const key of this.checkQueue) {
      if (checksCount >= this.MAX_CHECKS_PER_FRAME) break; // Хватит на этот кадр

      const [sx, sy, sz] = key.split(',').map(Number);
      this.checkQueue.delete(key);
      
      const blockId = this.chunkManager.getBlock(sx, sy, sz);
      
      // Если это всё еще листва - проверяем её
      if (blockId === BLOCK_TYPES.LEAVES) {
        const connected = this.isConnectedToWood(sx, sy, sz);
        
        if (!connected) {
           // Дерева нет - добавляем в список на уничтожение
           const randomDelay = this.DECAY_TIME_MIN + Math.random() * (this.DECAY_TIME_MAX - this.DECAY_TIME_MIN);
           this.decayingLeaves.set(key, { x: sx, y: sy, z: sz, timer: randomDelay });
        }
      }
      
      checksCount++;
    }

    // 2. Обрабатываем таймеры разрушения (Light Logic)
    const toDecay = [];
    for (const [key, data] of this.decayingLeaves) {
      data.timer -= deltaTime;
      if (data.timer <= 0) {
        toDecay.push(data);
        this.decayingLeaves.delete(key);
      }
    }

    // 3. Удаляем блоки и запускаем цепную реакцию
    for (const { x, y, z } of toDecay) {
      const blockId = this.chunkManager.getBlock(x, y, z);
      
      if (blockId === BLOCK_TYPES.LEAVES) {
        this.chunkManager.setBlock(x, y, z, BLOCK_TYPES.AIR);
        hasChanges = true;

        // Самое важное: когда лист пропадает, соседние листья должны проверить себя!
        // Это создает эффект "волны"
        this.notifyNeighbors(x, y, z);
      }
    }

    return hasChanges;
  }

  /**
   * BFS (Поиск в ширину)
   * Ищет путь к ближайшему дереву через другие листья.
   * Возвращает true, если дерево найдено в радиусе CHECK_RADIUS.
   */
  isConnectedToWood(startX, startY, startZ) {
    // Очередь для BFS: [x, y, z, distance]
    const queue = [[startX, startY, startZ, 0]];
    // Посещенные координаты, чтобы не ходить кругами (локальный Set для одной проверки)
    const visited = new Set([`${startX},${startY},${startZ}`]);

    let head = 0;
    while (head < queue.length) {
      const [cx, cy, cz, dist] = queue[head++];

      // Если превысили радиус - дальше нет смысла искать
      if (dist >= this.CHECK_RADIUS) continue;

      // Проверяем 6 соседей
      const neighbors = [
        [cx + 1, cy, cz], [cx - 1, cy, cz],
        [cx, cy + 1, cz], [cx, cy - 1, cz],
        [cx, cy, cz + 1], [cx, cy, cz - 1]
      ];

      for (const [nx, ny, nz] of neighbors) {
        const nKey = `${nx},${ny},${nz}`;
        if (visited.has(nKey)) continue;

        const block = this.chunkManager.getBlock(nx, ny, nz);

        // УРА! Нашли дерево. Лист спасен.
        if (block === BLOCK_TYPES.WOOD) return true;

        // Если это другой лист - идем через него дальше
        if (block === BLOCK_TYPES.LEAVES) {
          visited.add(nKey);
          queue.push([nx, ny, nz, dist + 1]);
        }
      }
    }

    // Путь не найден
    return false;
  }

  /**
   * Добавляет всех соседей (6 сторон) в очередь на проверку
   */
  notifyNeighbors(x, y, z) {
    const neighbors = [
      [x + 1, y, z], [x - 1, y, z],
      [x, y + 1, z], [x, y - 1, z],
      [x, y, z + 1], [x, y, z - 1]
    ];

    for (const [nx, ny, nz] of neighbors) {
      const blockId = this.chunkManager.getBlock(nx, ny, nz);
      if (blockId === BLOCK_TYPES.LEAVES) {
        this.scheduleCheck(nx, ny, nz);
      }
    }
  }

  /**
   * Внешний метод: вызывается игрой при разрушении любого блока
   */
  onBlockRemoved(x, y, z, oldBlockType) {
    // Если сломали дерево или листву - соседи должны напрячься
    if (oldBlockType === BLOCK_TYPES.WOOD || oldBlockType === BLOCK_TYPES.LEAVES) {
      this.notifyNeighbors(x, y, z);
    }
  }

  /**
   * Совместимость со старым методом (если где-то вызывается)
   */
  onWoodRemoved(x, y, z) {
    this.notifyNeighbors(x, y, z);
  }

  clear() {
    this.decayingLeaves.clear();
    this.checkQueue.clear();
  }
}


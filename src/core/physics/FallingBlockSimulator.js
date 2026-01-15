    import { BLOCK_TYPES, getBlockProperties } from '../../constants/blocks';
import { FallingBlock } from '../entities/FallingBlock';

/**
 * FallingBlockSimulator - симулятор гравитации для блоков (песок, гравий)
 */
export class FallingBlockSimulator {
  constructor(world) {
    this.world = world;
    this.chunkManager = world.getChunkManager();
    this.checkQueue = new Set();
  }

  /**
   * Вызывается при обновлении блока в мире
   */
  onBlockUpdate(x, y, z) {
    // Проверяем сам блок (если поставили песок в воздух)
    this.scheduleCheck(x, y, z);
    // И блок над текущим (если сломали опору под песком)
    this.scheduleCheck(x, y + 1, z);
  }

  /**
   * Добавить координаты в очередь на проверку
   */
  scheduleCheck(x, y, z) {
    if (y < 0 || y >= 256) return;
    this.checkQueue.add(`${x},${y},${z}`);
  }

  /**
   * Обновление симулятора
   */
  update(entityManager) {
    if (this.checkQueue.size === 0) return false;

    const toCheck = Array.from(this.checkQueue);
    this.checkQueue.clear();
    let hasChanges = false;

    for (const key of toCheck) {
      const [x, y, z] = key.split(',').map(Number);
      const blockId = this.chunkManager.getBlock(x, y, z);
      
      if (blockId === BLOCK_TYPES.AIR) continue;

      const props = getBlockProperties(blockId);
      if (props && props.gravity) {
        // Проверяем блок под ним
        const blockBelow = this.chunkManager.getBlock(x, y - 1, z);
        const propsBelow = getBlockProperties(blockBelow);

        // Если под блоком воздух или не-солид блок (например, вода)
        if (blockBelow === BLOCK_TYPES.AIR || (propsBelow && !propsBelow.solid)) {
          // Начинаем падение!
          this.startFalling(x, y, z, blockId, entityManager);
          hasChanges = true;
        }
      }
    }

    return hasChanges;
  }

  /**
   * Превратить блок в падающую сущность
   */
  startFalling(x, y, z, blockId, entityManager) {
    if (!entityManager) return;

    // Получаем метаданные перед удалением
    const metadata = this.chunkManager.getMetadata(x, y, z);

    // 1. Удаляем блок из мира
    this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);

    // 2. Создаем сущность
    const entity = new FallingBlock(x + 0.5, y, z + 0.5, blockId, metadata);
    entityManager.spawn(entity);

    // 3. Проверяем блок НАД этим, вдруг там тоже песок
    this.scheduleCheck(x, y + 1, z);
  }
}

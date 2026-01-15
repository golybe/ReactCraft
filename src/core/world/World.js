/**
 * World - класс мира, обертка над ChunkManager
 * Предоставляет высокоуровневый API для работы с миром
 */
import { ChunkManager } from '../../utils/chunkManager';
import { LiquidSimulator } from '../physics/LiquidSimulator';
import { LeafDecaySimulator } from '../physics/LeafDecaySimulator';
import { FallingBlockSimulator } from '../physics/FallingBlockSimulator';
import { FurnaceManager } from '../FurnaceManager';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants/world';
import { BLOCK_TYPES } from '../../constants/blocks';

export class World {
  constructor(seed, savedChunks = {}) {
    this.seed = seed;
    this.chunkManager = new ChunkManager(seed, savedChunks);
    this.liquidSimulator = new LiquidSimulator(this.chunkManager);
    this.leafDecaySimulator = new LeafDecaySimulator(this.chunkManager);
    this.fallingBlockSimulator = new FallingBlockSimulator(this);

    // Устанавливаем callback для обработки дропов листвы
    // Этот callback должен быть установлен извне через setLeafDecayCallback
    this.leafDecayCallback = null;

    // Callback для оповещения об обновлениях
    this.onChunksUpdate = null;
    this.onStateChange = null;
    this.needsUpdate = false; // Флаг для отслеживания изменений между кадрами

    // Настраиваем FurnaceManager для работы с освещением
    this.setupFurnaceLighting();
  }

  /**
   * Настраиваем FurnaceManager для работы с системой освещения
   */
  setupFurnaceLighting() {
    // Callback для добавления/удаления источника света печки
    FurnaceManager.setLightingCallback((worldX, worldY, worldZ, lightLevel, isAdding) => {
      const lightingManager = this.chunkManager.lightingManager;

      if (isAdding) {
        // Добавляем источник света
        return lightingManager.addLightSource(worldX, worldY, worldZ, lightLevel);
      } else {
        // Удаляем источник света
        return lightingManager.removeLightSource(worldX, worldY, worldZ, lightLevel);
      }
    });

    // Callback для пересчёта мешей затронутых чанков
    FurnaceManager.setChunkUpdateCallback((affectedChunks) => {
      // Клонируем затронутые чанки, чтобы React увидел изменения
      for (const chunkKey of affectedChunks) {
        if (this.chunkManager.chunks[chunkKey]) {
          this.chunkManager.chunks[chunkKey] = this.chunkManager.chunks[chunkKey].clone();
          this.chunkManager.modifiedChunkKeys.add(chunkKey);
        }
      }

      // Уведомляем об изменениях
      this.needsUpdate = true;
      this.chunkManager.notifyUpdateImmediate();
    });
  }

  /**
   * Получить блок в мировых координатах
   */
  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK_TYPES.AIR;
    return this.chunkManager.getBlock(x, y, z);
  }

  /**
   * Получить метаданные блока в мировых координатах
   */
  getMetadata(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    return this.chunkManager.getMetadata(x, y, z);
  }

  /**
   * Установить блок в мировых координатах
   */
  setBlock(x, y, z, blockType, metadata = 0) {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;

    const oldBlockType = this.chunkManager.getBlock(x, y, z);
    const success = this.chunkManager.setBlock(x, y, z, blockType, metadata);

    if (success) {
      this.needsUpdate = true;
      // Уведомляем симулятор жидкости об изменении
      this.liquidSimulator?.onBlockUpdate(x, y, z);

      // Уведомляем симулятор падающих блоков
      this.fallingBlockSimulator?.onBlockUpdate(x, y, z);

      // Уведомляем симулятор листвы об удалении блока (новая оптимизированная версия)
      if (oldBlockType !== BLOCK_TYPES.AIR && blockType === BLOCK_TYPES.AIR) {
        this.leafDecaySimulator?.onBlockRemoved(x, y, z, oldBlockType);

        // Удаляем печку из FurnaceManager если разрушен блок печки
        if (oldBlockType === BLOCK_TYPES.FURNACE) {
          FurnaceManager.removeFurnace(x, y, z);
        }
      }

      // Уведомляем об изменении состояния
      if (this.onStateChange) {
        this.onStateChange();
      }
    }

    return success;
  }

  /**
   * Получить уровень освещения в точке
   */
  getLightLevel(x, y, z) {
    return this.chunkManager.getLightLevel(x, y, z);
  }

  /**
   * Получить биом в точке
   */
  getBiome(x, z) {
    return this.chunkManager.getBiome(x, z);
  }

  /**
   * Обновить чанки вокруг позиции
   */
  update(playerPos) {
    const result = this.chunkManager.update(playerPos);

    // Если были изменения, уведомляем
    if (result.hasChanges && this.onChunksUpdate) {
      this.onChunksUpdate({ ...this.chunkManager.chunks });
    }

    return result;
  }

  /**
   * Обновить физику (жидкости, листва, падающие блоки)
   */
  updatePhysics(entityManager = null) {
    let hasChanges = false;

    // Обновляем жидкости
    if (this.liquidSimulator) {
      const liquidChanges = this.liquidSimulator.update();
      hasChanges = hasChanges || liquidChanges;
    }

    // Обновляем осыпание листвы
    if (this.leafDecaySimulator) {
      const leafChanges = this.leafDecaySimulator.update();
      hasChanges = hasChanges || leafChanges;
    }

    // Обновляем падающие блоки
    if (this.fallingBlockSimulator && entityManager) {
      const fallingChanges = this.fallingBlockSimulator.update(entityManager);
      hasChanges = hasChanges || fallingChanges;
    }

    // Уведомляем об изменениях
    const finalHasChanges = hasChanges || this.needsUpdate;
    if (finalHasChanges && this.onChunksUpdate) {
      this.onChunksUpdate({ ...this.chunkManager.chunks });
      this.needsUpdate = false;
    }

    return finalHasChanges;
  }

  /**
   * Загрузить чанки вокруг позиции (радиус в чанках)
   */
  loadChunksAround(position, radius = 5) {
    // ChunkManager сам управляет загрузкой через update
    // Этот метод для будущего расширения
    return this.update(position);
  }

  /**
   * Выгрузить далекие чанки
   */
  unloadDistantChunks(position, radius = 5) {
    // ChunkManager сам управляет выгрузкой через update
    // Этот метод для будущего расширения
    return this.update(position);
  }

  /**
   * Получить все активные чанки
   */
  getChunks() {
    return this.chunkManager.chunks;
  }

  /**
   * Получить карты освещения
   */
  getLightMaps() {
    return this.chunkManager.lightingManager.lightMaps;
  }

  /**
   * Получить данные для сохранения
   */
  getSaveData() {
    return this.chunkManager.getSaveData();
  }

  /**
   * Установить callback для обновления чанков
   */
  setOnChunksUpdate(callback) {
    this.onChunksUpdate = callback;
    this.chunkManager.setOnChunksUpdated(() => {
      if (this.onChunksUpdate) {
        this.onChunksUpdate({ ...this.chunkManager.chunks });
      }
    });
  }

  /**
   * Установить callback для изменения состояния
   */
  setOnStateChange(callback) {
    this.onStateChange = callback;
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    if (this.chunkManager) {
      this.chunkManager.terminate();
    }
  }

  /**
   * Получить ChunkManager (для обратной совместимости)
   */
  getChunkManager() {
    return this.chunkManager;
  }

  /**
   * Получить LiquidSimulator
   */
  getLiquidSimulator() {
    return this.liquidSimulator;
  }

  /**
   * Получить LeafDecaySimulator
   */
  getLeafDecaySimulator() {
    return this.leafDecaySimulator;
  }

  /**
   * Установить callback для обработки дропов листвы
   */
  setLeafDecayCallback(callback) {
    this.leafDecayCallback = callback;
    if (this.leafDecaySimulator) {
      this.leafDecaySimulator.onLeafDecay = callback;
    }
  }
}

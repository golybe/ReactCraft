/**
 * World - класс мира, обертка над ChunkManager
 * Предоставляет высокоуровневый API для работы с миром
 */
import { ChunkManager } from '../../utils/chunkManager';
import { LiquidSimulator } from '../physics/LiquidSimulator';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants/world';
import { BLOCK_TYPES } from '../../constants/blocks';

export class World {
  constructor(seed, savedChunks = {}) {
    this.seed = seed;
    this.chunkManager = new ChunkManager(seed, savedChunks);
    this.liquidSimulator = new LiquidSimulator(this.chunkManager);
    
    // Callback для оповещения об обновлениях
    this.onChunksUpdate = null;
    this.onStateChange = null;
  }

  /**
   * Получить блок в мировых координатах
   */
  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK_TYPES.AIR;
    return this.chunkManager.getBlock(x, y, z);
  }

  /**
   * Установить блок в мировых координатах
   */
  setBlock(x, y, z, blockType, metadata = 0) {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    
    const success = this.chunkManager.setBlock(x, y, z, blockType, metadata);
    
    if (success) {
      // Уведомляем симулятор жидкости об изменении
      this.liquidSimulator?.onBlockUpdate(x, y, z);
      
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
   * Обновить физику (жидкости)
   */
  updatePhysics() {
    if (this.liquidSimulator) {
      const hasChanges = this.liquidSimulator.update();
      if (hasChanges && this.onChunksUpdate) {
        this.onChunksUpdate({ ...this.chunkManager.chunks });
      }
      return hasChanges;
    }
    return false;
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
}

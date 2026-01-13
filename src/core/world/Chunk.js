import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants/world';
import { BLOCK_TYPES } from '../../constants/blocks';

export class Chunk {
  constructor(data) {
    // Отслеживание заполненности слоев для оптимизации рендеринга
    // 0 = слой пуст (только воздух), 1 = есть блоки
    this.layerMask = new Uint8Array(CHUNK_HEIGHT);

    // Если переданы данные - копируем их
    if (data instanceof Chunk) {
      this.data = new Uint8Array(data.data);
      this.metadata = new Uint8Array(data.metadata);
      this.layerMask = new Uint8Array(data.layerMask);
    } else if (data && data.blocks && data.metadata) {
      // Инициализация из объекта { blocks, metadata } (обычно при десериализации)
      this.data = new Uint8Array(data.blocks);
      this.metadata = new Uint8Array(data.metadata);
      this.recalculateLayers();
    } else if (data instanceof Uint8Array) {
      // Legacy support (только блоки)
      this.data = new Uint8Array(data);
      this.metadata = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
      this.recalculateLayers();
    } else {
      this.data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
      this.metadata = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
      // layerMask по умолчанию 0 (все пусто)
    }
  }

  recalculateLayers() {
    const area = CHUNK_SIZE * CHUNK_SIZE;
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      let hasBlock = 0;
      const start = y * area;
      const end = start + area;
      
      for (let i = start; i < end; i++) {
        if (this.data[i] !== BLOCK_TYPES.AIR) {
          hasBlock = 1;
          break;
        }
      }
      this.layerMask[y] = hasBlock;
    }
  }

  // Получить ID блока по координатам (локальным 0..15)
  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT || x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return BLOCK_TYPES.AIR;
    }
    const index = (y * CHUNK_SIZE * CHUNK_SIZE) + (x * CHUNK_SIZE) + z;
    return this.data[index];
  }

  // Получить метаданные блока
  getMetadata(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT || x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return 0;
    }
    const index = (y * CHUNK_SIZE * CHUNK_SIZE) + (x * CHUNK_SIZE) + z;
    return this.metadata[index];
  }

  // Установить блок
  setBlock(x, y, z, id, meta = 0) {
    if (y < 0 || y >= CHUNK_HEIGHT || x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    const index = (y * CHUNK_SIZE * CHUNK_SIZE) + (x * CHUNK_SIZE) + z;
    const oldId = this.data[index];
    const oldMeta = this.metadata[index];
    
    // Если блок и метаданные не изменились, ничего не делаем
    if (oldId === id && oldMeta === meta) return;

    this.data[index] = id;
    this.metadata[index] = meta;

    // Обновляем маску слоя
    if (id !== BLOCK_TYPES.AIR) {
      this.layerMask[y] = 1;
    } else {
      // Если удалили блок, нужно проверить, не стал ли слой пустым
      let hasBlock = 0;
      const area = CHUNK_SIZE * CHUNK_SIZE;
      const start = y * area;
      const end = start + area;
      
      for (let i = start; i < end; i++) {
        if (this.data[i] !== BLOCK_TYPES.AIR) {
          hasBlock = 1;
          break;
        }
      }
      this.layerMask[y] = hasBlock;
    }
  }

  // Установить только метаданные
  setMetadata(x, y, z, meta) {
    if (y < 0 || y >= CHUNK_HEIGHT || x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    const index = (y * CHUNK_SIZE * CHUNK_SIZE) + (x * CHUNK_SIZE) + z;
    this.metadata[index] = meta;
  }

  // Быстрая проверка на пустоту слоя
  isEmptyLayer(y) {
    return this.layerMask[y] === 0;
  }

  // Клонировать чанк (для иммутабельности в React)
  clone() {
    return new Chunk(this);
  }

  // Helper для RLE сжатия массива
  static serializeArray(array) {
    const rle = [];
    let current = array[0];
    let count = 1;
    const len = array.length;

    for (let i = 1; i < len; i++) {
      if (array[i] === current) {
        count++;
      } else {
        rle.push(count, current);
        current = array[i];
        count = 1;
      }
    }
    rle.push(count, current);
    return rle;
  }

  // Helper для десериализации RLE
  static deserializeArray(rleData, size) {
    const data = new Uint8Array(size);
    let index = 0;
    
    for (let i = 0; i < rleData.length; i += 2) {
      const count = rleData[i];
      const val = rleData[i+1];
      
      if (index + count > size) {
        break; // Overflow protection
      }

      data.fill(val, index, index + count);
      index += count;
    }
    return data;
  }

  // RLE Сжатие данных чанка для сохранения
  // Возвращает объект { blocks: [], metadata: [] }
  serialize() {
    return {
      blocks: Chunk.serializeArray(this.data),
      metadata: Chunk.serializeArray(this.metadata)
    };
  }

  // Восстановление чанка из RLE данных
  static deserialize(rleData) {
    const size = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE;
    
    // Обратная совместимость для старого формата (просто массив блоков)
    if (Array.isArray(rleData)) {
       const chunkData = Chunk.deserializeArray(rleData, size);
       // Создаем чанк, метаданные будут нулями
       return new Chunk(chunkData);
    }

    // Новый формат { blocks, metadata }
    if (rleData && rleData.blocks) {
      const blocks = Chunk.deserializeArray(rleData.blocks, size);
      const metadata = rleData.metadata ? Chunk.deserializeArray(rleData.metadata, size) : new Uint8Array(size);
      
      return new Chunk({ blocks, metadata });
    }

    return new Chunk(); // Fallback empty chunk
  }
}

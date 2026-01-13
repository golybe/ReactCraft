import { CHUNK_SIZE, CHUNK_HEIGHT, RENDER_DISTANCE } from '../constants/world';
import { BLOCK_PROPERTIES, BLOCK_TYPES } from '../constants/blocks';
import { Chunk } from '../core/world/Chunk';
import { PerformanceMetrics } from './performance';
import { getWorkerPool } from './workerPool';
import ChunkWorker from '../workers/chunkWorker.js?worker';
import { log } from './logger';

export class ChunkManager {
  constructor(seed, savedChunks = {}) {
    log('ChunkManager', `Constructor called with seed: ${seed}`);
    
    this.seed = seed;
    this.chunks = {}; // Активные загруженные чанки (объекты Chunk)
    this.lightMaps = {}; // Карты освещения для чанков (Uint8Array)
    
    // Хранилище сжатых данных (RLE) для всех измененных чанков
    this.storedChunks = savedChunks || {};
    
    // Множество ключей чанков, которые были изменены пользователем
    this.modifiedChunkKeys = new Set(Object.keys(this.storedChunks));
    
    // Batching support
    this.isBatching = false;
    this.batchModifiedKeys = new Set();
    this.batchLightingDirtyKeys = new Set();
    
    this.currentChunk = { x: null, z: null };
    
    // Worker Pool для асинхронной генерации (используем глобальный синглтон)
    log('ChunkManager', 'Getting global WorkerPool...');
    this.workerPool = getWorkerPool(ChunkWorker);
    log('ChunkManager', `WorkerPool obtained, workers: ${this.workerPool.workers.length}, ready: ${this.workerPool.isReady}`);
    
    this.pendingChunks = new Set(); // Чанки в процессе генерации
    this.pendingLighting = new Set(); // Чанки, ожидающие расчета освещения
    
    // Callback для оповещения React об обновлениях
    this.onChunksUpdated = null;
    this.updateTimeout = null;
  }

  // Оповестить слушателей (с debounce)
  notifyUpdate() {
    if (this.updateTimeout) return;
    
    this.updateTimeout = setTimeout(() => {
        if (this.onChunksUpdated) {
            this.onChunksUpdated();
        }
        this.updateTimeout = null;
    }, 100); // Обновляем UI не чаще раз в 100мс
  }

  // Начать пакетное обновление
  startBatch() {
    this.isBatching = true;
    this.batchModifiedKeys.clear();
    // НЕ очищаем batchLightingDirtyKeys — накапливаем необработанные чанки между батчами
    // this.batchLightingDirtyKeys.clear();
  }

  // Завершить пакетное обновление и применить изменения
  commitBatch() {
    this.isBatching = false;
    
    if (this.batchModifiedKeys.size === 0) return false;

    // Сначала обрабатываем освещение только для тех чанков, где это нужно
    const lightingKeys = new Set(this.batchLightingDirtyKeys);
    
    // ОПТИМИЗАЦИЯ: Ограничиваем количество чанков для пересчета света за один батч
    // Если чанков слишком много, обрабатываем только первый, остальные оставляем на следующий кадр
    const MAX_LIGHTING_CHUNKS_PER_BATCH = 1;
    const processedLightingKeys = [];
    
    let count = 0;
    for (const key of lightingKeys) {
        if (count >= MAX_LIGHTING_CHUNKS_PER_BATCH) {
            // Оставляем необработанные ключи в очереди
            break;
        }
        processedLightingKeys.push(key);
        this.batchLightingDirtyKeys.delete(key); // Удаляем только обработанные
        count++;
    }

    // 1. Пересчитываем свет (тяжелая операция) только для processed чанков
    for (const key of processedLightingKeys) {
        if (this.chunks[key]) {
            this.computeLighting(this.chunks[key], key);
        }
    }

    // 2. Обновляем соседей (освещение) только если были изменения света
    if (processedLightingKeys.length > 0) {
        // Собираем всех уникальных соседей (только для обработанных чанков)
        const neighborsToUpdate = new Set();
        for (const key of processedLightingKeys) {
            const [cx, cz] = key.split(',').map(Number);
            neighborsToUpdate.add(`${cx-1},${cz}`);
            neighborsToUpdate.add(`${cx+1},${cz}`);
            neighborsToUpdate.add(`${cx},${cz-1}`);
            neighborsToUpdate.add(`${cx},${cz+1}`);
        }

        // Исключаем те, что уже обновлены (сами измененные чанки)
        for (const key of processedLightingKeys) {
            neighborsToUpdate.delete(key);
        }

        // Пересчитываем свет для соседей
        for (const key of neighborsToUpdate) {
            if (this.chunks[key]) {
                // Клонируем для иммутабельности React
                this.chunks[key] = this.chunks[key].clone(); 
                this.computeLighting(this.chunks[key], key);
                // Добавляем в список модифицированных, чтобы React их перерисовал
                this.batchModifiedKeys.add(key);
            }
        }
    }

    // ВАЖНО: Клонируем все измененные чанки в конце батча,
    // чтобы React увидел изменения (сравнение по ссылке в React.memo)
    for (const key of this.batchModifiedKeys) {
        if (this.chunks[key]) {
            this.chunks[key] = this.chunks[key].clone();
        }
    }
    
    this.batchModifiedKeys.clear();
    return true; // Возвращаем true, если были любые изменения (даже без света)
  }

  // Получить ключ чанка
  getChunkKey(x, z) {
    return `${x},${z}`;
  }

  // Проверка наличия чанка
  isChunkLoaded(worldX, worldZ) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);
    return !!this.chunks[key];
  }

  // Получить свет из соседнего чанка
  getNeighborLight(chunkX, chunkZ, localX, localY, localZ) {
    const key = `${chunkX},${chunkZ}`;
    const lightMap = this.lightMaps[key];
    if (!lightMap) return -1;
    if (localY < 0 || localY >= CHUNK_HEIGHT) return localY >= CHUNK_HEIGHT ? 15 : 0;
    const index = localY * CHUNK_SIZE * CHUNK_SIZE + localX * CHUNK_SIZE + localZ;
    return lightMap[index] || 0;
  }

  // Рассчитать освещение для чанка
  computeLighting(chunk, chunkKey) {
    return PerformanceMetrics.measure('lighting', () => {
        const [chunkX, chunkZ] = chunkKey.split(',').map(Number);
        const lightMap = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);

        // Функция для получения индекса в lightMap
        const getIndex = (x, y, z) => y * CHUNK_SIZE * CHUNK_SIZE + x * CHUNK_SIZE + z;

        // Фаза 1: Sky Light
        const sunlitBlocks = [];
        
        for (let x = 0; x < CHUNK_SIZE; x++) {
          for (let z = 0; z < CHUNK_SIZE; z++) {
            let sunlight = 15;
            
            for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
              const index = getIndex(x, y, z);
              const block = chunk.getBlock(x, y, z);
              const props = BLOCK_PROPERTIES[block];
              
              if (!props || props.transparent) {
                if (block === BLOCK_TYPES.LEAVES) {
                  sunlight = Math.max(0, sunlight - 2); 
                } else if (block === BLOCK_TYPES.WATER) {
                  sunlight = Math.max(0, sunlight - 2);
                }

                lightMap[index] = sunlight;
                if (sunlight > 0) {
                  sunlitBlocks.push({ x, y, z, light: sunlight });
                }
              } else {
                lightMap[index] = 0;
                sunlight = 0; 
              }
            }
          }
        }

        // Фаза 2: Распространение света (BFS)
        const queue = [...sunlitBlocks];
        let head = 0;

        const neighborOffsets = [
          { cx: -1, cz: 0, edgeX: 0, edgeZ: null, sourceX: CHUNK_SIZE - 1 },
          { cx: 1, cz: 0, edgeX: CHUNK_SIZE - 1, edgeZ: null, sourceX: 0 },
          { cx: 0, cz: -1, edgeX: null, edgeZ: 0, sourceZ: CHUNK_SIZE - 1 },
          { cx: 0, cz: 1, edgeX: null, edgeZ: CHUNK_SIZE - 1, sourceZ: 0 }
        ];

        for (const { cx, cz, edgeX, edgeZ, sourceX, sourceZ } of neighborOffsets) {
          const neighborChunkX = chunkX + cx;
          const neighborChunkZ = chunkZ + cz;

          for (let y = 0; y < CHUNK_HEIGHT; y++) {
            for (let i = 0; i < CHUNK_SIZE; i++) {
              const srcX = edgeX !== null ? sourceX : i;
              const srcZ = edgeZ !== null ? sourceZ : i;
              const localX = edgeX !== null ? edgeX : i;
              const localZ = edgeZ !== null ? edgeZ : i;

              const neighborLight = this.getNeighborLight(neighborChunkX, neighborChunkZ, srcX, y, srcZ);

              if (neighborLight > 1) {
                const block = chunk.getBlock(localX, y, localZ);
                const props = BLOCK_PROPERTIES[block];

                if (!props || props.transparent) {
                  const index = getIndex(localX, y, localZ);
                  const newLight = neighborLight - 1;

                  if (newLight > lightMap[index]) {
                    lightMap[index] = newLight;
                    queue.push({ x: localX, y, z: localZ, light: newLight });
                  }
                }
              }
            }
          }
        }

        const directions = [
          { dx: 1, dy: 0, dz: 0 }, { dx: -1, dy: 0, dz: 0 },
          { dx: 0, dy: 1, dz: 0 }, { dx: 0, dy: -1, dz: 0 },
          { dx: 0, dy: 0, dz: 1 }, { dx: 0, dy: 0, dz: -1 }
        ];
        
        while (head < queue.length) {
          const { x, y, z, light } = queue[head++];
          
          if (light <= 1) continue;
          
          for (const { dx, dy, dz } of directions) {
            const nx = x + dx;
            const ny = y + dy;
            const nz = z + dz;
            
            if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) {
              continue;
            }
            
            const nIndex = getIndex(nx, ny, nz);
            const nBlock = chunk.getBlock(nx, ny, nz);
            const nProps = BLOCK_PROPERTIES[nBlock];

            if (nProps && !nProps.transparent) continue;

            let decay = 1;
            if (nBlock === BLOCK_TYPES.WATER) decay = 2;
            if (nBlock === BLOCK_TYPES.LEAVES) decay = 1;

            const newLight = light - decay;

            if (newLight > lightMap[nIndex]) {
              lightMap[nIndex] = newLight;
              queue.push({ x: nx, y: ny, z: nz, light: newLight });
            }
          }
        }
        
        this.lightMaps[chunkKey] = lightMap;
        return lightMap;
    });
  }

  // Обновить чанки вокруг игрока (ASYNC с воркерами)
  update(playerPos) {
    const chunkX = Math.floor(playerPos.x / CHUNK_SIZE);
    const chunkZ = Math.floor(playerPos.z / CHUNK_SIZE);

    // Обрабатываем pending lighting
    this.processPendingLighting();

    if (this.currentChunk.x === chunkX && this.currentChunk.z === chunkZ && Object.keys(this.chunks).length > 0) {
      return { hasChanges: false };
    }

    this.currentChunk = { x: chunkX, z: chunkZ };
    
    let hasChanges = false;
    const chunksToRemove = new Set(Object.keys(this.chunks));

    // 1. Определяем нужные чанки и запускаем загрузку
    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
      for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
        const cx = chunkX + x;
        const cz = chunkZ + z;
        const key = this.getChunkKey(cx, cz);

        chunksToRemove.delete(key); // Этот чанк нужен

        if (this.chunks[key]) {
          // Чанк уже загружен
          continue;
        }

        if (this.pendingChunks.has(key)) {
          // Чанк генерируется
          continue;
        }

        // Запускаем загрузку (асинхронно)
        this.loadChunkAsync(cx, cz, key);
      }
    }

    // 2. Выгрузка старых чанков
    for (const key of chunksToRemove) {
      // Сохраняем перед выгрузкой
      if (this.modifiedChunkKeys.has(key)) {
        this.storedChunks[key] = this.chunks[key].serialize();
      }
      delete this.chunks[key];
      delete this.lightMaps[key];
      this.pendingLighting.delete(key);
      hasChanges = true;
    }

    return { hasChanges, activeChunks: this.chunks };
  }

  // Асинхронная загрузка чанка
  async loadChunkAsync(cx, cz, key) {
    this.pendingChunks.add(key);
    log('ChunkManager', `Loading chunk ${key}...`);

    try {
      let chunk;

      // 1. Проверяем сохранения (синхронно)
      if (this.storedChunks[key]) {
        log('ChunkManager', `Loading chunk ${key} from storage`);
        chunk = Chunk.deserialize(this.storedChunks[key]);
      } else {
        // 2. Генерируем через воркер (асинхронно)
        log('ChunkManager', `Generating chunk ${key} via worker, seed: ${this.seed}`);
        const priority = this.calculatePriority(cx, cz);
        log('ChunkManager', `Calling workerPool.generateChunk...`);
        const result = await this.workerPool.generateChunk(cx, cz, this.seed, priority);
        log('ChunkManager', `Worker returned result for ${key}`);
        
        // Создаем Chunk из Transferable буферов
        const blocksArray = new Uint8Array(result.blocks);
        const metadataArray = new Uint8Array(result.metadata);
        log('ChunkManager', `Creating Chunk object for ${key}, blocks length: ${blocksArray.length}`);
        chunk = new Chunk({ blocks: blocksArray, metadata: metadataArray });
      }

      // 3. Добавляем в мир
      this.chunks[key] = chunk;
      this.pendingChunks.delete(key);
      this.pendingLighting.add(key);
      log('ChunkManager', `Chunk ${key} loaded successfully`);

      // 4. Оповещаем React
      this.notifyUpdate();
    } catch (error) {
      log('ChunkManager', `Failed to load chunk ${key}: ${error.message}`);
      console.error(`[ChunkManager] Failed to load chunk ${key}:`, error);
      this.pendingChunks.delete(key);
    }
  }

  // Обработка очереди освещения
  processPendingLighting() {
    if (this.pendingLighting.size === 0) return;

    const MAX_PER_TICK = 2; // Не больше 2 чанков за тик
    const processed = [];

    for (const key of this.pendingLighting) {
      if (processed.length >= MAX_PER_TICK) break;

      if (this.chunks[key]) {
        this.computeLighting(this.chunks[key], key);
        processed.push(key);

        // Обновляем соседей
        const [cx, cz] = key.split(',').map(Number);
        const neighbors = [
          `${cx - 1},${cz}`, `${cx + 1},${cz}`,
          `${cx},${cz - 1}`, `${cx},${cz + 1}`
        ];
        
        for (const nKey of neighbors) {
          if (this.chunks[nKey]) {
            this.chunks[nKey] = this.chunks[nKey].clone();
            this.computeLighting(this.chunks[nKey], nKey);
          }
        }
      }
    }

    for (const key of processed) {
      this.pendingLighting.delete(key);
    }

    if (processed.length > 0) {
      this.notifyUpdate();
    }
  }

  // Расчет приоритета чанка (ближайшие к игроку = выше)
  calculatePriority(cx, cz) {
    const dx = cx - this.currentChunk.x;
    const dz = cz - this.currentChunk.z;
    const distSq = dx * dx + dz * dz;
    return 100 - Math.min(100, distSq); // 100 = ближайший, 0 = дальний
  }

  // Установить коллбек для React
  setOnChunksUpdated(callback) {
    this.onChunksUpdated = callback;
  }

  // Изменить блок
  setBlock(worldX, worldY, worldZ, blockType, metadata = 0) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);

    if (!this.chunks[key]) return false;

    const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    // Если мы в режиме батчинга
    if (this.isBatching) {
        // Проверяем, клонировали ли мы уже этот чанк в рамках этого батча?
        // Или он уже был клонирован ранее?
        // Для простоты: всегда клонируем, если это первое изменение в батче для этого чанка.
        // Но как узнать?
        // Можно просто всегда клонировать, если еще не в списке.
        
        let targetChunk = this.chunks[key];
        
        // Если чанк еще не был помечен как измененный в этом батче, клонируем его,
        // чтобы не мутировать состояние, которое сейчас рендерится.
        if (!this.batchModifiedKeys.has(key)) {
            targetChunk = targetChunk.clone();
            this.chunks[key] = targetChunk;
            this.batchModifiedKeys.add(key);
            this.modifiedChunkKeys.add(key); // Для сохранения
        }
        
        // Устанавливаем блок
        const oldId = targetChunk.getBlock(lx, worldY, lz);
        targetChunk.setBlock(lx, worldY, lz, blockType, metadata);
        
        // Если изменился ТИП блока, помечаем для пересчета света
        // Изменение метаданных (уровня воды) свет не меняет!
        // ИСКЛЮЧЕНИЕ: Игнорируем изменения AIR↔WATER — они не должны триггерить свет
        const isWaterChange = (oldId === BLOCK_TYPES.AIR && blockType === BLOCK_TYPES.WATER) ||
                              (oldId === BLOCK_TYPES.WATER && blockType === BLOCK_TYPES.AIR);
        
        if (oldId !== blockType && !isWaterChange) {
            this.batchLightingDirtyKeys.add(key);
        }
        
        return true;
    }

    // Стандартный режим (по-одному)
    const newChunk = this.chunks[key].clone();
    newChunk.setBlock(lx, worldY, lz, blockType, metadata);
    this.chunks[key] = newChunk;

    // Помечаем чанк как измененный
    this.modifiedChunkKeys.add(key);

    this.computeLighting(newChunk, key);

    const neighborsToUpdate = [];
    if (lx === 0) neighborsToUpdate.push({ key: `${cx - 1},${cz}`, cx: cx - 1, cz });
    if (lx === CHUNK_SIZE - 1) neighborsToUpdate.push({ key: `${cx + 1},${cz}`, cx: cx + 1, cz });
    if (lz === 0) neighborsToUpdate.push({ key: `${cx},${cz - 1}`, cx, cz: cz - 1 });
    if (lz === CHUNK_SIZE - 1) neighborsToUpdate.push({ key: `${cx},${cz + 1}`, cx, cz: cz + 1 });
    
    for (const neighbor of neighborsToUpdate) {
      if (this.chunks[neighbor.key]) {
        this.chunks[neighbor.key] = this.chunks[neighbor.key].clone();
        this.computeLighting(this.chunks[neighbor.key], neighbor.key);
      }
    }

    return true;
  }

  // Получить данные для сохранения (все измененные чанки в формате RLE)
  getSaveData() {
    // Обновляем storedChunks данными из текущих активных чанков
    for (const key of this.modifiedChunkKeys) {
        if (this.chunks[key]) {
            this.storedChunks[key] = this.chunks[key].serialize();
        }
    }
    return this.storedChunks;
  }

  // Получить уровень света
  getLightLevel(worldX, worldY, worldZ) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);
    
    const lightMap = this.lightMaps[key];
    if (!lightMap) return 15;
    
    const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = Math.floor(worldY);
    
    if (ly < 0 || ly >= CHUNK_HEIGHT) return 15;
    
    const index = ly * CHUNK_SIZE * CHUNK_SIZE + lx * CHUNK_SIZE + lz;
    return lightMap[index] || 0;
  }

  // Получить метаданные
  getMetadata(worldX, worldY, worldZ) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);

    if (!this.chunks[key]) return 0;

    const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    return this.chunks[key].getMetadata(lx, worldY, lz);
  }

  // Получить блок (global)
  getBlock(worldX, worldY, worldZ) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);

    if (!this.chunks[key]) return BLOCK_TYPES.AIR;

    const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    return this.chunks[key].getBlock(lx, worldY, lz);
  }

  // Получить биом для отображения в UI
  getBiome(worldX, worldZ) {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);
    const chunk = this.chunks[key];
    
    if (!chunk) return { id: 'loading', name: 'Loading...' };
    
    const lx = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((worldZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    // Определяем биом по верхнему блоку (эвристика)
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const block = chunk.getBlock(lx, y, lz);
      if (block === BLOCK_TYPES.GRASS) return { id: 'plains', name: 'Plains' };
      if (block === BLOCK_TYPES.SAND && y < 42) return { id: 'beach', name: 'Beach' };
      if (block === BLOCK_TYPES.SAND && y >= 42) return { id: 'desert', name: 'Desert' };
      if (block === BLOCK_TYPES.SNOW) return { id: 'snowy', name: 'Snowy Plains' };
      if (block === BLOCK_TYPES.STONE && y > 70) return { id: 'mountains', name: 'Mountains' };
    }
    
    return { id: 'ocean', name: 'Ocean' };
  }

  // Очистить ресурсы
  terminate() {
    log('ChunkManager', 'Terminate called - clearing local state only (keeping global worker pool)');
    // НЕ терминируем workerPool - он глобальный синглтон
    // this.workerPool остаётся для переиспользования
    this.chunks = {};
    this.lightMaps = {};
    this.pendingChunks.clear();
    this.pendingLighting.clear();
  }
}

/**
 * TileEntityManager - глобальный менеджер для всех TileEntity
 * 
 * Управляет созданием, обновлением и удалением TileEntity.
 * Обеспечивает интеграцию с системой освещения и чанками.
 */

import { TileEntity } from './TileEntity';
import { FurnaceTileEntity } from './FurnaceTileEntity';
import { BLOCK_TYPES } from '../../constants/blockTypes';

// Регистрация типов TileEntity
const TILE_ENTITY_TYPES = {
    [BLOCK_TYPES.FURNACE]: FurnaceTileEntity,
    // В будущем добавятся:
    // [BLOCK_TYPES.CHEST]: ChestTileEntity,
    // [BLOCK_TYPES.BREWING_STAND]: BrewingStandTileEntity,
    // и т.д.
};

class TileEntityManagerClass {
    constructor() {
        // Map: "x,y,z" → TileEntity
        this.tileEntities = new Map();

        // Подписчики на изменения (для React)
        this.listeners = new Set();
        this.version = 0;

        // Callbacks для внешних систем
        this.lightingCallback = null;      // Для освещения
        this.chunkUpdateCallback = null;   // Для обновления чанков

        // Update loop
        this.updateInterval = null;
        this.lastUpdateTime = Date.now();
    }

    /**
     * Запустить глобальный update loop
     */
    startUpdateLoop() {
        if (this.updateInterval) return;

        this.lastUpdateTime = Date.now();
        this.updateInterval = setInterval(() => {
            const now = Date.now();
            const deltaTime = now - this.lastUpdateTime;
            this.lastUpdateTime = now;

            this.updateAll(deltaTime);
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
     * Обновить все TileEntity
     */
    updateAll(deltaTime) {
        let hasChanges = false;
        const lightingUpdates = [];

        for (const [key, tileEntity] of this.tileEntities.entries()) {
            const wasBurning = tileEntity.isActive();
            const changed = tileEntity.update(deltaTime);
            const isBurning = tileEntity.isActive();

            if (changed) hasChanges = true;

            // Проверяем изменение состояния освещения
            if (wasBurning !== isBurning) {
                lightingUpdates.push({
                    position: tileEntity.position,
                    lightLevel: tileEntity.getLightLevel(),
                    isAdding: isBurning
                });
            }
        }

        // Обновляем освещение
        if (lightingUpdates.length > 0 && this.lightingCallback) {
            const affectedChunks = new Set();

            for (const update of lightingUpdates) {
                const chunks = this.lightingCallback(
                    update.position.x,
                    update.position.y,
                    update.position.z,
                    update.isAdding ? update.lightLevel : 13, // lightLevel для удаления
                    update.isAdding
                );

                if (chunks) {
                    for (const chunk of chunks) {
                        affectedChunks.add(chunk);
                    }
                }
            }

            // Пересчитываем меши затронутых чанков
            if (this.chunkUpdateCallback && affectedChunks.size > 0) {
                this.chunkUpdateCallback(affectedChunks);
            }
        }

        if (hasChanges) {
            this.version++;
            this.notifyListeners();
        }
    }

    /**
     * Создать TileEntity для блока
     */
    create(x, y, z, blockType) {
        const TileEntityClass = TILE_ENTITY_TYPES[blockType];
        if (!TileEntityClass) return null;

        const key = TileEntity.makeKey(x, y, z);

        // Удаляем существующий если есть (без уведомления, так как уведомим в конце create)
        if (this.tileEntities.has(key)) {
            this.remove(x, y, z, false);
        }

        const tileEntity = new TileEntityClass(x, y, z);
        tileEntity.onPlace();
        this.tileEntities.set(key, tileEntity);

        this.version++;
        this.notifyListeners();

        return tileEntity;
    }

    /**
     * Получить TileEntity по координатам
     */
    get(x, y, z) {
        const key = TileEntity.makeKey(x, y, z);
        return this.tileEntities.get(key) || null;
    }

    /**
     * Получить или создать TileEntity
     */
    getOrCreate(x, y, z, blockType) {
        let tileEntity = this.get(x, y, z);
        if (!tileEntity) {
            tileEntity = this.create(x, y, z, blockType);
        }
        return tileEntity;
    }

    /**
     * Удалить TileEntity
     * @returns {Array} - дропы из TileEntity
     */
    remove(x, y, z, notify = true) {
        const key = TileEntity.makeKey(x, y, z);
        const tileEntity = this.tileEntities.get(key);

        if (!tileEntity) return [];

        // Получаем дропы
        const drops = tileEntity.getDrops();

        // Убираем освещение если было активно
        if (tileEntity.isActive() && this.lightingCallback) {
            const affectedChunks = this.lightingCallback(
                tileEntity.position.x,
                tileEntity.position.y,
                tileEntity.position.z,
                tileEntity.getLightLevel(),
                false // убираем свет
            );

            if (this.chunkUpdateCallback && affectedChunks && affectedChunks.size > 0) {
                this.chunkUpdateCallback(affectedChunks);
            }
        }

        tileEntity.onRemove();
        this.tileEntities.delete(key);

        if (notify) {
            this.version++;
            this.notifyListeners();
        }

        return drops;
    }

    /**
     * Проверить, является ли блок TileEntity
     */
    isTileEntityBlock(blockType) {
        return TILE_ENTITY_TYPES.hasOwnProperty(blockType);
    }

    /**
     * Получить все активные TileEntity определённого типа
     */
    getActiveByType(blockType) {
        const result = [];
        for (const tileEntity of this.tileEntities.values()) {
            if (tileEntity.blockType === blockType && tileEntity.isActive()) {
                result.push(tileEntity);
            }
        }
        return result;
    }

    /**
     * Получить все TileEntity определённого типа
     */
    getAllByType(blockType) {
        const result = [];
        for (const tileEntity of this.tileEntities.values()) {
            if (tileEntity.blockType === blockType) {
                result.push(tileEntity);
            }
        }
        return result;
    }

    /**
     * Установить callback для освещения
     */
    setLightingCallback(callback) {
        this.lightingCallback = callback;
    }

    /**
     * Установить callback для обновления чанков
     */
    setChunkUpdateCallback(callback) {
        this.chunkUpdateCallback = callback;
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
     * Получить версию (для React)
     */
    getVersion() {
        return this.version;
    }

    /**
     * Сериализация для сохранения
     */
    serialize() {
        const data = [];
        for (const tileEntity of this.tileEntities.values()) {
            data.push(tileEntity.serialize());
        }
        return data;
    }

    /**
     * Десериализация из сохранения
     */
    deserialize(data) {
        this.clear(false); // Очищаем без уведомления

        if (!Array.isArray(data)) return;

        for (const entityData of data) {
            const TileEntityClass = this.getTileEntityClassByName(entityData.type);
            if (TileEntityClass) {
                const tileEntity = TileEntityClass.deserialize(entityData);
                const key = tileEntity.getKey();
                this.tileEntities.set(key, tileEntity);
            }
        }

        this.version++;
        this.notifyListeners();
    }

    /**
     * Получить класс TileEntity по имени
     */
    getTileEntityClassByName(name) {
        switch (name) {
            case 'FurnaceTileEntity':
                return FurnaceTileEntity;
            // Добавить другие типы
            default:
                return null;
        }
    }

    /**
     * Очистить все TileEntity
     */
    clear(notify = true) {
        // Убираем освещение от всех активных
        for (const tileEntity of this.tileEntities.values()) {
            if (tileEntity.isActive() && this.lightingCallback) {
                this.lightingCallback(
                    tileEntity.position.x,
                    tileEntity.position.y,
                    tileEntity.position.z,
                    tileEntity.getLightLevel(),
                    false
                );
            }
            tileEntity.onRemove();
        }

        this.tileEntities.clear();

        if (notify) {
            this.version++;
            this.notifyListeners();
        }
    }
}

// Singleton
export const TileEntityManager = new TileEntityManagerClass();

// Запускаем update loop
TileEntityManager.startUpdateLoop();

export default TileEntityManager;

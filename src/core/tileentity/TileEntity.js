/**
 * TileEntity - базовый класс для блоков с состоянием (печка, сундук, варочная стойка и т.д.)
 * 
 * В Minecraft такие блоки называются "tile entities" или "block entities".
 * Они имеют дополнительное состояние помимо типа блока и metadata.
 */

export class TileEntity {
    constructor(x, y, z, blockType) {
        this.position = { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) };
        this.blockType = blockType;

        // Для отслеживания изменений
        this.isDirty = false;

        // Время создания (для сериализации)
        this.createdAt = Date.now();
    }

    /**
     * Получить ключ позиции для Map
     */
    getKey() {
        return `${this.position.x},${this.position.y},${this.position.z}`;
    }

    /**
     * Статический метод для создания ключа из координат
     */
    static makeKey(x, y, z) {
        return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    }

    /**
     * Обновление состояния (вызывается каждый тик)
     * @param {number} deltaTime - время в мс с прошлого обновления
     * @returns {boolean} - true если состояние изменилось
     */
    update(deltaTime) {
        // Переопределяется в наследниках
        return false;
    }

    /**
     * Вызывается при взаимодействии игрока с блоком (ПКМ)
     * @param {Player} player - игрок
     * @returns {boolean} - true если взаимодействие обработано
     */
    onInteract(player) {
        return false;
    }

    /**
     * Вызывается при разрушении блока
     * @returns {Array} - массив предметов для дропа [{type, count}, ...]
     */
    getDrops() {
        return [];
    }

    /**
     * Вызывается при установке блока
     */
    onPlace() {
        // Переопределяется в наследниках
    }

    /**
     * Вызывается при удалении
     */
    onRemove() {
        // Переопределяется в наследниках
    }

    /**
     * Проверить, активен ли TileEntity (для рендеринга эффектов)
     */
    isActive() {
        return false;
    }

    /**
     * Получить уровень света (для источников света)
     */
    getLightLevel() {
        return 0;
    }

    /**
     * Сериализация для сохранения
     */
    serialize() {
        return {
            type: this.constructor.name,
            position: this.position,
            blockType: this.blockType,
            createdAt: this.createdAt
        };
    }

    /**
     * Десериализация из сохранения
     * Должен быть переопределён в наследниках
     */
    static deserialize(data) {
        const entity = new TileEntity(
            data.position.x,
            data.position.y,
            data.position.z,
            data.blockType
        );
        entity.createdAt = data.createdAt || Date.now();
        return entity;
    }

    /**
     * Пометить как изменённый (для оптимизации сохранения)
     */
    markDirty() {
        this.isDirty = true;
    }

    /**
     * Сбросить флаг изменений
     */
    clearDirty() {
        this.isDirty = false;
    }
}

export default TileEntity;

/**
 * FurnaceTileEntity - TileEntity для печки
 * Содержит логику плавки, слоты и состояние горения
 */

import { TileEntity } from './TileEntity';
import { SMELTING_RECIPES, FUEL_VALUES } from '../../constants/recipes';
import { BLOCK_TYPES } from '../../constants/blockTypes';

// Уровень света от горящей печки (как в Minecraft - 13)
const FURNACE_LIGHT_LEVEL = 13;

// Время плавки по умолчанию (в мс)
const DEFAULT_SMELT_TIME = 10000;

// Получить рецепт плавки
const getSmeltingRecipe = (inputType) => {
    return SMELTING_RECIPES.find(r => r.input === inputType) || null;
};

// Получить время горения топлива
const getFuelBurnTime = (fuelType) => {
    return FUEL_VALUES[fuelType] || 0;
};

export class FurnaceTileEntity extends TileEntity {
    constructor(x, y, z) {
        super(x, y, z, BLOCK_TYPES.FURNACE);

        // Слоты печки
        this.inputSlot = null;   // { type, count }
        this.fuelSlot = null;    // { type, count }
        this.outputSlot = null;  // { type, count }

        // Состояние горения
        this.burnTime = 0;       // Оставшееся время горения текущего топлива (мс)
        this.maxBurnTime = 0;    // Максимальное время горения текущего топлива
        this.smeltProgress = 0;  // Прогресс плавки текущего предмета (мс)

        // Кэш рецепта
        this.currentRecipe = null;

        // Флаг для отслеживания изменения состояния горения
        this.wasBurning = false;
    }

    /**
     * Обновление печки (логика плавки)
     * @param {number} deltaTime - время в мс
     * @returns {boolean} - true если состояние изменилось
     */
    update(deltaTime) {
        let changed = false;
        this.wasBurning = this.burnTime > 0;

        // Проверяем рецепт для текущего входного предмета
        const inputType = this.inputSlot?.type;
        const recipe = inputType ? getSmeltingRecipe(inputType) : null;

        if (this.currentRecipe !== recipe) {
            this.currentRecipe = recipe;
            changed = true;
        }

        // Уменьшаем время горения если есть
        if (this.burnTime > 0) {
            this.burnTime = Math.max(0, this.burnTime - deltaTime);
            changed = true;
        }

        // Если топливо только что закончилось - сразу пытаемся взять новое
        // Это предотвращает моргание света
        if (this.burnTime === 0 && this.fuelSlot && recipe && this.inputSlot) {
            const fuelTime = getFuelBurnTime(this.fuelSlot.type);

            if (fuelTime > 0) {
                const canOutput = this.canOutputItem(recipe.output.type);

                if (canOutput) {
                    // Зажигаем топливо
                    this.burnTime = fuelTime;
                    this.maxBurnTime = fuelTime;

                    // Забираем 1 топливо
                    this.consumeFuel();
                    changed = true;
                }
            }
        }

        // Прогресс плавки (только если топливо горит)
        if (this.burnTime > 0 && recipe && this.inputSlot && this.inputSlot.count > 0) {
            const canOutput = this.canOutputItem(recipe.output.type);

            if (canOutput) {
                this.smeltProgress += deltaTime;

                if (this.smeltProgress >= (recipe.time || DEFAULT_SMELT_TIME)) {
                    // Плавка завершена!
                    this.consumeInput();
                    this.produceOutput(recipe.output);
                    this.smeltProgress = 0;
                }
                changed = true;
            }
        } else {
            // Нет рецепта или входа - сбрасываем прогресс
            if (this.smeltProgress > 0 && this.burnTime === 0) {
                this.smeltProgress = Math.max(0, this.smeltProgress - deltaTime * 0.5);
                changed = true;
            }
        }

        if (changed) {
            this.markDirty();
        }

        return changed;
    }

    /**
     * Проверить, можно ли положить результат в выходной слот
     */
    canOutputItem(outputType) {
        if (!this.outputSlot) return true;
        return this.outputSlot.type === outputType && this.outputSlot.count < 64;
    }

    /**
     * Потребить 1 единицу топлива
     */
    consumeFuel() {
        if (!this.fuelSlot) return;

        if (this.fuelSlot.count > 1) {
            this.fuelSlot = {
                type: this.fuelSlot.type,
                count: this.fuelSlot.count - 1
            };
        } else {
            this.fuelSlot = null;
        }
    }

    /**
     * Потребить 1 единицу входного предмета
     */
    consumeInput() {
        if (!this.inputSlot) return;

        if (this.inputSlot.count > 1) {
            this.inputSlot = {
                type: this.inputSlot.type,
                count: this.inputSlot.count - 1
            };
        } else {
            this.inputSlot = null;
        }
    }

    /**
     * Произвести результат плавки
     */
    produceOutput(output) {
        if (this.outputSlot) {
            this.outputSlot = {
                type: this.outputSlot.type,
                count: this.outputSlot.count + (output.count || 1)
            };
        } else {
            this.outputSlot = {
                type: output.type,
                count: output.count || 1
            };
        }
    }

    /**
     * Проверить, активна ли печка (горит)
     */
    isActive() {
        return this.burnTime > 0;
    }

    /**
     * Проверить, изменилось ли состояние горения
     */
    didBurningStateChange() {
        return this.wasBurning !== (this.burnTime > 0);
    }

    /**
     * Получить уровень света от печки
     */
    getLightLevel() {
        return this.burnTime > 0 ? FURNACE_LIGHT_LEVEL : 0;
    }

    /**
     * Получить данные для UI
     */
    getUIData() {
        return {
            inputSlot: this.inputSlot,
            fuelSlot: this.fuelSlot,
            outputSlot: this.outputSlot,
            burnTime: this.burnTime,
            maxBurnTime: this.maxBurnTime,
            smeltProgress: this.smeltProgress,
            currentRecipe: this.currentRecipe
        };
    }

    /**
     * Установить данные из UI
     */
    setSlotData(slotName, data) {
        if (slotName === 'input') {
            this.inputSlot = data;
        } else if (slotName === 'fuel') {
            this.fuelSlot = data;
        } else if (slotName === 'output') {
            this.outputSlot = data;
        }
        this.markDirty();
    }

    /**
     * Получить дропы при разрушении
     */
    getDrops() {
        const drops = [];

        if (this.inputSlot && this.inputSlot.type && this.inputSlot.count > 0) {
            drops.push({ ...this.inputSlot });
        }
        if (this.fuelSlot && this.fuelSlot.type && this.fuelSlot.count > 0) {
            drops.push({ ...this.fuelSlot });
        }
        if (this.outputSlot && this.outputSlot.type && this.outputSlot.count > 0) {
            drops.push({ ...this.outputSlot });
        }

        return drops;
    }

    /**
     * Сериализация
     */
    serialize() {
        return {
            ...super.serialize(),
            inputSlot: this.inputSlot,
            fuelSlot: this.fuelSlot,
            outputSlot: this.outputSlot,
            burnTime: this.burnTime,
            maxBurnTime: this.maxBurnTime,
            smeltProgress: this.smeltProgress
        };
    }

    /**
     * Десериализация
     */
    static deserialize(data) {
        const entity = new FurnaceTileEntity(
            data.position.x,
            data.position.y,
            data.position.z
        );

        entity.createdAt = data.createdAt || Date.now();
        entity.inputSlot = data.inputSlot || null;
        entity.fuelSlot = data.fuelSlot || null;
        entity.outputSlot = data.outputSlot || null;
        entity.burnTime = data.burnTime || 0;
        entity.maxBurnTime = data.maxBurnTime || 0;
        entity.smeltProgress = data.smeltProgress || 0;

        return entity;
    }
}

export default FurnaceTileEntity;

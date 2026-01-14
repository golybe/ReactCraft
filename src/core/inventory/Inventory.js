/**
 * Inventory - класс для управления инвентарем игрока
 * Инкапсулирует логику работы со слотами, стеками и операциями с предметами
 */
import {
  MAX_STACK_SIZE,
  HOTBAR_SIZE,
  MAIN_INVENTORY_SIZE,
  TOTAL_INVENTORY_SIZE
} from '../../utils/inventory';
import { BlockRegistry } from '../blocks/BlockRegistry';

export class Inventory {
  constructor(size = TOTAL_INVENTORY_SIZE, initialData = null) {
    // Создаем массив слотов
    if (initialData && Array.isArray(initialData)) {
      // Миграция старого 9-слотового инвентаря
      if (initialData.length === 9 && size === TOTAL_INVENTORY_SIZE) {
        this.slots = Array(TOTAL_INVENTORY_SIZE).fill(null);
        for (let i = 0; i < 9; i++) {
          const slot = initialData[i];
          if (slot) {
            // Восстанавливаем durability если есть
            this.slots[i] = {
              type: slot.type,
              count: slot.count,
              durability: slot.durability
            };
          } else {
            this.slots[i] = null;
          }
        }
      } else {
        this.slots = initialData.map(slot =>
          slot ? {
            type: slot.type || slot.t,
            count: slot.count || slot.c,
            durability: slot.durability
          } : null
        );
        // Дополняем до нужного размера если нужно
        while (this.slots.length < size) {
          this.slots.push(null);
        }
      }
    } else {
      this.slots = Array(size).fill(null);
    }

    this.selectedSlot = 0; // Выбранный слот в hotbar (0-8)
  }

  /**
   * Получить максимальный размер стака для типа
   */
  static getMaxStackSize(type) {
    const block = BlockRegistry.get(type);
    return block ? (block.maxStackSize || MAX_STACK_SIZE) : MAX_STACK_SIZE;
  }

  /**
   * Создать новый стек
   */
  static createStack(type, count = 1, durability = undefined) {
    if (!type || type === 0 || count <= 0) return null;
    const maxStack = Inventory.getMaxStackSize(type);
    return {
      type,
      count: Math.min(count, maxStack),
      durability: durability // Сохраняем прочность
    };
  }

  /**
   * Проверить, можно ли объединить два стека
   */
  static canMergeStacks(stack1, stack2) {
    if (!stack1 || !stack2) return true;
    const maxStack = Inventory.getMaxStackSize(stack1.type);
    // Предметы с прочностью (инструменты) обычно не стакаются, если у них разная прочность
    // Но если maxStackSize = 1, то они вообще не стакаются
    if (maxStack === 1) return false;

    return stack1.type === stack2.type && stack1.count < maxStack;
  }

  /**
   * Получить слот по индексу
   */
  getSlot(index) {
    return this.slots[index] || null;
  }

  /**
   * Получить тип блока в слоте
   */
  getBlockType(index) {
    const slot = this.slots[index];
    return slot ? slot.type : null;
  }

  /**
   * Получить количество предметов в слоте
   */
  getSlotCount(index) {
    const slot = this.slots[index];
    return slot ? slot.count : 0;
  }

  /**
   * Установить слот
   */
  setSlot(index, stack) {
    if (index < 0 || index >= this.slots.length) return false;
    this.slots[index] = stack;
    return true;
  }

  /**
   * Добавить предметы в конкретный слот
   * @returns {{ remaining: number }} - сколько осталось не добавлено
   */
  addToSlot(slotIndex, type, count = 1, durability = undefined) {
    if (slotIndex < 0 || slotIndex >= this.slots.length) {
      return { remaining: count };
    }

    const slot = this.slots[slotIndex];
    const maxStack = Inventory.getMaxStackSize(type);
    let remaining = count;

    if (!slot) {
      // Пустой слот - создаем новый стек
      // Если это инструмент, инициализируем прочность если не передана
      let finalDurability = durability;
      if (finalDurability === undefined) {
        const block = BlockRegistry.get(type);
        if (block && block.maxDurability > 0) {
          finalDurability = block.maxDurability;
        }
      }

      const toAdd = Math.min(count, maxStack);
      this.slots[slotIndex] = Inventory.createStack(type, toAdd, finalDurability);
      remaining = count - toAdd;
    } else if (slot.type === type) {
      // Тот же тип - добавляем в стек (если можно)
      // Если у предметов есть прочность, они не стакаются (обычно maxStack = 1 это решает)
      if (maxStack === 1) {
        return { remaining: count }; // Нельзя стакать
      }

      const space = maxStack - slot.count;
      const toAdd = Math.min(count, space);
      this.slots[slotIndex] = { ...slot, count: slot.count + toAdd };
      remaining = count - toAdd;
    }
    // Разный тип - не можем добавить, возвращаем все как remaining

    return { remaining };
  }

  /**
   * Удалить предметы из конкретного слота
   * @returns {{ removed: number }} - сколько было удалено
   */
  removeFromSlot(slotIndex, count = 1) {
    if (slotIndex < 0 || slotIndex >= this.slots.length) {
      return { removed: 0 };
    }

    const slot = this.slots[slotIndex];
    if (!slot) {
      return { removed: 0 };
    }

    const toRemove = Math.min(count, slot.count);
    const newCount = slot.count - toRemove;

    if (newCount <= 0) {
      this.slots[slotIndex] = null;
    } else {
      // Сохраняем durability
      this.slots[slotIndex] = { ...slot, count: newCount };
    }

    return { removed: toRemove };
  }

  /**
   * Добавить предметы в инвентарь (автоматически находит лучший слот)
   * Приоритет: существующие стеки того же типа, затем пустые слоты
   * @returns {{ remaining: number }} - сколько осталось не добавлено
   */
  addItem(type, count = 1, durability = undefined) {
    let remaining = count;
    const maxStack = Inventory.getMaxStackSize(type);

    // Первый проход: заполняем существующие стеки того же типа
    // Только если предмет стакается (maxStack > 1)
    if (maxStack > 1) {
      for (let i = 0; i < this.slots.length && remaining > 0; i++) {
        const slot = this.slots[i];
        if (slot && slot.type === type && slot.count < maxStack) {
          const result = this.addToSlot(i, type, remaining, durability);
          remaining = result.remaining;
        }
      }
    }

    // Второй проход: заполняем пустые слоты
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (!this.slots[i]) {
        const result = this.addToSlot(i, type, remaining, durability);
        remaining = result.remaining;
      }
    }

    return { remaining };
  }

  /**
   * Добавить предметы в полный инвентарь (36 слотов), приоритет hotbar
   * @returns {{ remaining: number }} - сколько осталось не добавлено
   */
  addToFullInventory(type, count = 1, durability = undefined) {
    let remaining = count;
    const maxStack = Inventory.getMaxStackSize(type);

    // Первый проход: заполняем существующие стеки в hotbar (0-8)
    if (maxStack > 1) {
      for (let i = 0; i < HOTBAR_SIZE && remaining > 0; i++) {
        const slot = this.slots[i];
        if (slot && slot.type === type && slot.count < maxStack) {
          const result = this.addToSlot(i, type, remaining, durability);
          remaining = result.remaining;
        }
      }

      // Второй проход: заполняем существующие стеки в main inventory (9-35)
      for (let i = HOTBAR_SIZE; i < TOTAL_INVENTORY_SIZE && remaining > 0; i++) {
        const slot = this.slots[i];
        if (slot && slot.type === type && slot.count < maxStack) {
          const result = this.addToSlot(i, type, remaining, durability);
          remaining = result.remaining;
        }
      }
    }

    // Третий проход: заполняем пустые слоты в hotbar
    for (let i = 0; i < HOTBAR_SIZE && remaining > 0; i++) {
      if (!this.slots[i]) {
        const result = this.addToSlot(i, type, remaining, durability);
        remaining = result.remaining;
      }
    }

    // Четвертый проход: заполняем пустые слоты в main inventory
    for (let i = HOTBAR_SIZE; i < TOTAL_INVENTORY_SIZE && remaining > 0; i++) {
      if (!this.slots[i]) {
        const result = this.addToSlot(i, type, remaining, durability);
        remaining = result.remaining;
      }
    }

    return { remaining };
  }

  /**
   * Удалить предметы из инвентаря (из любого слота)
   * @returns {{ removed: number }} - сколько было удалено
   */
  removeItem(type, count = 1) {
    let remaining = count;
    let totalRemoved = 0;

    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const slot = this.slots[i];
      if (slot && slot.type === type) {
        const result = this.removeFromSlot(i, remaining);
        remaining -= result.removed;
        totalRemoved += result.removed;
      }
    }

    return { removed: totalRemoved };
  }

  /**
   * Подсчитать количество предметов определенного типа
   */
  countItems(type) {
    return this.slots.reduce((total, slot) => {
      if (slot && slot.type === type) {
        return total + slot.count;
      }
      return total;
    }, 0);
  }

  /**
   * Проверить, есть ли в инвентаре хотя бы count предметов типа type
   */
  hasItems(type, count = 1) {
    return this.countItems(type) >= count;
  }

  /**
   * Получить hotbar (слоты 0-8)
   */
  getHotbar() {
    return this.slots.slice(0, HOTBAR_SIZE);
  }

  /**
   * Получить main inventory (слоты 9-35)
   */
  getMainInventory() {
    return this.slots.slice(HOTBAR_SIZE, TOTAL_INVENTORY_SIZE);
  }

  /**
   * Установить выбранный слот
   */
  setSelectedSlot(index) {
    if (index >= 0 && index < HOTBAR_SIZE) {
      this.selectedSlot = index;
    }
  }

  /**
   * Получить выбранный слот
   */
  getSelectedSlot() {
    return this.selectedSlot;
  }

  /**
   * Получить предмет в выбранном слоте
   */
  getSelectedItem() {
    return this.getSlot(this.selectedSlot);
  }

  /**
   * Получить тип блока в выбранном слоте
   */
  getSelectedBlockType() {
    return this.getBlockType(this.selectedSlot);
  }

  /**
   * Сериализовать инвентарь для сохранения
   */
  serialize() {
    return this.slots.map(slot => slot ? {
      t: slot.type,
      c: slot.count,
      d: slot.durability // Сохраняем прочность
    } : null);
  }

  /**
   * Десериализовать инвентарь из сохранения
   */
  static deserialize(data, size = TOTAL_INVENTORY_SIZE) {
    if (!data || !Array.isArray(data)) {
      return new Inventory(size);
    }
    const slots = data.map(item => item ? {
      type: item.t || item.type,
      count: item.c || item.count,
      durability: item.d !== undefined ? item.d : item.durability // Восстанавливаем прочность
    } : null);
    return new Inventory(size, slots);
  }

  /**
   * Получить массив слотов (для совместимости с React state)
   * Возвращает глубокую копию для предотвращения мутаций
   */
  getSlots() {
    return this.slots.map(slot => slot ? {
      type: slot.type,
      count: slot.count,
      durability: slot.durability
    } : null);
  }

  /**
   * Установить массив слотов (для совместимости с React state)
   */
  setSlots(slots) {
    if (Array.isArray(slots) && slots.length === this.slots.length) {
      this.slots = slots.map(slot => slot ? {
        type: slot.type,
        count: slot.count,
        durability: slot.durability // Сохраняем прочность
      } : null);
    }
  }

  /**
   * Очистить инвентарь
   */
  clear() {
    this.slots.fill(null);
  }

  /**
   * Получить размер инвентаря
   */
  getSize() {
    return this.slots.length;
  }
}

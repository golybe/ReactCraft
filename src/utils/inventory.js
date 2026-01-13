/**
 * Inventory Management Utilities
 * 
 * Handles stack-based inventory operations.
 * Stack format: { type: number, count: number } or null for empty slot
 */

export const MAX_STACK_SIZE = 64;

// Inventory layout constants
export const HOTBAR_SIZE = 9;       // Slots 0-8
export const MAIN_INVENTORY_SIZE = 27;  // Slots 9-35 (3 rows of 9)
export const TOTAL_INVENTORY_SIZE = HOTBAR_SIZE + MAIN_INVENTORY_SIZE; // 36 total

/**
 * Create a new stack
 * @param {number} type - Block type ID
 * @param {number} count - Number of items
 * @returns {{ type: number, count: number } | null}
 */
export const createStack = (type, count = 1) => {
  if (!type || type === 0 || count <= 0) return null;
  return { type, count: Math.min(count, MAX_STACK_SIZE) };
};

/**
 * Check if two stacks can be merged
 */
export const canMergeStacks = (stack1, stack2) => {
  if (!stack1 || !stack2) return true; // One is empty, can "merge" by replacing
  return stack1.type === stack2.type && stack1.count < MAX_STACK_SIZE;
};

/**
 * Add item(s) to a specific slot
 * @param {Array} inventory - Array of slots
 * @param {number} slotIndex - Target slot
 * @param {number} type - Block type to add
 * @param {number} count - Amount to add
 * @returns {{ inventory: Array, remaining: number }} - Updated inventory and leftover
 */
export const addToSlot = (inventory, slotIndex, type, count = 1) => {
  const newInventory = [...inventory];
  const slot = newInventory[slotIndex];
  let remaining = count;
  
  if (!slot) {
    // Empty slot - create new stack
    const toAdd = Math.min(count, MAX_STACK_SIZE);
    newInventory[slotIndex] = createStack(type, toAdd);
    remaining = count - toAdd;
  } else if (slot.type === type) {
    // Same type - add to stack
    const space = MAX_STACK_SIZE - slot.count;
    const toAdd = Math.min(count, space);
    newInventory[slotIndex] = { type, count: slot.count + toAdd };
    remaining = count - toAdd;
  }
  // Different type - can't add, return all as remaining
  
  return { inventory: newInventory, remaining };
};

/**
 * Remove item(s) from a specific slot
 * @param {Array} inventory - Array of slots
 * @param {number} slotIndex - Target slot
 * @param {number} count - Amount to remove
 * @returns {{ inventory: Array, removed: number }} - Updated inventory and actual removed
 */
export const removeFromSlot = (inventory, slotIndex, count = 1) => {
  const newInventory = [...inventory];
  const slot = newInventory[slotIndex];
  
  if (!slot) {
    return { inventory: newInventory, removed: 0 };
  }
  
  const toRemove = Math.min(count, slot.count);
  const newCount = slot.count - toRemove;
  
  if (newCount <= 0) {
    newInventory[slotIndex] = null;
  } else {
    newInventory[slotIndex] = { type: slot.type, count: newCount };
  }
  
  return { inventory: newInventory, removed: toRemove };
};

/**
 * Add items to inventory, finding the best slot automatically
 * Prefers existing stacks of the same type, then empty slots
 * @param {Array} inventory - Array of slots
 * @param {number} type - Block type to add
 * @param {number} count - Amount to add
 * @returns {{ inventory: Array, remaining: number }}
 */
export const addToInventory = (inventory, type, count = 1) => {
  let newInventory = [...inventory];
  let remaining = count;
  
  // First pass: try to fill existing stacks of the same type
  for (let i = 0; i < newInventory.length && remaining > 0; i++) {
    const slot = newInventory[i];
    if (slot && slot.type === type && slot.count < MAX_STACK_SIZE) {
      const result = addToSlot(newInventory, i, type, remaining);
      newInventory = result.inventory;
      remaining = result.remaining;
    }
  }
  
  // Second pass: fill empty slots
  for (let i = 0; i < newInventory.length && remaining > 0; i++) {
    if (!newInventory[i]) {
      const result = addToSlot(newInventory, i, type, remaining);
      newInventory = result.inventory;
      remaining = result.remaining;
    }
  }
  
  return { inventory: newInventory, remaining };
};

/**
 * Count total items of a type in inventory
 */
export const countItems = (inventory, type) => {
  return inventory.reduce((total, slot) => {
    if (slot && slot.type === type) {
      return total + slot.count;
    }
    return total;
  }, 0);
};

/**
 * Check if inventory has at least `count` items of `type`
 */
export const hasItems = (inventory, type, count = 1) => {
  return countItems(inventory, type) >= count;
};

/**
 * Remove items from inventory (from any slot)
 * @returns {{ inventory: Array, removed: number }}
 */
export const removeFromInventory = (inventory, type, count = 1) => {
  let newInventory = [...inventory];
  let remaining = count;
  let totalRemoved = 0;
  
  for (let i = 0; i < newInventory.length && remaining > 0; i++) {
    const slot = newInventory[i];
    if (slot && slot.type === type) {
      const result = removeFromSlot(newInventory, i, remaining);
      newInventory = result.inventory;
      remaining -= result.removed;
      totalRemoved += result.removed;
    }
  }
  
  return { inventory: newInventory, removed: totalRemoved };
};

/**
 * Get item at slot (convenience getter)
 * @returns {{ type: number, count: number } | null}
 */
export const getSlot = (inventory, index) => {
  return inventory[index] || null;
};

/**
 * Get block type at slot (for compatibility)
 * @returns {number | null}
 */
export const getBlockType = (inventory, index) => {
  const slot = inventory[index];
  return slot ? slot.type : null;
};

/**
 * Serialize inventory for saving
 */
export const serializeInventory = (inventory) => {
  return inventory.map(slot => slot ? { t: slot.type, c: slot.count } : null);
};

/**
 * Deserialize inventory from save
 */
export const deserializeInventory = (data, size = 9) => {
  if (!data || !Array.isArray(data)) {
    return Array(size).fill(null);
  }
  return data.map(item => item ? { type: item.t, count: item.c } : null);
};

/**
 * Add items to full inventory (36 slots), prioritizing hotbar first
 * @param {Array} inventory - Full 36-slot inventory
 * @param {number} type - Block type to add
 * @param {number} count - Amount to add
 * @returns {{ inventory: Array, remaining: number }}
 */
export const addToFullInventory = (inventory, type, count = 1) => {
  let newInventory = [...inventory];
  let remaining = count;

  // First pass: try to fill existing stacks in hotbar (0-8)
  for (let i = 0; i < HOTBAR_SIZE && remaining > 0; i++) {
    const slot = newInventory[i];
    if (slot && slot.type === type && slot.count < MAX_STACK_SIZE) {
      const result = addToSlot(newInventory, i, type, remaining);
      newInventory = result.inventory;
      remaining = result.remaining;
    }
  }

  // Second pass: try to fill existing stacks in main inventory (9-35)
  for (let i = HOTBAR_SIZE; i < TOTAL_INVENTORY_SIZE && remaining > 0; i++) {
    const slot = newInventory[i];
    if (slot && slot.type === type && slot.count < MAX_STACK_SIZE) {
      const result = addToSlot(newInventory, i, type, remaining);
      newInventory = result.inventory;
      remaining = result.remaining;
    }
  }

  // Third pass: fill empty slots in hotbar first
  for (let i = 0; i < HOTBAR_SIZE && remaining > 0; i++) {
    if (!newInventory[i]) {
      const result = addToSlot(newInventory, i, type, remaining);
      newInventory = result.inventory;
      remaining = result.remaining;
    }
  }

  // Fourth pass: fill empty slots in main inventory
  for (let i = HOTBAR_SIZE; i < TOTAL_INVENTORY_SIZE && remaining > 0; i++) {
    if (!newInventory[i]) {
      const result = addToSlot(newInventory, i, type, remaining);
      newInventory = result.inventory;
      remaining = result.remaining;
    }
  }

  return { inventory: newInventory, remaining };
};

/**
 * Get hotbar slice from full inventory
 */
export const getHotbar = (inventory) => {
  return inventory.slice(0, HOTBAR_SIZE);
};

/**
 * Get main inventory slice (27 slots)
 */
export const getMainInventory = (inventory) => {
  return inventory.slice(HOTBAR_SIZE, TOTAL_INVENTORY_SIZE);
};

export default {
  MAX_STACK_SIZE,
  HOTBAR_SIZE,
  MAIN_INVENTORY_SIZE,
  TOTAL_INVENTORY_SIZE,
  createStack,
  canMergeStacks,
  addToSlot,
  removeFromSlot,
  addToInventory,
  addToFullInventory,
  countItems,
  hasItems,
  removeFromInventory,
  getSlot,
  getBlockType,
  getHotbar,
  getMainInventory,
  serializeInventory,
  deserializeInventory
};

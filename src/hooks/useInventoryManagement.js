import { useState, useRef, useEffect, useCallback } from 'react';
import { Inventory as InventoryClass } from '../core/inventory/Inventory';
import { CraftingManager } from '../core/inventory/CraftingManager';
import { TOTAL_INVENTORY_SIZE, HOTBAR_SIZE, CRAFTING_GRID_SIZE } from '../utils/inventory';
import { HOTBAR_BLOCKS } from '../constants/blocks';

/**
 * Hook for managing player inventory and crafting
 */
export function useInventoryManagement({
  worldInfo,
  gameMode,
  playerPos,
  playerYaw,
  playerPitch,
  isChatOpen,
  isInventoryOpen,
  isPaused,
  setDroppedItems
}) {
  const inventoryRef = useRef(null);

  // Main inventory state
  const [inventory, setInventory] = useState(() => {
    // Create Inventory class from save or empty
    if (worldInfo?.inventory) {
      inventoryRef.current = InventoryClass.deserialize(worldInfo.inventory, TOTAL_INVENTORY_SIZE);
    } else {
      inventoryRef.current = new InventoryClass(TOTAL_INVENTORY_SIZE);
    }
    return inventoryRef.current.getSlots();
  });

  const [selectedSlot, setSelectedSlot] = useState(0);

  // Crafting state
  const [craftingGrid, setCraftingGrid] = useState(Array(CRAFTING_GRID_SIZE).fill(null));
  const [craftingResult, setCraftingResult] = useState(null);

  // Update crafting result when grid changes
  useEffect(() => {
    const result = CraftingManager.checkRecipe(craftingGrid);
    setCraftingResult(result);
  }, [craftingGrid]);

  // Handle crafting result pickup
  const handleCraftResultPickup = useCallback(() => {
    if (!craftingResult) return;

    // 1. Consume 1 item from each slot in crafting grid
    const newGrid = craftingGrid.map(item => {
      if (!item) return null;
      const newCount = item.count - 1;
      return newCount > 0 ? { ...item, count: newCount } : null;
    });
    setCraftingGrid(newGrid);

    // 2. Result is picked up by cursor logic (handled in Inventory component)
    // Here we just return the result to be used by the caller
    return { ...craftingResult };
  }, [craftingGrid, craftingResult]);

  // Handle Shift + Click (Craft all possible and move to inventory)
  const handleShiftCraftResult = useCallback(() => {
    if (!craftingResult || !inventoryRef.current) return;

    let currentGrid = [...craftingGrid];
    const resultType = craftingResult.type;
    const resultCountPerCraft = craftingResult.count;
    let totalAdded = 0;

    // Цикл крафта: продолжаем, пока рецепт совпадает и есть место в инвентаре
    while (true) {
      const currentRecipeResult = CraftingManager.checkRecipe(currentGrid);
      if (!currentRecipeResult || currentRecipeResult.type !== resultType) break;

      // Пытаемся добавить результат в инвентарь
      const { remaining } = inventoryRef.current.addToFullInventory(resultType, resultCountPerCraft);
      
      // Если не смогли добавить все предметы из этого цикла крафта — значит инвентарь полон
      if (remaining > 0) {
        // Если что-то добавилось (частично), нужно вернуть "лишнее" из инвентаря обратно? 
        // В Minecraft просто останавливается, если стак не влезает целиком.
        if (remaining < resultCountPerCraft) {
          // Откатываем частичное добавление (для простоты реализации)
          inventoryRef.current.removeItem(resultType, resultCountPerCraft - remaining);
        }
        break;
      }

      // Потребляем ингредиенты
      currentGrid = currentGrid.map(item => {
        if (!item) return null;
        const newCount = item.count - 1;
        return newCount > 0 ? { ...item, count: newCount } : null;
      });
      
      totalAdded += resultCountPerCraft;
      
      // Ограничитель, чтобы не зависнуть (на случай бесконечных рецептов)
      if (totalAdded > 1000) break;
    }

    if (totalAdded > 0) {
      setInventory(inventoryRef.current.getSlots());
      setCraftingGrid(currentGrid);
    }
  }, [craftingGrid, craftingResult]);

  // Return items from crafting grid to main inventory when inventory closes
  useEffect(() => {
    if (!isInventoryOpen) {
      const itemsToReturn = craftingGrid.filter(item => item && item.count > 0);
      if (itemsToReturn.length > 0) {
        if (inventoryRef.current) {
          itemsToReturn.forEach(item => {
            inventoryRef.current.addToFullInventory(item.type, item.count);
          });
          setInventory(inventoryRef.current.getSlots());
          setCraftingGrid(Array(CRAFTING_GRID_SIZE).fill(null));
        }
      }
    }
  }, [isInventoryOpen]);

  // Hotbar is slots 0-8
  const hotbar = inventory.slice(0, HOTBAR_SIZE);

  // Sync inventoryRef with React state
  useEffect(() => {
    if (inventoryRef.current) {
      inventoryRef.current.setSlots(inventory);
    }
  }, [inventory]);

  // Sync selectedSlot with Inventory class
  useEffect(() => {
    if (inventoryRef.current) {
      inventoryRef.current.setSelectedSlot(selectedSlot);
    }
  }, [selectedSlot]);

  const getBlockType = useCallback((slot) => {
    return inventoryRef.current?.getBlockType(slot) || null;
  }, []);

  const getSelectedBlockType = useCallback(() => {
    return inventoryRef.current?.getBlockType(selectedSlot) || null;
  }, [selectedSlot]);

  const addToInventory = useCallback((blockType, count) => {
    if (!inventoryRef.current) return { remaining: count };

    const result = inventoryRef.current.addToFullInventory(blockType, count);
    setInventory(inventoryRef.current.getSlots());
    return result;
  }, []);

  const removeFromSlot = useCallback((slot, count) => {
    if (!inventoryRef.current) return { removed: 0 };

    const result = inventoryRef.current.removeFromSlot(slot, count);
    setInventory(inventoryRef.current.getSlots());
    return result;
  }, []);

  const handleSelectSlot = useCallback((slot) => {
    setSelectedSlot(slot);
  }, []);

  const scrollHotbar = useCallback((direction) => {
    if (direction > 0) {
      setSelectedSlot(prev => (prev + 1) % HOTBAR_BLOCKS.length);
    } else {
      setSelectedSlot(prev => (prev - 1 + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length);
    }
  }, []);

  // Drop item (Q key)
  const handleDropItem = useCallback(() => {
    if (isChatOpen || isInventoryOpen || isPaused) return null;
    if (!inventoryRef.current) return null;

    const blockType = inventoryRef.current.getBlockType(selectedSlot);
    if (!blockType) return null;

    // Remove 1 item from slot
    const { removed } = inventoryRef.current.removeFromSlot(selectedSlot, 1);
    if (removed === 0) return null;

    setInventory(inventoryRef.current.getSlots());

    // Calculate throw direction
    const throwSpeed = 8;
    const dirX = -Math.sin(playerYaw) * Math.cos(playerPitch);
    const dirY = Math.sin(playerPitch);
    const dirZ = -Math.cos(playerYaw) * Math.cos(playerPitch);

    // Small spread
    const spread = 0.15;
    const randX = (Math.random() - 0.5) * spread;
    const randZ = (Math.random() - 0.5) * spread;

    const itemId = Date.now() + Math.random();
    const droppedItem = {
      id: itemId,
      blockType: blockType,
      count: 1,
      position: {
        x: playerPos.x + dirX * 1.2,
        y: playerPos.y + 1.5,
        z: playerPos.z + dirZ * 1.2
      },
      velocity: {
        x: dirX * throwSpeed + randX,
        y: dirY * throwSpeed + 1.5,
        z: dirZ * throwSpeed + randZ
      },
      noPickupTime: 1.0
    };

    if (setDroppedItems) {
      setDroppedItems(prev => [...prev, droppedItem]);
    }

    return droppedItem;
  }, [selectedSlot, playerPos, playerYaw, playerPitch, isChatOpen, isInventoryOpen, isPaused, setDroppedItems]);

  return {
    inventory,
    setInventory,
    hotbar,
    selectedSlot,
    setSelectedSlot,
    inventoryRef,
    getBlockType,
    getSelectedBlockType,
    addToInventory,
    removeFromSlot,
    handleSelectSlot,
    scrollHotbar,
    handleDropItem,
    craftingGrid,
    setCraftingGrid,
    craftingResult,
    handleCraftResultPickup,
    handleShiftCraftResult
  };
}

export default useInventoryManagement;

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

  // --- Crafting states ---
  // 2x2 Crafting (Survival Inventory)
  const [craftingGrid, setCraftingGrid] = useState(Array(4).fill(null));
  const [craftingResult, setCraftingResult] = useState(null);

  // 3x3 Crafting (Workbench)
  const [craftingGrid3x3, setCraftingGrid3x3] = useState(Array(9).fill(null));
  const [craftingResult3x3, setCraftingResult3x3] = useState(null);

  // Update crafting results when grids change
  useEffect(() => {
    const result = CraftingManager.checkRecipe(craftingGrid);
    setCraftingResult(result);
  }, [craftingGrid]);

  useEffect(() => {
    const result = CraftingManager.checkRecipe(craftingGrid3x3);
    setCraftingResult3x3(result);
  }, [craftingGrid3x3]);

  // Handle crafting result pickup (Survival 2x2)
  const handleCraftResultPickup = useCallback(() => {
    if (!craftingResult) return null;

    const newGrid = craftingGrid.map(item => {
      if (!item) return null;
      const newCount = item.count - 1;
      return newCount > 0 ? { ...item, count: newCount } : null;
    });
    setCraftingGrid(newGrid);

    return { ...craftingResult };
  }, [craftingGrid, craftingResult]);

  // Handle Shift + Click (Craft all possible - Survival 2x2)
  const handleShiftCraftResult = useCallback(() => {
    if (!craftingResult || !inventoryRef.current) return;

    let currentGrid = [...craftingGrid];
    const resultType = craftingResult.type;
    const resultCountPerCraft = craftingResult.count;
    let totalAdded = 0;

    while (true) {
      const currentRecipeResult = CraftingManager.checkRecipe(currentGrid);
      if (!currentRecipeResult || currentRecipeResult.type !== resultType) break;

      // Проверяем, можем ли добавить предметы в инвентарь
      const { remaining } = inventoryRef.current.addToFullInventory(resultType, resultCountPerCraft);
      
      if (remaining > 0) {
        // Инвентарь заполнен - откатываем добавление и останавливаемся
        inventoryRef.current.removeItem(resultType, resultCountPerCraft - remaining);
        break;
      }

      // Успешно добавили - уменьшаем ингредиенты в сетке
      currentGrid = currentGrid.map(item => {
        if (!item) return null;
        const newCount = item.count - 1;
        return newCount > 0 ? { ...item, count: newCount } : null;
      });
      totalAdded += resultCountPerCraft;
      
      // Защита от бесконечного цикла
      if (totalAdded > 1000) break;
    }

    if (totalAdded > 0) {
      setInventory(inventoryRef.current.getSlots());
      setCraftingGrid(currentGrid);
    }
  }, [craftingGrid, craftingResult]);

  // Handle crafting result pickup (Workbench 3x3)
  const handleCraftResult3x3Pickup = useCallback(() => {
    if (!craftingResult3x3) return null;

    const newGrid = craftingGrid3x3.map(item => {
      if (!item) return null;
      const newCount = item.count - 1;
      return newCount > 0 ? { ...item, count: newCount } : null;
    });
    setCraftingGrid3x3(newGrid);

    return { ...craftingResult3x3 };
  }, [craftingGrid3x3, craftingResult3x3]);

  // Handle Shift + Click (Workbench 3x3)
  const handleShiftCraftResult3x3 = useCallback(() => {
    if (!craftingResult3x3 || !inventoryRef.current) return;

    let currentGrid = [...craftingGrid3x3];
    const resultType = craftingResult3x3.type;
    const resultCountPerCraft = craftingResult3x3.count;
    let totalAdded = 0;

    while (true) {
      const currentRecipeResult = CraftingManager.checkRecipe(currentGrid);
      if (!currentRecipeResult || currentRecipeResult.type !== resultType) break;

      // Проверяем, можем ли добавить предметы в инвентарь
      const { remaining } = inventoryRef.current.addToFullInventory(resultType, resultCountPerCraft);
      
      if (remaining > 0) {
        // Инвентарь заполнен - откатываем добавление и останавливаемся
        inventoryRef.current.removeItem(resultType, resultCountPerCraft - remaining);
        break;
      }

      // Успешно добавили - уменьшаем ингредиенты в сетке
      currentGrid = currentGrid.map(item => {
        if (!item) return null;
        const newCount = item.count - 1;
        return newCount > 0 ? { ...item, count: newCount } : null;
      });
      totalAdded += resultCountPerCraft;
      
      // Защита от бесконечного цикла
      if (totalAdded > 1000) break;
    }

    if (totalAdded > 0) {
      setInventory(inventoryRef.current.getSlots());
      setCraftingGrid3x3(currentGrid);
    }
  }, [craftingGrid3x3, craftingResult3x3]);

  // Return items from 2x2 crafting grid when inventory closes
  useEffect(() => {
    if (!isInventoryOpen) {
      const itemsToReturn = craftingGrid.filter(item => item && item.count > 0);
      if (itemsToReturn.length > 0 && inventoryRef.current) {
        itemsToReturn.forEach(item => {
          inventoryRef.current.addToFullInventory(item.type, item.count);
        });
        setInventory(inventoryRef.current.getSlots());
        setCraftingGrid(Array(4).fill(null));
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
      setSelectedSlot(prev => (prev + 1) % HOTBAR_SIZE);
    } else {
      setSelectedSlot(prev => (prev - 1 + HOTBAR_SIZE) % HOTBAR_SIZE);
    }
  }, []);

  // Drop item (Q key or Shift+Q for whole stack)
  const handleDropItem = useCallback((data = {}) => {
    if (isChatOpen || isInventoryOpen || isPaused) return null;
    if (!inventoryRef.current) return null;

    const blockType = inventoryRef.current.getBlockType(selectedSlot);
    if (!blockType) return null;

    const dropAll = data.shiftKey === true;
    const currentCount = inventoryRef.current.getSlots()[selectedSlot]?.count || 0;
    const countToRemove = dropAll ? currentCount : 1;

    const { removed } = inventoryRef.current.removeFromSlot(selectedSlot, countToRemove);
    if (removed === 0) return null;

    setInventory(inventoryRef.current.getSlots());

    const throwSpeed = 8;
    const dirX = -Math.sin(playerYaw) * Math.cos(playerPitch);
    const dirY = Math.sin(playerPitch);
    const dirZ = -Math.cos(playerYaw) * Math.cos(playerPitch);

    const spread = 0.15;
    const randX = (Math.random() - 0.5) * spread;
    const randZ = (Math.random() - 0.5) * spread;

    const itemId = Date.now() + Math.random();
    const droppedItem = {
      id: itemId,
      blockType: blockType,
      count: removed,
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
    // Crafting states and handlers
    craftingGrid,
    setCraftingGrid,
    craftingResult,
    handleCraftResultPickup,
    handleShiftCraftResult,
    // 3x3 crafting
    craftingGrid3x3,
    setCraftingGrid3x3,
    craftingResult3x3,
    handleCraftResult3x3Pickup,
    handleShiftCraftResult3x3
  };
}

export default useInventoryManagement;

import { useState, useRef, useEffect, useCallback } from 'react';
import { Inventory as InventoryClass } from '../core/inventory/Inventory';
import { TOTAL_INVENTORY_SIZE, HOTBAR_SIZE } from '../utils/inventory';
import { HOTBAR_BLOCKS } from '../constants/blocks';

/**
 * Hook for managing player inventory
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
    handleDropItem
  };
}

export default useInventoryManagement;

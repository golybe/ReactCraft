import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BlockRegistry } from '../../core/blocks/BlockRegistry';
import { BlockIcon } from '../ui/BlockIcon';
import { MAX_STACK_SIZE, HOTBAR_SIZE, MAIN_INVENTORY_SIZE } from '../../utils/inventory';
import '../../styles/inventory.css';

/**
 * Extract block type and count from slot
 * Supports: null, number (old), { type, count } (new)
 */
const getSlotData = (slot) => {
  if (!slot) return { type: null, count: 0 };
  if (typeof slot === 'number') return { type: slot, count: MAX_STACK_SIZE };
  return { type: slot.type, count: slot.count || 0 };
};

/**
 * Minecraft-style inventory slot
 */
const MCSlot = ({ slot, onClick, onRightClick, onHover, isHovered, showCount = true, size = 36 }) => {
  const { type, count } = getSlotData(slot);
  const iconSize = Math.floor(size * 0.67);

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRightClick) onRightClick();
  };

  return (
    <div
      className="mc-slot"
      onClick={onClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={onHover}
      onMouseLeave={() => onHover && onHover(null)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      {type ? <BlockIcon blockId={type} size={iconSize} /> : null}

      {/* Stack count */}
      {type && showCount && count > 1 && (
        <div className="mc-slot-count">{count}</div>
      )}

      {isHovered && <div className="mc-slot-highlight" />}
    </div>
  );
};

/**
 * Creative Mode Inventory - Block palette with categories
 */
const CreativeInventory = ({
  inventory,
  onInventoryChange,
  cursorItem,
  setCursorItem,
  hoveredBlockName,
  setHoveredBlockName,
  searchInputRef,
  scrollContainerRef
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBlocks = useMemo(() => {
    const all = BlockRegistry.getAll().filter(b => b.id !== 0);
    if (!searchQuery) return all;
    return all.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  const handlePaletteClick = (blockId) => {
    // Creative: give full stack of 64
    setCursorItem({ type: blockId, count: MAX_STACK_SIZE });
  };

  const handlePaletteRightClick = (blockId) => {
    // Same as left click in palette - get a full stack
    setCursorItem({ type: blockId, count: MAX_STACK_SIZE });
  };

  const handleHotbarClick = (index) => {
    const currentSlot = inventory[index];
    const { type: currentType, count: currentCount } = getSlotData(currentSlot);

    if (cursorItem) {
      const cursorData = getSlotData(cursorItem);

      if (!currentType) {
        // Empty slot - place entire stack
        const newInventory = [...inventory];
        newInventory[index] = { type: cursorData.type, count: cursorData.count };
        onInventoryChange(newInventory);
        setCursorItem(null);
      } else if (currentType === cursorData.type) {
        // Same type - merge stacks
        const totalCount = currentCount + cursorData.count;
        const newSlotCount = Math.min(totalCount, MAX_STACK_SIZE);
        const remaining = totalCount - newSlotCount;

        const newInventory = [...inventory];
        newInventory[index] = { type: currentType, count: newSlotCount };
        onInventoryChange(newInventory);

        if (remaining > 0) {
          setCursorItem({ type: cursorData.type, count: remaining });
        } else {
          setCursorItem(null);
        }
      } else {
        // Different type - swap
        const newInventory = [...inventory];
        newInventory[index] = { type: cursorData.type, count: cursorData.count };
        onInventoryChange(newInventory);
        setCursorItem({ type: currentType, count: currentCount });
      }
    } else {
      // Picking up item
      if (currentType) {
        setCursorItem({ type: currentType, count: currentCount });
        const newInventory = [...inventory];
        newInventory[index] = null;
        onInventoryChange(newInventory);
      }
    }
  };

  const handleHotbarRightClick = (index) => {
    const currentSlot = inventory[index];
    const { type: currentType, count: currentCount } = getSlotData(currentSlot);

    if (cursorItem) {
      const cursorData = getSlotData(cursorItem);

      if (!currentType) {
        // Empty slot - place ONE item
        const newInventory = [...inventory];
        newInventory[index] = { type: cursorData.type, count: 1 };
        onInventoryChange(newInventory);

        if (cursorData.count > 1) {
          setCursorItem({ type: cursorData.type, count: cursorData.count - 1 });
        } else {
          setCursorItem(null);
        }
      } else if (currentType === cursorData.type && currentCount < MAX_STACK_SIZE) {
        // Same type, not full - add ONE
        const newInventory = [...inventory];
        newInventory[index] = { type: currentType, count: currentCount + 1 };
        onInventoryChange(newInventory);

        if (cursorData.count > 1) {
          setCursorItem({ type: cursorData.type, count: cursorData.count - 1 });
        } else {
          setCursorItem(null);
        }
      }
      // Different type or full stack - do nothing on right click
    } else {
      // Pick up half the stack
      if (currentType && currentCount > 0) {
        const takeCount = Math.ceil(currentCount / 2);
        const leaveCount = currentCount - takeCount;

        setCursorItem({ type: currentType, count: takeCount });

        const newInventory = [...inventory];
        if (leaveCount > 0) {
          newInventory[index] = { type: currentType, count: leaveCount };
        } else {
          newInventory[index] = null;
        }
        onInventoryChange(newInventory);
      }
    }
  };

  const handleWheel = (e) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop += e.deltaY;
    }
  };

  return (
    <div className="mc-creative-content" onWheel={handleWheel}>
      {/* Search bar */}
      <div className="mc-search-bar">
        <input
          ref={searchInputRef}
          placeholder="Search Items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Block palette */}
      <div className="mc-scroll-container" ref={scrollContainerRef}>
        <div
          className="mc-grid"
          onMouseLeave={() => setHoveredBlockName(null)}
        >
          {filteredBlocks.map(block => (
            <MCSlot
              key={block.id}
              slot={block.id}
              onClick={() => handlePaletteClick(block.id)}
              onRightClick={() => handlePaletteRightClick(block.id)}
              onHover={() => setHoveredBlockName(block.name)}
              isHovered={hoveredBlockName === block.name}
              showCount={false}
              size={36}
            />
          ))}
          {/* Fill empty spaces to complete the row */}
          {Array.from({ length: Math.max(0, 9 - (filteredBlocks.length % 9)) % 9 }).map((_, i) => (
            <div key={`empty-${i}`} className="mc-slot empty" style={{ width: '36px', height: '36px' }} />
          ))}
        </div>
      </div>

      {/* Hotbar section */}
      <div className="mc-separator">Hotbar</div>
      <div
        className="mc-hotbar-row"
        onMouseLeave={() => setHoveredBlockName(null)}
      >
        {Array.from({ length: HOTBAR_SIZE }).map((_, index) => {
          const slot = inventory[index];
          const { type } = getSlotData(slot);
          return (
            <MCSlot
              key={index}
              slot={slot}
              onClick={() => handleHotbarClick(index)}
              onRightClick={() => handleHotbarRightClick(index)}
              onHover={() => type && setHoveredBlockName(BlockRegistry.get(type)?.name)}
              isHovered={false}
              showCount={true}
              size={36}
            />
          );
        })}
      </div>
    </div>
  );
};

/**
 * Survival Mode Inventory - Main inventory + Hotbar
 */
const SurvivalInventory = ({
  inventory,
  onInventoryChange,
  cursorItem,
  setCursorItem,
  hoveredBlockName,
  setHoveredBlockName
}) => {

  // Left click - pick up/place entire stack
  const handleSlotClick = (index) => {
    const currentSlot = inventory[index];
    const { type: currentType, count: currentCount } = getSlotData(currentSlot);

    if (cursorItem) {
      // Placing item
      const cursorData = getSlotData(cursorItem);

      if (!currentType) {
        // Empty slot - place entire cursor stack
        const newInventory = [...inventory];
        newInventory[index] = { type: cursorData.type, count: cursorData.count };
        onInventoryChange(newInventory);
        setCursorItem(null);
      } else if (currentType === cursorData.type) {
        // Same type - merge stacks
        const totalCount = currentCount + cursorData.count;
        const newSlotCount = Math.min(totalCount, MAX_STACK_SIZE);
        const remaining = totalCount - newSlotCount;

        const newInventory = [...inventory];
        newInventory[index] = { type: currentType, count: newSlotCount };
        onInventoryChange(newInventory);

        if (remaining > 0) {
          setCursorItem({ type: cursorData.type, count: remaining });
        } else {
          setCursorItem(null);
        }
      } else {
        // Different type - swap
        const newInventory = [...inventory];
        newInventory[index] = { type: cursorData.type, count: cursorData.count };
        onInventoryChange(newInventory);
        setCursorItem({ type: currentType, count: currentCount });
      }
    } else {
      // Picking up item
      if (currentType) {
        setCursorItem({ type: currentType, count: currentCount });
        const newInventory = [...inventory];
        newInventory[index] = null;
        onInventoryChange(newInventory);
      }
    }
  };

  // Right click - place ONE item / pick up HALF stack
  const handleSlotRightClick = (index) => {
    const currentSlot = inventory[index];
    const { type: currentType, count: currentCount } = getSlotData(currentSlot);

    if (cursorItem) {
      // Has cursor item - place ONE
      const cursorData = getSlotData(cursorItem);

      if (!currentType) {
        // Empty slot - place ONE item
        const newInventory = [...inventory];
        newInventory[index] = { type: cursorData.type, count: 1 };
        onInventoryChange(newInventory);

        if (cursorData.count > 1) {
          setCursorItem({ type: cursorData.type, count: cursorData.count - 1 });
        } else {
          setCursorItem(null);
        }
      } else if (currentType === cursorData.type && currentCount < MAX_STACK_SIZE) {
        // Same type, not full - add ONE
        const newInventory = [...inventory];
        newInventory[index] = { type: currentType, count: currentCount + 1 };
        onInventoryChange(newInventory);

        if (cursorData.count > 1) {
          setCursorItem({ type: cursorData.type, count: cursorData.count - 1 });
        } else {
          setCursorItem(null);
        }
      }
      // Different type or full stack - do nothing on right click
    } else {
      // No cursor item - pick up HALF the stack
      if (currentType && currentCount > 0) {
        const takeCount = Math.ceil(currentCount / 2);
        const leaveCount = currentCount - takeCount;

        setCursorItem({ type: currentType, count: takeCount });

        const newInventory = [...inventory];
        if (leaveCount > 0) {
          newInventory[index] = { type: currentType, count: leaveCount };
        } else {
          newInventory[index] = null;
        }
        onInventoryChange(newInventory);
      }
    }
  };

  return (
    <div className="mc-survival-content">
      {/* Crafting area placeholder */}
      <div className="mc-crafting-area">
        <div className="mc-player-preview">
          {/* Player model placeholder */}
          <div className="mc-player-silhouette" />
        </div>
        <div className="mc-crafting-grid">
          <div className="mc-crafting-label">Crafting</div>
          <div className="mc-crafting-slots">
            {/* 2x2 crafting grid placeholder */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mc-slot disabled" style={{ width: '36px', height: '36px' }} />
            ))}
          </div>
          <div className="mc-crafting-arrow">→</div>
          <div className="mc-slot disabled" style={{ width: '36px', height: '36px' }} />
        </div>
      </div>

      {/* Main inventory (27 slots = 3 rows of 9) */}
      <div
        className="mc-main-inventory"
        onMouseLeave={() => setHoveredBlockName(null)}
      >
        {Array.from({ length: 3 }).map((_, row) => (
          <div key={row} className="mc-inventory-row">
            {Array.from({ length: 9 }).map((_, col) => {
              const index = HOTBAR_SIZE + row * 9 + col; // Slots 9-35
              const slot = inventory[index];
              const { type } = getSlotData(slot);
              return (
                <MCSlot
                  key={index}
                  slot={slot}
                  onClick={() => handleSlotClick(index)}
                  onRightClick={() => handleSlotRightClick(index)}
                  onHover={() => type && setHoveredBlockName(BlockRegistry.get(type)?.name)}
                  isHovered={false}
                  showCount={true}
                  size={36}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Hotbar (9 slots = slots 0-8) */}
      <div
        className="mc-hotbar-row survival"
        onMouseLeave={() => setHoveredBlockName(null)}
      >
        {Array.from({ length: HOTBAR_SIZE }).map((_, index) => {
          const slot = inventory[index];
          const { type } = getSlotData(slot);
          return (
            <MCSlot
              key={index}
              slot={slot}
              onClick={() => handleSlotClick(index)}
              onRightClick={() => handleSlotRightClick(index)}
              onHover={() => type && setHoveredBlockName(BlockRegistry.get(type)?.name)}
              isHovered={false}
              showCount={true}
              size={36}
            />
          );
        })}
      </div>
    </div>
  );
};

/**
 * Main Inventory Component
 */
const Inventory = ({ isOpen, onClose, inventory, onInventoryChange, isCreativeMode = false }) => {
  const [cursorItem, setCursorItem] = useState(null);
  const [hoveredBlockName, setHoveredBlockName] = useState(null);

  const searchInputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const cursorRef = useRef(null);
  const tooltipRef = useRef(null);

  // Handle dropping cursor item (right click on overlay)
  const handleOverlayRightClick = (e) => {
    e.preventDefault();
    if (cursorItem) {
      setCursorItem(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseMove = (e) => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%) scale(1.1)`;
      }
      if (tooltipRef.current) {
        tooltipRef.current.style.transform = `translate(${e.clientX + 15}px, ${e.clientY - 30}px)`;
      }
    };

    const timer = setTimeout(() => {
      if (searchInputRef.current && isCreativeMode) {
        searchInputRef.current.focus();
      }
    }, 50);

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timer);
    };
  }, [isOpen, isCreativeMode]);

  useEffect(() => {
    if (!isOpen) {
      setCursorItem(null);
      setHoveredBlockName(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const cursorData = cursorItem ? getSlotData(cursorItem) : null;

  return (
    <div className="mc-overlay" onContextMenu={handleOverlayRightClick}>
      <div className={`mc-window ${isCreativeMode ? 'creative' : 'survival'}`} onClick={e => e.stopPropagation()}>

        {/* Window title */}
        <div className="mc-window-title">
          {isCreativeMode ? 'Creative Inventory' : 'Inventory'}
        </div>

        {/* Content based on mode */}
        {isCreativeMode ? (
          <CreativeInventory
            inventory={inventory}
            onInventoryChange={onInventoryChange}
            cursorItem={cursorItem}
            setCursorItem={setCursorItem}
            hoveredBlockName={hoveredBlockName}
            setHoveredBlockName={setHoveredBlockName}
            searchInputRef={searchInputRef}
            scrollContainerRef={scrollContainerRef}
          />
        ) : (
          <SurvivalInventory
            inventory={inventory}
            onInventoryChange={onInventoryChange}
            cursorItem={cursorItem}
            setCursorItem={setCursorItem}
            hoveredBlockName={hoveredBlockName}
            setHoveredBlockName={setHoveredBlockName}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="mc-tooltip"
        style={{
          display: (hoveredBlockName && !cursorItem) ? 'block' : 'none',
          left: 0, top: 0
        }}
      >
        {hoveredBlockName}
      </div>

      {/* Cursor item */}
      <div
        ref={cursorRef}
        className="mc-cursor-item"
        style={{
          display: cursorItem ? 'block' : 'none',
          left: 0, top: 0
        }}
      >
        {cursorData && (
          <>
            <BlockIcon blockId={cursorData.type} size={32} />
            {cursorData.count > 1 && (
              <div className="mc-cursor-count">{cursorData.count}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Inventory;

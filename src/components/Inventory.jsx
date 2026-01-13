import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BlockRegistry } from '../core/blocks/BlockRegistry';
import { BlockIcon } from './BlockIcon';
import { MAX_STACK_SIZE, HOTBAR_SIZE, MAIN_INVENTORY_SIZE } from '../utils/inventory';

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

      <style>{`
        .mc-overlay {
          position: fixed;
          top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0, 0, 0, 0.65);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 2000;
          font-family: 'Minecraft', 'VT323', monospace;
          image-rendering: pixelated;
        }

        .mc-window {
          background-color: #c6c6c6;
          border: 4px solid;
          border-color: #fff #555 #555 #fff;
          padding: 8px;
          box-shadow: 8px 8px 0 rgba(0,0,0,0.3);
        }

        .mc-window.creative {
          width: 352px;
        }

        .mc-window.survival {
          width: 352px;
        }

        .mc-window-title {
          background: #c6c6c6;
          color: #404040;
          font-size: 16px;
          padding: 4px 0 8px 0;
          text-align: center;
          font-weight: bold;
          text-shadow: 1px 1px 0 #fff;
        }

        /* ===== SLOT STYLES ===== */
        .mc-slot {
          background: #8b8b8b;
          border: 2px solid;
          border-color: #373737 #fff #fff #373737;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          box-sizing: border-box;
          cursor: pointer;
        }

        .mc-slot:hover .mc-slot-highlight {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(255, 255, 255, 0.5);
          z-index: 5;
          pointer-events: none;
        }

        .mc-slot.empty {
          background: #8b8b8b;
          cursor: default;
        }

        .mc-slot.disabled {
          background: #6b6b6b;
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mc-slot-count {
          position: absolute;
          bottom: 1px;
          right: 2px;
          color: #fff;
          font-size: 14px;
          font-family: 'VT323', monospace;
          text-shadow: 1.5px 1.5px 0 #3f3f3f;
          line-height: 1;
          pointer-events: none;
          z-index: 10;
        }

        /* ===== CREATIVE MODE ===== */
        .mc-creative-content {
          display: flex;
          flex-direction: column;
        }

        .mc-search-bar {
          margin-bottom: 4px;
          border: 2px solid;
          border-color: #373737 #fff #fff #373737;
          background: #000;
          padding: 4px;
        }

        .mc-search-bar input {
          width: 100%;
          background: transparent;
          border: none;
          color: #fff;
          font-family: 'VT323', monospace;
          font-size: 16px;
          outline: none;
        }

        .mc-scroll-container {
          height: 180px;
          overflow-y: auto;
          border: 2px solid;
          border-color: #373737 #fff #fff #373737;
          background: #000;
          padding: 2px;
          scrollbar-width: thin;
          scrollbar-color: #8b8b8b #2b2b2b;
        }

        .mc-scroll-container::-webkit-scrollbar {
          width: 14px;
        }

        .mc-scroll-container::-webkit-scrollbar-track {
          background: #2b2b2b;
          border: 1px solid #1a1a1a;
        }

        .mc-scroll-container::-webkit-scrollbar-thumb {
          background: #8b8b8b;
          border: 2px solid;
          border-color: #fff #555 #555 #fff;
        }

        .mc-grid {
          display: grid;
          grid-template-columns: repeat(9, 36px);
          gap: 0;
        }

        .mc-separator {
          margin: 8px 0 4px 0;
          color: #404040;
          font-size: 14px;
          text-shadow: 1px 1px 0 #fff;
        }

        .mc-hotbar-row {
          display: grid;
          grid-template-columns: repeat(9, 36px);
          gap: 0;
          margin-top: 4px;
        }

        /* ===== SURVIVAL MODE ===== */
        .mc-survival-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mc-crafting-area {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 8px 0;
          border-bottom: 2px solid #8b8b8b;
          margin-bottom: 8px;
        }

        .mc-player-preview {
          width: 60px;
          height: 80px;
          background: #3b3b3b;
          border: 2px solid;
          border-color: #555 #8b8b8b #8b8b8b #555;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mc-player-silhouette {
          width: 24px;
          height: 48px;
          background: linear-gradient(to bottom,
            #5d4a3d 0%, #5d4a3d 25%,  /* head */
            #3d7d49 25%, #3d7d49 50%, /* torso */
            #3b3bab 50%, #3b3bab 100% /* legs */
          );
          image-rendering: pixelated;
        }

        .mc-crafting-grid {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .mc-crafting-label {
          color: #404040;
          font-size: 12px;
          text-shadow: 1px 1px 0 #fff;
          margin-bottom: 4px;
        }

        .mc-crafting-slots {
          display: grid;
          grid-template-columns: repeat(2, 36px);
          gap: 0;
        }

        .mc-crafting-arrow {
          color: #404040;
          font-size: 24px;
          margin: 0 4px;
        }

        .mc-main-inventory {
          display: flex;
          flex-direction: column;
          gap: 0;
          padding: 4px;
          border: 2px solid;
          border-color: #555 #fff #fff #555;
          background: #8b8b8b40;
        }

        .mc-inventory-row {
          display: grid;
          grid-template-columns: repeat(9, 36px);
          gap: 0;
        }

        .mc-hotbar-row.survival {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 2px solid #8b8b8b;
        }

        /* ===== TOOLTIP ===== */
        .mc-tooltip {
          position: fixed;
          background: rgba(16, 0, 16, 0.94);
          border: 2px solid #25005a;
          color: #fff;
          padding: 4px 8px;
          font-family: 'VT323', monospace;
          font-size: 16px;
          z-index: 2500;
          pointer-events: none;
          text-shadow: 1px 1px 0 #000;
          white-space: nowrap;
        }

        /* ===== CURSOR ITEM ===== */
        .mc-cursor-item {
          position: fixed;
          pointer-events: none;
          z-index: 3000;
        }

        .mc-cursor-count {
          position: absolute;
          bottom: 0;
          right: 0;
          color: #fff;
          font-size: 14px;
          font-family: 'VT323', monospace;
          text-shadow: 1.5px 1.5px 0 #3f3f3f;
          line-height: 1;
        }
      `}</style>
    </div>
  );
};

export default Inventory;

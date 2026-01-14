// Улучшенный хотбар с текстурами, количеством и названиями блоков (Minecraft Style)
import React, { useEffect, useRef, memo, useState } from 'react';
import { BlockRegistry } from '../../core/blocks/BlockRegistry';
import { BlockIcon } from './BlockIcon';
import { MAX_STACK_SIZE } from '../../utils/inventory';
import '../../styles/hotbar.css';

/**
 * Extract block type from slot (supports both old format and new stack format)
 * Old format: blockId (number)
 * New format: { type: number, count: number }
 */
const getSlotData = (slot) => {
  if (!slot) return { type: null, count: 0 };
  if (typeof slot === 'number') return { type: slot, count: MAX_STACK_SIZE };
  return { type: slot.type, count: slot.count || 0 };
};

const HotbarSlot = memo(({ slot, isSelected, index, onSelect, showCount = true }) => {
  const { type, count } = getSlotData(slot);
  
  // Определяем размер: предметы (items) 32px, блоки 24px
  const block = type ? BlockRegistry.get(type) : null;
  const isItem = block?.isPlaceable === false;
  const iconSize = isItem ? 36 : 24;
  
  return (
    <div
      onClick={() => onSelect(index)}
      className="hotbar-slot"
    >
      {type ? <BlockIcon blockId={type} size={iconSize} /> : null}
      
      {/* Stack count (only show if > 1) */}
      {type && showCount && count > 1 && (
        <div className="hotbar-slot-count">
          {count}
        </div>
      )}
      
      {isSelected && <div className="hotbar-slot-selected" />}
    </div>
  );
});

const Hotbar = ({ selectedSlot, onSelectSlot, hotbarItems, showCount = true }) => {
  const [showName, setShowName] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const nameTimeoutRef = useRef(null);

  useEffect(() => {
    const slot = hotbarItems[selectedSlot];
    const { type } = getSlotData(slot);
    const block = type ? BlockRegistry.get(type) : null;
    const name = block ? block.name : '';
    
    setDisplayName(name);
    setShowName(!!name);

    if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
    nameTimeoutRef.current = setTimeout(() => setShowName(false), 2000);

    return () => { if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current); };
  }, [selectedSlot, hotbarItems]);

  return (
    <div className="hotbar-container">
      <div className={`hotbar-name ${showName ? 'visible' : ''}`}>
        {displayName}
      </div>

      <div className="hotbar-slots">
        {hotbarItems.map((slot, index) => (
          <HotbarSlot
            key={index}
            slot={slot}
            isSelected={selectedSlot === index}
            index={index}
            onSelect={onSelectSlot}
            showCount={showCount}
          />
        ))}
      </div>
      
      <div className="hotbar-spacer"></div>
    </div>
  );
};

export default memo(Hotbar);

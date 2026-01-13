// Улучшенный хотбар с текстурами, количеством и названиями блоков (Minecraft Style)
import React, { useEffect, useRef, memo, useState } from 'react';
import { BlockRegistry } from '../core/blocks/BlockRegistry';
import { BlockIcon } from './BlockIcon';

import { MAX_STACK_SIZE } from '../utils/inventory';

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
  
  return (
    <div
      onClick={() => onSelect(index)}
      style={{
        width: '44px',
        height: '44px',
        border: '2px solid',
        borderColor: '#373737 #fff #fff #373737',
        backgroundColor: '#8b8b8b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        boxSizing: 'border-box'
      }}
    >
      {type ? <BlockIcon blockId={type} size={24} /> : null}
      
      {/* Stack count (only show if > 1) */}
      {type && showCount && count > 1 && (
        <div style={{
          position: 'absolute',
          bottom: '2px',
          right: '2px',
          color: '#fff',
          fontSize: '14px',
          fontFamily: "'VT323', monospace",
          textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
          lineHeight: 1,
          pointerEvents: 'none',
          zIndex: 5
        }}>
          {count}
        </div>
      )}
      
      {isSelected && (
        <div style={{
            position: 'absolute', top: '-4px', left: '-4px', right: '-4px', bottom: '-4px',
            border: '4px solid #fff', borderRadius: '2px', pointerEvents: 'none', zIndex: 10
        }} />
      )}
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
    <div style={{
      position: 'fixed',
      bottom: '0',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      zIndex: 100,
      width: '100%',
      pointerEvents: 'none'
    }}>
      <div style={{
        color: '#fff',
        fontFamily: "'VT323', monospace",
        fontSize: '24px',
        marginBottom: '10px',
        textShadow: '2px 2px 0 #000',
        opacity: showName ? 1 : 0,
        transition: 'opacity 0.2s',
        pointerEvents: 'none'
      }}>
        {displayName}
      </div>

      <div style={{
        display: 'flex',
        gap: '2px',
        padding: '3px',
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: '2px 2px 0 0',
        pointerEvents: 'auto'
      }}>
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
      
      <div style={{ height: '5px' }}></div>
    </div>
  );
};

export default memo(Hotbar);

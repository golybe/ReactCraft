import React from 'react';
import { BlockIcon } from './BlockIcon';
import { MAX_STACK_SIZE } from '../../utils/inventory';
import { BlockRegistry } from '../../core/blocks/BlockRegistry';

/**
 * Извлечение данных из слота (поддерживает разные форматы)
 */
export const getSlotData = (slot) => {
    if (!slot) return { type: null, count: 0 };
    if (typeof slot === 'number') return { type: slot, count: MAX_STACK_SIZE };
    return { 
        type: slot.type, 
        count: slot.count || 0,
        durability: slot.durability
    };
};

/**
 * MCSlot - Универсальный компонент слота в стиле Minecraft
 * 
 * Используется во всех интерфейсах: инвентарь, крафт, печь и т.д.
 */
export const MCSlot = ({
    slot,
    onClick,
    onRightClick,
    onHover,
    isHovered = false,
    showCount = true,
    size = 54,
    disabled = false,
    className = ''
}) => {
    const { type, count, durability } = getSlotData(slot);
    const iconSize = Math.floor(size * 0.67);
    const block = type ? BlockRegistry.get(type) : null;
    const maxDurability = block?.maxDurability || 0;

    // Вычисляем цвет и ширину полоски прочности
    let durabilityPct = 0;
    let durabilityColor = '#00ff00';
    
    if (type && maxDurability > 0) {
        const current = durability !== undefined ? durability : maxDurability;
        durabilityPct = Math.max(0, Math.min(1, current / maxDurability));
        
        // HSL переход от зеленого (120) к красному (0)
        const hue = Math.floor(durabilityPct * 120);
        durabilityColor = `hsl(${hue}, 100%, 50%)`;
    }

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onRightClick && !disabled) onRightClick();
    };

    const handleClick = (e) => {
        if (onClick && !disabled) onClick(e);
    };

    return (
        <div
            className={`mc-slot ${disabled ? 'disabled' : ''} ${className}`}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onMouseEnter={() => onHover && onHover(true)}
            onMouseLeave={() => onHover && onHover(false)}
            style={{
                width: `${size}px`,
                height: `${size}px`,
            }}
        >
            {type ? <BlockIcon blockId={type} size={iconSize} /> : null}

            {type && showCount && count > 1 && (
                <div className="mc-slot-count">{count}</div>
            )}

            {/* Durability Bar */}
            {type && maxDurability > 0 && durability !== undefined && durability < maxDurability && (
                <div className="durability-bar-container" style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '4px',
                    right: '4px',
                    height: '2px',
                    backgroundColor: '#000',
                    zIndex: 10
                }}>
                    <div style={{
                        width: `${durabilityPct * 100}%`,
                        height: '100%',
                        backgroundColor: durabilityColor,
                        transition: 'width 0.2s'
                    }} />
                </div>
            )}

            {isHovered && <div className="mc-slot-highlight" />}
        </div>
    );
};

/**
 * MCGrid - Сетка слотов
 */
export const MCGrid = ({
    slots,
    columns,
    onSlotClick,
    onSlotRightClick,
    onSlotHover,
    startIndex = 0,
    size = 54,
    showCount = true,
    className = ''
}) => {
    return (
        <div
            className={`mc-grid ${className}`}
            style={{ gridTemplateColumns: `repeat(${columns}, ${size}px)` }}
        >
            {slots.map((slot, i) => (
                <MCSlot
                    key={startIndex + i}
                    slot={slot}
                    onClick={(e) => onSlotClick && onSlotClick(startIndex + i, e)}
                    onRightClick={() => onSlotRightClick && onSlotRightClick(startIndex + i)}
                    onHover={(hovered) => onSlotHover && onSlotHover(startIndex + i, hovered, slot)}
                    showCount={showCount}
                    size={size}
                />
            ))}
        </div>
    );
};

/**
 * MCCursorItem - Предмет, следующий за курсором
 */
export const MCCursorItem = React.forwardRef(({ item }, ref) => {
    const { type, count } = getSlotData(item);

    if (!item) return null;

    return (
        <div
            ref={ref}
            className="mc-cursor-item"
            style={{ display: 'block', left: 0, top: 0 }}
        >
            {type && (
                <>
                    <BlockIcon blockId={type} size={48} />
                    {count > 1 && (
                        <div className="mc-cursor-count">{count}</div>
                    )}
                </>
            )}
        </div>
    );
});

MCCursorItem.displayName = 'MCCursorItem';

/**
 * MCTooltip - Всплывающая подсказка
 */
export const MCTooltip = React.forwardRef(({ text, durability, visible }, ref) => {
    if (!visible || !text) return null;

    return (
        <div
            ref={ref}
            className="mc-tooltip"
            style={{ display: 'block', left: 0, top: 0 }}
        >
            <div className="mc-tooltip-name">{text}</div>
            {durability && (
                <div className="mc-tooltip-durability" style={{ color: '#aaaaaa', fontSize: '0.8em', marginTop: '2px' }}>
                    Durability: {durability}
                </div>
            )}
        </div>
    );
});

MCTooltip.displayName = 'MCTooltip';

export default MCSlot;

import React from 'react';
import { BlockIcon } from './BlockIcon';
import { MAX_STACK_SIZE } from '../../utils/inventory';

/**
 * Извлечение данных из слота (поддерживает разные форматы)
 */
export const getSlotData = (slot) => {
    if (!slot) return { type: null, count: 0 };
    if (typeof slot === 'number') return { type: slot, count: MAX_STACK_SIZE };
    return { type: slot.type, count: slot.count || 0 };
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
    const { type, count } = getSlotData(slot);
    const iconSize = Math.floor(size * 0.67);

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
export const MCTooltip = React.forwardRef(({ text, visible }, ref) => {
    if (!visible || !text) return null;

    return (
        <div
            ref={ref}
            className="mc-tooltip"
            style={{ display: 'block', left: 0, top: 0 }}
        >
            {text}
        </div>
    );
});

MCTooltip.displayName = 'MCTooltip';

export default MCSlot;

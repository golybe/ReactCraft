import React, { useState, useEffect, useRef } from 'react';
import { BlockRegistry } from '../../core/blocks/BlockRegistry';
import { BLOCK_TYPES } from '../../constants/blockTypes';
import { BlockIcon } from './BlockIcon';
import { MAX_STACK_SIZE, HOTBAR_SIZE } from '../../utils/inventory';
import '../../styles/inventory.css';

/**
 * Извлечение данных из слота
 */
const getSlotData = (slot) => {
    if (!slot) return { type: null, count: 0 };
    if (typeof slot === 'number') {
        const block = BlockRegistry.get(slot);
        // Tools should have count 1, blocks have MAX_STACK_SIZE (64)
        const count = block?.isTool ? 1 : MAX_STACK_SIZE;
        return { type: slot, count };
    }
    return { type: slot.type, count: slot.count || 0 };
};

/**
 * Minecraft-style slot component
 */
const MCSlot = ({ slot, onClick, onRightClick, onHover, isHovered, showCount = true, size = 36 }) => {
    const { type, count } = getSlotData(slot);
    const block = type ? BlockRegistry.get(type) : null;
    const isItem = block?.isPlaceable === false || block?.renderAsItem || type === BLOCK_TYPES.TALL_GRASS || type === BLOCK_TYPES.TORCH;
    
    // Предметы крупнее (85%), блоки стандартно (67%)
    const iconSize = isItem ? Math.floor(size * 0.85) : Math.floor(size * 0.67);

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

            {type && showCount && count > 1 && (
                <div className="mc-slot-count">{count}</div>
            )}

            {isHovered && <div className="mc-slot-highlight" />}
        </div>
    );
};

/**
 * Crafting Interface (3x3 grid) - Workbench UI
 */
const CraftingInterface = ({
    isOpen,
    onClose,
    inventory,
    onInventoryChange,
    craftingGrid,
    onCraftingGridChange,
    craftingResult,
    onCraftResultPickup,
    onShiftCraft
}) => {
    const [cursorItem, setCursorItem] = useState(null);
    const [hoveredBlockName, setHoveredBlockName] = useState(null);

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

        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setCursorItem(null);
            setHoveredBlockName(null);
        }
    }, [isOpen]);

    // Common click handler for all slots
    const handleGenericSlotClick = (slots, onSlotsChange, index, isResultSlot = false, shiftKey = false) => {
        if (isResultSlot) {
            if (!craftingResult) return;

            if (shiftKey) {
                onShiftCraft();
                return;
            }

            const resultData = getSlotData(craftingResult);

            if (cursorItem) {
                const cursorData = getSlotData(cursorItem);
                if (cursorData.type === resultData.type && cursorData.count + resultData.count <= MAX_STACK_SIZE) {
                    const result = onCraftResultPickup();
                    if (result) {
                        setCursorItem({ type: cursorData.type, count: cursorData.count + result.count });
                    }
                }
            } else {
                const result = onCraftResultPickup();
                if (result) {
                    setCursorItem({ type: result.type, count: result.count });
                }
            }
            return;
        }

        const currentSlot = slots[index];
        const { type: currentType, count: currentCount } = getSlotData(currentSlot);

        if (cursorItem) {
            const cursorData = getSlotData(cursorItem);

            if (!currentType) {
                const newSlots = [...slots];
                newSlots[index] = { type: cursorData.type, count: cursorData.count };
                onSlotsChange(newSlots);
                setCursorItem(null);
            } else if (currentType === cursorData.type) {
                const totalCount = currentCount + cursorData.count;
                const newSlotCount = Math.min(totalCount, MAX_STACK_SIZE);
                const remaining = totalCount - newSlotCount;

                const newSlots = [...slots];
                newSlots[index] = { type: currentType, count: newSlotCount };
                onSlotsChange(newSlots);

                if (remaining > 0) {
                    setCursorItem({ type: cursorData.type, count: remaining });
                } else {
                    setCursorItem(null);
                }
            } else {
                const newSlots = [...slots];
                newSlots[index] = { type: cursorData.type, count: cursorData.count };
                onSlotsChange(newSlots);
                setCursorItem({ type: currentType, count: currentCount });
            }
        } else {
            if (currentType) {
                setCursorItem({ type: currentType, count: currentCount });
                const newSlots = [...slots];
                newSlots[index] = null;
                onSlotsChange(newSlots);
            }
        }
    };

    const handleGenericSlotRightClick = (slots, onSlotsChange, index, isResultSlot = false) => {
        if (isResultSlot) return;

        const currentSlot = slots[index];
        const { type: currentType, count: currentCount } = getSlotData(currentSlot);

        if (cursorItem) {
            const cursorData = getSlotData(cursorItem);

            if (!currentType) {
                const newSlots = [...slots];
                newSlots[index] = { type: cursorData.type, count: 1 };
                onSlotsChange(newSlots);

                if (cursorData.count > 1) {
                    setCursorItem({ type: cursorData.type, count: cursorData.count - 1 });
                } else {
                    setCursorItem(null);
                }
            } else if (currentType === cursorData.type && currentCount < MAX_STACK_SIZE) {
                const newSlots = [...slots];
                newSlots[index] = { type: currentType, count: currentCount + 1 };
                onSlotsChange(newSlots);

                if (cursorData.count > 1) {
                    setCursorItem({ type: cursorData.type, count: cursorData.count - 1 });
                } else {
                    setCursorItem(null);
                }
            }
        } else {
            if (currentType && currentCount > 0) {
                const takeCount = Math.ceil(currentCount / 2);
                const leaveCount = currentCount - takeCount;

                setCursorItem({ type: currentType, count: takeCount });

                const newSlots = [...slots];
                if (leaveCount > 0) {
                    newSlots[index] = { type: currentType, count: leaveCount };
                } else {
                    newSlots[index] = null;
                }
                onSlotsChange(newSlots);
            }
        }
    };

    if (!isOpen) return null;

    const cursorData = cursorItem ? getSlotData(cursorItem) : null;

    return (
        <div className="mc-overlay" onContextMenu={handleOverlayRightClick}>
            <div className="mc-window crafting-table" onClick={e => e.stopPropagation()}>
                <div className="mc-window-title">Crafting</div>

                <div className="mc-crafting-interface">
                    {/* 3x3 Crafting Grid */}
                    <div className="mc-crafting-area-3x3">
                        <div className="mc-crafting-grid-3x3">
                            <div className="mc-crafting-slots-3x3">
                                {craftingGrid.map((slot, i) => (
                                    <MCSlot
                                        key={`craft-${i}`}
                                        slot={slot}
                                        onClick={() => handleGenericSlotClick(craftingGrid, onCraftingGridChange, i)}
                                        onRightClick={() => handleGenericSlotRightClick(craftingGrid, onCraftingGridChange, i)}
                                        onHover={() => {
                                            const data = getSlotData(slot);
                                            if (data.type) setHoveredBlockName(BlockRegistry.get(data.type)?.name);
                                        }}
                                        isHovered={false}
                                        size={36}
                                    />
                                ))}
                            </div>
                            <div className="mc-crafting-arrow">→</div>
                            <div className="mc-result-slot">
                                <MCSlot
                                    slot={craftingResult}
                                    onClick={(e) => handleGenericSlotClick(null, null, 0, true, e.shiftKey)}
                                    onHover={() => {
                                        if (craftingResult?.type) setHoveredBlockName(BlockRegistry.get(craftingResult.type)?.name);
                                    }}
                                    isHovered={false}
                                    size={36}
                                />
                            </div>
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
                                    const index = HOTBAR_SIZE + row * 9 + col;
                                    const slot = inventory[index];
                                    const { type } = getSlotData(slot);
                                    return (
                                        <MCSlot
                                            key={index}
                                            slot={slot}
                                            onClick={() => handleGenericSlotClick(inventory, onInventoryChange, index)}
                                            onRightClick={() => handleGenericSlotRightClick(inventory, onInventoryChange, index)}
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
                                    onClick={() => handleGenericSlotClick(inventory, onInventoryChange, index)}
                                    onRightClick={() => handleGenericSlotRightClick(inventory, onInventoryChange, index)}
                                    onHover={() => type && setHoveredBlockName(BlockRegistry.get(type)?.name)}
                                    isHovered={false}
                                    showCount={true}
                                    size={36}
                                />
                            );
                        })}
                    </div>
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
        </div>
    );
};

export default CraftingInterface;

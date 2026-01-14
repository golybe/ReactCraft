import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BlockRegistry } from '../../core/blocks/BlockRegistry';
import { MCSlot, MCGrid, MCCursorItem, MCTooltip, getSlotData } from './MCSlot';
import { UI_TYPES, UI_CONFIG } from '../../constants/uiTypes';
import { MAX_STACK_SIZE, HOTBAR_SIZE } from '../../utils/inventory';
import '../../styles/inventory.css';

/**
 * useSlotInteraction - Хук для обработки взаимодействия со слотами
 * 
 * Общая логика для всех интерфейсов: перетаскивание, разделение стака и т.д.
 */
const useSlotInteraction = () => {
    const [cursorItem, setCursorItem] = useState(null);
    const [hoveredSlot, setHoveredSlot] = useState(null);
    const [hoveredBlockName, setHoveredBlockName] = useState(null);

    const cursorRef = useRef(null);
    const tooltipRef = useRef(null);

    // Обработка движения мыши
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (cursorRef.current) {
                cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%) scale(1.1)`;
            }
            if (tooltipRef.current) {
                tooltipRef.current.style.transform = `translate(${e.clientX + 15}px, ${e.clientY - 30}px)`;
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Левый клик по слоту
    const handleSlotClick = useCallback((slots, setSlots, index, isResultSlot = false, onCraftPickup = null, shiftKey = false) => {
        if (isResultSlot) {
            if (!onCraftPickup) return;

            const result = onCraftPickup(shiftKey);
            if (result && !shiftKey) {
                const cursorData = cursorItem ? getSlotData(cursorItem) : null;

                if (cursorData && cursorData.type === result.type && cursorData.count + result.count <= MAX_STACK_SIZE) {
                    setCursorItem({ type: cursorData.type, count: cursorData.count + result.count });
                } else if (!cursorData) {
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
                // Пустой слот - кладём всё
                const newSlots = [...slots];
                newSlots[index] = { type: cursorData.type, count: cursorData.count };
                setSlots(newSlots);
                setCursorItem(null);
            } else if (currentType === cursorData.type) {
                // Тот же тип - объединяем
                const totalCount = currentCount + cursorData.count;
                const newSlotCount = Math.min(totalCount, MAX_STACK_SIZE);
                const remaining = totalCount - newSlotCount;

                const newSlots = [...slots];
                newSlots[index] = { type: currentType, count: newSlotCount };
                setSlots(newSlots);

                setCursorItem(remaining > 0 ? { type: cursorData.type, count: remaining } : null);
            } else {
                // Разные типы - обмен
                const newSlots = [...slots];
                newSlots[index] = { type: cursorData.type, count: cursorData.count };
                setSlots(newSlots);
                setCursorItem({ type: currentType, count: currentCount });
            }
        } else {
            // Берём предмет
            if (currentType) {
                setCursorItem({ type: currentType, count: currentCount });
                const newSlots = [...slots];
                newSlots[index] = null;
                setSlots(newSlots);
            }
        }
    }, [cursorItem]);

    // Правый клик по слоту
    const handleSlotRightClick = useCallback((slots, setSlots, index, isResultSlot = false) => {
        if (isResultSlot) return;

        const currentSlot = slots[index];
        const { type: currentType, count: currentCount } = getSlotData(currentSlot);

        if (cursorItem) {
            const cursorData = getSlotData(cursorItem);

            if (!currentType) {
                // Пустой слот - кладём 1
                const newSlots = [...slots];
                newSlots[index] = { type: cursorData.type, count: 1 };
                setSlots(newSlots);

                if (cursorData.count > 1) {
                    setCursorItem({ type: cursorData.type, count: cursorData.count - 1 });
                } else {
                    setCursorItem(null);
                }
            } else if (currentType === cursorData.type && currentCount < MAX_STACK_SIZE) {
                // Тот же тип - добавляем 1
                const newSlots = [...slots];
                newSlots[index] = { type: currentType, count: currentCount + 1 };
                setSlots(newSlots);

                if (cursorData.count > 1) {
                    setCursorItem({ type: cursorData.type, count: cursorData.count - 1 });
                } else {
                    setCursorItem(null);
                }
            }
        } else {
            // Берём половину
            if (currentType && currentCount > 0) {
                const takeCount = Math.ceil(currentCount / 2);
                const leaveCount = currentCount - takeCount;

                setCursorItem({ type: currentType, count: takeCount });

                const newSlots = [...slots];
                newSlots[index] = leaveCount > 0 ? { type: currentType, count: leaveCount } : null;
                setSlots(newSlots);
            }
        }
    }, [cursorItem]);

    // Обновление подсказки при наведении
    const handleSlotHover = useCallback((index, hovered, slot) => {
        if (hovered && slot) {
            const { type } = getSlotData(slot);
            if (type) {
                const block = BlockRegistry.get(type);
                setHoveredBlockName(block?.name || null);
                setHoveredSlot(index);
            }
        } else if (!hovered && hoveredSlot === index) {
            setHoveredBlockName(null);
            setHoveredSlot(null);
        }
    }, [hoveredSlot]);

    // Сброс при закрытии
    const reset = useCallback(() => {
        setCursorItem(null);
        setHoveredBlockName(null);
        setHoveredSlot(null);
    }, []);

    return {
        cursorItem,
        setCursorItem,
        hoveredBlockName,
        cursorRef,
        tooltipRef,
        handleSlotClick,
        handleSlotRightClick,
        handleSlotHover,
        reset
    };
};

/**
 * InventoryUI - Интерфейс инвентаря игрока (2x2 крафт)
 */
const InventoryUI = ({
    inventory,
    onInventoryChange,
    craftingGrid,
    onCraftingGridChange,
    craftingResult,
    onCraftResultPickup,
    onShiftCraft,
    isCreativeMode,
    slotInteraction
}) => {
    const { handleSlotClick, handleSlotRightClick, handleSlotHover } = slotInteraction;

    if (isCreativeMode) {
        // Creative mode - простой список блоков
        return (
            <div className="mc-creative-content">
                <div className="mc-scroll-container">
                    {/* Тут будет список всех блоков */}
                </div>
            </div>
        );
    }

    return (
        <div className="mc-survival-content">
            {/* Область крафта 2x2 */}
            <div className="mc-crafting-area">
                <div className="mc-player-preview">
                    <div className="mc-player-silhouette" />
                </div>

                <div className="mc-crafting-grid">
                    <div className="mc-crafting-slots">
                        {craftingGrid.map((slot, i) => (
                            <MCSlot
                                key={`craft-${i}`}
                                slot={slot}
                                onClick={(e) => handleSlotClick(craftingGrid, onCraftingGridChange, i, false, null, e.shiftKey)}
                                onRightClick={() => handleSlotRightClick(craftingGrid, onCraftingGridChange, i)}
                                onHover={(hovered) => handleSlotHover(i, hovered, slot)}
                            />
                        ))}
                    </div>
                    <div className="mc-crafting-arrow">→</div>
                    <MCSlot
                        slot={craftingResult}
                        onClick={(e) => handleSlotClick(null, null, 0, true, () => onCraftResultPickup(), e.shiftKey)}
                        onHover={(hovered) => handleSlotHover(-1, hovered, craftingResult)}
                    />
                </div>
            </div>

            {/* Основной инвентарь */}
            <div className="mc-main-inventory">
                {Array.from({ length: 3 }).map((_, row) => (
                    <div key={row} className="mc-inventory-row">
                        {Array.from({ length: 9 }).map((_, col) => {
                            const index = HOTBAR_SIZE + row * 9 + col;
                            return (
                                <MCSlot
                                    key={index}
                                    slot={inventory[index]}
                                    onClick={(e) => handleSlotClick(inventory, onInventoryChange, index, false, null, e.shiftKey)}
                                    onRightClick={() => handleSlotRightClick(inventory, onInventoryChange, index)}
                                    onHover={(hovered) => handleSlotHover(index, hovered, inventory[index])}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Хотбар */}
            <div className="mc-hotbar-row survival">
                {Array.from({ length: HOTBAR_SIZE }).map((_, index) => (
                    <MCSlot
                        key={index}
                        slot={inventory[index]}
                        onClick={(e) => handleSlotClick(inventory, onInventoryChange, index, false, null, e.shiftKey)}
                        onRightClick={() => handleSlotRightClick(inventory, onInventoryChange, index)}
                        onHover={(hovered) => handleSlotHover(index, hovered, inventory[index])}
                    />
                ))}
            </div>
        </div>
    );
};

/**
 * CraftingUI - Интерфейс верстака (3x3 крафт)
 */
const CraftingUI = ({
    inventory,
    onInventoryChange,
    craftingGrid,
    onCraftingGridChange,
    craftingResult,
    onCraftResultPickup,
    onShiftCraft,
    slotInteraction
}) => {
    const { handleSlotClick, handleSlotRightClick, handleSlotHover } = slotInteraction;

    return (
        <div className="mc-crafting-interface">
            {/* 3x3 Crafting Grid */}
            <div className="mc-crafting-area-3x3">
                <div className="mc-crafting-grid-3x3">
                    <div className="mc-crafting-slots-3x3">
                        {craftingGrid.map((slot, i) => (
                            <MCSlot
                                key={`craft-${i}`}
                                slot={slot}
                                onClick={(e) => handleSlotClick(craftingGrid, onCraftingGridChange, i, false, null, e.shiftKey)}
                                onRightClick={() => handleSlotRightClick(craftingGrid, onCraftingGridChange, i)}
                                onHover={(hovered) => handleSlotHover(i, hovered, slot)}
                            />
                        ))}
                    </div>
                    <div className="mc-crafting-arrow">→</div>
                    <div className="mc-result-slot">
                        <MCSlot
                            slot={craftingResult}
                            onClick={(e) => handleSlotClick(null, null, 0, true, () => onCraftResultPickup(), e.shiftKey)}
                            onHover={(hovered) => handleSlotHover(-1, hovered, craftingResult)}
                        />
                    </div>
                </div>
            </div>

            {/* Main inventory */}
            <div className="mc-main-inventory">
                {Array.from({ length: 3 }).map((_, row) => (
                    <div key={row} className="mc-inventory-row">
                        {Array.from({ length: 9 }).map((_, col) => {
                            const index = HOTBAR_SIZE + row * 9 + col;
                            return (
                                <MCSlot
                                    key={index}
                                    slot={inventory[index]}
                                    onClick={(e) => handleSlotClick(inventory, onInventoryChange, index, false, null, e.shiftKey)}
                                    onRightClick={() => handleSlotRightClick(inventory, onInventoryChange, index)}
                                    onHover={(hovered) => handleSlotHover(index, hovered, inventory[index])}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Hotbar */}
            <div className="mc-hotbar-row survival">
                {Array.from({ length: HOTBAR_SIZE }).map((_, index) => (
                    <MCSlot
                        key={index}
                        slot={inventory[index]}
                        onClick={(e) => handleSlotClick(inventory, onInventoryChange, index, false, null, e.shiftKey)}
                        onRightClick={() => handleSlotRightClick(inventory, onInventoryChange, index)}
                        onHover={(hovered) => handleSlotHover(index, hovered, inventory[index])}
                    />
                ))}
            </div>
        </div>
    );
};

/**
 * UIManager - Централизованный менеджер интерфейсов
 * 
 * Единая точка входа для всех игровых UI.
 * Управляет открытием/закрытием и передачей данных между интерфейсами.
 */
const UIManager = ({
    activeUI,
    onClose,
    // Inventory data
    inventory,
    onInventoryChange,
    isCreativeMode,
    // 2x2 crafting (inventory)
    craftingGrid,
    onCraftingGridChange,
    craftingResult,
    onCraftResultPickup,
    onShiftCraft,
    // 3x3 crafting (crafting table)
    craftingGrid3x3,
    onCraftingGrid3x3Change,
    craftingResult3x3,
    onCraftResult3x3Pickup,
    onShiftCraft3x3
}) => {
    const slotInteraction = useSlotInteraction();
    const { cursorItem, hoveredBlockName, cursorRef, tooltipRef, reset } = slotInteraction;

    // Сброс при закрытии UI
    useEffect(() => {
        if (activeUI === UI_TYPES.NONE) {
            reset();
        }
    }, [activeUI, reset]);

    // Обработка правого клика на оверлей (сброс предмета)
    const handleOverlayRightClick = (e) => {
        e.preventDefault();
        if (cursorItem) {
            slotInteraction.setCursorItem(null);
        }
    };

    if (activeUI === UI_TYPES.NONE) return null;

    // Определяем заголовок и контент
    let title = '';
    let content = null;
    let windowClass = '';

    switch (activeUI) {
        case UI_TYPES.INVENTORY:
            title = isCreativeMode ? 'Creative Inventory' : 'Inventory';
            windowClass = isCreativeMode ? 'creative' : 'survival';
            content = (
                <InventoryUI
                    inventory={inventory}
                    onInventoryChange={onInventoryChange}
                    craftingGrid={craftingGrid}
                    onCraftingGridChange={onCraftingGridChange}
                    craftingResult={craftingResult}
                    onCraftResultPickup={onCraftResultPickup}
                    onShiftCraft={onShiftCraft}
                    isCreativeMode={isCreativeMode}
                    slotInteraction={slotInteraction}
                />
            );
            break;

        case UI_TYPES.CRAFTING:
            title = 'Crafting';
            windowClass = 'crafting-table';
            content = (
                <CraftingUI
                    inventory={inventory}
                    onInventoryChange={onInventoryChange}
                    craftingGrid={craftingGrid3x3}
                    onCraftingGridChange={onCraftingGrid3x3Change}
                    craftingResult={craftingResult3x3}
                    onCraftResultPickup={onCraftResult3x3Pickup}
                    onShiftCraft={onShiftCraft3x3}
                    slotInteraction={slotInteraction}
                />
            );
            break;

        case UI_TYPES.FURNACE:
            title = 'Furnace';
            windowClass = 'furnace';
            content = <div>Furnace UI - Coming Soon</div>;
            break;

        default:
            return null;
    }

    return (
        <div className="mc-overlay" onContextMenu={handleOverlayRightClick}>
            <div className={`mc-window ${windowClass}`} onClick={e => e.stopPropagation()}>
                <div className="mc-window-title">{title}</div>
                {content}

                {/* Tooltip */}
                <MCTooltip
                    ref={tooltipRef}
                    text={hoveredBlockName}
                    visible={!!hoveredBlockName && !cursorItem}
                />

                {/* Cursor item */}
                <MCCursorItem ref={cursorRef} item={cursorItem} />
            </div>
        </div>
    );
};

export default UIManager;

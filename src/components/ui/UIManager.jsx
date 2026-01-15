import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BlockRegistry } from '../../core/blocks/BlockRegistry';
import { MCSlot, MCGrid, MCCursorItem, MCTooltip, getSlotData } from './MCSlot';
import { UI_TYPES, UI_CONFIG } from '../../constants/uiTypes';
import { MAX_STACK_SIZE, HOTBAR_SIZE } from '../../utils/inventory';
import { Inventory } from '../../core/inventory/Inventory';
import { getSmeltingRecipe, getFuelBurnTime } from '../../constants/recipes';
import { FurnaceManager } from '../../core/FurnaceManager';
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
    const [hoveredItemDurability, setHoveredItemDurability] = useState(null);

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
    const handleSlotClick = useCallback((slots, setSlots, index, isResultSlot = false, onCraftPickup = null, onShiftCraftFunc = null, shiftKey = false) => {
        if (isResultSlot) {
            if (!onCraftPickup) return;

            // Если зажат Shift - крафтим всё возможное в инвентарь
            if (shiftKey && onShiftCraftFunc) {
                onShiftCraftFunc();
                return;
            }

            // Обычный клик - берём результат на курсор
            const result = onCraftPickup();
            if (result) {
                const cursorData = cursorItem ? getSlotData(cursorItem) : null;
                const maxStack = Inventory.getMaxStackSize(result.type);

                if (cursorData && cursorData.type === result.type && cursorData.count + result.count <= maxStack) {
                    setCursorItem({ ...cursorData, count: cursorData.count + result.count });
                } else if (!cursorData) {
                    setCursorItem(result);
                }
            }
            return;
        }

        const currentSlot = slots[index];
        const { type: currentType, count: currentCount, durability: currentDurability } = getSlotData(currentSlot);

        if (cursorItem) {
            const cursorData = getSlotData(cursorItem);
            const maxStack = Inventory.getMaxStackSize(cursorData.type);

            if (!currentType) {
                // Пустой слот - кладём всё
                const newSlots = [...slots];
                newSlots[index] = cursorData;
                setSlots(newSlots);
                setCursorItem(null);
            } else if (currentType === cursorData.type) {
                // Тот же тип - объединяем (если позволяет стак)
                if (maxStack === 1) {
                    // Если предмет не стакается (инструмент), меняем местами
                    const newSlots = [...slots];
                    newSlots[index] = cursorData;
                    setSlots(newSlots);
                    setCursorItem({ type: currentType, count: currentCount, durability: currentDurability });
                } else {
                    const totalCount = currentCount + cursorData.count;
                    const newSlotCount = Math.min(totalCount, maxStack);
                    const remaining = totalCount - newSlotCount;

                    const newSlots = [...slots];
                    newSlots[index] = { ...cursorData, count: newSlotCount };
                    setSlots(newSlots);

                    setCursorItem(remaining > 0 ? { ...cursorData, count: remaining } : null);
                }
            } else {
                // Разные типы - обмен
                const newSlots = [...slots];
                newSlots[index] = cursorData;
                setSlots(newSlots);
                setCursorItem({ type: currentType, count: currentCount, durability: currentDurability });
            }
        } else {
            // Берём предмет
            if (currentType) {
                setCursorItem({ type: currentType, count: currentCount, durability: currentDurability });
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
        const { type: currentType, count: currentCount, durability: currentDurability } = getSlotData(currentSlot);

        if (cursorItem) {
            const cursorData = getSlotData(cursorItem);
            const maxStack = Inventory.getMaxStackSize(cursorData.type);

            if (!currentType) {
                // Пустой слот - кладём 1
                const newSlots = [...slots];
                newSlots[index] = { ...cursorData, count: 1 };
                setSlots(newSlots);

                if (cursorData.count > 1) {
                    setCursorItem({ ...cursorData, count: cursorData.count - 1 });
                } else {
                    setCursorItem(null);
                }
            } else if (currentType === cursorData.type && currentCount < maxStack) {
                // Тот же тип - добавляем 1
                const newSlots = [...slots];
                newSlots[index] = { ...currentSlot, count: currentCount + 1 };
                setSlots(newSlots);

                if (cursorData.count > 1) {
                    setCursorItem({ ...cursorData, count: cursorData.count - 1 });
                } else {
                    setCursorItem(null);
                }
            } else if (currentType !== cursorData.type) {
                 // Swap if trying to right click on different item (standard Minecraft behavior is actually strict, but swapping is often better UX for web)
                 // But let's keep it simple: do nothing or swap? Minecraft doesn't swap on right click usually.
            }
        } else {
            // Берём половину
            if (currentType && currentCount > 0) {
                const takeCount = Math.ceil(currentCount / 2);
                const leaveCount = currentCount - takeCount;

                setCursorItem({ type: currentType, count: takeCount, durability: currentDurability });

                const newSlots = [...slots];
                newSlots[index] = leaveCount > 0 ? { type: currentType, count: leaveCount, durability: currentDurability } : null;
                setSlots(newSlots);
            }
        }
    }, [cursorItem]);

    // Обновление подсказки при наведении
    const handleSlotHover = useCallback((index, hovered, slot) => {
        if (hovered && slot) {
            const { type, durability } = getSlotData(slot);
            if (type) {
                const block = BlockRegistry.get(type);
                setHoveredBlockName(block?.name || null);
                
                // Проверяем прочность
                if (durability !== undefined && block?.maxDurability > 0) {
                    setHoveredItemDurability(`${durability} / ${block.maxDurability}`);
                } else {
                    setHoveredItemDurability(null);
                }
                
                setHoveredSlot(index);
            }
        } else if (!hovered && hoveredSlot === index) {
            setHoveredBlockName(null);
            setHoveredItemDurability(null);
            setHoveredSlot(null);
        }
    }, [hoveredSlot]);

    // Сброс при закрытии
    const reset = useCallback(() => {
        setCursorItem(null);
        setHoveredBlockName(null);
        setHoveredItemDurability(null);
        setHoveredSlot(null);
    }, []);

    return {
        cursorItem,
        setCursorItem,
        hoveredBlockName,
        hoveredItemDurability, // Экспортируем
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
        const [searchQuery, setSearchQuery] = useState('');

        const filteredBlocks = React.useMemo(() => {
            const all = BlockRegistry.getAll().filter(b => b.id !== 0);
            if (!searchQuery) return all;
            return all.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }, [searchQuery]);

        const handlePaletteClick = (blockId) => {
            const block = BlockRegistry.get(blockId);
            const count = block?.isTool ? 1 : MAX_STACK_SIZE;
            slotInteraction.setCursorItem({ type: blockId, count });
        };

        // Вычисляем сколько пустых слотов нужно добавить, чтобы дополнить последний ряд
        const slotsPerRow = 9;
        const totalItems = filteredBlocks.length;
        const emptySlotsCount = (slotsPerRow - (totalItems % slotsPerRow)) % slotsPerRow;
        
        // Вычисляем динамическую высоту контейнера
        const totalRows = Math.ceil((totalItems + emptySlotsCount) / slotsPerRow);
        const containerHeight = totalRows * 54 + 12; // 54px на ряд + 8px для компенсации padding и границ

        return (
            <div className="mc-creative-content">
                <div className="mc-search-bar">
                    <input
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="mc-scroll-container" style={{ height: `${containerHeight}px` }}>
                    <div className="mc-grid">
                        {filteredBlocks.map(block => (
                            <MCSlot
                                key={block.id}
                                slot={block.id}
                                onClick={() => handlePaletteClick(block.id)}
                                onHover={(hovered) => handleSlotHover(block.id, hovered, block.id)}
                                showCount={false}
                            />
                        ))}
                        {/* Дополняем последний ряд пустыми ячейками */}
                        {Array.from({ length: emptySlotsCount }).map((_, i) => (
                            <MCSlot
                                key={`empty-${i}`}
                                slot={null}
                                disabled={true}
                                className="empty"
                            />
                        ))}
                    </div>
                </div>
                <div className="mc-separator">Hotbar</div>
                <div className="mc-hotbar-row">
                    {Array.from({ length: HOTBAR_SIZE }).map((_, index) => (
                        <MCSlot
                            key={index}
                            slot={inventory[index]}
                            onClick={(e) => handleSlotClick(inventory, onInventoryChange, index, false, null, null, e.shiftKey)}
                            onRightClick={() => handleSlotRightClick(inventory, onInventoryChange, index)}
                            onHover={(hovered) => handleSlotHover(index, hovered, inventory[index])}
                        />
                    ))}
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
                                onClick={(e) => handleSlotClick(craftingGrid, onCraftingGridChange, i, false, null, null, e.shiftKey)}
                                onRightClick={() => handleSlotRightClick(craftingGrid, onCraftingGridChange, i)}
                                onHover={(hovered) => handleSlotHover(i, hovered, slot)}
                            />
                        ))}
                    </div>
                    <div className="mc-crafting-arrow">→</div>
                    <MCSlot
                        slot={craftingResult}
                        onClick={(e) => handleSlotClick(null, null, 0, true, onCraftResultPickup, onShiftCraft, e.shiftKey)}
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
                                onClick={(e) => handleSlotClick(craftingGrid, onCraftingGridChange, i, false, null, null, e.shiftKey)}
                                onRightClick={() => handleSlotRightClick(craftingGrid, onCraftingGridChange, i)}
                                onHover={(hovered) => handleSlotHover(i, hovered, slot)}
                            />
                        ))}
                    </div>
                    <div className="mc-crafting-arrow">→</div>
                    <div className="mc-result-slot">
                        <MCSlot
                            slot={craftingResult}
                            onClick={(e) => handleSlotClick(null, null, 0, true, onCraftResultPickup, onShiftCraft, e.shiftKey)}
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
 * FurnaceUI - Интерфейс печки
 */
const FurnaceUI = ({
    inventory,
    onInventoryChange,
    furnaceData,
    onFurnaceDataChange,
    furnacePosition,
    slotInteraction
}) => {
    const { handleSlotClick, handleSlotRightClick, handleSlotHover, cursorItem, setCursorItem } = slotInteraction;

    // Состояние печки: { inputSlot, fuelSlot, outputSlot, burnTime, maxBurnTime, smeltProgress, smeltTime }
    const [inputSlot, setInputSlot] = useState(furnaceData?.inputSlot || null);
    const [fuelSlot, setFuelSlot] = useState(furnaceData?.fuelSlot || null);
    const [outputSlot, setOutputSlot] = useState(furnaceData?.outputSlot || null);
    const [burnTime, setBurnTime] = useState(furnaceData?.burnTime || 0);
    const [maxBurnTime, setMaxBurnTime] = useState(furnaceData?.maxBurnTime || 0);
    const [smeltProgress, setSmeltProgress] = useState(furnaceData?.smeltProgress || 0);
    const [currentRecipe, setCurrentRecipe] = useState(null);

    // Обновляем FurnaceManager при изменении состояния горения
    useEffect(() => {
        if (furnacePosition) {
            FurnaceManager.setFurnaceState(
                furnacePosition.x,
                furnacePosition.y,
                furnacePosition.z,
                burnTime > 0,
                burnTime
            );
        }
    }, [burnTime, furnacePosition]);

    // Очищаем состояние при размонтировании (закрытии UI)
    useEffect(() => {
        return () => {
            // Не очищаем, чтобы печка продолжала гореть после закрытия UI
            // Это временное решение - в будущем состояние должно храниться в мире
        };
    }, []);

    // Логика плавки
    useEffect(() => {
        const interval = setInterval(() => {
            // Проверяем рецепт для текущего входного предмета
            const inputData = getSlotData(inputSlot);
            const recipe = inputData.type ? getSmeltingRecipe(inputData.type) : null;
            setCurrentRecipe(recipe);

            // Если есть топливо и оно горит
            if (burnTime > 0) {
                setBurnTime(prev => Math.max(0, prev - 100)); // Уменьшаем на 100мс

                // Если есть рецепт и входной предмет
                if (recipe && inputData.type && inputData.count > 0) {
                    // Проверяем, можно ли положить результат в выходной слот
                    const outputData = getSlotData(outputSlot);
                    const canOutput = !outputData.type ||
                        (outputData.type === recipe.output.type && outputData.count < MAX_STACK_SIZE);

                    if (canOutput) {
                        // Прогресс плавки
                        setSmeltProgress(prev => {
                            const newProgress = prev + 100;
                            if (newProgress >= recipe.time) {
                                // Плавка завершена!
                                // Забираем 1 предмет из входа
                                if (inputData.count > 1) {
                                    setInputSlot({ type: inputData.type, count: inputData.count - 1 });
                                } else {
                                    setInputSlot(null);
                                }

                                // Добавляем результат в выход
                                if (outputData.type) {
                                    setOutputSlot({ type: outputData.type, count: outputData.count + recipe.output.count });
                                } else {
                                    setOutputSlot({ type: recipe.output.type, count: recipe.output.count });
                                }

                                return 0; // Сброс прогресса
                            }
                            return newProgress;
                        });
                    }
                } else {
                    // Нет рецепта или входа - сбрасываем прогресс
                    if (smeltProgress > 0) setSmeltProgress(0);
                }
            } else {
                // Топливо закончилось - пытаемся взять новое
                const fuelData = getSlotData(fuelSlot);
                if (fuelData.type && recipe && inputData.type) {
                    const fuelTime = getFuelBurnTime(fuelData.type);
                    if (fuelTime > 0) {
                        // Проверяем, можно ли положить результат
                        const outputData = getSlotData(outputSlot);
                        const canOutput = !outputData.type ||
                            (outputData.type === recipe.output.type && outputData.count < MAX_STACK_SIZE);

                        if (canOutput) {
                            // Зажигаем топливо
                            setBurnTime(fuelTime);
                            setMaxBurnTime(fuelTime);

                            // Забираем 1 топливо
                            if (fuelData.count > 1) {
                                setFuelSlot({ type: fuelData.type, count: fuelData.count - 1 });
                            } else {
                                setFuelSlot(null);
                            }
                        }
                    }
                }

                // Если нет горящего топлива, сбрасываем прогресс
                if (smeltProgress > 0) {
                    setSmeltProgress(prev => Math.max(0, prev - 50)); // Медленно сбрасывается
                }
            }
        }, 100); // Обновление каждые 100мс

        return () => clearInterval(interval);
    }, [inputSlot, fuelSlot, outputSlot, burnTime, smeltProgress]);

    // Сохранение состояния печки при изменениях
    useEffect(() => {
        if (onFurnaceDataChange) {
            onFurnaceDataChange({
                inputSlot,
                fuelSlot,
                outputSlot,
                burnTime,
                maxBurnTime,
                smeltProgress
            });
        }
    }, [inputSlot, fuelSlot, outputSlot, burnTime, maxBurnTime, smeltProgress, onFurnaceDataChange]);

    // Обработчик клика по слоту печки
    const handleFurnaceSlotClick = (slotType, e) => {
        let currentSlot, setSlot;

        if (slotType === 'input') {
            currentSlot = inputSlot;
            setSlot = setInputSlot;
        } else if (slotType === 'fuel') {
            currentSlot = fuelSlot;
            setSlot = setFuelSlot;
        } else if (slotType === 'output') {
            // Выходной слот - только забирать
            if (outputSlot && !cursorItem) {
                setCursorItem(outputSlot);
                setOutputSlot(null);
            } else if (outputSlot && cursorItem) {
                const cursorData = getSlotData(cursorItem);
                const outputData = getSlotData(outputSlot);
                if (cursorData.type === outputData.type) {
                    const total = cursorData.count + outputData.count;
                    if (total <= MAX_STACK_SIZE) {
                        setCursorItem({ type: cursorData.type, count: total });
                        setOutputSlot(null);
                    }
                }
            }
            return;
        }

        const { type: currentType, count: currentCount } = getSlotData(currentSlot);

        if (cursorItem) {
            const cursorData = getSlotData(cursorItem);

            // Проверка для топлива - только топливные предметы
            if (slotType === 'fuel' && getFuelBurnTime(cursorData.type) === 0) {
                return; // Не топливо - не кладём
            }

            // Проверка для входа - только плавимые предметы
            if (slotType === 'input' && !getSmeltingRecipe(cursorData.type)) {
                return; // Не плавится - не кладём
            }

            if (!currentType) {
                setSlot({ type: cursorData.type, count: cursorData.count });
                setCursorItem(null);
            } else if (currentType === cursorData.type) {
                const total = currentCount + cursorData.count;
                const newSlotCount = Math.min(total, MAX_STACK_SIZE);
                const remaining = total - newSlotCount;
                setSlot({ type: currentType, count: newSlotCount });
                setCursorItem(remaining > 0 ? { type: cursorData.type, count: remaining } : null);
            } else {
                setSlot({ type: cursorData.type, count: cursorData.count });
                setCursorItem({ type: currentType, count: currentCount });
            }
        } else {
            if (currentType) {
                setCursorItem({ type: currentType, count: currentCount });
                setSlot(null);
            }
        }
    };

    // Обработчик правого клика по слоту печки
    const handleFurnaceSlotRightClick = (slotType) => {
        if (slotType === 'output') return;

        let currentSlot, setSlot;

        if (slotType === 'input') {
            currentSlot = inputSlot;
            setSlot = setInputSlot;
        } else if (slotType === 'fuel') {
            currentSlot = fuelSlot;
            setSlot = setFuelSlot;
        }

        const { type: currentType, count: currentCount } = getSlotData(currentSlot);

        if (cursorItem) {
            const cursorData = getSlotData(cursorItem);

            // Проверка для топлива
            if (slotType === 'fuel' && getFuelBurnTime(cursorData.type) === 0) return;
            // Проверка для входа
            if (slotType === 'input' && !getSmeltingRecipe(cursorData.type)) return;

            if (!currentType) {
                setSlot({ type: cursorData.type, count: 1 });
                if (cursorData.count > 1) {
                    setCursorItem({ type: cursorData.type, count: cursorData.count - 1 });
                } else {
                    setCursorItem(null);
                }
            } else if (currentType === cursorData.type && currentCount < MAX_STACK_SIZE) {
                setSlot({ type: currentType, count: currentCount + 1 });
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
                setSlot(leaveCount > 0 ? { type: currentType, count: leaveCount } : null);
            }
        }
    };

    const burnProgress = maxBurnTime > 0 ? burnTime / maxBurnTime : 0;
    const smeltProgressPct = currentRecipe ? smeltProgress / currentRecipe.time : 0;

    return (
        <div className="mc-furnace-interface">
            {/* Furnace slots area */}
            <div className="mc-furnace-area">
                <div className="mc-furnace-grid">
                    {/* Input and Fuel slots */}
                    <div className="mc-furnace-slots">
                        <div className="mc-furnace-input">
                            <MCSlot
                                slot={inputSlot}
                                onClick={(e) => handleFurnaceSlotClick('input', e)}
                                onRightClick={() => handleFurnaceSlotRightClick('input')}
                                onHover={(hovered) => handleSlotHover(-10, hovered, inputSlot)}
                            />
                        </div>
                        <div className="mc-furnace-fuel">
                            <MCSlot
                                slot={fuelSlot}
                                onClick={(e) => handleFurnaceSlotClick('fuel', e)}
                                onRightClick={() => handleFurnaceSlotRightClick('fuel')}
                                onHover={(hovered) => handleSlotHover(-11, hovered, fuelSlot)}
                            />
                        </div>
                    </div>

                    {/* Progress indicators */}
                    <div className="mc-furnace-progress">
                        {/* Fire indicator */}
                        <div className="mc-furnace-fire">
                            <div
                                className="mc-furnace-fire-fill"
                                style={{ height: `${burnProgress * 100}%` }}
                            />
                        </div>

                        {/* Arrow indicator */}
                        <div className="mc-furnace-arrow">
                            <div
                                className="mc-furnace-arrow-fill"
                                style={{ width: `${smeltProgressPct * 100}%` }}
                            />
                            <span className="mc-furnace-arrow-icon">→</span>
                        </div>
                    </div>

                    {/* Output slot */}
                    <div className="mc-result-slot">
                        <MCSlot
                            slot={outputSlot}
                            onClick={(e) => handleFurnaceSlotClick('output', e)}
                            onHover={(hovered) => handleSlotHover(-12, hovered, outputSlot)}
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
    onShiftCraft3x3,
    // Furnace
    furnaceData,
    onFurnaceDataChange,
    furnacePosition
}) => {
    const slotInteraction = useSlotInteraction();
    const { cursorItem, hoveredBlockName, hoveredItemDurability, cursorRef, tooltipRef, reset } = slotInteraction;

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
            content = (
                <FurnaceUI
                    inventory={inventory}
                    onInventoryChange={onInventoryChange}
                    furnaceData={furnaceData}
                    onFurnaceDataChange={onFurnaceDataChange}
                    furnacePosition={furnacePosition}
                    slotInteraction={slotInteraction}
                />
            );
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
                    durability={hoveredItemDurability}
                    visible={!!hoveredBlockName && !cursorItem}
                />

                {/* Cursor item */}
                <MCCursorItem ref={cursorRef} item={cursorItem} isCreative={isCreativeMode} />
            </div>
        </div>
    );
};

export default UIManager;

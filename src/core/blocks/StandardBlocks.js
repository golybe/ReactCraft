import { Block } from './Block';

export class AirBlock extends Block {
  constructor() {
    super(0, {
      name: 'air',
      solid: false,
      transparent: true,
      texture: null
    });
  }
}

export class SolidBlock extends Block {
  constructor(id, settings) {
    super(id, {
      solid: true,
      transparent: false,
      ...settings
    });
  }
}

export class TransparentBlock extends Block {
  constructor(id, settings) {
    super(id, {
      solid: true,
      transparent: true, // Прозрачный, но твердый (стекло, листва)
      ...settings
    });
  }
}

export class LiquidBlock extends Block {
  constructor(id, settings) {
    super(id, {
      solid: false,
      transparent: true,
      liquid: true,
      ...settings
    });
  }
}

/**
 * Чистый предмет (не блок)
 */
export class Item extends Block {
  constructor(id, settings) {
    super(id, {
      solid: false,
      transparent: true,
      unbreakable: true, // Предметы нельзя поставить/сломать в мире как блоки
      isPlaceable: false,
      ...settings
    });
    this.isPlaceable = false;
  }
}

/**
 * Инструмент (топор, кирка, лопата и т.д.)
 */
export class Tool extends Item {
  constructor(id, settings) {
    super(id, {
      ...settings,
      isTool: true
    });
    this.isTool = true;
    this.toolType = settings.toolType || 'hand'; // тип инструмента (axe, pickaxe, shovel)
    this.toolEfficiency = settings.toolEfficiency || 1.0; // множитель скорости добычи
    this.durability = settings.durability || -1; // прочность (-1 = неломаемый)
    this.maxDurability = settings.durability || -1;
    this.maxStackSize = 1; // Инструменты не стакаются
  }
}

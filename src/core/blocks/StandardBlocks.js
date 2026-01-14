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

/**
 * Растение (трава, цветы) - рендерится как крест (X-shape)
 */
export class PlantBlock extends Block {
  constructor(id, settings) {
    super(id, {
      solid: false,
      transparent: true,
      ...settings,
      renderType: 'cross' // Специальный тип рендеринга
    });
    this.renderType = 'cross';
    this.isPlant = true;
  }
}

/**
 * Факел - источник света, рендерится как маленький объект
 */
export class TorchBlock extends Block {
  constructor(id, settings) {
    super(id, {
      solid: false,
      transparent: true,
      hardness: 0, // Мгновенно ломается
      ...settings,
      renderType: 'torch'
    });
    this.renderType = 'torch';
    this.lightLevel = settings.lightLevel || 14; // Факел даёт свет уровня 14
    this.isLightSource = true;
    this.renderAsItem = true; // В инвентаре рендерится как 2D предмет
    // Bounding box факела (для выделения)
    this.boundingBox = { minX: 0.4375, maxX: 0.5625, minY: 0, maxY: 0.625, minZ: 0.4375, maxZ: 0.5625 };
  }
}

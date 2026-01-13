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

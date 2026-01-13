import { BlockRegistry } from './blocks/BlockRegistry';
import { AirBlock, SolidBlock, TransparentBlock, LiquidBlock } from './blocks/StandardBlocks';
import { TOOL_TYPES } from './blocks/Block';

// Инициализация всех блоков
export const initBlocks = () => {
  // 0: AIR
  BlockRegistry.register(new AirBlock());

  // 1: GRASS (копает лопатой, дропает землю)
  BlockRegistry.register(new SolidBlock(1, {
    name: 'grass',
    texture: 'grass',
    color: 0x5bac36,
    hardness: 0.6,
    preferredTool: TOOL_TYPES.SHOVEL,
    drops: 2 // Дропает DIRT
  }));

  // 2: DIRT
  BlockRegistry.register(new SolidBlock(2, {
    name: 'dirt',
    texture: 'dirt',
    color: 0x79553a,
    hardness: 0.5,
    preferredTool: TOOL_TYPES.SHOVEL
  }));

  // 3: STONE (требует кирку, дропает булыжник - пока себя)
  BlockRegistry.register(new SolidBlock(3, {
    name: 'stone',
    texture: 'stone',
    color: 0x7d7d7d,
    hardness: 1.5,
    preferredTool: TOOL_TYPES.PICKAXE,
    requiresTool: true
  }));

  // 4: WOOD (топор)
  BlockRegistry.register(new SolidBlock(4, {
    name: 'wood',
    texture: 'wood',
    color: 0x664d36,
    hardness: 2.0,
    preferredTool: TOOL_TYPES.AXE
  }));

  // 5: LEAVES (ножницы, шанс дропнуть саженец - пока себя)
  BlockRegistry.register(new TransparentBlock(5, {
    name: 'leaves',
    texture: 'leaves',
    color: 0x3d7a28,
    hardness: 0.2,
    preferredTool: TOOL_TYPES.SHEARS,
    drops: null // Без ножниц не дропает (пока)
  }));

  // 6: SAND (лопата)
  BlockRegistry.register(new SolidBlock(6, {
    name: 'sand',
    texture: 'sand',
    color: 0xdccfa3,
    hardness: 0.5,
    preferredTool: TOOL_TYPES.SHOVEL
  }));

  // 7: WATER (не ломается обычно)
  BlockRegistry.register(new LiquidBlock(7, {
    name: 'water',
    texture: 'water',
    color: 0x3f76e4,
    drops: null
  }));

  // 8: BRICK (кирка)
  BlockRegistry.register(new SolidBlock(8, {
    name: 'brick',
    texture: 'brick',
    color: 0x966c5a,
    hardness: 2.0,
    preferredTool: TOOL_TYPES.PICKAXE,
    requiresTool: true
  }));

  // 9: COAL_ORE (кирка, дропает уголь - пока себя)
  BlockRegistry.register(new SolidBlock(9, {
    name: 'coal_ore',
    texture: 'coalOre',
    color: 0x383838,
    hardness: 3.0,
    preferredTool: TOOL_TYPES.PICKAXE,
    requiresTool: true,
    xp: 1
  }));

  // 10: IRON_ORE (кирка)
  BlockRegistry.register(new SolidBlock(10, {
    name: 'iron_ore',
    texture: 'ironOre',
    color: 0x8c8c8c,
    hardness: 3.0,
    preferredTool: TOOL_TYPES.PICKAXE,
    requiresTool: true
  }));

  // 11: GOLD_ORE (кирка)
  BlockRegistry.register(new SolidBlock(11, {
    name: 'gold_ore',
    texture: 'goldOre',
    color: 0x8c8c8c,
    hardness: 3.0,
    preferredTool: TOOL_TYPES.PICKAXE,
    requiresTool: true
  }));

  // 12: DIAMOND_ORE (кирка, дропает алмаз - пока себя)
  BlockRegistry.register(new SolidBlock(12, {
    name: 'diamond_ore',
    texture: 'diamondOre',
    color: 0x8c8c8c,
    hardness: 3.0,
    preferredTool: TOOL_TYPES.PICKAXE,
    requiresTool: true,
    xp: 5
  }));

  // 13: SNOW (лопата)
  BlockRegistry.register(new SolidBlock(13, {
    name: 'snow',
    texture: 'snow',
    color: 0xffffff,
    hardness: 0.2,
    preferredTool: TOOL_TYPES.SHOVEL
  }));

  // 14: PLANKS (топор)
  BlockRegistry.register(new SolidBlock(14, {
    name: 'planks',
    texture: 'planks',
    color: 0xa08356,
    hardness: 2.0,
    preferredTool: TOOL_TYPES.AXE
  }));

  // 15: BEDROCK (неразрушимый)
  BlockRegistry.register(new SolidBlock(15, {
    name: 'bedrock',
    texture: 'stone',
    color: 0x222222,
    hardness: Infinity,
    unbreakable: true,
    drops: null
  }));
};

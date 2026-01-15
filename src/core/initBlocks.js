import { BlockRegistry } from './blocks/BlockRegistry';
import { AirBlock, SolidBlock, TransparentBlock, LiquidBlock, Item, Tool, PlantBlock, TorchBlock } from './blocks/StandardBlocks';
import { TOOL_TYPES } from './blocks/Block';
import { BLOCK_TYPES } from '../constants/blockTypes';

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

  // 3: STONE (требует кирку, дропает булыжник)
  BlockRegistry.register(new SolidBlock(3, {
    name: 'stone',
    texture: 'stone',
    color: 0x7d7d7d,
    hardness: 1.5,
    preferredTool: TOOL_TYPES.PICKAXE,
    requiresTool: true,
    drops: 17 // Дропает COBBLESTONE
  }));

  // 4: WOOD (топор)
  BlockRegistry.register(new SolidBlock(4, {
    name: 'wood',
    texture: 'wood',
    color: 0x664d36,
    hardness: 2.0,
    preferredTool: TOOL_TYPES.AXE
  }));

  // 5: LEAVES (ножницы, 5% шанс дропнуть яблоко)
  BlockRegistry.register(new TransparentBlock(5, {
    name: 'leaves',
    texture: 'leaves',
    color: 0x3d7a28,
    hardness: 0.2,
    preferredTool: TOOL_TYPES.SHEARS,
    drops: null, // Без ножниц не дропает сам блок
    customDrops: [ // Но может дропнуть яблоко
      { type: BLOCK_TYPES.APPLE, chance: 0.05 } // 5% шанс
    ]
  }));

  // 6: SAND (лопата)
  BlockRegistry.register(new SolidBlock(6, {
    name: 'sand',
    texture: 'sand',
    color: 0xdccfa3,
    hardness: 0.5,
    preferredTool: TOOL_TYPES.SHOVEL,
    gravity: true
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

  // 9: COAL_ORE (кирка, дропает уголь)
  BlockRegistry.register(new SolidBlock(9, {
    name: 'coal_ore',
    texture: 'coalOre',
    color: 0x383838,
    hardness: 3.0,
    preferredTool: TOOL_TYPES.PICKAXE,
    requiresTool: true,
    drops: 514, // Дропает COAL
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

  // 12: DIAMOND_ORE (кирка, дропает алмаз)
  BlockRegistry.register(new SolidBlock(12, {
    name: 'diamond_ore',
    texture: 'diamondOre',
    color: 0x8c8c8c,
    hardness: 3.0,
    preferredTool: TOOL_TYPES.PICKAXE,
    requiresTool: true,
    drops: 515, // Дропает DIAMOND
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

  // 16: CRAFTING_TABLE
  BlockRegistry.register(new SolidBlock(16, {
    name: 'crafting_table',
    textures: {
      top: 'crafting_table_top',
      side: 'crafting_table_side',
      front: 'crafting_table_front'
    },
    color: 0x79553a,
    hardness: 2.5,
    preferredTool: TOOL_TYPES.AXE
  }));

  // 17: COBBLESTONE
  BlockRegistry.register(new SolidBlock(17, {
    name: 'cobblestone',
    texture: 'cobblestone',
    color: 0x7d7d7d,
    hardness: 2.0,
    preferredTool: TOOL_TYPES.PICKAXE,
    requiresTool: true
  }));

  // 18: GRAVEL (лопата, может дропнуть кремень)
  BlockRegistry.register(new SolidBlock(18, {
    name: 'gravel',
    texture: 'gravel',
    color: 0x857b7b,
    hardness: 0.6,
    preferredTool: TOOL_TYPES.SHOVEL,
    gravity: true
  }));

  // 19: SANDSTONE (кирка)
  BlockRegistry.register(new SolidBlock(19, {
    name: 'sandstone',
    texture: 'sandstone',
    color: 0xd9ca8f,
    hardness: 0.8,
    preferredTool: TOOL_TYPES.PICKAXE
  }));

  // 20: LAPIS_ORE (кирка)
  BlockRegistry.register(new SolidBlock(20, {
    name: 'lapis_ore',
    texture: 'lapisOre',
    color: 0x4668a3,
    hardness: 3.0,
    preferredTool: TOOL_TYPES.PICKAXE,
    requiresTool: true,
    xp: 3
  }));

  // 21: TALL_GRASS (Short Grass - декоративная трава)
  BlockRegistry.register(new PlantBlock(BLOCK_TYPES.TALL_GRASS, {
    name: 'tall_grass',
    texture: 'shortGrass',
    color: 0x5bac36,
    hardness: 0,
    drops: null, // Не дропает ничего (можно добавить семена позже)
    renderAsItem: true
  }));

  // 22: TORCH - факел (источник света)
  BlockRegistry.register(new TorchBlock(BLOCK_TYPES.TORCH, {
    name: 'torch',
    texture: 'torch',
    color: 0xffaa00,
    hardness: 0,
    lightLevel: 14 // Факел даёт свет 14 (как в Minecraft)
  }));

  // =========================================================
  // ITEMS (512+)
  // =========================================================

  // 512: STICK
  BlockRegistry.register(new Item(BLOCK_TYPES.STICK, {
    name: 'stick',
    texture: 'stick',
    color: 0xffffff
  }));

  // 513: APPLE (Food item)
  BlockRegistry.register(new Item(BLOCK_TYPES.APPLE, {
    name: 'apple',
    texture: 'apple',
    color: 0xff0000,
    isFood: true,
    healAmount: 4
  }));

  // 514: COAL
  BlockRegistry.register(new Item(BLOCK_TYPES.COAL, {
    name: 'coal',
    texture: 'coal',
    color: 0x1a1a1a
  }));

  // 515: DIAMOND
  BlockRegistry.register(new Item(BLOCK_TYPES.DIAMOND, {
    name: 'diamond',
    texture: 'diamond',
    color: 0x5decf5
  }));

  // =========================================================
  // TOOLS (520+)
  // =========================================================

  // 520: WOODEN_AXE
  BlockRegistry.register(new Tool(BLOCK_TYPES.WOODEN_AXE, {
    name: 'wooden_axe',
    texture: 'wooden_axe',
    color: 0x8B4513,
    toolType: TOOL_TYPES.AXE,
    toolEfficiency: 1.0, // Деревянные инструменты - базовая эффективность
    durability: 59
  }));

  // 521: WOODEN_PICKAXE
  BlockRegistry.register(new Tool(BLOCK_TYPES.WOODEN_PICKAXE, {
    name: 'wooden_pickaxe',
    texture: 'wooden_pickaxe',
    color: 0x8B4513,
    toolType: TOOL_TYPES.PICKAXE,
    toolEfficiency: 1.0,
    durability: 59
  }));

  // 522: WOODEN_SHOVEL
  BlockRegistry.register(new Tool(BLOCK_TYPES.WOODEN_SHOVEL, {
    name: 'wooden_shovel',
    texture: 'wooden_shovel',
    color: 0x8B4513,
    toolType: TOOL_TYPES.SHOVEL,
    toolEfficiency: 1.0,
    durability: 59
  }));

  // 523: STONE_AXE
  BlockRegistry.register(new Tool(BLOCK_TYPES.STONE_AXE, {
    name: 'stone_axe',
    texture: 'stone_axe',
    color: 0x7d7d7d,
    toolType: TOOL_TYPES.AXE,
    toolEfficiency: 2.0, // Каменные инструменты - в 2 раза быстрее деревянных
    durability: 131
  }));

  // 524: STONE_PICKAXE
  BlockRegistry.register(new Tool(BLOCK_TYPES.STONE_PICKAXE, {
    name: 'stone_pickaxe',
    texture: 'stone_pickaxe',
    color: 0x7d7d7d,
    toolType: TOOL_TYPES.PICKAXE,
    toolEfficiency: 2.0,
    durability: 131
  }));

  // 525: STONE_SHOVEL
  BlockRegistry.register(new Tool(BLOCK_TYPES.STONE_SHOVEL, {
    name: 'stone_shovel',
    texture: 'stone_shovel',
    color: 0x7d7d7d,
    toolType: TOOL_TYPES.SHOVEL,
    toolEfficiency: 2.0,
    durability: 131
  }));

  // 526: DIAMOND_AXE
  BlockRegistry.register(new Tool(BLOCK_TYPES.DIAMOND_AXE, {
    name: 'diamond_axe',
    texture: 'diamond_axe',
    color: 0x5decf5,
    toolType: TOOL_TYPES.AXE,
    toolEfficiency: 4.0, // Алмазные инструменты - в 4 раза быстрее деревянных
    durability: 1561
  }));

  // 527: DIAMOND_PICKAXE
  BlockRegistry.register(new Tool(BLOCK_TYPES.DIAMOND_PICKAXE, {
    name: 'diamond_pickaxe',
    texture: 'diamond_pickaxe',
    color: 0x5decf5,
    toolType: TOOL_TYPES.PICKAXE,
    toolEfficiency: 4.0,
    durability: 1561
  }));

  // 528: DIAMOND_SHOVEL
  BlockRegistry.register(new Tool(BLOCK_TYPES.DIAMOND_SHOVEL, {
    name: 'diamond_shovel',
    texture: 'diamond_shovel',
    color: 0x5decf5,
    toolType: TOOL_TYPES.SHOVEL,
    toolEfficiency: 4.0,
    durability: 1561
  }));
};

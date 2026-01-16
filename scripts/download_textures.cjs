const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://raw.githubusercontent.com/ItsBrian/minecraft-textures/main/';
const OUTPUT_DIR = path.join(__dirname, '../public/textures');

const files = {
  // === БЛОКИ ===
  'grass_top.png': 'block/grass_block_top.png',
  'grass_side.png': 'block/grass_block_side.png',
  'grass_side_overlay.png': 'block/grass_block_side_overlay.png',
  'short_grass.png': 'block/grass.png',
  'tall_grass_bottom.png': 'block/tall_grass_bottom.png',
  'tall_grass_top.png': 'block/tall_grass_top.png',
  'dirt.png': 'block/dirt.png',
  'stone.png': 'block/stone.png',
  'wood_side.png': 'block/oak_log.png',
  'wood_top.png': 'block/oak_log_top.png',
  'planks.png': 'block/oak_planks.png',
  'leaves.png': 'block/oak_leaves.png',
  'gravel.png': 'block/gravel.png',
  'sandstone.png': 'block/sandstone.png',
  'sandstone_top.png': 'block/sandstone_top.png',
  'sandstone_bottom.png': 'block/sandstone_bottom.png',
  'lapis_ore.png': 'block/lapis_ore.png',
  'sand.png': 'block/sand.png',
  'water.png': 'block/water_still.png',
  'bedrock.png': 'block/bedrock.png',
  'snow.png': 'block/snow.png',
  'coal_ore.png': 'block/coal_ore.png',
  'iron_ore.png': 'block/iron_ore.png',
  'gold_ore.png': 'block/gold_ore.png',
  'diamond_ore.png': 'block/diamond_ore.png',
  'brick.png': 'block/bricks.png',
  'cobblestone.png': 'block/cobblestone.png',
  'crafting_table_top.png': 'block/crafting_table_top.png',
  'crafting_table_side.png': 'block/crafting_table_side.png',
  'crafting_table_front.png': 'block/crafting_table_front.png',
  'torch.png': 'block/torch.png',
  'furnace_front_off.png': 'block/furnace_front.png',
  'furnace_front_on.png': 'block/furnace_front_on.png',
  'furnace_side.png': 'block/furnace_side.png',
  'furnace_top.png': 'block/furnace_top.png',
  'glass.png': 'block/glass.png',

  // === ПРЕДМЕТЫ ===
  'stick.png': 'item/stick.png',
  'apple.png': 'item/apple.png',
  'coal.png': 'item/coal.png',
  'diamond.png': 'item/diamond.png',
  'wooden_axe.png': 'item/wooden_axe.png',
  'wooden_pickaxe.png': 'item/wooden_pickaxe.png',
  'wooden_shovel.png': 'item/wooden_shovel.png',
  'stone_axe.png': 'item/stone_axe.png',
  'stone_pickaxe.png': 'item/stone_pickaxe.png',
  'stone_shovel.png': 'item/stone_shovel.png',
  'diamond_axe.png': 'item/diamond_axe.png',
  'diamond_pickaxe.png': 'item/diamond_pickaxe.png',
  'diamond_shovel.png': 'item/diamond_shovel.png',
  'iron_ingot.png': 'item/iron_ingot.png',
  'gold_ingot.png': 'item/gold_ingot.png',

  // === МОБЫ ===
  'entity/sheep.png': 'entity/sheep/sheep.png',
  'entity/sheep_fur.png': 'entity/sheep/sheep_fur.png',
  // Свинья
  'entity/pig.png': 'entity/pig/pig.png',
  // Корова
  'entity/cow.png': 'entity/cow/cow.png',
  // Курица (текстура недоступна в репозитории)
  // 'entity/chicken.png': 'entity/chicken/chicken.png',
  // Зомби
  'entity/zombie.png': 'entity/zombie/zombie.png',
  // Скелет
  'entity/skeleton.png': 'entity/skeleton/skeleton.png',
  // Крипер
  'entity/creeper.png': 'entity/creeper/creeper.png',
  // Паук
  'entity/spider.png': 'entity/spider/spider.png'
};

// Создаём папку entity если не существует
const entityDir = path.join(OUTPUT_DIR, 'entity');
if (!fs.existsSync(entityDir)) {
  fs.mkdirSync(entityDir, { recursive: true });
  console.log('Created entity directory');
}

const downloadFile = (filename, remotePath) => {
  const url = BASE_URL + remotePath;
  const filePath = path.join(OUTPUT_DIR, filename);

  // Создаём папку если нужно
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const file = fs.createWriteStream(filePath);

  https.get(url, (response) => {
    if (response.statusCode !== 200) {
      console.error(`Failed to download ${filename}: ${response.statusCode}`);
      file.close();
      fs.unlink(filePath, () => { });
      return;
    }
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log(`Downloaded ${filename}`);
    });
  }).on('error', (err) => {
    fs.unlink(filePath, () => { });
    console.error(`Error downloading ${filename}: ${err.message}`);
  });
};

console.log('Starting texture download...');

Object.entries(files).forEach(([filename, remotePath]) => {
  downloadFile(filename, remotePath);
});

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://raw.githubusercontent.com/ItsBrian/minecraft-textures/main/';
const OUTPUT_DIR = path.join(__dirname, '../public/textures');

const files = {
  'grass_top.png': 'block/grass_block_top.png',
  'grass_side.png': 'block/grass_block_side.png', // Оставляем на всякий случай
  'grass_side_overlay.png': 'block/grass_block_side_overlay.png', // Добавляем оверлей
  'short_grass.png': 'block/grass.png', // Декоративная трава (в 1.19 называется grass.png)
  'tall_grass_bottom.png': 'block/tall_grass_bottom.png', // Высокая трава (низ)
  'tall_grass_top.png': 'block/tall_grass_top.png', // Высокая трава (верх)
  'dirt.png': 'block/dirt.png',
  'stone.png': 'block/stone.png',
  'wood_side.png': 'block/oak_log.png',
  'wood_top.png': 'block/oak_log_top.png',
  'planks.png': 'block/oak_planks.png',
  'leaves.png': 'block/oak_leaves.png',
  'gravel.png': 'block/gravel.png',
  'sandstone.png': 'block/sandstone.png',
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
  'stick.png': 'item/stick.png',
  'apple.png': 'item/apple.png',
  'wooden_axe.png': 'item/wooden_axe.png',
  'wooden_pickaxe.png': 'item/wooden_pickaxe.png',
  'wooden_shovel.png': 'item/wooden_shovel.png',
  'cobblestone.png': 'block/cobblestone.png',
  'stone_axe.png': 'item/stone_axe.png',
  'stone_pickaxe.png': 'item/stone_pickaxe.png',
  'stone_shovel.png': 'item/stone_shovel.png',
  'crafting_table_top.png': 'block/crafting_table_top.png',
  'crafting_table_side.png': 'block/crafting_table_side.png',
  'crafting_table_front.png': 'block/crafting_table_front.png',
  'torch.png': 'block/torch.png'
};

const downloadFile = (filename, remotePath) => {
  const url = BASE_URL + remotePath;
  const filePath = path.join(OUTPUT_DIR, filename);
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

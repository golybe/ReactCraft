// Константы мира - оптимизированные

// Размеры чанка
export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 128; // Увеличиваем высоту для гор
export const RENDER_DISTANCE = 6; // Немного увеличим дальность, чтобы видеть горы

// Размеры мира в блоках
export const WORLD_SIZE = 10000; // Бесконечный практически
export const WORLD_HEIGHT = CHUNK_HEIGHT;
export const SEA_LEVEL = 40; // Чуть выше дна

// Настройки генерации
export const TERRAIN_SCALE = 0.003; // Очень плавные изменения (масштаб континентов)
export const TERRAIN_HEIGHT_SCALE = 40; // Высокие горы
export const CAVE_SCALE = 0.05; 
export const CAVE_THRESHOLD = 0.6;
export const BIOME_SCALE = 0.002; // Огромные биомы

// Настройки руды
export const ORE_DISTRIBUTION = {
  9: { // Coal
    minY: 5,
    maxY: 40,
    frequency: 0.02,
    veinSize: 8
  },
  10: { // Iron
    minY: 5,
    maxY: 32,
    frequency: 0.015,
    veinSize: 6
  },
  11: { // Gold
    minY: 5,
    maxY: 24,
    frequency: 0.01,
    veinSize: 4
  },
  12: { // Diamond
    minY: 5,
    maxY: 12,
    frequency: 0.005,
    veinSize: 3
  }
};

// Настройки игрока
export const PLAYER_SPEED = 0.12;
export const PLAYER_JUMP_FORCE = 0.25;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_WIDTH = 0.6;
export const GRAVITY = 0.012;

// Дальность взаимодействия (в блоках)
export const REACH_DISTANCE = 5;

export default {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  RENDER_DISTANCE,
  WORLD_SIZE,
  WORLD_HEIGHT,
  SEA_LEVEL,
  TERRAIN_SCALE,
  TERRAIN_HEIGHT_SCALE,
  CAVE_SCALE,
  CAVE_THRESHOLD,
  BIOME_SCALE,
  ORE_DISTRIBUTION,
  PLAYER_SPEED,
  PLAYER_JUMP_FORCE,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  GRAVITY,
  REACH_DISTANCE
};

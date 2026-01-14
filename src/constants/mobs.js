/**
 * Константы для системы мобов
 */
import { MobRegistry } from '../core/entities/MobRegistry';

// Типы мобов (ID для использования в коде)
export const MOB_TYPES = {
  // Враждебные мобы
  ZOMBIE: 'zombie',
  SKELETON: 'skeleton',
  SPIDER: 'spider',
  CREEPER: 'creeper',

  // Мирные мобы
  PIG: 'pig',
  COW: 'cow',
  SHEEP: 'sheep',
  CHICKEN: 'chicken'
};

// Категории мобов
export const MOB_CATEGORIES = {
  HOSTILE: 'hostile',
  PASSIVE: 'passive',
  NEUTRAL: 'neutral'
};

// Константы физики мобов
export const MOB_PHYSICS = {
  GRAVITY: 20,
  MAX_FALL_SPEED: 50,
  GROUND_CHECK_DIST: 0.1,
  STEP_HEIGHT: 0.5 // Мобы могут подниматься на полблока
};

// Константы AI мобов
export const MOB_AI = {
  THINK_INTERVAL: 0.25, // Как часто моб принимает решения (сек)
  PATH_UPDATE_INTERVAL: 1.0, // Как часто обновляется путь
  WANDER_RADIUS: 10, // Радиус случайных блужданий
  WANDER_INTERVAL: 5.0, // Интервал между сменой направления
  AGGRO_DURATION: 10.0, // Время агрессии после потери цели
  ATTACK_COOLDOWN: 1.0 // Кулдаун атаки
};

// Константы спавна мобов
export const MOB_SPAWN = {
  MAX_HOSTILE_PER_PLAYER: 70,
  MAX_PASSIVE_PER_PLAYER: 10,
  SPAWN_RADIUS_MIN: 24,
  SPAWN_RADIUS_MAX: 128,
  DESPAWN_RADIUS: 128
};

/**
 * Регистрация базовых типов мобов
 * Вызывается при инициализации игры
 */
export function registerDefaultMobs() {
  // === ВРАЖДЕБНЫЕ МОБЫ ===

  MobRegistry.register({
    id: MOB_TYPES.ZOMBIE,
    name: 'Zombie',
    maxHealth: 20,
    moveSpeed: 2.3,
    attackDamage: 3,
    attackRange: 1.5,
    detectionRange: 35,
    width: 0.6,
    height: 1.95,
    hostile: true,
    burnInSunlight: true,
    drops: [
      { type: 'rotten_flesh', count: [0, 2], chance: 1.0 }
    ],
    xp: 5
  });

  MobRegistry.register({
    id: MOB_TYPES.SKELETON,
    name: 'Skeleton',
    maxHealth: 20,
    moveSpeed: 2.5,
    attackDamage: 2,
    attackRange: 15, // Дальняя атака
    detectionRange: 16,
    width: 0.6,
    height: 1.99,
    hostile: true,
    burnInSunlight: true,
    drops: [
      { type: 'bone', count: [0, 2], chance: 1.0 },
      { type: 'arrow', count: [0, 2], chance: 1.0 }
    ],
    xp: 5
  });

  MobRegistry.register({
    id: MOB_TYPES.SPIDER,
    name: 'Spider',
    maxHealth: 16,
    moveSpeed: 3.0,
    attackDamage: 2,
    attackRange: 1.5,
    detectionRange: 16,
    width: 1.4,
    height: 0.9,
    hostile: true,
    burnInSunlight: false,
    drops: [
      { type: 'string', count: [0, 2], chance: 1.0 },
      { type: 'spider_eye', count: [0, 1], chance: 0.33 }
    ],
    xp: 5
  });

  MobRegistry.register({
    id: MOB_TYPES.CREEPER,
    name: 'Creeper',
    maxHealth: 20,
    moveSpeed: 2.5,
    attackDamage: 0, // Урон от взрыва
    attackRange: 3,
    detectionRange: 16,
    width: 0.6,
    height: 1.7,
    hostile: true,
    burnInSunlight: false,
    drops: [
      { type: 'gunpowder', count: [0, 2], chance: 1.0 }
    ],
    xp: 5
  });

  // === МИРНЫЕ МОБЫ ===

  MobRegistry.register({
    id: MOB_TYPES.PIG,
    name: 'Pig',
    maxHealth: 10,
    moveSpeed: 2.5,
    attackDamage: 0,
    attackRange: 0,
    detectionRange: 0,
    width: 0.9,
    height: 0.9,
    hostile: false,
    drops: [
      { type: 'porkchop', count: [1, 3], chance: 1.0 }
    ],
    xp: 1
  });

  MobRegistry.register({
    id: MOB_TYPES.COW,
    name: 'Cow',
    maxHealth: 10,
    moveSpeed: 2.0,
    attackDamage: 0,
    attackRange: 0,
    detectionRange: 0,
    width: 0.9,
    height: 1.4,
    hostile: false,
    drops: [
      { type: 'beef', count: [1, 3], chance: 1.0 },
      { type: 'leather', count: [0, 2], chance: 1.0 }
    ],
    xp: 1
  });

  MobRegistry.register({
    id: MOB_TYPES.SHEEP,
    name: 'Sheep',
    maxHealth: 8,
    moveSpeed: 2.3,
    attackDamage: 0,
    attackRange: 0,
    detectionRange: 0,
    width: 0.9,
    height: 1.3,
    hostile: false,
    drops: [
      { type: 'wool', count: 1, chance: 1.0 },
      { type: 'mutton', count: [1, 2], chance: 1.0 }
    ],
    xp: 1
  });

  MobRegistry.register({
    id: MOB_TYPES.CHICKEN,
    name: 'Chicken',
    maxHealth: 4,
    moveSpeed: 2.5,
    attackDamage: 0,
    attackRange: 0,
    detectionRange: 0,
    width: 0.4,
    height: 0.7,
    hostile: false,
    canSwim: true,
    drops: [
      { type: 'chicken', count: 1, chance: 1.0 },
      { type: 'feather', count: [0, 2], chance: 1.0 }
    ],
    xp: 1
  });
}

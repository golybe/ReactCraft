/**
 * EatBlockGoal - овца щиплет травку
 * 
 * Как в Minecraft:
 * - Овца смотрит вниз и "ест" траву
 * - Блок травы превращается в землю
 * - Анимация: голова опускается вниз
 * - После еды овца восстанавливает шерсть (если была острижена)
 */
import { Goal } from '../Goal';
import { BLOCK_TYPES } from '../../../../constants/blockTypes';

// ID блоков
const BLOCK_GRASS = BLOCK_TYPES.GRASS;  // 1
const BLOCK_DIRT = BLOCK_TYPES.DIRT;    // 2

export class EatBlockGoal extends Goal {
  constructor(mob, onBlockChange = null) {
    super();
    this.mob = mob;
    this.onBlockChange = onBlockChange; // Callback для изменения блока
    this.flags.add('MOVE');
    this.flags.add('LOOK');
    
    // Таймеры (в "тиках", 20 тиков = 1 секунда)
    this.eatingTime = 0;
    this.maxEatingTime = 40; // 40 тиков = 2 секунды на поедание
    this.hasEaten = false;
    
    // Кулдаун между попытками есть
    this.cooldown = 0;
    this.cooldownTime = 600; // ~30 секунд между едой (как в Minecraft)
  }

  canUse() {
    // Кулдаун
    if (this.cooldown > 0) {
      this.cooldown--;
      return false;
    }
    
    // Проверяем есть ли трава под ногами (сначала!)
    const hasGrass = this.hasGrassBelow();
    if (!hasGrass) {
      return false;
    }
    
    // Шанс начать есть (5% за тик когда стоим на траве)
    if (Math.random() > 0.05) {
      return false;
    }
    
    console.log('[EatBlockGoal] Овца начинает есть траву!');
    return true;
  }

  canContinueToUse() {
    return this.eatingTime > 0;
  }

  start() {
    this.eatingTime = this.maxEatingTime; // 2 секунды
    this.hasEaten = false; // Ещё не съели
    // Останавливаем движение
    this.mob.navigation?.stop();
    this.mob.velocity.x = 0;
    this.mob.velocity.z = 0;
    // Начинаем анимацию
    this.mob.isEating = true;
    this.mob.eatingProgress = 0;
    console.log('[EatBlockGoal] Начинаем есть, время:', this.eatingTime);
  }

  stop() {
    console.log('[EatBlockGoal] Закончили есть, hasEaten:', this.hasEaten);
    this.eatingTime = 0;
    this.cooldown = this.cooldownTime + Math.floor(Math.random() * 200); // 30-40 секунд
    this.mob.isEating = false;
    this.mob.eatingProgress = 0;
    this.mob.isStuck = false; // Сбрасываем флаг застревания
  }

  tick(deltaTime) {
    // Уменьшаем время ПО РЕАЛЬНОМУ ВРЕМЕНИ, не по кадрам!
    // deltaTime в секундах, eatingTime в "тиках" (20 тиков = 1 сек)
    this.eatingTime -= deltaTime * 20; // 20 тиков в секунду
    
    // Прогресс анимации (0 -> 1)
    this.mob.eatingProgress = Math.min(1, 1 - (this.eatingTime / this.maxEatingTime));
    
    // Держим моба на месте пока ест
    this.mob.velocity.x = 0;
    this.mob.velocity.z = 0;
    
    // Когда закончили есть — съедаем траву ОДИН раз
    if (this.eatingTime <= 0 && !this.hasEaten) {
      this.hasEaten = true;
      this.eatGrass();
      console.log('[EatBlockGoal] Трава съедена!');
    }
  }

  /**
   * Проверяет есть ли трава под ногами овцы
   */
  hasGrassBelow() {
    const chunks = this.mob.context?.chunks;
    if (!chunks) {
      return false;
    }
    
    const x = Math.floor(this.mob.position.x);
    // Блок ПОД ногами = блок на котором стоим минус небольшой отступ
    const y = Math.floor(this.mob.position.y - 0.1);
    const z = Math.floor(this.mob.position.z);
    
    const block = this.getBlock(x, y, z);
    
    // Debug: раз в 100 тиков показываем что под ногами
    if (Math.random() < 0.01) {
      console.log(`[EatBlockGoal] pos.y=${this.mob.position.y.toFixed(2)}, blockY=${y}, block=${block}, GRASS=${BLOCK_GRASS}`);
    }
    
    return block === BLOCK_GRASS;
  }

  /**
   * Съедает траву — превращает в землю
   */
  eatGrass() {
    if (!this.mob.context?.chunks) return;
    
    const x = Math.floor(this.mob.position.x);
    const y = Math.floor(this.mob.position.y - 0.1); // Блок под ногами
    const z = Math.floor(this.mob.position.z);
    
    const block = this.getBlock(x, y, z);
    if (block === BLOCK_GRASS) {
      // Меняем блок на землю
      if (this.onBlockChange) {
        this.onBlockChange(x, y, z, BLOCK_DIRT);
      } else if (this.mob.context?.setBlock) {
        this.mob.context.setBlock(x, y, z, BLOCK_DIRT);
      }
      
      // Восстанавливаем шерсть (если была острижена)
      if (this.mob.isSheared) {
        this.mob.isSheared = false;
      }
    }
  }

  /**
   * Получает блок по координатам
   */
  getBlock(x, y, z) {
    const chunks = this.mob.context?.chunks;
    if (!chunks) return 0;
    
    const chunkSize = 16;
    const chunkX = Math.floor(x / chunkSize);
    const chunkZ = Math.floor(z / chunkSize);
    const chunkKey = `${chunkX},${chunkZ}`;
    
    const chunk = chunks[chunkKey];
    if (!chunk) return 0;
    
    // Используем метод getBlock как в Mob.js
    if (typeof chunk.getBlock === 'function') {
      const localX = ((x % chunkSize) + chunkSize) % chunkSize;
      const localZ = ((z % chunkSize) + chunkSize) % chunkSize;
      return chunk.getBlock(localX, y, localZ);
    }
    
    // Fallback для старого формата
    if (chunk.blocks) {
      const localX = ((x % chunkSize) + chunkSize) % chunkSize;
      const localZ = ((z % chunkSize) + chunkSize) % chunkSize;
      if (y < 0 || y >= 256) return 0;
      const index = localX + localZ * chunkSize + y * chunkSize * chunkSize;
      return chunk.blocks[index] || 0;
    }
    
    return 0;
  }
}

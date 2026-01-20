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
    
    // Шанс начать есть (уменьшили шанс до 0.5% за тик, было 5%)
    // Это примерно раз в 10 секунд если стоим на траве
    if (Math.random() > 0.005) {
      return false;
    }
    
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
    this.mob.headShake = 0;
  }

  stop() {
    this.eatingTime = 0;
    // Увеличили кулдаун до 60-120 секунд (было 30-40)
    this.cooldown = 1200 + Math.floor(Math.random() * 1200); 
    this.mob.isEating = false;
    this.mob.eatingProgress = 0;
    this.mob.headShake = 0;
    this.mob.isStuck = false; // Сбрасываем флаг застревания
  }

  tick(deltaTime) {
    // Уменьшаем время ПО РЕАЛЬНОМУ ВРЕМЕНИ, не по кадрам!
    // deltaTime в секундах, eatingTime в "тиках" (20 тиков = 1 сек)
    this.eatingTime -= deltaTime * 20; // 20 тиков в секунду
    
    // Прогресс анимации (0 -> 1)
    // Добавим подергивание головы
    // eatingTime меняется от 40 до 0
    // Мы хотим 5 подергиваний за 2 секунды
    // phase = (40 - eatingTime) / 4 -> 0..10
    // sin(phase * PI) -> 5 пиков
    const timePassed = this.maxEatingTime - this.eatingTime;
    const progress = Math.max(0, Math.min(1, timePassed / this.maxEatingTime));
    const envelope = Math.sin(progress * Math.PI);
    this.mob.eatingProgress = progress;
    this.mob.headShake = Math.sin(timePassed * 1.3) * 0.08 * envelope;
    
    // Держим моба на месте пока ест
    this.mob.velocity.x = 0;
    this.mob.velocity.z = 0;
    
    // Когда закончили есть — съедаем траву ОДИН раз
    if (this.eatingTime <= 0 && !this.hasEaten) {
      this.hasEaten = true;
      this.eatGrass();
    }
  }

  /**
   * Проверяет есть ли трава под ногами овцы
   */
  hasGrassBelow() {
    if (!this.mob.context?.chunks) {
      return false;
    }
    
    const x = Math.floor(this.mob.position.x);
    // Блок ПОД ногами = блок на котором стоим минус небольшой отступ
    const y = Math.floor(this.mob.position.y - 0.1);
    const z = Math.floor(this.mob.position.z);
    
    const block = this.mob.getBlock(this.mob.context.chunks, x, y, z);
    
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
    
    const block = this.mob.getBlock(this.mob.context.chunks, x, y, z);
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
}

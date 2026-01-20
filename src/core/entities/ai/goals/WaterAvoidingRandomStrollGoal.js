/**
 * WaterAvoidingRandomStrollGoal - случайное блуждание, избегая воды
 * 
 * В Minecraft овцы БОЛЬШУЮ ЧАСТЬ ВРЕМЕНИ стоят на месте!
 * Они лишь изредка решают куда-то пойти.
 */
import { Goal } from '../Goal';
import { BLOCK_TYPES, isSolid } from '../../../../constants/blocks';

export class WaterAvoidingRandomStrollGoal extends Goal {
  constructor(mob, speedModifier = 1.0) {
    super();
    this.mob = mob;
    this.speedModifier = speedModifier;
    this.flags.add('MOVE');
    
    // Целевая позиция
    this.targetX = 0;
    this.targetZ = 0;
    
    // Параметры — овцы редко решают куда-то пойти!
    this.ticksUntilNextStart = 0;
    
    // Радиус поиска (небольшой — овцы не уходят далеко)
    this.horizontalRadius = 5;
  }

  canUse() {
    // Сбрасываем isStuck при каждой проверке (чтобы не застревать навсегда)
    if (this.mob.isStuck && !this.mob.navigation?.isNavigating) {
      this.mob.isStuck = false;
    }
    
    // Кулдаун между попытками пойти куда-то
    if (this.ticksUntilNextStart > 0) {
      this.ticksUntilNextStart--;
      return false;
    }
    
    // 2% шанс начать движение (чаще чем было 1%)
    if (Math.random() > 0.02) {
      return false;
    }
    
    // Пытаемся найти случайную позицию
    const pos = this.findRandomPosition();
    if (pos) {
      this.targetX = pos.x;
      this.targetZ = pos.z;
      return true;
    }
    
    return false;
  }

  canContinueToUse() {
    // Останавливаемся если застряли
    if (this.mob.isStuck) {
      this.stuckTime = (this.stuckTime || 0) + 1;
      if (this.stuckTime > 20) { // Застряли больше 1 сек
        return false;
      }
    } else {
      this.stuckTime = 0;
    }
    
    // Продолжаем пока не дошли до цели
    const dx = this.targetX - this.mob.position.x;
    const dz = this.targetZ - this.mob.position.z;
    const distSq = dx * dx + dz * dz;
    
    return distSq > 0.5 * 0.5; // Ещё не дошли
  }

  start() {
    this.stuckTime = 0;
    this.mob.isStuck = false;
    // Начинаем движение к цели
    console.log(`[WaterAvoidingRandomStrollGoal] Starting navigation to (${this.targetX.toFixed(1)}, ${this.targetZ.toFixed(1)})`);
    this.mob.navigation?.moveTo(this.targetX, this.mob.position.y, this.targetZ, this.speedModifier);
  }

  stop() {
    // После похода — отдых (1-3 секунды)
    this.ticksUntilNextStart = 20 + Math.floor(Math.random() * 40);
    this.stuckTime = 0;
    this.mob.isStuck = false;
    this.mob.navigation?.stop();
  }

  tick(deltaTime) {
    // Если навигация была остановлена (например, другой целью), возобновляем
    if (!this.mob.navigation?.isNavigating) {
      // Проверяем что ещё не дошли до цели
      const dx = this.targetX - this.mob.position.x;
      const dz = this.targetZ - this.mob.position.z;
      const distSq = dx * dx + dz * dz;
      
      if (distSq > 0.5 * 0.5) {
        // Возобновляем навигацию
        this.mob.navigation?.moveTo(this.targetX, this.mob.position.y, this.targetZ, this.speedModifier);
      }
    }
  }

  /**
   * Находит случайную безопасную позицию
   */
  findRandomPosition() {
    // Пробуем несколько раз найти хорошую позицию
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 2 + Math.random() * (this.horizontalRadius - 2);
      
      const x = this.mob.position.x + Math.cos(angle) * distance;
      const z = this.mob.position.z + Math.sin(angle) * distance;
      
      // Проверяем что позиция безопасна
      if (this.isPositionSafe(x, z)) {
        return { x, z };
      }
    }
    
    return null;
  }

  /**
   * Проверяет безопасность позиции (нет воды, есть земля)
   */
  isPositionSafe(x, z) {
    if (!this.mob.context?.chunks) return true; // Если чанков нет, считаем безопасным (fallback)

    const chunks = this.mob.context.chunks;
    const floorY = Math.floor(this.mob.position.y);
    const blockX = Math.floor(x);
    const blockZ = Math.floor(z);

    // 1. Проверяем блок в самой точке (ноги)
    const blockAtLegs = this.mob.getBlock(chunks, blockX, floorY, blockZ);
    if (blockAtLegs === BLOCK_TYPES.WATER || blockAtLegs === BLOCK_TYPES.LAVA) {
      return false; // Вода или лава
    }
    
    // Если блок в ногах твердый, значит мы застряли в блоке? 
    // Обычно моб занимает 2 блока высоты. Проверим ноги и голову?
    // Для движения нам нужно чтобы в ногах было пусто (или трава/цветы)
    if (isSolid(blockAtLegs)) {
        return false; // Застрянем
    }

    // 2. Проверяем блок под ногами (на чем стоять)
    const blockBelow = this.mob.getBlock(chunks, blockX, floorY - 1, blockZ);
    
    // Должен быть твердый блок
    if (!isSolid(blockBelow)) {
        // Если под ногами воздух/вода - это плохо.
        // Но может мы спускаемся на 1 блок?
        // Проверим блок еще ниже (y-2)
        const blockBelow2 = this.mob.getBlock(chunks, blockX, floorY - 2, blockZ);
        if (!isSolid(blockBelow2)) {
             return false; // Слишком глубоко падать (> 1 блока)
        }
    }
    
    // Если под ногами вода/лава - тоже нельзя
    if (blockBelow === BLOCK_TYPES.WATER || blockBelow === BLOCK_TYPES.LAVA) {
        return false;
    }

    return true;
  }
}

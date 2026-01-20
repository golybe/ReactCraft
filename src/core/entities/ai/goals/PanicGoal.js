/**
 * PanicGoal - убегает в панике при получении урона
 * Высокий приоритет, прерывает другие действия
 */
import { Goal } from '../Goal';

export class PanicGoal extends Goal {
  constructor(mob, speedModifier = 1.25) {
    super();
    this.mob = mob;
    this.speedModifier = speedModifier;
    this.flags.add('MOVE');
    
    this.targetX = 0;
    this.targetZ = 0;
    this.panicTime = 0;
    this.maxPanicTime = 100; // ~5 секунд
  }

  canUse() {
    // Активируется только если моб недавно получил урон
    if (this.mob.hurtAnimation > 0 || this.mob.lastDamageTime > 0) {
      // Проверяем, что урон был недавно (в последние 2 секунды)
      const timeSinceDamage = performance.now() - (this.mob.lastDamageTimestamp || 0);
      if (timeSinceDamage < 2000) {
        return this.findRandomPosition();
      }
    }
    return false;
  }

  canContinueToUse() {
    return this.panicTime > 0;
  }

  start() {
    this.panicTime = this.maxPanicTime;
    this.mob.navigation?.moveTo(this.targetX, this.mob.position.y, this.targetZ, this.speedModifier);
  }

  stop() {
    this.panicTime = 0;
    this.mob.navigation?.stop();
  }

  tick(deltaTime) {
    this.panicTime--;
    
    // Проверяем достигли ли цели
    const dx = this.targetX - this.mob.position.x;
    const dz = this.targetZ - this.mob.position.z;
    const distSq = dx * dx + dz * dz;
    
    // Если достигли - ищем новую точку для побега
    if (distSq < 1.0) {
      if (this.findRandomPosition()) {
        this.mob.navigation?.moveTo(this.targetX, this.mob.position.y, this.targetZ, this.speedModifier);
      }
    }
  }

  /**
   * Находит случайную позицию для побега
   */
  findRandomPosition() {
    for (let attempt = 0; attempt < 5; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 5 + Math.random() * 5;
      
      this.targetX = this.mob.position.x + Math.cos(angle) * distance;
      this.targetZ = this.mob.position.z + Math.sin(angle) * distance;
      
      // TODO: проверить безопасность позиции
      return true;
    }
    return false;
  }
}

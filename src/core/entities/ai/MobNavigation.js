/**
 * MobNavigation - контроллер навигации моба
 * Управляет движением к цели с плавным поворотом
 */
export class MobNavigation {
  constructor(mob) {
    this.mob = mob;
    
    // Целевая позиция
    this.targetX = 0;
    this.targetY = 0;
    this.targetZ = 0;
    
    // Модификатор скорости
    this.speedModifier = 1.0;
    
    // Активна ли навигация
    this.isNavigating = false;
    
    // Параметры
    this.reachThreshold = 0.5; // Расстояние "достижения" цели
    
    // Плавное изменение скорости (интерполяция)
    this.smoothVelX = 0;
    this.smoothVelZ = 0;
  }

  /**
   * Установить цель движения
   */
  moveTo(x, y, z, speedModifier = 1.0) {
    this.targetX = x;
    this.targetY = y;
    this.targetZ = z;
    this.speedModifier = speedModifier;
    this.isNavigating = true;
  }

  /**
   * Остановить навигацию
   */
  stop() {
    this.isNavigating = false;
    // Не обнуляем velocity резко — пусть плавно затухает в tick()
  }

  /**
   * Достигли ли цели?
   */
  isDone() {
    if (!this.isNavigating) return true;
    
    const dx = this.targetX - this.mob.position.x;
    const dz = this.targetZ - this.mob.position.z;
    return dx * dx + dz * dz < this.reachThreshold * this.reachThreshold;
  }

  /**
   * Обновление навигации
   */
  tick(deltaTime) {
    // Целевая скорость
    let targetVelX = 0;
    let targetVelZ = 0;
    
    if (this.isNavigating) {
      const dx = this.targetX - this.mob.position.x;
      const dz = this.targetZ - this.mob.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      if (distance < this.reachThreshold) {
        // Достигли цели
        this.isNavigating = false;
      } else {
        // Направление к цели
        const dirX = dx / distance;
        const dirZ = dz / distance;
        
        // Целевой угол
        const targetYaw = Math.atan2(dirX, dirZ);
        
        // Плавный поворот
        this.mob.lookController?.setLookRotation(targetYaw, 0, 6.0);
        
        // Скорость движения
        const speed = this.mob.moveSpeed * this.speedModifier;
        
        // Проверяем угол между текущим направлением и целью
        const currentYaw = this.mob.rotation.yaw;
        const yawDiff = Math.abs(this.normalizeAngle(targetYaw - currentYaw));
        
        // Модификатор скорости в зависимости от угла поворота
        let speedMod = 1.0;
        if (yawDiff > Math.PI / 2) {
          speedMod = 0; // Стоим и поворачиваемся
        } else if (yawDiff > Math.PI / 4) {
          speedMod = 0.5; // Идём медленнее
        }
        
        targetVelX = dirX * speed * speedMod;
        targetVelZ = dirZ * speed * speedMod;
      }
    }
    
    // Плавная интерполяция скорости (избегаем рывков)
    const lerpFactor = 0.15; // Чем меньше, тем плавнее
    this.smoothVelX += (targetVelX - this.smoothVelX) * lerpFactor;
    this.smoothVelZ += (targetVelZ - this.smoothVelZ) * lerpFactor;
    
    // Применяем сглаженную скорость
    this.mob.velocity.x = this.smoothVelX;
    this.mob.velocity.z = this.smoothVelZ;
    
    if (!this.isNavigating) {
      if (Math.abs(this.mob.velocity.x) < 0.02) this.mob.velocity.x = 0;
      if (Math.abs(this.mob.velocity.z) < 0.02) this.mob.velocity.z = 0;
    }
  }

  /**
   * Нормализует угол в диапазон [-PI, PI]
   */
  normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }
}

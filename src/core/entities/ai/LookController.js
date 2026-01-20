/**
 * LookController - контроллер взгляда моба
 * Управляет плавным поворотом головы/тела
 */
export class LookController {
  constructor(mob) {
    this.mob = mob;
    
    // Целевые углы
    this.targetYaw = 0;
    this.targetPitch = 0;
    
    // Скорость поворота (радиан/сек)
    this.turnSpeed = 0;
    
    // Активен ли контроллер
    this.isLooking = false;
    
    // Максимальная скорость поворота
    this.maxTurnSpeed = 10.0; // радиан/сек
  }

  /**
   * Смотреть в точку
   */
  lookAt(x, y, z) {
    const dx = x - this.mob.position.x;
    const dy = y - (this.mob.position.y + this.mob.height * 0.85);
    const dz = z - this.mob.position.z;
    
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    
    this.targetYaw = Math.atan2(dx, dz);
    this.targetPitch = -Math.atan2(dy, horizontalDist);
    this.turnSpeed = this.maxTurnSpeed;
    this.isLooking = true;
  }

  /**
   * Установить целевой угол поворота
   */
  setLookRotation(yaw, pitch = 0, speed = null) {
    this.targetYaw = yaw;
    this.targetPitch = pitch;
    this.turnSpeed = speed !== null ? speed : this.maxTurnSpeed;
    this.isLooking = true;
  }

  /**
   * Обновление контроллера
   */
  tick(deltaTime) {
    if (!this.isLooking) return;
    
    // Плавный поворот yaw
    const yawDiff = this.normalizeAngle(this.targetYaw - this.mob.rotation.yaw);
    const maxYawDelta = this.turnSpeed * deltaTime;
    
    if (Math.abs(yawDiff) < maxYawDelta) {
      this.mob.rotation.yaw = this.targetYaw;
    } else {
      this.mob.rotation.yaw += Math.sign(yawDiff) * maxYawDelta;
    }
    
    // Нормализуем результат
    this.mob.rotation.yaw = this.normalizeAngle(this.mob.rotation.yaw);
    
    // Плавный поворот pitch (для головы)
    if (this.mob.rotation.pitch !== undefined) {
      const pitchDiff = this.targetPitch - this.mob.rotation.pitch;
      const maxPitchDelta = this.turnSpeed * deltaTime * 0.5;
      
      if (Math.abs(pitchDiff) < maxPitchDelta) {
        this.mob.rotation.pitch = this.targetPitch;
      } else {
        this.mob.rotation.pitch += Math.sign(pitchDiff) * maxPitchDelta;
      }
    }
    
    // Проверяем достигли ли цели
    if (Math.abs(yawDiff) < 0.01) {
      this.isLooking = false;
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

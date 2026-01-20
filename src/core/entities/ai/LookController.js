/**
 * LookController - контроллер взгляда моба
 * Управляет плавным поворотом головы/тела
 */
export class LookController {
  constructor(mob) {
    this.mob = mob;
    
    // Целевые углы
    this.bodyTargetYaw = 0;
    this.bodyTargetPitch = 0;
    this.headTargetYaw = 0;
    this.headTargetPitch = 0;
    
    // Скорость поворота (радиан/сек)
    this.bodyTurnSpeed = 0;
    this.headTurnSpeed = 0;
    
    // Активен ли контроллер
    this.isBodyLooking = false;
    this.isHeadLooking = false;
    
    // Максимальная скорость поворота
    this.maxTurnSpeed = 10.0; // радиан/сек
    this.maxHeadYaw = Math.PI * 0.75;
    this.headReturnSpeed = 2.5;
  }

  /**
   * Смотреть в точку
   */
  lookAt(x, y, z, speed = null) {
    const dx = x - this.mob.position.x;
    const dy = y - (this.mob.position.y + this.mob.height * 0.85);
    const dz = z - this.mob.position.z;
    
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    
    const targetYaw = Math.atan2(dx, dz);
    const targetPitch = -Math.atan2(dy, horizontalDist);
    const desiredHeadYaw = this.normalizeAngle(targetYaw - this.mob.rotation.yaw);
    const clampedHeadYaw = Math.max(-this.maxHeadYaw, Math.min(this.maxHeadYaw, desiredHeadYaw));
    const clampedHeadPitch = Math.max(-1.2, Math.min(1.2, targetPitch));

    this.headTargetYaw = clampedHeadYaw;
    this.headTargetPitch = clampedHeadPitch;
    this.headTurnSpeed = speed !== null ? speed : this.maxTurnSpeed;
    this.isHeadLooking = true;
  }

  /**
   * Установить целевой угол поворота
   */
  setLookRotation(yaw, pitch = 0, speed = null) {
    this.bodyTargetYaw = yaw;
    this.bodyTargetPitch = pitch;
    this.bodyTurnSpeed = speed !== null ? speed : this.maxTurnSpeed;
    this.isBodyLooking = true;
  }

  setHeadRotation(yaw, pitch = 0, speed = null) {
    const clampedYaw = Math.max(-this.maxHeadYaw, Math.min(this.maxHeadYaw, yaw));
    const clampedPitch = Math.max(-1.2, Math.min(1.2, pitch));
    this.headTargetYaw = clampedYaw;
    this.headTargetPitch = clampedPitch;
    this.headTurnSpeed = speed !== null ? speed : this.maxTurnSpeed;
    this.isHeadLooking = true;
  }

  /**
   * Обновление контроллера
   */
  tick(deltaTime) {
    if (this.isBodyLooking) {
      const yawDiff = this.normalizeAngle(this.bodyTargetYaw - this.mob.rotation.yaw);
      const maxYawDelta = this.bodyTurnSpeed * deltaTime;

      if (Math.abs(yawDiff) < maxYawDelta) {
        this.mob.rotation.yaw = this.bodyTargetYaw;
      } else {
        this.mob.rotation.yaw += Math.sign(yawDiff) * maxYawDelta;
      }

      this.mob.rotation.yaw = this.normalizeAngle(this.mob.rotation.yaw);

      const pitchDiff = this.bodyTargetPitch - this.mob.rotation.pitch;
      const maxPitchDelta = this.bodyTurnSpeed * deltaTime * 0.5;
      if (Math.abs(pitchDiff) < maxPitchDelta) {
        this.mob.rotation.pitch = this.bodyTargetPitch;
      } else {
        this.mob.rotation.pitch += Math.sign(pitchDiff) * maxPitchDelta;
      }

      if (Math.abs(yawDiff) < 0.01 && Math.abs(pitchDiff) < 0.01) {
        this.isBodyLooking = false;
      }
    }

    if (this.isHeadLooking) {
      const headYawDiff = this.normalizeAngle(this.headTargetYaw - this.mob.rotation.headYaw);
      const maxHeadYawDelta = this.headTurnSpeed * deltaTime;
      if (Math.abs(headYawDiff) < maxHeadYawDelta) {
        this.mob.rotation.headYaw = this.headTargetYaw;
      } else {
        this.mob.rotation.headYaw += Math.sign(headYawDiff) * maxHeadYawDelta;
      }
      this.mob.rotation.headYaw = this.normalizeAngle(this.mob.rotation.headYaw);

      const headPitchDiff = this.headTargetPitch - this.mob.rotation.headPitch;
      const maxHeadPitchDelta = this.headTurnSpeed * deltaTime * 0.5;
      if (Math.abs(headPitchDiff) < maxHeadPitchDelta) {
        this.mob.rotation.headPitch = this.headTargetPitch;
      } else {
        this.mob.rotation.headPitch += Math.sign(headPitchDiff) * maxHeadPitchDelta;
      }

      if (Math.abs(headYawDiff) < 0.01 && Math.abs(headPitchDiff) < 0.01) {
        this.isHeadLooking = false;
      }
    } else {
      const headYawDiff = this.normalizeAngle(0 - this.mob.rotation.headYaw);
      const maxHeadYawDelta = this.headReturnSpeed * deltaTime;
      if (Math.abs(headYawDiff) < maxHeadYawDelta) {
        this.mob.rotation.headYaw = 0;
      } else {
        this.mob.rotation.headYaw += Math.sign(headYawDiff) * maxHeadYawDelta;
      }
      this.mob.rotation.headYaw = this.normalizeAngle(this.mob.rotation.headYaw);

      const headPitchDiff = 0 - this.mob.rotation.headPitch;
      const maxHeadPitchDelta = this.headReturnSpeed * deltaTime * 0.5;
      if (Math.abs(headPitchDiff) < maxHeadPitchDelta) {
        this.mob.rotation.headPitch = 0;
      } else {
        this.mob.rotation.headPitch += Math.sign(headPitchDiff) * maxHeadPitchDelta;
      }
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

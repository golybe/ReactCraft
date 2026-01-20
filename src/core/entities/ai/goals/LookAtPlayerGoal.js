/**
 * LookAtPlayerGoal - ИНОГДА смотрит на ближайшего игрока
 * 
 * В Minecraft овцы лишь изредка поглядывают на игрока,
 * а не следят за ним постоянно!
 */
import { Goal } from '../Goal';

export class LookAtPlayerGoal extends Goal {
  constructor(mob, lookDistance = 6.0) {
    super();
    this.mob = mob;
    this.lookDistance = lookDistance;
    this.flags.add('LOOK');
    
    this.lookAt = null;
    this.lookTime = 0;
    
    // Кулдаун между взглядами (чтобы не пялиться постоянно)
    this.cooldown = 0;
  }

  canUse() {
    // Кулдаун — не смотрим слишком часто
    if (this.cooldown > 0) {
      this.cooldown--;
      return false;
    }
    
    const player = this.mob.context?.player;
    if (!player) return false;
    
    const dx = player.position.x - this.mob.position.x;
    const dy = player.position.y - this.mob.position.y;
    const dz = player.position.z - this.mob.position.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    
    if (distSq > this.lookDistance * this.lookDistance) {
      return false;
    }
    
    // 0.5% шанс начать смотреть (редко!)
    if (Math.random() < 0.005) {
      this.lookAt = player;
      return true;
    }
    
    return false;
  }

  canContinueToUse() {
    if (!this.lookAt) return false;
    if (this.lookTime <= 0) return false;
    
    const dx = this.lookAt.position.x - this.mob.position.x;
    const dz = this.lookAt.position.z - this.mob.position.z;
    const distSq = dx * dx + dz * dz;
    
    return distSq <= this.lookDistance * this.lookDistance * 1.5;
  }

  start() {
    // Смотрим 1-2 секунды (не долго!)
    this.lookTime = 20 + Math.floor(Math.random() * 20);
  }

  stop() {
    this.lookAt = null;
    this.lookTime = 0;
    // Кулдаун 3-6 секунд перед следующим взглядом
    this.cooldown = 60 + Math.floor(Math.random() * 60);
  }

  tick(deltaTime) {
    this.lookTime--;
    
    if (this.lookAt) {
      this.mob.lookController?.lookAt(
        this.lookAt.position.x,
        this.lookAt.position.y + 1.6,
        this.lookAt.position.z
      );
    }
  }
}

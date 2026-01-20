/**
 * RandomLookAroundGoal - случайно смотрит вокруг
 * Делает поведение моба более естественным
 */
import { Goal } from '../Goal';

export class RandomLookAroundGoal extends Goal {
  constructor(mob) {
    super();
    this.mob = mob;
    this.flags.add('LOOK');
    
    // Целевой угол поворота головы
    this.targetYaw = 0;
    
    // Время до следующего поворота
    this.lookTimeLeft = 0;
  }

  canUse() {
    if (this.mob.isEating) return false;
    if (this.mob.navigation?.isNavigating) return false;
    return Math.random() < 0.02;
  }

  canContinueToUse() {
    return this.lookTimeLeft > 0;
  }

  start() {
    const deltaYaw = (Math.random() - 0.5) * 1.2;
    this.targetYaw = deltaYaw;
    this.lookTimeLeft = 0.8 + Math.random() * 1.6;
  }

  stop() {
    this.lookTimeLeft = 0;
  }

  tick(deltaTime) {
    this.lookTimeLeft -= deltaTime;
    this.mob.lookController?.setHeadRotation(this.targetYaw, 0, 2.0);
  }
}

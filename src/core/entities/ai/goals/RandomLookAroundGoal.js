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
    this.lookTime = 0;
    this.maxLookTime = 0;
  }

  canUse() {
    // 2% шанс каждый тик начать смотреть в случайном направлении
    return Math.random() < 0.02;
  }

  canContinueToUse() {
    return this.lookTime > 0;
  }

  start() {
    // Выбираем случайное направление
    const deltaYaw = (Math.random() - 0.5) * Math.PI; // ±90 градусов
    this.targetYaw = this.mob.rotation.yaw + deltaYaw;
    
    // Время на поворот (40-80 тиков = 2-4 секунды)
    this.maxLookTime = 40 + Math.floor(Math.random() * 40);
    this.lookTime = this.maxLookTime;
  }

  stop() {
    this.lookTime = 0;
  }

  tick(deltaTime) {
    this.lookTime--;
    
    // Плавно поворачиваем к целевому углу
    const turnSpeed = 2.0 * deltaTime; // радиан/сек
    this.mob.lookController?.setLookRotation(this.targetYaw, 0, turnSpeed);
  }
}

/**
 * Entity - базовый класс для всех сущностей в игре
 */
import * as THREE from 'three';

export class Entity {
  constructor(x = 0, y = 0, z = 0) {
    this.position = new THREE.Vector3(x, y, z);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotation = { yaw: 0, pitch: 0 };
    
    // Размеры для коллизий
    this.width = 0.6;
    this.height = 1.8;
    
    // Состояние
    this.onGround = false;
    this.isFlying = false;
  }

  /**
   * Обновление сущности (вызывается каждый кадр)
   */
  update(deltaTime) {
    // Базовая реализация - просто применяем скорость
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
  }

  /**
   * Получить позицию
   */
  getPosition() {
    return this.position.clone();
  }

  /**
   * Установить позицию
   */
  setPosition(x, y, z) {
    this.position.set(x, y, z);
  }

  /**
   * Телепортировать
   */
  teleport(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
  }
}

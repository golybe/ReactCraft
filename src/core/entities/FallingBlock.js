import { Entity } from './Entity';
import * as THREE from 'three';

/**
 * FallingBlock - сущность падающего блока (песок, гравий)
 */
export class FallingBlock extends Entity {
  constructor(x, y, z, blockType, metadata = 0) {
    // Центрируем сущность по горизонтали
    super(x, y, z);
    this.blockType = blockType;
    this.metadata = metadata;
    
    // Размеры блока для физики
    this.width = 0.9;
    this.height = 0.9;
    
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.shouldLand = false;
    this.isFallingBlock = true; // Флаг для рендерера
  }

  update(deltaTime, chunks, context) {
    const physics = context.physicsEngine;
    const world = context.world;
    if (!physics || !world) return;

    // Применяем гравитацию и коллизии через общий движок
    physics.updateEntity(this, deltaTime);

    // Если приземлились
    if (this.onGround || Math.abs(this.velocity.y) < 0.001) {
      this.shouldLand = true;
    }

    // Логика приземления
    if (this.shouldLand) {
      const bx = Math.floor(this.position.x);
      const by = Math.floor(this.position.y + 0.1); // Небольшое смещение вверх для точности
      const bz = Math.floor(this.position.z);

      // Проверяем, можно ли здесь поставить блок
      const currentBlock = world.getBlock(bx, by, bz);
      if (currentBlock === 0) { // 0 = AIR
        world.setBlock(bx, by, bz, this.blockType, this.metadata);
      } else {
        // Если место занято, дропаем блок как предмет (Survival mode style)
        // В данном упрощенном варианте просто удаляем, 
        // но можно вызвать world.dropItem(...)
      }
      
      this.isDead = true; // Удаляем сущность после приземления
    }
    
    // Если упали слишком глубоко (в бездну)
    if (this.position.y < -10) {
      this.isDead = true;
    }
  }
}

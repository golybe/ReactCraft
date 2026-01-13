// Система коллизий
import { getBlock } from './noise';
import { isSolid } from '../constants/blocks';
import { PLAYER_WIDTH, PLAYER_HEIGHT, GRAVITY, PLAYER_JUMP_FORCE } from '../constants/world';

export class CollisionSystem {
  constructor(chunks) {
    this.chunks = chunks;
  }

  // Обновить ссылку на чанки
  updateChunks(chunks) {
    this.chunks = chunks;
  }

  // Проверить, занимает ли блок пространство
  isBlockSolid(x, y, z) {
    const block = getBlock(this.chunks, Math.floor(x), Math.floor(y), Math.floor(z));
    return isSolid(block);
  }

  // Проверить AABB коллизию
  checkAABBCollision(x, y, z, width, height) {
    const halfWidth = width / 2;

    // Проверяем все блоки вокруг AABB
    const minX = Math.floor(x - halfWidth);
    const maxX = Math.floor(x + halfWidth);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + height - 0.01);
    const minZ = Math.floor(z - halfWidth);
    const maxZ = Math.floor(z + halfWidth);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (this.isBlockSolid(bx, by, bz)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  // Разрешить коллизию по оси X
  resolveX(entity, newX) {
    if (!this.checkAABBCollision(newX, entity.y, entity.z, entity.width, entity.height)) {
      entity.x = newX;
      return false;
    }
    return true;
  }

  // Разрешить коллизию по оси Y
  resolveY(entity, newY) {
    if (!this.checkAABBCollision(entity.x, newY, entity.z, entity.width, entity.height)) {
      entity.y = newY;
      entity.grounded = false;
      return false;
    }

    // Проверяем, на земле ли мы
    if (newY < entity.y) {
      entity.grounded = true;
      entity.y = Math.floor(newY) + 0.001;
    } else {
      entity.y = newY;
    }

    return true;
  }

  // Разрешить коллизию по оси Z
  resolveZ(entity, newZ) {
    if (!this.checkAABBCollision(entity.x, entity.y, newZ, entity.width, entity.height)) {
      entity.z = newZ;
      return false;
    }
    return true;
  }
}

// Класс игрока
export class Player {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.width = PLAYER_WIDTH;
    this.height = PLAYER_HEIGHT;
    this.grounded = false;
    this.selectedBlock = 1; // Выбранный блок для строительства
  }

  update(collisionSystem, keys, dt) {
    // Обработка ввода
    const speed = 0.15;
    let moveX = 0;
    let moveZ = 0;

    // Движение относительно направления камеры
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);

    if (keys.forward) {
      moveX -= sin * speed;
      moveZ -= cos * speed;
    }
    if (keys.backward) {
      moveX += sin * speed;
      moveZ += cos * speed;
    }
    if (keys.left) {
      moveX -= cos * speed;
      moveZ += sin * speed;
    }
    if (keys.right) {
      moveX += cos * speed;
      moveZ -= sin * speed;
    }

    // Прыжок
    if (keys.jump && this.grounded) {
      this.vy = PLAYER_JUMP_FORCE;
      this.grounded = false;
    }

    // Гравитация
    if (!this.grounded) {
      this.vy -= GRAVITY;
    } else {
      this.vy = 0;
    }

    // Применяем скорость
    const newY = this.y + this.vy;

    // Разрешаем коллизии
    collisionSystem.resolveX(this, this.x + moveX);
    collisionSystem.resolveZ(this, this.z + moveZ);
    collisionSystem.resolveY(this, newY);

    // Терминальная скорость
    if (this.vy < -1) this.vy = -1;
  }

  getPosition() {
    return [this.x, this.y + this.height * 0.8, this.z];
  }

  getDirection() {
    return [
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    ];
  }
}

export default {
  CollisionSystem,
  Player
};

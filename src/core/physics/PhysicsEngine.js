/**
 * PhysicsEngine - движок физики для обработки коллизий, гравитации и движения сущностей
 */
import { getBlock } from '../../utils/noise';
import { isSolid } from '../../constants/blocks';
import {
  PHYSICS_GRAVITY,
  MAX_FALL_SPEED,
  GROUND_CHECK_DIST
} from '../../constants/world';

// Физические константы (можно переопределить)
const DEFAULT_GRAVITY = PHYSICS_GRAVITY;
const DEFAULT_MAX_FALL_SPEED = MAX_FALL_SPEED;
const DEFAULT_GROUND_CHECK_DIST = GROUND_CHECK_DIST;

export class PhysicsEngine {
  constructor(chunks = null) {
    this.chunks = chunks;
    this.gravity = DEFAULT_GRAVITY;
    this.maxFallSpeed = DEFAULT_MAX_FALL_SPEED;
    this.groundCheckDist = DEFAULT_GROUND_CHECK_DIST;

    // Pre-allocated arrays for collision checks to avoid GC pressure
    // Each sub-array holds [x, y, z] coordinates
    this._collisionPoints = [
      [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], // Feet (4 corners)
      [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], // Middle (4 corners)
      [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]  // Head (4 corners)
    ];

    // Pre-allocated arrays for ground checks [x, z]
    this._groundCheckPoints = [
      [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]
    ];
  }

  /**
   * Обновить ссылку на чанки
   */
  setChunks(chunks) {
    this.chunks = chunks;
  }

  /**
   * Проверка, является ли блок твердым
   */
  isBlockSolid(x, y, z) {
    if (!this.chunks) return false;
    return isSolid(getBlock(this.chunks, Math.floor(x), Math.floor(y), Math.floor(z)));
  }

  /**
   * Проверка коллизии AABB для сущности
   * @param {Object} entity - сущность с position, width, height
   * @param {number} x - X координата для проверки
   * @param {number} y - Y координата для проверки
   * @param {number} z - Z координата для проверки
   * @returns {boolean} true если есть коллизия
   */
  checkCollision(entity, x, y, z) {
    if (!this.chunks) return false;

    const hw = (entity.width || 0.6) / 2 - 0.01;
    const height = (entity.height || 1.8) - 0.01;
    const halfHeight = height / 2;

    // Reuse pre-allocated arrays to avoid GC pressure
    const p = this._collisionPoints;

    // Feet (4 corners)
    p[0][0] = x - hw; p[0][1] = y; p[0][2] = z - hw;
    p[1][0] = x + hw; p[1][1] = y; p[1][2] = z - hw;
    p[2][0] = x - hw; p[2][1] = y; p[2][2] = z + hw;
    p[3][0] = x + hw; p[3][1] = y; p[3][2] = z + hw;

    // Middle (4 corners)
    p[4][0] = x - hw; p[4][1] = y + halfHeight; p[4][2] = z - hw;
    p[5][0] = x + hw; p[5][1] = y + halfHeight; p[5][2] = z - hw;
    p[6][0] = x - hw; p[6][1] = y + halfHeight; p[6][2] = z + hw;
    p[7][0] = x + hw; p[7][1] = y + halfHeight; p[7][2] = z + hw;

    // Head (4 corners)
    p[8][0] = x - hw; p[8][1] = y + height; p[8][2] = z - hw;
    p[9][0] = x + hw; p[9][1] = y + height; p[9][2] = z - hw;
    p[10][0] = x - hw; p[10][1] = y + height; p[10][2] = z + hw;
    p[11][0] = x + hw; p[11][1] = y + height; p[11][2] = z + hw;

    for (let i = 0; i < 12; i++) {
      if (this.isBlockSolid(p[i][0], p[i][1], p[i][2])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Проверка земли под сущностью
   * @param {Object} entity - сущность
   * @param {number} x - X координата
   * @param {number} y - Y координата
   * @param {number} z - Z координата
   * @returns {boolean} true если есть земля под ногами
   */
  checkGround(entity, x, y, z) {
    if (!this.chunks) return false;

    const hw = (entity.width || 0.6) / 2 - 0.01;
    const checkY = y - this.groundCheckDist;

    return (
      this.isBlockSolid(x - hw, checkY, z - hw) ||
      this.isBlockSolid(x + hw, checkY, z - hw) ||
      this.isBlockSolid(x - hw, checkY, z + hw) ||
      this.isBlockSolid(x + hw, checkY, z + hw) ||
      this.isBlockSolid(x, checkY, z) // Центр тоже проверяем
    );
  }

  /**
   * Найти позицию на земле (для snap к земле)
   * @param {Object} entity - сущность
   * @param {number} x - X координата
   * @param {number} y - Y координата
   * @param {number} z - Z координата
   * @returns {number} Y координата земли
   */
  findGroundY(entity, x, y, z) {
    if (!this.chunks) return y;

    const hw = (entity.width || 0.6) / 2 - 0.01;
    let groundY = -Infinity;

    // Reuse pre-allocated arrays to avoid GC pressure
    const p = this._groundCheckPoints;
    p[0][0] = x - hw; p[0][1] = z - hw;
    p[1][0] = x + hw; p[1][1] = z - hw;
    p[2][0] = x - hw; p[2][1] = z + hw;
    p[3][0] = x + hw; p[3][1] = z + hw;
    p[4][0] = x;      p[4][1] = z;

    const floorY = Math.floor(y);
    const minCheckY = floorY - 2;

    for (let i = 0; i < 5; i++) {
      const px = p[i][0];
      const pz = p[i][1];
      for (let checkY = floorY; checkY >= minCheckY; checkY--) {
        if (this.isBlockSolid(px, checkY, pz)) {
          groundY = Math.max(groundY, checkY + 1);
          break;
        }
      }
    }

    return groundY > -Infinity ? groundY : y;
  }

  /**
   * Применить гравитацию к сущности
   * @param {Object} entity - сущность с velocity и onGround
   * @param {number} deltaTime - время с последнего кадра
   */
  applyGravity(entity, deltaTime) {
    if (!entity.onGround && entity.velocity) {
      entity.velocity.y -= this.gravity * deltaTime;
      entity.velocity.y = Math.max(entity.velocity.y, -this.maxFallSpeed);
    }
  }

  /**
   * Разрешить движение по оси X
   * @param {Object} entity - сущность
   * @param {number} newX - новая X координата
   * @returns {boolean} true если движение разрешено
   */
  resolveX(entity, newX) {
    if (!this.checkCollision(entity, newX, entity.position.y, entity.position.z)) {
      entity.position.x = newX;
      return true;
    }
    return false;
  }

  /**
   * Разрешить движение по оси Y
   * @param {Object} entity - сущность
   * @param {number} newY - новая Y координата
   * @returns {boolean} true если движение разрешено
   */
  resolveY(entity, newY) {
    if (!this.checkCollision(entity, entity.position.x, newY, entity.position.z)) {
      entity.position.y = newY;
      return true;
    }

    // Если коллизия при движении вниз - ставим на землю
    if (newY < entity.position.y) {
      entity.onGround = true;
      const groundY = this.findGroundY(entity, entity.position.x, entity.position.y, entity.position.z);
      entity.position.y = groundY;
      if (entity.velocity) {
        entity.velocity.y = 0;
      }
    } else {
      // Коллизия при движении вверх - останавливаем
      entity.position.y = newY;
      if (entity.velocity) {
        entity.velocity.y = 0;
      }
    }
    return false;
  }

  /**
   * Разрешить движение по оси Z
   * @param {Object} entity - сущность
   * @param {number} newZ - новая Z координата
   * @returns {boolean} true если движение разрешено
   */
  resolveZ(entity, newZ) {
    if (!this.checkCollision(entity, entity.position.x, entity.position.y, newZ)) {
      entity.position.z = newZ;
      return true;
    }
    return false;
  }

  /**
   * Обновить физику сущности (гравитация + коллизии)
   * @param {Object} entity - сущность с position, velocity, width, height, onGround
   * @param {number} deltaTime - время с последнего кадра
   */
  updateEntity(entity, deltaTime) {
    if (!entity.position) return;

    const dt = Math.min(deltaTime, 0.05);

    // Проверяем землю
    const onGround = this.checkGround(
      entity,
      entity.position.x,
      entity.position.y,
      entity.position.z
    );

    entity.onGround = onGround;

    // Применяем гравитацию если не на земле
    if (!onGround && entity.velocity) {
      this.applyGravity(entity, dt);
    } else if (onGround && entity.velocity && entity.velocity.y < 0) {
      // На земле - обнуляем вертикальную скорость и snap к земле
      entity.velocity.y = 0;
      const groundY = this.findGroundY(
        entity,
        entity.position.x,
        entity.position.y,
        entity.position.z
      );
      if (groundY > entity.position.y - 0.5) {
        entity.position.y = groundY;
      }
    }

    // Применяем вертикальное движение
    if (entity.velocity && entity.velocity.y !== 0) {
      const newY = entity.position.y + entity.velocity.y * dt;

      if (entity.velocity.y > 0) {
        // Движение вверх
        if (!this.checkCollision(entity, entity.position.x, newY, entity.position.z)) {
          entity.position.y = newY;
        } else {
          entity.velocity.y = 0;
        }
      } else if (entity.velocity.y < 0) {
        // Движение вниз
        if (!this.checkCollision(entity, entity.position.x, newY, entity.position.z)) {
          entity.position.y = newY;
        } else {
          entity.velocity.y = 0;
          entity.onGround = true;
          const groundY = this.findGroundY(
            entity,
            entity.position.x,
            entity.position.y,
            entity.position.z
          );
          entity.position.y = groundY;
        }
      }
    }
  }
}

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

    // Проверяем углы и центр на разных высотах
    const checkPoints = [
      // Ноги
      [x - hw, y, z - hw],
      [x + hw, y, z - hw],
      [x - hw, y, z + hw],
      [x + hw, y, z + hw],
      // Середина
      [x - hw, y + height / 2, z - hw],
      [x + hw, y + height / 2, z - hw],
      [x - hw, y + height / 2, z + hw],
      [x + hw, y + height / 2, z + hw],
      // Голова
      [x - hw, y + height, z - hw],
      [x + hw, y + height, z - hw],
      [x - hw, y + height, z + hw],
      [x + hw, y + height, z + hw],
    ];

    for (const [px, py, pz] of checkPoints) {
      if (this.isBlockSolid(px, py, pz)) {
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

    // Проверяем все 4 угла и центр
    const checkPositions = [
      [x - hw, z - hw],
      [x + hw, z - hw],
      [x - hw, z + hw],
      [x + hw, z + hw],
      [x, z]
    ];

    for (const [px, pz] of checkPositions) {
      for (let checkY = Math.floor(y); checkY >= Math.floor(y) - 2; checkY--) {
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

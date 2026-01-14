/**
 * Player - класс игрока (наследуется от LivingEntity)
 * Содержит логику движения, физики и управления
 */
import { LivingEntity, DamageSource } from './LivingEntity';
import * as THREE from 'three';
import { getBlock } from '../../utils/noise';
import { isSolid, BLOCK_TYPES } from '../../constants/blocks';
import {
  SEA_LEVEL,
  CHUNK_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  MOVE_SPEED,
  JUMP_VELOCITY,
  WATER_GRAVITY,
  WATER_MAX_FALL_SPEED,
  WATER_SWIM_SPEED,
  WATER_DRAG,
  WATER_BUOYANCY
} from '../../constants/world';
import { PhysicsEngine } from '../physics/PhysicsEngine';

// Константы игрока
const PLAYER_MAX_HEALTH = 20;

export class Player extends LivingEntity {
  constructor(x = 0, y = 64, z = 0) {
    super(x, y, z, PLAYER_MAX_HEALTH);

    this.width = PLAYER_WIDTH;
    this.height = PLAYER_HEIGHT;

    // Сохраняем начальную позицию для респавна
    this.spawnPoint = { x, y, z };

    // Управление
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      shift: false
    };

    // Режимы
    this.noclipMode = false;
    this.canFly = false;
    this.speedMultiplier = 1;

    // Состояние воды
    this.isInWater = false; // Тело находится в воде (любая часть)
    this.isHeadUnderwater = false; // Голова под водой (для визуального эффекта)
    this.isSwimming = false; // Активно плывёт

    // Callback для уведомления об изменениях
    this.onMove = null;

    // Callback для получения актуального canFly (из React state)
    this.getCanFly = null;

    // PhysicsEngine будет установлен извне
    this.physicsEngine = null;
  }

  /**
   * Установить PhysicsEngine
   */
  setPhysicsEngine(physicsEngine) {
    this.physicsEngine = physicsEngine;
  }

  /**
   * Проверка, находится ли точка в воде
   */
  isBlockWater(chunks, x, y, z) {
    if (!chunks) return false;
    const block = getBlock(chunks, Math.floor(x), Math.floor(y), Math.floor(z));
    return block === BLOCK_TYPES.WATER;
  }

  /**
   * Проверка нахождения игрока в воде (тело)
   */
  checkInWater(chunks) {
    if (!chunks) return false;

    // Проверяем несколько точек на теле игрока
    const feetY = this.position.y;
    const bodyY = this.position.y + this.height / 2;
    const headY = this.position.y + this.height - 0.2;

    const inWaterFeet = this.isBlockWater(chunks, this.position.x, feetY, this.position.z);
    const inWaterBody = this.isBlockWater(chunks, this.position.x, bodyY, this.position.z);

    return inWaterFeet || inWaterBody;
  }

  /**
   * Проверка, находится ли голова под водой
   */
  checkHeadUnderwater(chunks) {
    if (!chunks) return false;

    // Уровень глаз игрока
    const eyeY = this.position.y + this.height - 0.3;
    return this.isBlockWater(chunks, this.position.x, eyeY, this.position.z);
  }

  /**
   * Найти безопасную точку спавна
   */
  static findSpawnPoint(chunks, initialPosition) {
    // Если есть сохранённая позиция - используем её
    if (initialPosition) {
      return {
        x: initialPosition.x,
        y: initialPosition.y,
        z: initialPosition.z,
        foundGround: true
      };
    }

    if (!chunks || Object.keys(chunks).length === 0) {
      return { x: 0.5, y: CHUNK_HEIGHT - 5, z: 0.5, foundGround: false };
    }

    // Ищем землю в центре мира
    for (let y = CHUNK_HEIGHT - 2; y >= 0; y--) {
      const block = getBlock(chunks, 0, y, 0);
      if (isSolid(block) && block !== BLOCK_TYPES.WATER) {
        return { x: 0.5, y: y + 1.01, z: 0.5, foundGround: true };
      }
    }

    // Fallback
    return { x: 0.5, y: SEA_LEVEL + 10, z: 0.5, foundGround: false };
  }

  /**
   * Проверка коллизии AABB игрока (делегирует PhysicsEngine)
   */
  checkCollision(chunks, x, y, z) {
    if (!this.physicsEngine) {
      console.warn('[Player] PhysicsEngine not set, collision check skipped');
      return false;
    }
    return this.physicsEngine.checkCollision(this, x, y, z);
  }

  /**
   * Проверка земли под игроком (использует PhysicsEngine)
   */
  checkGround(chunks, x, y, z) {
    if (!this.physicsEngine) return false;
    return this.physicsEngine.checkGround(this, x, y, z);
  }

  /**
   * Найти позицию на земле (использует PhysicsEngine)
   */
  findGroundY(chunks, x, y, z) {
    if (!this.physicsEngine) return y;
    return this.physicsEngine.findGroundY(this, x, y, z);
  }

  /**
   * Вращение камеры
   */
  rotate(deltaYaw, deltaPitch) {
    this.rotation.yaw -= deltaYaw;
    this.rotation.pitch -= deltaPitch;
    this.rotation.pitch = Math.max(
      -Math.PI / 2 + 0.01,
      Math.min(Math.PI / 2 - 0.01, this.rotation.pitch)
    );
  }

  /**
   * Прыжок
   */
  jump() {
    if (this.onGround && this.velocity.y <= 0) {
      this.velocity.y = JUMP_VELOCITY;
      this.onGround = false;
    }
  }

  /**
   * Переключить режим полета
   */
  toggleFly() {
    this.isFlying = !this.isFlying;
    if (!this.isFlying) {
      this.velocity.set(0, 0, 0);
    }
  }

  /**
   * Установить режим полета
   */
  setFlying(flying) {
    this.isFlying = flying;
    if (!flying) {
      this.velocity.set(0, 0, 0);
    }
  }

  /**
   * Телепортация игрока
   */
  teleport(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
  }

  /**
   * Установить точку спавна
   */
  setSpawnPoint(x, y, z) {
    this.spawnPoint = { x, y, z };
  }

  /**
   * Респавн игрока (при смерти)
   */
  respawnPlayer() {
    // Вызываем базовый respawn
    this.respawn();

    // Телепортируем в точку спавна
    this.teleport(this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z);

    // Сбрасываем состояние
    this.isFlying = false;
    this.noclipMode = false;
    this.isInWater = false;
    this.isHeadUnderwater = false;
    this.isSwimming = false;
    this.fallDistance = 0;
  }

  /**
   * Переопределяем update для добавления логики LivingEntity
   */
  update(deltaTime, chunks, isChatOpen = false) {
    // Если мертв - не обновляем движение
    if (this.isDead) {
      return;
    }

    // Вызов оригинальной логики движения (но не super.update!)
    this.updateMovement(deltaTime, chunks, isChatOpen);

    // Обновляем систему здоровья (invulnerableTime и fallDistance)
    // Примечание: fallDistance обрабатывается в LivingEntity.update
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= deltaTime;
      if (this.invulnerableTime < 0) {
        this.invulnerableTime = 0;
      }
    }
  }

  /**
   * Логика движения (вынесена из update)
   */
  updateMovement(deltaTime, chunks, isChatOpen = false) {
    const dt = Math.min(deltaTime, 0.05);

    // Отслеживание падения для урона
    const prevY = this.position.y;
    const wasOnGround = this.onGround;

    // === ОБНОВЛЕНИЕ СОСТОЯНИЯ ВОДЫ ===
    this.isInWater = this.checkInWater(chunks);
    this.isHeadUnderwater = this.checkHeadUnderwater(chunks);

    let currentSpeed = MOVE_SPEED * this.speedMultiplier;

    // При полете скорость в 3 раза выше
    if (this.isFlying) {
      currentSpeed *= 3.0;
    }

    // В воде замедляем скорость
    if (this.isInWater && !this.noclipMode && !this.isFlying) {
      currentSpeed *= WATER_DRAG;
    }

    // === ГОРИЗОНТАЛЬНОЕ ДВИЖЕНИЕ ===
    let inputX = 0, inputZ = 0;

    // ВАЖНО: Читаем ввод только если чат закрыт!
    if (!isChatOpen) {
      if (this.keys.forward) {
        inputX -= Math.sin(this.rotation.yaw);
        inputZ -= Math.cos(this.rotation.yaw);
      }
      if (this.keys.backward) {
        inputX += Math.sin(this.rotation.yaw);
        inputZ += Math.cos(this.rotation.yaw);
      }
      if (this.keys.left) {
        inputX -= Math.cos(this.rotation.yaw);
        inputZ += Math.sin(this.rotation.yaw);
      }
      if (this.keys.right) {
        inputX += Math.cos(this.rotation.yaw);
        inputZ -= Math.sin(this.rotation.yaw);
      }
    }

    // Нормализуем диагональное движение
    const inputLen = Math.sqrt(inputX * inputX + inputZ * inputZ);
    if (inputLen > 0) {
      inputX /= inputLen;
      inputZ /= inputLen;
    }

    const moveX = inputX * currentSpeed * dt;
    const moveZ = inputZ * currentSpeed * dt;

    // === РЕЖИМ NOCLIP (Сквозь стены) ===
    if (this.noclipMode) {
      this.position.x += moveX * 3;
      this.position.z += moveZ * 3;

      // Вертикальное перемещение
      if (this.keys.jump) this.position.y += currentSpeed * dt * 2;
      if (this.keys.shift) this.position.y -= currentSpeed * dt * 2;

      this.velocity.set(0, 0, 0);
      this.isSwimming = false;
    }
    // === РЕЖИМ ПОЛЕТА (Creative) ===
    else if (this.isFlying) {
      // Горизонтальное движение с коллизиями
      const newX = this.position.x + moveX;
      if (!this.checkCollision(chunks, newX, this.position.y, this.position.z)) {
        this.position.x = newX;
      }

      const newZ = this.position.z + moveZ;
      if (!this.checkCollision(chunks, this.position.x, this.position.y, newZ)) {
        this.position.z = newZ;
      }

      // Вертикальное движение (без гравитации, но с коллизиями)
      let vertMove = 0;
      if (this.keys.jump) vertMove += currentSpeed * dt;
      if (this.keys.shift) vertMove -= currentSpeed * dt;

      const newY = this.position.y + vertMove;
      if (vertMove !== 0) {
        if (!this.checkCollision(chunks, this.position.x, newY, this.position.z)) {
          this.position.y = newY;
        }
      }

      this.velocity.set(0, 0, 0);
      this.isSwimming = false;
    }
    // === ФИЗИКА В ВОДЕ ===
    else if (this.isInWater) {
      // Горизонтальное движение (замедленное, с коллизиями)
      const newX = this.position.x + moveX;
      if (!this.checkCollision(chunks, newX, this.position.y, this.position.z)) {
        this.position.x = newX;
      }

      const newZ = this.position.z + moveZ;
      if (!this.checkCollision(chunks, this.position.x, this.position.y, newZ)) {
        this.position.z = newZ;
      }

      // === ВЕРТИКАЛЬНОЕ ДВИЖЕНИЕ В ВОДЕ ===
      // Лёгкая гравитация (игрок медленно тонет)
      this.velocity.y -= WATER_GRAVITY * dt;

      // Ограничиваем скорость погружения
      if (this.velocity.y < -WATER_MAX_FALL_SPEED) {
        this.velocity.y = -WATER_MAX_FALL_SPEED;
      }

      // Плавание вверх при нажатии Space
      if (this.keys.jump && !isChatOpen) {
        this.velocity.y += WATER_BUOYANCY * dt;
        this.isSwimming = true;

        // Ограничиваем скорость всплытия
        if (this.velocity.y > WATER_SWIM_SPEED) {
          this.velocity.y = WATER_SWIM_SPEED;
        }
      } else {
        this.isSwimming = false;
      }

      // Погружение при нажатии Shift
      if (this.keys.shift && !isChatOpen) {
        this.velocity.y -= WATER_BUOYANCY * 0.5 * dt;
      }

      // Применяем вертикальное движение
      if (this.velocity.y !== 0) {
        const newY = this.position.y + this.velocity.y * dt;

        // Проверяем коллизию с твёрдыми блоками (не с водой)
        if (this.physicsEngine) {
          if (!this.physicsEngine.checkCollision(this, this.position.x, newY, this.position.z)) {
            this.position.y = newY;
          } else {
            // Коллизия с землёй
            if (this.velocity.y < 0) {
              this.onGround = true;
              this.velocity.y = 0;
              const groundY = this.physicsEngine.findGroundY(
                this,
                this.position.x,
                this.position.y,
                this.position.z
              );
              this.position.y = groundY;
            } else {
              this.velocity.y = 0;
            }
          }
        } else {
          this.position.y = newY;
        }
      }

      // Сбрасываем onGround в воде (мы плаваем, а не стоим)
      this.onGround = false;
    }
    // === ОБЫЧНАЯ ФИЗИКА ===
    else {
      this.isSwimming = false;

      // Пробуем двигаться по X
      const newX = this.position.x + moveX;
      if (!this.checkCollision(chunks, newX, this.position.y, this.position.z)) {
        this.position.x = newX;
      }

      // Пробуем двигаться по Z
      const newZ = this.position.z + moveZ;
      if (!this.checkCollision(chunks, this.position.x, this.position.y, newZ)) {
        this.position.z = newZ;
      }

      // === ВЕРТИКАЛЬНОЕ ДВИЖЕНИЕ ===
      // Используем PhysicsEngine для обработки гравитации и коллизий
      if (this.physicsEngine) {
        // Обновляем чанки в PhysicsEngine
        this.physicsEngine.setChunks(chunks);

        // Проверяем землю
        const onGround = this.physicsEngine.checkGround(
          this,
          this.position.x,
          this.position.y,
          this.position.z
        );
        this.onGround = onGround;

        // Применяем гравитацию если не на земле
        if (!onGround) {
          this.physicsEngine.applyGravity(this, dt);
        } else {
          if (this.velocity.y < 0) {
            this.velocity.y = 0;
            const groundY = this.physicsEngine.findGroundY(
              this,
              this.position.x,
              this.position.y,
              this.position.z
            );
            if (groundY > this.position.y - 0.5) {
              this.position.y = groundY;
            }
          }
        }

        // Прыжок
        if (this.keys.jump && this.onGround && this.velocity.y <= 0) {
          this.velocity.y = JUMP_VELOCITY;
          this.onGround = false;
        }

        // Применяем вертикальное движение через PhysicsEngine
        if (this.velocity.y !== 0) {
          const newY = this.position.y + this.velocity.y * dt;
          if (this.velocity.y > 0) {
            // Движение вверх
            if (!this.physicsEngine.checkCollision(this, this.position.x, newY, this.position.z)) {
              this.position.y = newY;
            } else {
              this.velocity.y = 0;
            }
          } else if (this.velocity.y < 0) {
            // Движение вниз
            if (!this.physicsEngine.checkCollision(this, this.position.x, newY, this.position.z)) {
              this.position.y = newY;
            } else {
              this.velocity.y = 0;
              this.onGround = true;
              const groundY = this.physicsEngine.findGroundY(
                this,
                this.position.x,
                this.position.y,
                this.position.z
              );
              this.position.y = groundY;
            }
          }
        }
      } else {
        // PhysicsEngine is required for proper physics
        console.warn('[Player] PhysicsEngine not set, physics disabled');
      }
    }

    // Защита от падения в пустоту
    if (!this.noclipMode && !this.isFlying && this.position.y < -20) {
      const spawn = Player.findSpawnPoint(chunks, null);
      this.position.set(spawn.x, spawn.y, spawn.z);
      this.velocity.set(0, 0, 0);
    }

    // === УРОН ОТ ПАДЕНИЯ ===
    // Проверяем урон от падения только если приземлились
    // В креативном режиме (canFly) урон от падения отключен
    // Используем getCanFly() callback для получения актуального значения из React state
    const actualCanFly = this.getCanFly ? this.getCanFly() : this.canFly;
    
    if (!wasOnGround && this.onGround && !actualCanFly && !this.isFlying && !this.noclipMode && !this.isInWater) {
      const fallDist = prevY - this.position.y;
      if (fallDist > 0) {
        this.fallDistance += fallDist;
      }
      // Урон от падения (> 3 блоков)
      if (this.fallDistance > 3) {
        const damage = Math.floor(this.fallDistance - 3);
        if (damage > 0) {
          this.damage(damage, DamageSource.FALL);
        }
      }
      this.fallDistance = 0;
    } else if (!this.onGround && this.velocity.y < 0 && !actualCanFly && !this.isFlying && !this.noclipMode && !this.isInWater) {
      // Накапливаем дистанцию падения
      const fallDist = prevY - this.position.y;
      if (fallDist > 0) {
        this.fallDistance += fallDist;
      }
    } else if (actualCanFly || this.isFlying || this.noclipMode || this.isInWater) {
      // Сбрасываем при полете/воде/креативе
      this.fallDistance = 0;
    }

    // Уведомляем об изменениях
    if (this.onMove) {
      this.onMove({
        type: 'position',
        x: this.position.x,
        y: this.position.y,
        z: this.position.z,
        yaw: this.rotation.yaw,
        pitch: this.rotation.pitch,
        isFlying: this.isFlying || this.noclipMode,
        isInWater: this.isInWater,
        isHeadUnderwater: this.isHeadUnderwater,
        isSwimming: this.isSwimming,
        health: this.health,
        maxHealth: this.maxHealth
      });
    }
  }
}

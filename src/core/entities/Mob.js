/**
 * Mob - базовый класс для всех мобов
 * Наследуется от LivingEntity, добавляет базовую логику мобов
 */
import { LivingEntity, DamageSource } from './LivingEntity';
import { MobRegistry } from './MobRegistry';
import { MOB_AI, MOB_PHYSICS } from '../../constants/mobs';

// Состояния AI моба
export const MobState = {
  IDLE: 'idle',       // Стоит на месте
  WANDER: 'wander',   // Бродит случайно
  CHASE: 'chase',     // Преследует цель
  ATTACK: 'attack',   // Атакует
  FLEE: 'flee',       // Убегает
  DEAD: 'dead'        // Мёртв
};

export class Mob extends LivingEntity {
  constructor(x = 0, y = 0, z = 0, mobType) {
    // Получаем определение моба из реестра
    const definition = MobRegistry.get(mobType);
    if (!definition) {
      console.error(`[Mob] Unknown mob type: ${mobType}`);
    }

    const maxHealth = definition?.maxHealth || 20;
    super(x, y, z, maxHealth);

    // Тип моба
    this.mobType = mobType;
    this.definition = definition;

    // Применяем параметры из определения
    if (definition) {
      this.width = definition.width;
      this.height = definition.height;
      this.moveSpeed = definition.moveSpeed;
      this.attackDamage = definition.attackDamage;
      this.attackRange = definition.attackRange;
      this.detectionRange = definition.detectionRange;
      this.hostile = definition.hostile;
    } else {
      // Дефолтные значения
      this.moveSpeed = 4.3;
      this.attackDamage = 2;
      this.attackRange = 1.5;
      this.detectionRange = 16;
      this.hostile = true;
    }

    // AI состояние
    this.state = MobState.IDLE;
    this.target = null;           // Целевая сущность
    this.targetPosition = null;   // Целевая позиция (для wander)

    // Таймеры AI
    this.thinkTimer = 0;
    this.wanderTimer = 0;
    this.attackCooldown = 0;
    this.aggroTimer = 0;

    // Навигация
    this.path = [];               // Путь к цели
    this.pathIndex = 0;
    this.pathUpdateTimer = 0;

    // Физика
    this.gravity = MOB_PHYSICS.GRAVITY;
    this.maxFallSpeed = MOB_PHYSICS.MAX_FALL_SPEED;
    this.stepHeight = MOB_PHYSICS.STEP_HEIGHT;

    // Анимация
    this.walkAnimation = 0;
    this.hurtAnimation = 0;

    // PhysicsEngine для коллизий (будет установлен извне)
    this.physicsEngine = null;
  }

  /**
   * Установить PhysicsEngine
   */
  setPhysicsEngine(physicsEngine) {
    this.physicsEngine = physicsEngine;
  }

  /**
   * Главный метод обновления моба
   */
  update(deltaTime, chunks, context = {}) {
    if (this.isDead) {
      this.state = MobState.DEAD;
      return;
    }

    // Обновляем таймеры
    this.updateTimers(deltaTime);

    // Обновляем анимации
    this.updateAnimations(deltaTime);

    // AI мышление (с интервалом для оптимизации)
    this.thinkTimer += deltaTime;
    if (this.thinkTimer >= MOB_AI.THINK_INTERVAL) {
      this.think(context);
      this.thinkTimer = 0;
    }

    // Выполняем действия на основе состояния
    this.executeState(deltaTime, chunks, context);

    // Применяем физику
    this.applyPhysics(deltaTime, chunks);

    // Вызываем родительский update (invulnerableTime)
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= deltaTime;
      if (this.invulnerableTime < 0) {
        this.invulnerableTime = 0;
      }
    }
  }

  /**
   * Обновление таймеров
   */
  updateTimers(deltaTime) {
    if (this.attackCooldown > 0) {
      this.attackCooldown -= deltaTime;
    }

    if (this.aggroTimer > 0) {
      this.aggroTimer -= deltaTime;
    }

    if (this.hurtAnimation > 0) {
      this.hurtAnimation -= deltaTime * 2;
    }
  }

  /**
   * Обновление анимаций
   */
  updateAnimations(deltaTime) {
    // Анимация ходьбы
    const speed = Math.sqrt(
      this.velocity.x * this.velocity.x +
      this.velocity.z * this.velocity.z
    );

    if (speed > 0.1) {
      this.walkAnimation += deltaTime * speed * 2;
    } else {
      this.walkAnimation = 0;
    }
  }

  /**
   * AI мышление - принятие решений
   * Заглушка для будущей реализации AI
   */
  think(context) {
    // Базовая логика - заглушка
    // В будущем здесь будет:
    // - Поиск игрока
    // - Выбор состояния
    // - Построение пути

    const player = context.player;

    if (!player) {
      // Нет игрока - просто бродим
      if (this.state !== MobState.WANDER && this.state !== MobState.IDLE) {
        this.state = MobState.IDLE;
      }
      return;
    }

    // Проверяем расстояние до игрока
    const dx = player.position.x - this.position.x;
    const dy = player.position.y - this.position.y;
    const dz = player.position.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (this.hostile && distance <= this.detectionRange) {
      // Враждебный моб видит игрока
      this.target = player;
      this.aggroTimer = MOB_AI.AGGRO_DURATION;

      if (distance <= this.attackRange) {
        this.state = MobState.ATTACK;
      } else {
        this.state = MobState.CHASE;
      }
    } else if (this.aggroTimer > 0 && this.target) {
      // Помним о цели какое-то время
      this.state = MobState.CHASE;
    } else {
      // Не видим цель
      this.target = null;

      // Случайно переключаемся между IDLE и WANDER
      this.wanderTimer += MOB_AI.THINK_INTERVAL;
      if (this.wanderTimer >= MOB_AI.WANDER_INTERVAL) {
        this.wanderTimer = 0;
        this.state = this.state === MobState.IDLE ? MobState.WANDER : MobState.IDLE;

        // Выбираем случайную точку для брождения
        if (this.state === MobState.WANDER) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * MOB_AI.WANDER_RADIUS;
          this.targetPosition = {
            x: this.position.x + Math.cos(angle) * dist,
            z: this.position.z + Math.sin(angle) * dist
          };
        }
      }
    }
  }

  /**
   * Выполнение действий на основе состояния
   * Заглушка для будущей реализации AI
   */
  executeState(deltaTime, chunks, context) {
    switch (this.state) {
      case MobState.IDLE:
        // Стоим на месте
        this.velocity.x = 0;
        this.velocity.z = 0;
        break;

      case MobState.WANDER:
        // Идём к случайной точке
        if (this.targetPosition) {
          this.moveTowards(this.targetPosition.x, this.targetPosition.z, deltaTime);
        }
        break;

      case MobState.CHASE:
        // Преследуем цель
        if (this.target) {
          this.moveTowards(this.target.position.x, this.target.position.z, deltaTime);
        }
        break;

      case MobState.ATTACK:
        // Атакуем цель
        this.velocity.x = 0;
        this.velocity.z = 0;

        if (this.target && this.attackCooldown <= 0) {
          this.attack(this.target);
          this.attackCooldown = MOB_AI.ATTACK_COOLDOWN;
        }
        break;

      case MobState.FLEE:
        // Убегаем от цели
        if (this.target) {
          this.moveAway(this.target.position.x, this.target.position.z, deltaTime);
        }
        break;

      case MobState.DEAD:
        this.velocity.x = 0;
        this.velocity.z = 0;
        break;
    }
  }

  /**
   * Движение к точке
   */
  moveTowards(targetX, targetZ, deltaTime) {
    const dx = targetX - this.position.x;
    const dz = targetZ - this.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 0.5) {
      // Достигли цели
      this.velocity.x = 0;
      this.velocity.z = 0;
      return;
    }

    // Направление к цели
    const dirX = dx / distance;
    const dirZ = dz / distance;

    // Устанавливаем скорость
    this.velocity.x = dirX * this.moveSpeed;
    this.velocity.z = dirZ * this.moveSpeed;

    // Поворачиваем моба к цели
    this.rotation.yaw = Math.atan2(-dx, -dz);
  }

  /**
   * Движение от точки
   */
  moveAway(targetX, targetZ, deltaTime) {
    const dx = this.position.x - targetX;
    const dz = this.position.z - targetZ;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 0.1) {
      // Слишком близко, выбираем случайное направление
      const angle = Math.random() * Math.PI * 2;
      this.velocity.x = Math.cos(angle) * this.moveSpeed;
      this.velocity.z = Math.sin(angle) * this.moveSpeed;
      return;
    }

    // Направление от цели
    const dirX = dx / distance;
    const dirZ = dz / distance;

    this.velocity.x = dirX * this.moveSpeed;
    this.velocity.z = dirZ * this.moveSpeed;
  }

  /**
   * Атака цели
   * Заглушка - в будущем здесь будет реальная атака
   */
  attack(target) {
    if (!target || !target.damage) return;

    // Наносим урон цели
    target.damage(this.attackDamage, DamageSource.MOB, this);
  }

  /**
   * Применение физики
   * Упрощенная версия - в будущем использовать PhysicsEngine
   */
  applyPhysics(deltaTime, chunks) {
    const dt = Math.min(deltaTime, 0.05);

    // Гравитация
    if (!this.onGround) {
      this.velocity.y -= this.gravity * dt;
      if (this.velocity.y < -this.maxFallSpeed) {
        this.velocity.y = -this.maxFallSpeed;
      }
    }

    // Применяем скорость
    const newX = this.position.x + this.velocity.x * dt;
    const newY = this.position.y + this.velocity.y * dt;
    const newZ = this.position.z + this.velocity.z * dt;

    // Простая проверка коллизий через PhysicsEngine (если есть)
    if (this.physicsEngine) {
      // Горизонтальное движение
      if (!this.physicsEngine.checkCollision(this, newX, this.position.y, this.position.z)) {
        this.position.x = newX;
      } else {
        this.velocity.x = 0;
      }

      if (!this.physicsEngine.checkCollision(this, this.position.x, this.position.y, newZ)) {
        this.position.z = newZ;
      } else {
        this.velocity.z = 0;
      }

      // Вертикальное движение
      if (!this.physicsEngine.checkCollision(this, this.position.x, newY, this.position.z)) {
        this.position.y = newY;
        this.onGround = false;
      } else {
        if (this.velocity.y < 0) {
          this.onGround = true;
          this.position.y = this.physicsEngine.findGroundY(
            this,
            this.position.x,
            this.position.y,
            this.position.z
          );
        }
        this.velocity.y = 0;
      }
    } else {
      // Без PhysicsEngine просто применяем скорость
      this.position.x = newX;
      this.position.y = newY;
      this.position.z = newZ;

      // Защита от падения в пустоту
      if (this.position.y < -20) {
        this.die(DamageSource.VOID);
      }
    }
  }

  /**
   * Переопределение получения урона для анимации
   */
  damage(amount, source = DamageSource.GENERIC, attacker = null) {
    const damaged = super.damage(amount, source, attacker);

    if (damaged) {
      // Запускаем анимацию получения урона
      this.hurtAnimation = 1.0;

      // Если атакован игроком - агрессируем на него
      if (attacker && this.hostile) {
        this.target = attacker;
        this.aggroTimer = MOB_AI.AGGRO_DURATION;
        this.state = MobState.CHASE;
      }
    }

    return damaged;
  }

  /**
   * Установить цель
   */
  setTarget(entity) {
    this.target = entity;
    if (entity) {
      this.aggroTimer = MOB_AI.AGGRO_DURATION;
    }
  }

  /**
   * Очистить цель
   */
  clearTarget() {
    this.target = null;
    this.aggroTimer = 0;
    this.state = MobState.IDLE;
  }

  /**
   * Проверка видимости сущности
   * Заглушка - в будущем будет raycast
   */
  canSee(entity) {
    if (!entity) return false;

    const dx = entity.position.x - this.position.x;
    const dy = entity.position.y - this.position.y;
    const dz = entity.position.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    return distance <= this.detectionRange;
  }

  /**
   * Получить дроп при смерти
   */
  getDrops() {
    if (!this.definition || !this.definition.drops) {
      return [];
    }

    const drops = [];

    for (const drop of this.definition.drops) {
      if (Math.random() <= drop.chance) {
        let count;
        if (Array.isArray(drop.count)) {
          count = Math.floor(
            Math.random() * (drop.count[1] - drop.count[0] + 1) + drop.count[0]
          );
        } else {
          count = drop.count;
        }

        if (count > 0) {
          drops.push({
            type: drop.type,
            count: count
          });
        }
      }
    }

    return drops;
  }

  /**
   * Сериализация для сохранения
   */
  serialize() {
    return {
      mobType: this.mobType,
      position: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      },
      health: this.health,
      rotation: { ...this.rotation }
    };
  }

  /**
   * Десериализация
   */
  static deserialize(data) {
    const mob = new Mob(
      data.position.x,
      data.position.y,
      data.position.z,
      data.mobType
    );
    mob.health = data.health;
    mob.rotation = { ...data.rotation };
    return mob;
  }
}

/**
 * Mob - базовый класс для всех мобов
 * Наследуется от LivingEntity, добавляет базовую логику мобов
 * 
 * Использует систему целей (Goals) как в Minecraft:
 * - GoalSelector управляет приоритетами целей
 * - Navigation отвечает за движение
 * - LookController за плавный поворот
 */
import { LivingEntity, DamageSource } from './LivingEntity';
import { MobRegistry } from './MobRegistry';
import { MOB_AI, MOB_PHYSICS } from '../../constants/mobs';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../../constants/world';
import { isSolid } from '../../constants/blocks';

// AI система
import { 
  GoalSelector, 
  MobNavigation, 
  LookController,
  WaterAvoidingRandomStrollGoal,
  RandomLookAroundGoal,
  LookAtPlayerGoal,
  PanicGoal,
  EatBlockGoal
} from './ai';

// Состояния AI моба (для совместимости)
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

    // === НОВАЯ СИСТЕМА AI (как в Minecraft) ===
    
    // Контроллеры
    this.navigation = new MobNavigation(this);
    this.lookController = new LookController(this);
    
    // Селектор целей
    this.goalSelector = new GoalSelector(this);
    
    // Регистрируем цели для мирных мобов
    if (!this.hostile) {
      this.registerPassiveMobGoals();
    } else {
      this.registerHostileMobGoals();
    }
    
    // Контекст AI (игрок, мир и т.д.)
    this.context = null;
    
    // Время последнего урона (для PanicGoal)
    this.lastDamageTimestamp = 0;
    
    // === Устаревшие поля (для совместимости) ===
    this.state = MobState.IDLE;
    this.target = null;
    this.targetPosition = null;
    this.thinkTimer = 0;
    this.wanderTimer = 0;
    this.attackCooldown = 0;
    this.aggroTimer = 0;
    this.path = [];
    this.pathIndex = 0;
    this.pathUpdateTimer = 0;

    // Физика
    this.gravity = MOB_PHYSICS.GRAVITY;
    this.maxFallSpeed = MOB_PHYSICS.MAX_FALL_SPEED;
    this.stepHeight = MOB_PHYSICS.STEP_HEIGHT;

    // Анимация
    this.walkAnimation = 0;
    this.hurtAnimation = 0;
    
    // Анимация еды (для овец)
    this.isEating = false;
    this.eatingProgress = 0; // 0-1
    
    // Состояние шерсти (для овец)
    this.isSheared = false;

    // PhysicsEngine для коллизий (будет установлен извне)
    this.physicsEngine = null;
  }

  /**
   * Регистрация целей для мирных мобов (овцы, коровы, свиньи)
   */
  registerPassiveMobGoals() {
    // Приоритеты (меньше = важнее):
    // 1 - Паника при уроне
    // 4 - Есть траву (только овцы)
    // 5 - Случайное блуждание  
    // 6 - Смотреть на игрока
    // 7 - Случайно оглядываться
    
    this.goalSelector.addGoal(1, new PanicGoal(this, 1.25));
    
    // Овцы едят траву!
    if (this.mobType === 'sheep') {
      this.goalSelector.addGoal(4, new EatBlockGoal(this));
    }
    
    this.goalSelector.addGoal(5, new WaterAvoidingRandomStrollGoal(this, 1.0));
    this.goalSelector.addGoal(6, new LookAtPlayerGoal(this, 6.0));
    this.goalSelector.addGoal(7, new RandomLookAroundGoal(this));
  }

  /**
   * Регистрация целей для враждебных мобов
   */
  registerHostileMobGoals() {
    // TODO: Добавить цели для враждебных мобов
    // - MeleeAttackGoal
    // - NearestAttackableTargetGoal
    // - etc.
    
    // Пока используем базовое поведение
    this.goalSelector.addGoal(5, new WaterAvoidingRandomStrollGoal(this, 1.0));
    this.goalSelector.addGoal(7, new RandomLookAroundGoal(this));
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

    // Сохраняем контекст для целей
    this.context = context;

    // Обновляем таймеры
    this.updateTimers(deltaTime);

    // Обновляем анимации
    this.updateAnimations(deltaTime);

    // === НОВАЯ СИСТЕМА AI ===
    // Обновляем контроллеры
    this.lookController.tick(deltaTime);
    this.navigation.tick(deltaTime);
    
    // Обновляем цели
    this.goalSelector.tick(deltaTime);

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
      // Не видим цель — мирное поведение
      this.target = null;

      // Таймер для смены состояния
      this.wanderTimer += MOB_AI.THINK_INTERVAL;
      
      // Случайный интервал между MIN и MAX
      if (!this.nextWanderTime) {
        this.nextWanderTime = MOB_AI.WANDER_INTERVAL_MIN + 
          Math.random() * (MOB_AI.WANDER_INTERVAL_MAX - MOB_AI.WANDER_INTERVAL_MIN);
      }

      if (this.wanderTimer >= this.nextWanderTime) {
        this.wanderTimer = 0;
        this.nextWanderTime = null; // Сбросить для нового случайного времени

        // Шанс остаться стоять или начать движение
        if (this.state === MobState.IDLE) {
          // Стояли — теперь идём
          this.state = MobState.WANDER;
          
          // Выбираем случайную точку для брождения
          const angle = Math.random() * Math.PI * 2;
          const dist = 2 + Math.random() * (MOB_AI.WANDER_RADIUS - 2);
          this.targetPosition = {
            x: this.position.x + Math.cos(angle) * dist,
            z: this.position.z + Math.sin(angle) * dist
          };
        } else {
          // Шли — теперь шанс остановиться или продолжить
          if (Math.random() < MOB_AI.IDLE_CHANCE) {
            this.state = MobState.IDLE;
          } else {
            // Выбираем новую точку и продолжаем
            const angle = Math.random() * Math.PI * 2;
            const dist = 2 + Math.random() * (MOB_AI.WANDER_RADIUS - 2);
            this.targetPosition = {
              x: this.position.x + Math.cos(angle) * dist,
              z: this.position.z + Math.sin(angle) * dist
            };
          }
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

    // Поворачиваем моба к цели (смотрит в направлении движения)
    this.rotation.yaw = Math.atan2(dirX, dirZ);
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
   * Получить блок из chunks по мировым координатам
   */
  getBlock(chunks, worldX, worldY, worldZ) {
    if (worldY < 0 || worldY >= WORLD_HEIGHT) return 0;
    
    const chunkX = Math.floor(worldX / CHUNK_SIZE);
    const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
    const key = `${chunkX},${chunkZ}`;
    const chunk = chunks?.[key];
    
    if (!chunk) return 0;
    
    const localX = ((Math.floor(worldX) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((Math.floor(worldZ) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    return chunk.getBlock(localX, Math.floor(worldY), localZ);
  }

  /**
   * Проверка коллизии AABB моба с блоками мира
   */
  checkCollision(chunks, x, y, z) {
    const hw = this.width / 2;
    const hd = this.width / 2; // Мобы обычно квадратные в горизонтали
    
    // Проверяем все блоки в AABB моба
    const minX = Math.floor(x - hw);
    const maxX = Math.floor(x + hw);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + this.height);
    const minZ = Math.floor(z - hd);
    const maxZ = Math.floor(z + hd);
    
    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const block = this.getBlock(chunks, bx, by, bz);
          if (isSolid(block)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Найти Y позицию земли под мобом
   */
  findGroundY(chunks, x, z) {
    const hw = this.width / 2;
    let groundY = Math.floor(this.position.y);
    
    // Ищем землю вниз
    for (let y = groundY; y >= 0; y--) {
      // Проверяем все блоки под мобом
      let hasGround = false;
      for (let bx = Math.floor(x - hw); bx <= Math.floor(x + hw); bx++) {
        for (let bz = Math.floor(z - hw); bz <= Math.floor(z + hw); bz++) {
          const block = this.getBlock(chunks, bx, y, bz);
          if (isSolid(block)) {
            hasGround = true;
            break;
          }
        }
        if (hasGround) break;
      }
      
      if (hasGround) {
        return y + 1; // Стоим на блоке
      }
    }
    
    return 0;
  }

  /**
   * Применение физики с коллизиями через chunks
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

    // Коллизии через chunks
    if (chunks) {
      let movedX = false;
      let movedZ = false;
      
      // Движение по X
      if (!this.checkCollision(chunks, newX, this.position.y, this.position.z)) {
        this.position.x = newX;
        movedX = true;
      } else if (this.onGround) {
        // Пробуем step up по X — проверяем что не влезем в блок СВЕРХУ
        const stepY = this.position.y + 1.0;
        // Проверяем и новую позицию И путь подъёма
        const canStepUp = !this.checkCollision(chunks, newX, stepY, this.position.z) &&
                          !this.checkCollision(chunks, this.position.x, stepY, this.position.z);
        if (canStepUp) {
          this.position.x = newX;
          this.position.y = stepY;
          movedX = true;
        }
      }
      
      if (!movedX && Math.abs(this.velocity.x) > 0.01) {
        this.velocity.x = 0;
        this.isStuck = true;
      }

      // Движение по Z
      if (!this.checkCollision(chunks, this.position.x, this.position.y, newZ)) {
        this.position.z = newZ;
        movedZ = true;
      } else if (this.onGround) {
        // Пробуем step up по Z
        const stepY = this.position.y + 1.0;
        const canStepUp = !this.checkCollision(chunks, this.position.x, stepY, newZ) &&
                          !this.checkCollision(chunks, this.position.x, stepY, this.position.z);
        if (canStepUp) {
          this.position.z = newZ;
          this.position.y = stepY;
          movedZ = true;
        }
      }
      
      if (!movedZ && Math.abs(this.velocity.z) > 0.01) {
        this.velocity.z = 0;
        this.isStuck = true;
      }
      
      // Если двигались успешно — не застряли
      if (movedX || movedZ) {
        this.isStuck = false;
      }
      
      // ЗАЩИТА: если застряли в блоке — выталкиваем вверх
      if (this.checkCollision(chunks, this.position.x, this.position.y, this.position.z)) {
        // Ищем свободное место вверх
        for (let tryY = this.position.y; tryY < this.position.y + 3; tryY += 0.5) {
          if (!this.checkCollision(chunks, this.position.x, tryY, this.position.z)) {
            this.position.y = tryY;
            break;
          }
        }
      }

      // Вертикальное движение
      if (!this.checkCollision(chunks, this.position.x, newY, this.position.z)) {
        this.position.y = newY;
        this.onGround = false;
      } else {
        if (this.velocity.y < 0) {
          // Падаем - нашли землю
          this.onGround = true;
          this.position.y = this.findGroundY(chunks, this.position.x, this.position.z);
        }
        this.velocity.y = 0;
      }
    } else {
      // Без chunks просто применяем скорость (fallback)
      this.position.x = newX;
      this.position.y = newY;
      this.position.z = newZ;
    }

    // Защита от падения в пустоту
    if (this.position.y < -20) {
      this.die(DamageSource.VOID);
    }
  }

  /**
   * Переопределение получения урона для анимации и паники
   */
  damage(amount, source = DamageSource.GENERIC, attacker = null) {
    const damaged = super.damage(amount, source, attacker);

    if (damaged) {
      // Запоминаем время урона для PanicGoal
      this.lastDamageTimestamp = performance.now();
      
      // Запускаем анимацию получения урона
      this.hurtAnimation = 1.0;

      // Если атакован игроком - агрессируем на него (для враждебных мобов)
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

/**
 * LivingEntity - базовый класс для живых сущностей (игрок, мобы)
 * Добавляет систему здоровья поверх Entity
 */
import { Entity } from './Entity';

// Источники урона
export const DamageSource = {
  FALL: 'fall',
  MOB: 'mob',
  PLAYER: 'player',
  VOID: 'void',
  DROWNING: 'drowning',
  FIRE: 'fire',
  GENERIC: 'generic'
};

export class LivingEntity extends Entity {
  constructor(x = 0, y = 0, z = 0, maxHealth = 20) {
    super(x, y, z);

    // Система здоровья
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.isDead = false;

    // Неуязвимость после получения урона (в секундах)
    this.invulnerableTime = 0;
    this.invulnerableDuration = 0.5; // 0.5 секунды неуязвимости после урона

    // Урон от падения
    this.fallDistance = 0;
    this.lastY = y;

    // Callbacks
    this.onDamage = null;  // (amount, source, attacker) => void
    this.onDeath = null;   // (source, attacker) => void
    this.onHeal = null;    // (amount) => void
  }

  /**
   * Обновление сущности
   */
  update(deltaTime) {
    super.update(deltaTime);

    // Уменьшаем время неуязвимости
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= deltaTime;
      if (this.invulnerableTime < 0) {
        this.invulnerableTime = 0;
      }
    }

    // Отслеживание падения
    this.updateFallDistance();
  }

  /**
   * Обновление дистанции падения
   */
  updateFallDistance() {
    const deltaY = this.lastY - this.position.y;

    if (deltaY > 0 && !this.onGround) {
      // Падаем вниз
      this.fallDistance += deltaY;
    } else if (this.onGround && this.fallDistance > 0) {
      // Приземлились - проверяем урон от падения
      this.handleFallDamage();
      this.fallDistance = 0;
    } else if (this.velocity.y >= 0) {
      // Двигаемся вверх или стоим - сбрасываем
      this.fallDistance = 0;
    }

    this.lastY = this.position.y;
  }

  /**
   * Обработка урона от падения
   */
  handleFallDamage() {
    // Урон начинается с падения > 3 блоков
    const safeFallDistance = 3;
    if (this.fallDistance > safeFallDistance) {
      const damage = Math.floor(this.fallDistance - safeFallDistance);
      if (damage > 0) {
        this.damage(damage, DamageSource.FALL);
      }
    }
  }

  /**
   * Нанести урон сущности
   * @param {number} amount - количество урона
   * @param {string} source - источник урона (DamageSource)
   * @param {Entity} attacker - атакующая сущность (опционально)
   * @returns {boolean} - был ли урон нанесён
   */
  damage(amount, source = DamageSource.GENERIC, attacker = null) {
    if (this.isDead) return false;
    if (this.invulnerableTime > 0) return false;
    if (amount <= 0) return false;

    // Применяем урон
    this.health -= amount;

    // Устанавливаем неуязвимость
    this.invulnerableTime = this.invulnerableDuration;

    // Callback
    if (this.onDamage) {
      this.onDamage(amount, source, attacker);
    }

    // Проверяем смерть
    if (this.health <= 0) {
      this.health = 0;
      this.die(source, attacker);
    }

    return true;
  }

  /**
   * Исцелить сущность
   * @param {number} amount - количество здоровья
   * @returns {number} - фактически восстановленное здоровье
   */
  heal(amount) {
    if (this.isDead) return 0;
    if (amount <= 0) return 0;

    const oldHealth = this.health;
    this.health = Math.min(this.health + amount, this.maxHealth);
    const healed = this.health - oldHealth;

    if (healed > 0 && this.onHeal) {
      this.onHeal(healed);
    }

    return healed;
  }

  /**
   * Установить здоровье напрямую
   * @param {number} value - новое значение здоровья
   */
  setHealth(value) {
    this.health = Math.max(0, Math.min(value, this.maxHealth));
    if (this.health <= 0 && !this.isDead) {
      this.die(DamageSource.GENERIC);
    }
  }

  /**
   * Убить сущность
   * @param {string} source - источник смерти
   * @param {Entity} attacker - убийца (опционально)
   */
  die(source = DamageSource.GENERIC, attacker = null) {
    if (this.isDead) return;

    this.isDead = true;
    this.health = 0;
    this.velocity.set(0, 0, 0);

    if (this.onDeath) {
      this.onDeath(source, attacker);
    }
  }

  /**
   * Воскресить сущность
   * @param {number} health - начальное здоровье (по умолчанию maxHealth)
   */
  respawn(health = null) {
    this.isDead = false;
    this.health = health !== null ? health : this.maxHealth;
    this.invulnerableTime = 0;
    this.fallDistance = 0;
  }

  /**
   * Убить мгновенно (игнорирует неуязвимость)
   */
  kill() {
    this.die(DamageSource.GENERIC);
  }

  /**
   * Проверка, жива ли сущность
   */
  isAlive() {
    return !this.isDead && this.health > 0;
  }

  /**
   * Получить процент здоровья (0-1)
   */
  getHealthPercent() {
    return this.health / this.maxHealth;
  }

  /**
   * Проверка неуязвимости
   */
  isInvulnerable() {
    return this.invulnerableTime > 0;
  }
}

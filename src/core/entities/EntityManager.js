/**
 * EntityManager - управление всеми сущностями в игре
 * Централизованное хранилище и обновление сущностей
 */
import { Entity } from './Entity';
import { LivingEntity } from './LivingEntity';

export class EntityManager {
  constructor() {
    // Хранилище сущностей: id -> Entity
    this.entities = new Map();

    // Счётчик для генерации уникальных ID
    this.nextId = 1;

    // Callback при изменении списка сущностей
    this.onChange = null;
  }

  /**
   * Генерация уникального ID
   */
  generateId() {
    return `entity_${this.nextId++}`;
  }

  /**
   * Добавить сущность
   * @param {Entity} entity - сущность для добавления
   * @param {string} customId - опциональный кастомный ID
   * @returns {string} - ID добавленной сущности
   */
  spawn(entity, customId = null) {
    const id = customId || this.generateId();
    entity.id = id;
    this.entities.set(id, entity);

    if (this.onChange) {
      this.onChange('spawn', id, entity);
    }

    return id;
  }

  /**
   * Удалить сущность по ID
   * @param {string} id - ID сущности
   * @returns {boolean} - была ли сущность удалена
   */
  despawn(id) {
    const entity = this.entities.get(id);
    if (!entity) return false;

    this.entities.delete(id);

    if (this.onChange) {
      this.onChange('despawn', id, entity);
    }

    return true;
  }

  /**
   * Получить сущность по ID
   * @param {string} id - ID сущности
   * @returns {Entity|null}
   */
  get(id) {
    return this.entities.get(id) || null;
  }

  /**
   * Проверить существование сущности
   * @param {string} id - ID сущности
   * @returns {boolean}
   */
  has(id) {
    return this.entities.has(id);
  }

  /**
   * Получить все сущности
   * @returns {Entity[]}
   */
  getAll() {
    return Array.from(this.entities.values());
  }

  /**
   * Получить все сущности определённого типа
   * @param {Function} EntityClass - класс сущности (например, Mob)
   * @returns {Entity[]}
   */
  getByType(EntityClass) {
    return this.getAll().filter(entity => entity instanceof EntityClass);
  }

  /**
   * Получить все живые сущности
   * @returns {LivingEntity[]}
   */
  getLiving() {
    return this.getAll().filter(entity =>
      entity instanceof LivingEntity && entity.isAlive()
    );
  }

  /**
   * Получить сущности в радиусе от точки
   * @param {number} x - X координата центра
   * @param {number} y - Y координата центра
   * @param {number} z - Z координата центра
   * @param {number} radius - радиус поиска
   * @returns {Entity[]}
   */
  getInRadius(x, y, z, radius) {
    const radiusSq = radius * radius;

    return this.getAll().filter(entity => {
      const dx = entity.position.x - x;
      const dy = entity.position.y - y;
      const dz = entity.position.z - z;
      const distSq = dx * dx + dy * dy + dz * dz;
      return distSq <= radiusSq;
    });
  }

  /**
   * Получить сущности в радиусе от точки (только живые)
   * @param {number} x - X координата центра
   * @param {number} y - Y координата центра
   * @param {number} z - Z координата центра
   * @param {number} radius - радиус поиска
   * @returns {LivingEntity[]}
   */
  getLivingInRadius(x, y, z, radius) {
    return this.getInRadius(x, y, z, radius).filter(entity =>
      entity instanceof LivingEntity && entity.isAlive()
    );
  }

  /**
   * Получить ближайшую сущность к точке
   * @param {number} x - X координата
   * @param {number} y - Y координата
   * @param {number} z - Z координата
   * @param {number} maxRadius - максимальный радиус поиска
   * @param {Function} filter - опциональный фильтр
   * @returns {{entity: Entity, distance: number}|null}
   */
  getNearest(x, y, z, maxRadius = Infinity, filter = null) {
    let nearest = null;
    let nearestDistSq = maxRadius * maxRadius;

    for (const entity of this.entities.values()) {
      if (filter && !filter(entity)) continue;

      const dx = entity.position.x - x;
      const dy = entity.position.y - y;
      const dz = entity.position.z - z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = entity;
      }
    }

    if (nearest) {
      return {
        entity: nearest,
        distance: Math.sqrt(nearestDistSq)
      };
    }

    return null;
  }

  /**
   * Обновить все сущности
   * @param {number} deltaTime - время с прошлого кадра
   * @param {Object} chunks - чанки мира
   * @param {Object} context - дополнительный контекст (игрок, etc.)
   */
  update(deltaTime, chunks, context = {}) {
    // Собираем мёртвые сущности для удаления
    const toRemove = [];

    for (const [id, entity] of this.entities) {
      // Обновляем сущность
      if (typeof entity.update === 'function') {
        entity.update(deltaTime, chunks, context);
      }

      // Проверяем на смерть (для LivingEntity)
      if (entity instanceof LivingEntity && entity.isDead) {
        // Даём время на анимацию смерти перед удалением
        if (!entity._deathTimer) {
          entity._deathTimer = 0;
        }
        entity._deathTimer += deltaTime;

        // Удаляем через 2 секунды после смерти
        if (entity._deathTimer >= 2) {
          toRemove.push(id);
        }
      }
    }

    // Удаляем мёртвые сущности
    for (const id of toRemove) {
      this.despawn(id);
    }
  }

  /**
   * Получить количество сущностей
   * @returns {number}
   */
  count() {
    return this.entities.size;
  }

  /**
   * Получить количество сущностей по типу
   * @param {Function} EntityClass - класс сущности
   * @returns {number}
   */
  countByType(EntityClass) {
    return this.getByType(EntityClass).length;
  }

  /**
   * Очистить все сущности
   */
  clear() {
    const ids = Array.from(this.entities.keys());
    for (const id of ids) {
      this.despawn(id);
    }
  }

  /**
   * Сериализация для сохранения
   * @returns {Array}
   */
  serialize() {
    const data = [];

    for (const [id, entity] of this.entities) {
      if (typeof entity.serialize === 'function') {
        data.push({
          id,
          type: entity.constructor.name,
          data: entity.serialize()
        });
      }
    }

    return data;
  }

  /**
   * Итератор для for...of
   */
  [Symbol.iterator]() {
    return this.entities.values();
  }

  /**
   * forEach для совместимости
   * @param {Function} callback - (entity, id) => void
   */
  forEach(callback) {
    this.entities.forEach((entity, id) => callback(entity, id));
  }
}

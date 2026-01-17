/**
 * MobModel - базовый класс модели моба (аналог Minecraft EntityModel)
 * 
 * Определяет структуру модели и методы анимации.
 * Наследуйте этот класс для создания конкретных моделей мобов.
 */
import * as THREE from 'three';
import { createBox, ModelPart } from './ModelPart';

/**
 * Загрузка текстуры с кэшированием (Minecraft-style)
 */
const textureCache = new Map();
const textureLoader = new THREE.TextureLoader();

export function loadTexture(path) {
  if (textureCache.has(path)) return textureCache.get(path);

  const texture = textureLoader.load(
    path,
    () => {},
    undefined,
    (err) => console.error('[MobTexture] Failed to load:', path, err)
  );

  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  textureCache.set(path, texture);
  return texture;
}

/**
 * Базовый класс модели моба
 * 
 * @example
 * class SheepModel extends MobModel {
 *   constructor() {
 *     super({
 *       texturePath: '/textures/entity/sheep.png',
 *       textureWidth: 64,
 *       textureHeight: 32,
 *     });
 *   }
 *   
 *   setupParts() {
 *     this.head = this.createPart('head', {...});
 *   }
 *   
 *   animate(mob, delta) {
 *     // Анимация ходьбы
 *   }
 * }
 */
export class MobModel {
  constructor(config = {}) {
    this.texturePath = config.texturePath || '';
    this.textureWidth = config.textureWidth || 64;
    this.textureHeight = config.textureHeight || 32;
    this.scale = config.scale || 1 / 16;
    
    // Части модели
    this.parts = new Map();
    this.geometries = [];
    
    // Материалы
    this.materials = new Map();
    
    // Анимация
    this.animationTime = 0;
    
    // Загрузка текстуры
    if (this.texturePath) {
      this.texture = loadTexture(this.texturePath);
    }
  }

  /**
   * Создаёт геометрию бокса с текущими параметрами текстуры
   */
  createBoxGeometry({ width, height, depth, texU, texV, inflate = 0 }) {
    const geometry = createBox({
      width,
      height,
      depth,
      texU,
      texV,
      texWidth: this.textureWidth,
      texHeight: this.textureHeight,
      scale: this.scale,
      inflate,
    });
    this.geometries.push(geometry);
    return geometry;
  }

  /**
   * Создаёт часть модели
   */
  createPart(name, options = {}) {
    const part = new ModelPart(name, options);
    this.parts.set(name, part);
    return part;
  }

  /**
   * Получает часть модели по имени
   */
  getPart(name) {
    return this.parts.get(name);
  }

  /**
   * Создаёт материал для модели
   */
  createMaterial(name, options = {}) {
    const material = new THREE.MeshLambertMaterial({
      map: this.texture,
      transparent: options.transparent || false,
      alphaTest: options.alphaTest || 0,
      side: options.side || THREE.DoubleSide,
      ...options,
    });
    this.materials.set(name, material);
    return material;
  }

  /**
   * Получает материал по имени
   */
  getMaterial(name) {
    return this.materials.get(name);
  }

  /**
   * Инициализация модели - переопределите в наследниках
   * Вызывается после создания экземпляра
   */
  setupParts() {
    // Переопределите в наследнике
  }

  /**
   * Создаёт материалы - переопределите в наследниках
   */
  setupMaterials() {
    // Переопределите в наследнике
  }

  /**
   * Анимация модели - переопределите в наследниках
   * @param {Object} mob - Данные моба (position, velocity, etc.)
   * @param {number} delta - Время с прошлого кадра
   * @param {Object} refs - Ссылки на mesh-объекты
   */
  animate(mob, delta, refs) {
    // Переопределите в наследнике
  }

  /**
   * Освобождает ресурсы
   */
  dispose() {
    this.geometries.forEach(geo => geo.dispose());
    this.materials.forEach(mat => mat.dispose());
    this.parts.forEach(part => part.dispose());
    this.geometries = [];
    this.materials.clear();
    this.parts.clear();
  }
}

/**
 * QuadrupedModel - базовая модель четвероногого животного
 * Расширяет MobModel, добавляя стандартные части: голова, тело, 4 ноги
 */
export class QuadrupedModel extends MobModel {
  constructor(config = {}) {
    super(config);
    
    // Параметры по умолчанию для четвероногого
    this.headSize = config.headSize || { width: 4, height: 4, depth: 4 };
    this.bodySize = config.bodySize || { width: 6, height: 8, depth: 4 };
    this.legSize = config.legSize || { width: 2, height: 6, depth: 2 };
    
    // Позиции
    this.bodyY = config.bodyY || 0;
    this.headY = config.headY || 0;
    this.legSpacing = config.legSpacing || { x: 2, zFront: 3, zBack: -3 };
  }

  /**
   * Анимация ходьбы для четвероногих
   */
  animateWalk(speed, delta, refs) {
    if (speed > 0.01) {
      this.animationTime += delta * 8;
    } else {
      this.animationTime *= 0.9;
    }

    const swing = Math.sin(this.animationTime) * 0.6;

    if (refs.legFL) refs.legFL.rotation.x = swing;
    if (refs.legFR) refs.legFR.rotation.x = -swing;
    if (refs.legBL) refs.legBL.rotation.x = -swing;
    if (refs.legBR) refs.legBR.rotation.x = swing;
  }
}

export default MobModel;

/**
 * SheepModel - модель овцы (аналог Minecraft SheepModel)
 * 
 * Vanilla Minecraft sheep dimensions:
 * - Head: 6×6×8 at UV(0,0) — морда вытянута вперёд
 * - Body: 8×16×6 at UV(28,8) — повёрнуто на 90° по X
 * - Legs: 4×12×4 at UV(0,16) — все 4 ноги одинаковые
 * 
 * Wool layer (sheep_fur.png):
 * - Head wool: 6×6×6 at UV(0,0) — сдвинута назад, морда выглядывает
 * - Body wool: 8×16×6 at UV(28,8) — с inflate
 */
import * as THREE from 'three';
import { QuadrupedModel, loadTexture } from './MobModel';
import { createBox } from './ModelPart';

// Константы размеров (в пикселях модели)
const SCALE = 1 / 16;
const TEX_W = 64;
const TEX_H = 32;

// Размеры частей
const HEAD = { width: 6, height: 6, depth: 8 };
const BODY = { width: 8, height: 16, depth: 6 };
const LEG = { width: 4, height: 12, depth: 4 };

// Шерсть
const WOOL_INFLATE = 0.5;
const WOOL_HEAD = { width: 6, height: 6, depth: 6 }; // Короче чем голова!

/**
 * Модель овцы
 */
export class SheepModel extends QuadrupedModel {
  constructor() {
    super({
      texturePath: '/textures/entity/sheep.png',
      textureWidth: TEX_W,
      textureHeight: TEX_H,
      scale: SCALE,
    });

    // Путь к текстуре шерсти
    this.furTexturePath = '/textures/entity/sheep_fur.png';
    this.furTexture = null;

    // Геометрии
    this.headGeometry = null;
    this.bodyGeometry = null;
    this.legGeometry = null;
    this.woolHeadGeometry = null;
    this.woolBodyGeometry = null;

    // Инициализация
    this.setupGeometries();
    this.setupMaterials();
    this.calculatePositions();
  }

  /**
   * Создаёт геометрии всех частей
   */
  setupGeometries() {
    // Голова (кожа): 6×6×8
    this.headGeometry = createBox({
      width: HEAD.width,
      height: HEAD.height,
      depth: HEAD.depth,
      texU: 0,
      texV: 0,
      texWidth: TEX_W,
      texHeight: TEX_H,
      scale: SCALE,
      inflate: 0,
    });

    // Тело (кожа): 8×16×6
    this.bodyGeometry = createBox({
      width: BODY.width,
      height: BODY.height,
      depth: BODY.depth,
      texU: 28,
      texV: 8,
      texWidth: TEX_W,
      texHeight: TEX_H,
      scale: SCALE,
      inflate: 0,
    });

    // Нога: 4×12×4
    this.legGeometry = createBox({
      width: LEG.width,
      height: LEG.height,
      depth: LEG.depth,
      texU: 0,
      texV: 16,
      texWidth: TEX_W,
      texHeight: TEX_H,
      scale: SCALE,
      inflate: 0,
    });

    // Шерсть на голове: 6×6×6 (короче чем голова!)
    this.woolHeadGeometry = createBox({
      width: WOOL_HEAD.width,
      height: WOOL_HEAD.height,
      depth: WOOL_HEAD.depth,
      texU: 0,
      texV: 0,
      texWidth: TEX_W,
      texHeight: TEX_H,
      scale: SCALE,
      inflate: WOOL_INFLATE,
    });

    // Шерсть на теле: 8×16×6 с inflate
    this.woolBodyGeometry = createBox({
      width: BODY.width,
      height: BODY.height,
      depth: BODY.depth,
      texU: 28,
      texV: 8,
      texWidth: TEX_W,
      texHeight: TEX_H,
      scale: SCALE,
      inflate: WOOL_INFLATE,
    });

    // Добавляем в список для dispose
    this.geometries.push(
      this.headGeometry,
      this.bodyGeometry,
      this.legGeometry,
      this.woolHeadGeometry,
      this.woolBodyGeometry
    );
  }

  /**
   * Создаёт материалы
   */
  setupMaterials() {
    // Текстура кожи
    this.skinMaterial = new THREE.MeshLambertMaterial({
      map: this.texture,
      transparent: false,
      side: THREE.DoubleSide,
    });

    // Текстура шерсти
    this.furTexture = loadTexture(this.furTexturePath);
    this.woolMaterial = new THREE.MeshLambertMaterial({
      map: this.furTexture,
      transparent: false,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    // Тень
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });

    this.materials.set('skin', this.skinMaterial);
    this.materials.set('wool', this.woolMaterial);
    this.materials.set('shadow', this.shadowMaterial);

    // Цвета для эффекта урона
    this.emissiveOff = new THREE.Color(0x000000);
    this.emissiveOn = new THREE.Color(0x330000);
  }

  /**
   * Рассчитывает позиции частей тела
   */
  calculatePositions() {
    // Ноги
    this.legHeight = LEG.height * SCALE;
    this.legX = 3 * SCALE;
    this.legZFront = 7 * SCALE;
    this.legZBack = -5 * SCALE;

    // Тело
    this.bodyThickY = BODY.depth * SCALE; // После поворота
    this.bodyY = this.legHeight + this.bodyThickY / 2;
    this.bodyZ = 2 * SCALE;

    // Голова
    this.headDepth = HEAD.depth * SCALE;
    this.headHeight = HEAD.height * SCALE;
    this.bodyHalfLenZ = (BODY.height * SCALE) / 2;
    this.headZ = this.bodyZ + this.bodyHalfLenZ + this.headDepth / 2 - 1 * SCALE;
    this.headY = this.bodyY + this.bodyThickY / 2 - this.headHeight / 2 + 2 * SCALE;

    // Шерсть на голове сдвинута назад
    this.woolHeadDepth = WOOL_HEAD.depth * SCALE;
    this.woolHeadZ = this.headZ - (this.headDepth - this.woolHeadDepth) / 2;
  }

  /**
   * Анимация овцы
   */
  animate(mob, delta, refs) {
    // Анимация ходьбы
    const speed = Math.sqrt((mob.velocity?.x || 0) ** 2 + (mob.velocity?.z || 0) ** 2);
    this.animateWalk(speed, delta, refs);

    // Эффект урона
    if (mob.hurtAnimation > 0) {
      const flash = Math.sin(mob.hurtAnimation * 20) > 0;
      this.skinMaterial.emissive.copy(flash ? this.emissiveOn : this.emissiveOff);
      this.woolMaterial.emissive.copy(flash ? this.emissiveOn : this.emissiveOff);
    } else {
      this.skinMaterial.emissive.copy(this.emissiveOff);
      this.woolMaterial.emissive.copy(this.emissiveOff);
    }
  }

  /**
   * Получает конфигурацию для рендера
   */
  getRenderConfig() {
    return {
      geometries: {
        head: this.headGeometry,
        body: this.bodyGeometry,
        leg: this.legGeometry,
        woolHead: this.woolHeadGeometry,
        woolBody: this.woolBodyGeometry,
      },
      materials: {
        skin: this.skinMaterial,
        wool: this.woolMaterial,
        shadow: this.shadowMaterial,
      },
      positions: {
        body: { y: this.bodyY, z: this.bodyZ },
        head: { y: this.headY, z: this.headZ },
        woolHead: { y: this.headY, z: this.woolHeadZ },
        legFL: { x: -this.legX, y: this.legHeight, z: this.legZFront },
        legFR: { x: this.legX, y: this.legHeight, z: this.legZFront },
        legBL: { x: -this.legX, y: this.legHeight, z: this.legZBack },
        legBR: { x: this.legX, y: this.legHeight, z: this.legZBack },
        legOffset: -this.legHeight / 2,
      },
    };
  }

  /**
   * Освобождает ресурсы
   */
  dispose() {
    super.dispose();
    this.skinMaterial?.dispose();
    this.woolMaterial?.dispose();
    this.shadowMaterial?.dispose();
  }
}

export default SheepModel;

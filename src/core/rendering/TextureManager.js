/**
 * TextureManager - единый менеджер текстур (Singleton)
 * Устраняет дублирование загрузки текстур между компонентами
 */
import * as THREE from 'three';
import { textures, getBlockTexture } from '../../utils/textures';
import { BLOCK_TINTS } from '../../constants/colors';
import { BLOCK_TYPES } from '../../constants/blocks';

export class TextureManager {
  static instance = null;

  constructor() {
    if (TextureManager.instance) {
      return TextureManager.instance;
    }

    this.textureCache = new Map();
    this.materialCache = new Map();
    this.loadingPromises = new Map(); // Для предотвращения дублирования загрузок

    TextureManager.instance = this;
  }

  static getInstance() {
    if (!TextureManager.instance) {
      TextureManager.instance = new TextureManager();
    }
    return TextureManager.instance;
  }

  /**
   * Создание текстуры из источника с обработкой специальных случаев
   */
  createTextureFromSource(source, name) {
    const image = new Image();
    const texture = new THREE.Texture(image);
    
    return new Promise((resolve) => {
      image.onload = () => {
        // Специальная логика для боковой грани травы (Композитинг: Земля + Окрашенный оверлей)
        if (name === 'grassSide') {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          
          // 1. Загружаем землю
          const dirtImg = new Image();
          dirtImg.crossOrigin = "Anonymous";
          dirtImg.onload = () => {
            // Рисуем землю
            ctx.drawImage(dirtImg, 0, 0);
            
            // Подготавливаем оверлей
            const overlayCanvas = document.createElement('canvas');
            overlayCanvas.width = image.width;
            overlayCanvas.height = image.height;
            const oCtx = overlayCanvas.getContext('2d');
            
            // Рисуем оверлей
            oCtx.drawImage(image, 0, 0);
            
            // Красим оверлей
            oCtx.globalCompositeOperation = 'multiply';
            oCtx.fillStyle = BLOCK_TINTS['grassSide'];
            oCtx.fillRect(0, 0, image.width, image.height);
            
            // Восстанавливаем альфу оверлея
            oCtx.globalCompositeOperation = 'destination-in';
            oCtx.drawImage(image, 0, 0);
            
            // Накладываем оверлей на землю
            ctx.drawImage(overlayCanvas, 0, 0);
            
            texture.image = canvas;
            texture.needsUpdate = true;
            resolve(texture);
          };
          dirtImg.src = '/textures/dirt.png';
          return;
        }

        // Специальная логика для воды (берем первый кадр из стрипа и красим)
        if (name === 'water') {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          
          // Берем первый кадр (верхняя часть изображения)
          ctx.drawImage(image, 0, 0, image.width, image.height / 16, 0, 0, canvas.width, canvas.height);
          
          // Красим воду
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = BLOCK_TINTS['water'] || '#3F76E4';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          texture.image = canvas;
          texture.needsUpdate = true;
          resolve(texture);
          return;
        }

        // Обработка тинтов для других блоков
        if (BLOCK_TINTS[name]) {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          
          // Рисуем исходное изображение
          ctx.drawImage(image, 0, 0);
          
          // Накладываем цвет
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = BLOCK_TINTS[name];
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // ВАЖНО: Восстанавливаем прозрачность (для листвы)
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(image, 0, 0);
          
          // Сброс
          ctx.globalCompositeOperation = 'source-over';
          
          texture.image = canvas;
        }
        
        texture.needsUpdate = true;
        resolve(texture);
      };
      
      image.src = source;
      
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
    });
  }

  /**
   * Получить текстуру по имени (с кэшированием)
   */
  async getTexture(textureName) {
    if (this.textureCache.has(textureName)) {
      return this.textureCache.get(textureName);
    }

    // Если уже загружается, ждем существующий промис
    if (this.loadingPromises.has(textureName)) {
      return this.loadingPromises.get(textureName);
    }

    const source = getBlockTexture(textureName);
    if (!source) {
      console.warn(`Texture not found: ${textureName}`);
      return null;
    }

    // Создаем промис загрузки
    const loadPromise = this.createTextureFromSource(source, textureName);
    this.loadingPromises.set(textureName, loadPromise);

    const texture = await loadPromise;
    this.textureCache.set(textureName, texture);
    this.loadingPromises.delete(textureName);

    return texture;
  }

  /**
   * Получить текстуру синхронно (если уже загружена)
   */
  getTextureSync(textureName) {
    return this.textureCache.get(textureName) || null;
  }

  /**
   * Получить материал для блока
   */
  async getBlockMaterial(blockType, options = {}) {
    const cacheKey = `${blockType}_${JSON.stringify(options)}`;
    
    if (this.materialCache.has(cacheKey)) {
      return this.materialCache.get(cacheKey);
    }

    const { getBlockTextureInfo } = await import('../../utils/textures');
    const textureInfo = getBlockTextureInfo(blockType);
    
    if (!textureInfo) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x888888 });
      this.materialCache.set(cacheKey, mat);
      return mat;
    }

    let textureName;
    if (options.textureName) {
      textureName = options.textureName;
    } else if (options.face === 'top' && textureInfo.top) {
      textureName = textureInfo.top;
    } else if (options.face === 'bottom' && textureInfo.bottom) {
      textureName = textureInfo.bottom;
    } else if (options.face === 'sides' && textureInfo.side) {
      textureName = textureInfo.side;
    } else {
      textureName = textureInfo.all || textureInfo.side || textureInfo.top;
    }

    const texture = await this.getTexture(textureName);
    
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      vertexColors: options.vertexColors !== false
    });

    // Специальные настройки для воды
    if (blockType === BLOCK_TYPES.WATER) {
      mat.transparent = true;
      mat.opacity = 0.8;
      mat.depthWrite = false;
      mat.side = THREE.DoubleSide;
    }

    // Специальные настройки для листвы
    if (blockType === BLOCK_TYPES.LEAVES) {
      mat.alphaTest = 0.5;
      mat.side = THREE.DoubleSide;
    }

    this.materialCache.set(cacheKey, mat);
    return mat;
  }

  /**
   * Предзагрузка всех текстур
   */
  async preloadAllTextures() {
    const textureNames = Object.keys(textures);
    await Promise.all(textureNames.map(name => this.getTexture(name)));
  }

  /**
   * Очистка кэша
   */
  clearCache() {
    // Удаляем текстуры
    this.textureCache.forEach(texture => texture.dispose());
    this.textureCache.clear();
    
    // Удаляем материалы
    this.materialCache.forEach(material => material.dispose());
    this.materialCache.clear();
    
    this.loadingPromises.clear();
  }
}

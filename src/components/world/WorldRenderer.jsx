// Компонент мира - оптимизированный с Time Slicing
import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { isTransparent } from '../../constants/blocks';
import { BLOCK_TYPES } from '../../constants/blockTypes';
import { getBlock } from '../../utils/noise';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants/world';
import { BLOCK_TINTS } from '../../constants/colors';

import { getBlockTextureInfo } from '../../utils/textures';
import { TextureManager } from '../../core/rendering/TextureManager';
import { FurnaceManager } from '../../core/FurnaceManager';

// Используем единый TextureManager
const textureManager = TextureManager.getInstance();

// Предзагрузка текстур при первом использовании
let texturesPreloaded = false;
const preloadTextures = async () => {
  if (texturesPreloaded) return;
  await textureManager.preloadAllTextures();
  texturesPreloaded = true;
};

// Синхронная версия getTexture (использует уже загруженные текстуры)
const getTexture = (textureName) => {
  return textureManager.getTextureSync(textureName);
};

import { ChunkMesher } from '../../utils/chunkMesher';

// Компонент меша для конкретного типа блока в чанке
// faceFilter: null = все грани, 'top' = верх, 'bottom' = низ, 'sides' = бока
// metadataFilter: null = все, или число = только блоки с этим metadata
const ChunkBlockMesh = ({ blockType, chunkData, lightMap, chunkX, chunkZ, getNeighborData, faceFilter = null, textureName = null, texturesLoaded, metadataFilter = null }) => {
  const meshRef = useRef(null);

  const material = useMemo(() => {
    const info = getBlockTextureInfo(blockType);
    if (!info) return new THREE.MeshBasicMaterial({ color: 0xff00ff });

    // Выбираем текстуру в зависимости от типа грани
    let texName;
    if (textureName) {
      texName = textureName;
    } else if (faceFilter === 'top' && info.top) {
      texName = info.top;
    } else if (faceFilter === 'bottom' && info.bottom) {
      texName = info.bottom;
    } else if (faceFilter === 'sides' && info.side) {
      texName = info.side;
    } else {
      texName = info.all || info.side || info.top;
    }

    const map = getTexture(texName);
    if (!map) {
      // Если текстура еще не загружена, возвращаем временный материал
      return new THREE.MeshBasicMaterial({ color: 0x888888 });
    }

    // MeshBasicMaterial:
    // - НЕ реагирует на внешний свет (как в Minecraft)
    // - Вся яркость идёт через vertexColors (faceShade + skylight + AO)
    const mat = new THREE.MeshBasicMaterial({
      map: map,
      vertexColors: true
    });

    if (blockType === BLOCK_TYPES.WATER) {
      mat.transparent = true;
      mat.opacity = 0.8;
      mat.depthWrite = false;
      mat.side = THREE.DoubleSide;
    }
    if (blockType === BLOCK_TYPES.LEAVES) {
      mat.alphaTest = 0.5;
      mat.side = THREE.DoubleSide;
    }
    // Специальная обработка для cross-блоков (растения, трава)
    if (info.renderType === 'cross') {
      mat.alphaTest = 0.5;
      mat.side = THREE.DoubleSide;
    }
    // Факелы - прозрачность для текстуры
    if (info.renderType === 'torch') {
      mat.alphaTest = 0.5;
      mat.side = THREE.DoubleSide;
    }

    return mat;
  }, [blockType, faceFilter, textureName, texturesLoaded]);

  // Генерация геометрии
  const geometry = useMemo(() => {
    // Получаем данные соседей на момент генерации
    const neighborData = getNeighborData ? getNeighborData() : { lightMaps: {}, chunks: {} };
    const mesher = new ChunkMesher(chunkData, lightMap, chunkX, chunkZ, neighborData);
    const data = mesher.generateForType(blockType, faceFilter, metadataFilter);

    if (data.positions.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));

    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    return geo;
  }, [chunkData, lightMap, chunkX, chunkZ, blockType, faceFilter, metadataFilter]);

  if (!geometry) return null;

  return (
    <mesh
      ref={meshRef}
      name="block-mesh" // Метка для Raycaster
      userData={{ isLiquid: blockType === BLOCK_TYPES.WATER }}
      geometry={geometry}
      material={material}
      position={[chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE]} // Позиция чанка
    />
  );
};

import { PerformanceMetrics } from '../../utils/performance';

// Основной компонент мира с оптимизацией Time Slicing
const World = ({ chunks, chunkManager }) => {
  const [texturesLoaded, setTexturesLoaded] = useState(texturesPreloaded);

  // Предзагрузка текстур при монтировании
  useEffect(() => {
    if (!texturesPreloaded) {
      preloadTextures().then(() => setTexturesLoaded(true));
    }
  }, []);

  // visibleChunks - это чанки, которые мы разрешили рендерить
  const [visibleChunkKeys, setVisibleChunkKeys] = useState(new Set());

  // Queue для чанков, которые нужно добавить в рендер
  const pendingChunksQueue = useRef([]);

  // 1. Синхронизация чанков: При обновлении chunks добавляем новые в очередь
  useEffect(() => {
    if (!chunks) return;

    const allKeys = Object.keys(chunks);
    const currentKeys = new Set(allKeys);

    // Удаляем из visible те, которых больше нет
    setVisibleChunkKeys(prev => {
      const next = new Set(prev);
      for (const key of next) {
        if (!currentKeys.has(key)) {
          next.delete(key);
        }
      }
      return next;
    });

    // Находим новые чанки, которых нет в visible и нет в очереди
    const newKeys = [];
    for (const key of allKeys) {
      // Если чанк еще не видим
      if (!visibleChunkKeys.has(key)) {
        newKeys.push(key);
      }
    }

    // Обновляем очередь: берем только актуальные новые ключи
    // Важно не дублировать
    const uniqueNew = newKeys.filter(k => !pendingChunksQueue.current.includes(k));
    if (uniqueNew.length > 0) {
      pendingChunksQueue.current.push(...uniqueNew);
    }

  }, [chunks]); // Запускаем при любом обновлении списка чанков


  // 2. Time Slicing Loop: Каждый кадр достаем немного чанков из очереди
  useFrame(() => {
    if (pendingChunksQueue.current.length === 0) return;

    // Сколько чанков обрабатывать за кадр?
    // 1-2 чанка достаточно для плавности.
    const CHUNKS_PER_FRAME = 2;

    const toAdd = [];
    for (let i = 0; i < CHUNKS_PER_FRAME; i++) {
      const key = pendingChunksQueue.current.shift();
      if (key) toAdd.push(key);
      else break;
    }

    if (toAdd.length > 0) {
      setVisibleChunkKeys(prev => {
        const next = new Set(prev);
        toAdd.forEach(k => next.add(k));
        return next;
      });
    }
  });




  if (!chunks) return null;

  // Callback для получения данных соседних чанков
  const getNeighborDataFor = useCallback((cx, cz) => {
    return {
      lightMaps: {
        west: chunkManager?.lightingManager?.lightMaps[`${cx - 1},${cz}`],
        east: chunkManager?.lightingManager?.lightMaps[`${cx + 1},${cz}`],
        north: chunkManager?.lightingManager?.lightMaps[`${cx},${cz - 1}`],
        south: chunkManager?.lightingManager?.lightMaps[`${cx},${cz + 1}`]
      },
      chunks: {
        west: chunks[`${cx - 1},${cz}`],
        east: chunks[`${cx + 1},${cz}`],
        north: chunks[`${cx},${cz - 1}`],
        south: chunks[`${cx},${cz + 1}`]
      }
    };
  }, [chunks, chunkManager]);

  return (
    <group>
      {Array.from(visibleChunkKeys).map(key => {
        const chunkData = chunks[key];
        // Если чанк был удален, но ключ остался в visible (редкий кейс гонки)
        if (!chunkData) return null;

        const [x, z] = key.split(',').map(Number);
        const lightMap = chunkManager?.lightingManager?.lightMaps[key];

        return (
          <ChunkRenderer
            key={key}
            chunkX={x}
            chunkZ={z}
            chunkData={chunkData}
            lightMap={lightMap}
            getNeighborDataFor={getNeighborDataFor}
            texturesLoaded={texturesLoaded}
          />
        );
      })}
    </group>
  );
};

// Рендерер отдельного чанка
const ChunkRenderer = React.memo(({ chunkX, chunkZ, chunkData, lightMap, getNeighborDataFor, texturesLoaded }) => {
  const getNeighborData = useCallback(() => {
    return getNeighborDataFor(chunkX, chunkZ);
  }, [getNeighborDataFor, chunkX, chunkZ]);

  // Находим все уникальные типы блоков в чанке
  const blockTypes = useMemo(() => {
    return PerformanceMetrics.measure('meshingPrep', () => {
      if (!chunkData) return [];
      const types = new Set();
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          for (let y = 0; y < CHUNK_HEIGHT; y++) {
            const b = chunkData.getBlock(x, y, z);
            if (b !== BLOCK_TYPES.AIR) types.add(b);
          }
        }
      }
      return Array.from(types);
    });
  }, [chunkData]);

  const needsMultiTexture = (type) => {
    const info = getBlockTextureInfo(type);
    return info && !info.all && (info.top || info.bottom || info.side);
  };

  // Проверяем, нужна ли отдельная текстура для передней грани (как у верстака)
  const needsFrontTexture = (type) => {
    const info = getBlockTextureInfo(type);
    return info && info.front && info.front !== info.side;
  };

  // Проверяем, является ли блок направленным (печка, верстак)
  const isDirectionalBlock = (type) => {
    return type === BLOCK_TYPES.FURNACE || type === BLOCK_TYPES.CRAFTING_TABLE;
  };

  // Маппинг направления metadata на грань
  // metadata: 0 = south (Z+), 1 = west (X-), 2 = north (Z-), 3 = east (X+)
  const metadataToFace = {
    0: 'front',  // South (Z+) -> front face
    1: 'left',   // West (X-) -> left face
    2: 'back',   // North (Z-) -> back face
    3: 'right'   // East (X+) -> right face
  };

  // Получить противоположные грани для sides (исключая front)
  const getSidesExcludingFront = (metadata) => {
    // Все боковые грани кроме той, которая является front для данного metadata
    const allSides = ['front', 'back', 'left', 'right'];
    const frontFace = metadataToFace[metadata];
    return allSides.filter(f => f !== frontFace);
  };

  return (
    <group>
      {blockTypes.map(type => {
        const info = getBlockTextureInfo(type);
        const hasFront = needsFrontTexture(type);
        const isDirectional = isDirectionalBlock(type);

        if (needsMultiTexture(type)) {
          return (
            <React.Fragment key={type}>
              <ChunkBlockMesh
                key={`${type}-top`}
                blockType={type}
                chunkData={chunkData}
                lightMap={lightMap}
                chunkX={chunkX}
                chunkZ={chunkZ}
                getNeighborData={getNeighborData}
                faceFilter="top"
                texturesLoaded={texturesLoaded}
              />
              <ChunkBlockMesh
                key={`${type}-bottom`}
                blockType={type}
                chunkData={chunkData}
                lightMap={lightMap}
                chunkX={chunkX}
                chunkZ={chunkZ}
                getNeighborData={getNeighborData}
                faceFilter="bottom"
                texturesLoaded={texturesLoaded}
              />
              {hasFront && isDirectional ? (
                /* Направленные блоки (печка, верстак) - рендерим front для каждого направления отдельно */
                <>
                  {[0, 1, 2, 3].map(meta => (
                    <React.Fragment key={`${type}-dir-${meta}`}>
                      {/* Front грань с текстурой front для этого направления */}
                      <ChunkBlockMesh
                        key={`${type}-front-m${meta}`}
                        blockType={type}
                        chunkData={chunkData}
                        lightMap={lightMap}
                        chunkX={chunkX}
                        chunkZ={chunkZ}
                        getNeighborData={getNeighborData}
                        faceFilter={metadataToFace[meta]}
                        textureName={info.front}
                        texturesLoaded={texturesLoaded}
                        metadataFilter={meta}
                      />
                      {/* Остальные боковые грани с текстурой side */}
                      {getSidesExcludingFront(meta).map(face => (
                        <ChunkBlockMesh
                          key={`${type}-${face}-m${meta}`}
                          blockType={type}
                          chunkData={chunkData}
                          lightMap={lightMap}
                          chunkX={chunkX}
                          chunkZ={chunkZ}
                          getNeighborData={getNeighborData}
                          faceFilter={face}
                          texturesLoaded={texturesLoaded}
                          metadataFilter={meta}
                        />
                      ))}
                    </React.Fragment>
                  ))}
                </>
              ) : hasFront ? (
                <>
                  {/* Не направленные блоки с front текстурой */}
                  <ChunkBlockMesh
                    key={`${type}-sides-no-front`}
                    blockType={type}
                    chunkData={chunkData}
                    lightMap={lightMap}
                    chunkX={chunkX}
                    chunkZ={chunkZ}
                    getNeighborData={getNeighborData}
                    faceFilter="sides-no-front"
                    texturesLoaded={texturesLoaded}
                  />
                  <ChunkBlockMesh
                    key={`${type}-front`}
                    blockType={type}
                    chunkData={chunkData}
                    lightMap={lightMap}
                    chunkX={chunkX}
                    chunkZ={chunkZ}
                    getNeighborData={getNeighborData}
                    faceFilter="front"
                    textureName={info.front}
                    texturesLoaded={texturesLoaded}
                  />
                </>
              ) : (
                <ChunkBlockMesh
                  key={`${type}-sides`}
                  blockType={type}
                  chunkData={chunkData}
                  lightMap={lightMap}
                  chunkX={chunkX}
                  chunkZ={chunkZ}
                  getNeighborData={getNeighborData}
                  faceFilter="sides"
                  texturesLoaded={texturesLoaded}
                />
              )}
            </React.Fragment>
          );
        } else {
          return (
            <ChunkBlockMesh
              key={type}
              blockType={type}
              chunkData={chunkData}
              lightMap={lightMap}
              chunkX={chunkX}
              chunkZ={chunkZ}
              getNeighborData={getNeighborData}
              texturesLoaded={texturesLoaded}
            />
          );
        }
      })}
    </group>
  );
}, (prevProps, nextProps) => {
  if (prevProps.texturesLoaded !== nextProps.texturesLoaded) return false;
  if (prevProps.chunkData !== nextProps.chunkData) return false;
  if (prevProps.lightMap !== nextProps.lightMap) return false;
  return true;
});

/**
 * BurningFurnacesRenderer - Рендерит горящую текстуру поверх активных печек
 * Подписывается на FurnaceManager и обновляется при изменении состояния печек
 */
const BurningFurnacesRenderer = ({ chunks }) => {
  const [furnaceVersion, setFurnaceVersion] = useState(0);
  const [burningFurnaces, setBurningFurnaces] = useState([]);

  // Подписываемся на изменения FurnaceManager
  useEffect(() => {
    const unsubscribe = FurnaceManager.subscribe((version) => {
      setFurnaceVersion(version);
      setBurningFurnaces(FurnaceManager.getBurningFurnaces());

    });

    // Инициализация
    setBurningFurnaces(FurnaceManager.getBurningFurnaces());

    return () => unsubscribe();
  }, []);

  // Материал для горящей текстуры
  const burningMaterial = useMemo(() => {
    const map = getTexture('furnaceFrontOn');

    if (!map) return null;

    return new THREE.MeshBasicMaterial({
      map: map,
      transparent: false,
      side: THREE.DoubleSide,
    });
  }, [furnaceVersion]);

  // Геометрия одной грани (плоскость)
  const faceGeometry = useMemo(() => {
    return new THREE.PlaneGeometry(1, 1);
  }, []);

  if (!burningMaterial || burningFurnaces.length === 0) return null;

  // Маппинг metadata на поворот и смещение для передней грани
  // metadata: 0 = south (Z+), 1 = west (X-), 2 = north (Z-), 3 = east (X+)
  // Небольшой offset (0.002) чтобы избежать z-fighting с основной текстурой
  const getTransform = (metadata) => {
    switch (metadata) {
      case 0: // South (Z+) - лицо смотрит на +Z
        return { rotation: [0, 0, Math.PI], offset: [0.5, 0.5, 1.002] };
      case 1: // West (X-) - лицо смотрит на -X
        return { rotation: [0, Math.PI / 2, Math.PI], offset: [-0.002, 0.5, 0.5] };
      case 2: // North (Z-) - лицо смотрит на -Z
        return { rotation: [0, Math.PI, Math.PI], offset: [0.5, 0.5, -0.002] };
      case 3: // East (X+) - лицо смотрит на +X
        return { rotation: [0, -Math.PI / 2, Math.PI], offset: [1.002, 0.5, 0.5] };
      default:
        return { rotation: [0, 0, Math.PI], offset: [0.5, 0.5, 1.002] };
    }
  };

  return (
    <group>
      {burningFurnaces.map((furnace, index) => {
        const { x, y, z } = furnace.position;

        // Получаем metadata печки для определения направления
        // Ищем в chunks данные о metadata
        const chunkX = Math.floor(x / CHUNK_SIZE);
        const chunkZ = Math.floor(z / CHUNK_SIZE);
        const chunkKey = `${chunkX},${chunkZ}`;
        const chunk = chunks?.[chunkKey];

        let metadata = 0;
        if (chunk) {
          const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          metadata = chunk.getMetadata(localX, y, localZ);
        }

        const transform = getTransform(metadata);


        // Позиция для света - перед печкой
        const lightOffset = {
          0: [0, 0, 0.6],   // South
          1: [-0.6, 0, 0],  // West
          2: [0, 0, -0.6],  // North
          3: [0.6, 0, 0]    // East
        }[metadata] || [0, 0, 0.6];

        return (
          <group key={`burning-${x}-${y}-${z}`}>
            <mesh
              geometry={faceGeometry}
              material={burningMaterial}
              position={[
                x + transform.offset[0],
                y + transform.offset[1],
                z + transform.offset[2]
              ]}
              rotation={transform.rotation}
            />
            {/* Свет от горящей печки */}
            <pointLight
              position={[
                x + 0.5 + lightOffset[0],
                y + 0.5 + lightOffset[1],
                z + 0.5 + lightOffset[2]
              ]}
              color={0xff6600}
              intensity={0}
              distance={8}
              decay={2}
            />
          </group>
        );
      })}
    </group>
  );
};

export { BurningFurnacesRenderer };
export default World;
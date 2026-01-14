import * as THREE from 'three';
import { BLOCK_PROPERTIES } from '../constants/blocks';
import { BLOCK_TYPES } from '../constants/blockTypes';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../constants/world';

// Направления граней
const FACES = [
  { dir: [1, 0, 0], name: 'right' },   // 0: Right (X+)
  { dir: [-1, 0, 0], name: 'left' },   // 1: Left (X-)
  { dir: [0, 1, 0], name: 'top' },     // 2: Top (Y+)
  { dir: [0, -1, 0], name: 'bottom' }, // 3: Bottom (Y-)
  { dir: [0, 0, 1], name: 'front' },   // 4: Front (Z+)
  { dir: [0, 0, -1], name: 'back' }    // 5: Back (Z-)
];

// Смещения для AO (Ambient Occlusion) - 4 угла каждой грани
// Для каждого угла: 3 соседних блока, которые влияют на затенение
const AO_OFFSETS = {
  // Right (X+): смотрим в направлении +X
  0: [
    [[1, -1, 0], [1, 0, 1], [1, -1, 1]],   // BL
    [[1, -1, 0], [1, 0, -1], [1, -1, -1]], // BR
    [[1, 1, 0], [1, 0, -1], [1, 1, -1]],   // TR
    [[1, 1, 0], [1, 0, 1], [1, 1, 1]]      // TL
  ],
  // Left (X-)
  1: [
    [[-1, -1, 0], [-1, 0, -1], [-1, -1, -1]],
    [[-1, -1, 0], [-1, 0, 1], [-1, -1, 1]],
    [[-1, 1, 0], [-1, 0, 1], [-1, 1, 1]],
    [[-1, 1, 0], [-1, 0, -1], [-1, 1, -1]]
  ],
  // Top (Y+)
  2: [
    [[0, 1, 1], [-1, 1, 0], [-1, 1, 1]],
    [[0, 1, 1], [1, 1, 0], [1, 1, 1]],
    [[0, 1, -1], [1, 1, 0], [1, 1, -1]],
    [[0, 1, -1], [-1, 1, 0], [-1, 1, -1]]
  ],
  // Bottom (Y-)
  3: [
    [[0, -1, -1], [-1, -1, 0], [-1, -1, -1]],
    [[0, -1, -1], [1, -1, 0], [1, -1, -1]],
    [[0, -1, 1], [1, -1, 0], [1, -1, 1]],
    [[0, -1, 1], [-1, -1, 0], [-1, -1, 1]]
  ],
  // Front (Z+)
  4: [
    [[-1, 0, 1], [0, -1, 1], [-1, -1, 1]],
    [[1, 0, 1], [0, -1, 1], [1, -1, 1]],
    [[1, 0, 1], [0, 1, 1], [1, 1, 1]],
    [[-1, 0, 1], [0, 1, 1], [-1, 1, 1]]
  ],
  // Back (Z-)
  5: [
    [[1, 0, -1], [0, -1, -1], [1, -1, -1]],
    [[-1, 0, -1], [0, -1, -1], [-1, -1, -1]],
    [[-1, 0, -1], [0, 1, -1], [-1, 1, -1]],
    [[1, 0, -1], [0, 1, -1], [1, 1, -1]]
  ]
};

export class ChunkMesher {
  constructor(chunkData, lightMap, chunkX, chunkZ, neighborData) {
    this.chunkData = chunkData;
    this.lightMap = lightMap;
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    // neighborData: { lightMaps: {west, east, north, south}, chunks: {west, east, north, south} }
    this.neighborData = neighborData || { lightMaps: {}, chunks: {} };
  }

  // Получить блок (с поддержкой соседних чанков для AO)
  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK_TYPES.AIR;

    // Внутри текущего чанка
    if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
      // Используем метод Chunk
      return this.chunkData.getBlock(x, y, z);
    }

    // За пределами - получаем из соседнего чанка
    let neighborChunk = null;
    let localX = x;
    let localZ = z;

    if (x < 0) {
      neighborChunk = this.neighborData.chunks?.west;
      localX = x + CHUNK_SIZE;
    } else if (x >= CHUNK_SIZE) {
      neighborChunk = this.neighborData.chunks?.east;
      localX = x - CHUNK_SIZE;
    }

    if (z < 0) {
      neighborChunk = this.neighborData.chunks?.north;
      localZ = z + CHUNK_SIZE;
    } else if (z >= CHUNK_SIZE) {
      neighborChunk = this.neighborData.chunks?.south;
      localZ = z - CHUNK_SIZE;
    }

    if (neighborChunk) {
      // Соседний чанк тоже объект Chunk
      return neighborChunk.getBlock(localX, y, localZ);
    }

    // Соседний чанк не загружен - считаем воздухом
    return BLOCK_TYPES.AIR;
  }

  // Получить метаданные блока (с поддержкой соседних чанков)
  getMetadata(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;

    // Внутри текущего чанка
    if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
      return this.chunkData.getMetadata(x, y, z);
    }

    // За пределами - получаем из соседнего чанка
    let neighborChunk = null;
    let localX = x;
    let localZ = z;

    if (x < 0) {
      neighborChunk = this.neighborData.chunks?.west;
      localX = x + CHUNK_SIZE;
    } else if (x >= CHUNK_SIZE) {
      neighborChunk = this.neighborData.chunks?.east;
      localX = x - CHUNK_SIZE;
    }

    if (z < 0) {
      neighborChunk = this.neighborData.chunks?.north;
      localZ = z + CHUNK_SIZE;
    } else if (z >= CHUNK_SIZE) {
      neighborChunk = this.neighborData.chunks?.south;
      localZ = z - CHUNK_SIZE;
    }

    if (neighborChunk) {
      return neighborChunk.getMetadata(localX, y, localZ);
    }

    return 0;
  }

  // Проверка: блок твёрдый (для AO)?
  isSolid(x, y, z) {
    const block = this.getBlock(x, y, z);
    if (block === BLOCK_TYPES.AIR) return false;
    const props = BLOCK_PROPERTIES[block];
    return props && !props.transparent;
  }

  // Получить свет блока (с поддержкой соседних чанков)
  // fallbackLight - значение, которое использовать если блок твёрдый (для smooth lighting)
  getLight(x, y, z, fallbackLight = null) {
    if (y < 0) return 0;
    if (y >= CHUNK_HEIGHT) return 15;

    // Если это твёрдый блок - возвращаем fallback (для smooth lighting)
    // Твёрдые блоки имеют light=0, но для усреднения нужно использовать соседний свет
    if (fallbackLight !== null && this.isSolid(x, y, z)) {
      return fallbackLight;
    }

    // Внутри текущего чанка
    if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
      const idx = y * CHUNK_SIZE * CHUNK_SIZE + x * CHUNK_SIZE + z;
      return this.lightMap ? this.lightMap[idx] : 15;
    }

    // За пределами - получаем из соседнего чанка
    let neighborLightMap = null;
    let localX = x;
    let localZ = z;

    if (x < 0) {
      neighborLightMap = this.neighborData.lightMaps?.west;
      localX = x + CHUNK_SIZE;
    } else if (x >= CHUNK_SIZE) {
      neighborLightMap = this.neighborData.lightMaps?.east;
      localX = x - CHUNK_SIZE;
    }

    if (z < 0) {
      neighborLightMap = this.neighborData.lightMaps?.north;
      localZ = z + CHUNK_SIZE;
    } else if (z >= CHUNK_SIZE) {
      neighborLightMap = this.neighborData.lightMaps?.south;
      localZ = z - CHUNK_SIZE;
    }

    if (neighborLightMap) {
      const idx = y * CHUNK_SIZE * CHUNK_SIZE + localX * CHUNK_SIZE + localZ;
      return neighborLightMap[idx] || 0;
    }

    // Если соседний чанк не загружен - используем свет из текущего чанка на границе
    const clampedX = Math.max(0, Math.min(CHUNK_SIZE - 1, x));
    const clampedZ = Math.max(0, Math.min(CHUNK_SIZE - 1, z));
    const idx = y * CHUNK_SIZE * CHUNK_SIZE + clampedX * CHUNK_SIZE + clampedZ;
    return this.lightMap ? this.lightMap[idx] : 15;
  }

  // Расчёт AO для одного угла (0-3, где 3 = полностью затенён)
  calculateAO(side1, side2, corner) {
    if (side1 && side2) return 0; // Угол полностью закрыт
    return 3 - (side1 ? 1 : 0) - (side2 ? 1 : 0) - (corner ? 1 : 0);
  }

  // Получить высоту воды в точке (с учетом соседей)
  getWaterLevel(x, y, z) {
    const block = this.getBlock(x, y, z);
    if (block !== BLOCK_TYPES.WATER) {
      // Если блок твердый, он считается "полным" для воды, если он выше.
      // Если воздух - 0.
      return this.isSolid(x, y, z) ? 1.0 : 0.0;
    }
    const meta = this.getMetadata(x, y, z);
    const MAX_LEVEL = 255;
    const level = meta === 0 ? MAX_LEVEL : meta;
    return level / MAX_LEVEL;
  }

  // Генерация геометрии для конкретного типа блока и набора граней
  // faceFilter: null = все грани, 'top' = только верх, 'bottom' = только низ, 'sides' = боковые
  generateForType(targetBlockType, faceFilter = null) {
    // Проверяем, является ли блок растением (cross-render)
    const blockProps = BLOCK_PROPERTIES[targetBlockType];
    if (blockProps && blockProps.renderType === 'cross') {
      return this.generateCrossGeometry(targetBlockType);
    }

    const positions = [];
    const normals = [];
    const colors = [];
    const uvs = [];
    const indices = [];
    let indexOffset = 0;

    // Определяем какие грани рендерить
    let allowedFaces;
    if (faceFilter === 'top') {
      allowedFaces = [2]; // Top (Y+)
    } else if (faceFilter === 'bottom') {
      allowedFaces = [3]; // Bottom (Y-)
    } else if (faceFilter === 'sides') {
      allowedFaces = [0, 1, 4, 5]; // Right, Left, Front, Back
    } else if (faceFilter === 'front') {
      allowedFaces = [4]; // Front (Z+)
    } else if (faceFilter === 'back') {
      allowedFaces = [5]; // Back (Z-)
    } else if (faceFilter === 'left') {
      allowedFaces = [1]; // Left (X-)
    } else if (faceFilter === 'right') {
      allowedFaces = [0]; // Right (X+)
    } else if (faceFilter === 'sides-no-front') {
      allowedFaces = [0, 1, 5]; // Right, Left, Back (без Front)
    } else {
      allowedFaces = [0, 1, 2, 3, 4, 5]; // Все
    }

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      // ОПТИМИЗАЦИЯ: Если слой пустой (только воздух), пропускаем его целиком
      if (this.chunkData.isEmptyLayer(y)) continue;

      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const block = this.chunkData.getBlock(x, y, z);
          if (block !== targetBlockType) continue;

          // Определяем высоту блока (для жидкостей)
          let myHeight = 1.0;
          let myMeta = 0;
          let waterHeights = null; // [BL, BR, TR, TL]

          if (block === BLOCK_TYPES.WATER) {
            myMeta = this.chunkData.getMetadata(x, y, z);
            const MAX_LEVEL = 255;
            const level = myMeta === 0 ? MAX_LEVEL : myMeta;
            myHeight = level / MAX_LEVEL;

            // Для верхней грани рассчитываем высоты углов для плавности
            // Берем среднее значение высот соседних блоков воды
            // 4 угла:
            // BL (x, z)     -> среднее из (x,z), (x-1,z), (x,z-1), (x-1,z-1)
            // BR (x+1, z)   -> среднее из (x,z), (x+1,z), (x,z-1), (x+1,z-1)
            // TR (x+1, z+1) -> среднее из (x,z), (x+1,z), (x,z+1), (x+1,z+1)
            // TL (x, z+1)   -> среднее из (x,z), (x-1,z), (x,z+1), (x-1,z+1)

            // Функция для получения уровня в локальных координатах
            const getLvl = (dx, dz) => {
              // Если это тот же самый блок (0,0) - возвращаем myHeight
              if (dx === 0 && dz === 0) return myHeight;
              return this.getWaterLevel(x + dx, y, z + dz);
            };

            const calcCorner = (dx, dz) => {
              // Уровень самого блока
              let sum = myHeight;
              let count = 1;

              // Соседи
              const v1 = getLvl(dx, 0); // По X
              const v2 = getLvl(0, dz); // По Z
              const v3 = getLvl(dx, dz); // Диагональ

              // Minecraft logic: если сосед - это блок воды, берем его уровень.
              // Если сосед - воздух, берем уровень "0" только если это сток? Нет, просто усредняем.
              // Для простоты: берем макс уровень из соседей
              // Или среднее? Среднее дает более гладкую волну.

              // Упрощенная логика:
              // Высота угла = MAX(уровни блоков, касающихся угла)
              // Это предотвращает появление дырок
              let maxH = myHeight;
              if (v1 > maxH) maxH = v1;
              if (v2 > maxH) maxH = v2;
              if (v3 > maxH) maxH = v3;

              // Но если сосед - воздух (0), он не должен тянуть воду вниз, если это полный блок.
              // Если текущий блок не полный, то должен.

              // Пробуем просто MAX.
              return maxH;
            };

            // Смещения для углов относительно центра блока (x,z)
            // BL: x, z (neighbors: -1,0; 0,-1; -1,-1) - В данном цикле мы рендерим блок (x,y,z).
            // Его вершины:
            // BL: x, y, z. Соседи: (x-1, z), (x, z-1), (x-1, z-1)
            // Но getLvl берет относительно блока.

            // Внимание: getFaceVertices использует вершины:
            // (x,z) ... (x+1,z+1)
            // Нам нужны высоты именно в этих точках.

            // Точка (x,z) - это угол BL текущего блока. Она общая для (x,z), (x-1,z), (x,z-1), (x-1,z-1).
            // Точка (x+1,z) - BR. Общая для (x,z), (x+1,z), (x,z-1), (x+1,z-1).

            // Реализуем функцию, которая берет координаты вершины и считает среднее 4-х блоков вокруг нее.
            const getVertexHeight = (vx, vz) => {
              // vx, vz - это целые координаты узла сетки.
              // Блоки вокруг узла (vx, vz):
              // (vx-1, vz-1), (vx, vz-1), (vx-1, vz), (vx, vz)
              // Мы находимся в блоке (x, y, z).
              // Относительно (x, y, z):
              // BL (x, z) -> блоки (-1,-1), (0,-1), (-1,0), (0,0)

              const b00 = this.getWaterLevel(vx, y, vz);     // (0,0) - SE от вершины
              const b10 = this.getWaterLevel(vx - 1, y, vz);   // (-1,0) - SW
              const b01 = this.getWaterLevel(vx, y, vz - 1);   // (0,-1) - NE
              const b11 = this.getWaterLevel(vx - 1, y, vz - 1); // (-1,-1) - NW

              // Находим максимальный уровень воды, чтобы вода "тянулась" к соседу
              // Исключаем 0 (воздух), если есть вода > 0
              const levels = [b00, b10, b01, b11];
              let max = 0;
              for (let l of levels) {
                // 1.0 (Solid) не должен поднимать воду выше 1.0, но должен считаться как полная стена
                if (l > max) max = l;
              }

              // Если все 0, то 0.
              // Если есть вода, уровень будет по самой высокой воде.
              return max;
            };

            // BL, BR, TR, TL
            waterHeights = [
              getVertexHeight(x, z),         // BL
              getVertexHeight(x + 1, z),     // BR
              getVertexHeight(x + 1, z + 1), // TR
              getVertexHeight(x, z + 1)      // TL
            ];
          }

          // Проходим только по разрешённым граням
          for (const f of allowedFaces) {
            const { dir } = FACES[f];
            const nx = x + dir[0];
            const ny = y + dir[1];
            const nz = z + dir[2];

            const neighbor = this.getBlock(nx, ny, nz);
            const neighborProps = BLOCK_PROPERTIES[neighbor];

            // Рисуем грань только если:
            // 1. Сосед - ВОЗДУХ (прозрачный воздух)
            // 2. ИЛИ Сосед - прозрачный блок (листва), НО НЕ ТАКОЙ ЖЕ, как текущий (вода к воде не рисуется)
            // 3. Исключение: Если это листья, то рисуем всегда (leaves к leaves рисуются в MC Fast/Fancy по-разному, но пусть будет красиво)
            //
            // Правило для ВОДЫ:
            // Вода граничит с Воздухом -> Рисуем
            // Вода граничит с Водой -> Проверяем уровни
            // Вода граничит с Листвой -> Рисуем
            // Вода граничит с Камнем -> Не рисуем (камень непрозрачный)

            let shouldRenderFace = false;

            if (block === BLOCK_TYPES.WATER) {
              // Для воды: рисуем только если сосед НЕ вода и при этом сосед прозрачный (воздух, листва) или это верхняя грань мира
              // Если neighbor (ID) === WATER -> Сравниваем уровни
              if (neighbor === BLOCK_TYPES.WATER) {
                // УБИРАЕМ ВНУТРЕННИЕ ГРАНИ ВОДЫ ПОЛНОСТЬЮ
                // Это убирает эффект "сетки" внутри объема воды.
                // Даже если уровни разные, мы не рисуем стенку между ними.
                // Переход уровней будет виден за счет наклона верхней грани (waterHeights).
                shouldRenderFace = false;
              } else {
                // Если сосед не вода, проверяем его прозрачность
                // Воздух (0) -> прозрачный -> рисуем
                // Камень -> непрозрачный -> не рисуем
                if (!neighborProps || neighborProps.transparent) {
                  shouldRenderFace = true;
                }
              }
            } else {
              // Для остальных блоков (включая листву):
              // Если сосед прозрачный - рисуем.
              // Листва к листве обычно рисуется (чтобы было гуще), или нет (оптимизация). 
              // В Minecraft Fancy: листва прозрачная, видно сквозь.
              if (!neighborProps || neighborProps.transparent) {
                shouldRenderFace = true;
              }
            }

            if (shouldRenderFace) {
              const verts = this.getFaceVertices(x, y, z, f, myHeight, waterHeights);
              positions.push(...verts);

              // Нормали
              for (let i = 0; i < 4; i++) {
                normals.push(dir[0], dir[1], dir[2]);
              }

              // UV координаты
              const faceUVs = this.getFaceUVs(f, myHeight);
              uvs.push(...faceUVs);

              // ==========================================
              // MINECRAFT-STYLE LIGHTING
              // ==========================================
              // В настоящем Minecraft нет realtime-теней. Вся глубина достигается:
              // 1. Статическим затемнением граней (faceShade) — боковые темнее верхних
              // 2. Воксельным skylight (пещеры/навесы темнее)
              // 3. Мягким AO в углах
              //
              // Это даёт "тёплую", читаемую картинку без чёрных пятен.

              const aoOffsets = AO_OFFSETS[f];
              const baseLight = this.getLight(nx, ny, nz);

              // ==========================================
              // FACE SHADE (мягкий, как в Minecraft)
              // ==========================================
              // Minecraft использует статическое затемнение, но мы делаем его
              // ещё мягче для более естественного вида.
              let faceShade;
              let warmth = 0; // цветовая температура: >0 = теплее, <0 = холоднее

              if (f === 2) {
                faceShade = 1.0;        // Top (Y+) — полный свет
                warmth = 0.04;          // чуть теплее (солнечный свет)
              } else if (f === 3) {
                faceShade = 0.5;        // Bottom (Y-) — классический Minecraft
                warmth = -0.02;         // чуть холоднее
              } else if (f === 0 || f === 1) {
                faceShade = 0.6;        // East/West (X±) — классический Minecraft
                warmth = -0.01;         // нейтрально-холодный (свет неба)
              } else {
                faceShade = 0.8;        // North/South (Z±) — классический Minecraft
                warmth = 0.01;          // чуть тёплый
              }

              for (let corner = 0; corner < 4; corner++) {
                const offsets = aoOffsets[corner];

                // Check 3 neighbors for AO calculation
                const side1 = this.isSolid(x + offsets[0][0], y + offsets[0][1], z + offsets[0][2]);
                const side2 = this.isSolid(x + offsets[1][0], y + offsets[1][1], z + offsets[1][2]);
                const cornerBlock = this.isSolid(x + offsets[2][0], y + offsets[2][1], z + offsets[2][2]);

                // AO value (0-3, where 3 = no occlusion, 0 = fully occluded)
                const ao = this.calculateAO(side1, side2, cornerBlock);

                // Smooth lighting: average light from 4 positions (face + 3 AO neighbors)
                let totalLight = baseLight;
                let lightCount = 1;

                for (const [ox, oy, oz] of offsets) {
                  const neighborLight = this.getLight(x + ox, y + oy, z + oz, baseLight);
                  totalLight += neighborLight;
                  lightCount++;
                }

                const avgLight = totalLight / lightCount;

                // ==========================================
                // SKYLIGHT BRIGHTNESS (настоящая формула Minecraft)
                // ==========================================
                // brightness = 0.8^(15 - lightLevel)
                // Нормализуем, чтобы уровень 0 был абсолютно черным (0.0)
                let lightBrightness = Math.pow(0.8, 15 - avgLight);
                const minBase = Math.pow(0.8, 15); // ~0.035
                lightBrightness = (lightBrightness - minBase) / (1 - minBase);
                lightBrightness = Math.max(0, lightBrightness);

                // ==========================================
                // AMBIENT OCCLUSION (очень мягкий)
                // ==========================================
                // ao=3: открыто (1.0), ao=0: угол закрыт (чуть темнее)
                // Диапазон 0.85..1.0 — едва заметные мягкие тени
                const aoFactor = ao / 3.0;
                const aoMultiplier = 0.85 + aoFactor * 0.15;

                // ==========================================
                // ИТОГОВАЯ ЯРКОСТЬ + ЦВЕТОВАЯ ТЕМПЕРАТУРА
                // ==========================================
                let brightness = lightBrightness * aoMultiplier * faceShade;

                // Минимум 0.02 — пещеры должны быть почти чёрными!
                brightness = Math.max(brightness, 0.01);
                brightness = Math.min(brightness, 1.0);

                // НЕ применяем gamma здесь! Gamma должна быть на уровне рендера.
                // Vertex colors должны быть линейными, чтобы пещеры оставались тёмными.
                // MeshBasicMaterial выведет их как есть, что правильно для Minecraft-стиля.

                // Цветовая температура (тёплый свет сверху, холодный с боков)
                // Применяем только для достаточно ярких поверхностей
                let r = brightness;
                let g = brightness;
                let b = brightness;

                if (brightness > 0.15) {
                  r = Math.min(1.0, brightness * (1.0 + warmth));
                  b = Math.min(1.0, brightness * (1.0 - warmth));
                }

                colors.push(r, g, b);
              }

              // Индексы (учитываем AO flip для правильной интерполяции)
              const base = indexOffset;
              // Проверяем, нужен ли флип для корректного AO
              // Стандартный порядок: 0,1,2 и 0,2,3
              indices.push(base, base + 1, base + 2);
              indices.push(base, base + 2, base + 3);

              indexOffset += 4;
            }
          }
        }
      }
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      colors: new Float32Array(colors),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices)
    };
  }

  /**
   * Генерация cross-геометрии для растений (трава, цветы)
   * Два пересекающихся квада под углом 45°
   */
  generateCrossGeometry(targetBlockType) {
    const positions = [];
    const normals = [];
    const colors = [];
    const uvs = [];
    const indices = [];
    let indexOffset = 0;

    // Offset для X-образной формы (диагональ через центр блока)
    const d = 0.85; // Диагональное смещение (чуть меньше 1 для эстетики)

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      if (this.chunkData.isEmptyLayer(y)) continue;

      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const block = this.chunkData.getBlock(x, y, z);
          if (block !== targetBlockType) continue;

          // Центр блока
          const cx = x + 0.5;
          const cy = y;
          const cz = z + 0.5;

          // Получаем освещение
          const light = this.getLight(x, y, z);
          const brightness = Math.pow(0.8, 15 - light);
          
          // Тинт травы (темнее, более насыщенный зеленый)
          const tintR = 0.90 * brightness;
          const tintG = 0.90 * brightness;
          const tintB = 0.90 * brightness;

          // Два квада: один по диагонали XZ, другой перпендикулярно
          // Quad 1: от (cx-d/2, cz-d/2) до (cx+d/2, cz+d/2)
          // Quad 2: от (cx-d/2, cz+d/2) до (cx+d/2, cz-d/2)

          const halfD = d * 0.5;

          // Quad 1 (диагональ /)
          positions.push(
            cx - halfD, cy, cz - halfD,      // BL
            cx + halfD, cy, cz + halfD,      // BR
            cx + halfD, cy + 1, cz + halfD,  // TR
            cx - halfD, cy + 1, cz - halfD   // TL
          );

          // Нормаль перпендикулярна диагонали (по XZ)
          const n1x = 0.707, n1z = -0.707;
          for (let i = 0; i < 4; i++) {
            normals.push(n1x, 0, n1z);
            colors.push(tintR, tintG, tintB);
          }
          uvs.push(0, 1, 1, 1, 1, 0, 0, 0);
          indices.push(indexOffset, indexOffset + 1, indexOffset + 2);
          indices.push(indexOffset, indexOffset + 2, indexOffset + 3);
          indexOffset += 4;

          // Quad 1 backface (обратная сторона)
          positions.push(
            cx + halfD, cy, cz + halfD,      // BL
            cx - halfD, cy, cz - halfD,      // BR
            cx - halfD, cy + 1, cz - halfD,  // TR
            cx + halfD, cy + 1, cz + halfD   // TL
          );
          for (let i = 0; i < 4; i++) {
            normals.push(-n1x, 0, -n1z);
            colors.push(tintR, tintG, tintB);
          }
          uvs.push(0, 1, 1, 1, 1, 0, 0, 0);
          indices.push(indexOffset, indexOffset + 1, indexOffset + 2);
          indices.push(indexOffset, indexOffset + 2, indexOffset + 3);
          indexOffset += 4;

          // Quad 2 (диагональ \)
          positions.push(
            cx - halfD, cy, cz + halfD,      // BL
            cx + halfD, cy, cz - halfD,      // BR
            cx + halfD, cy + 1, cz - halfD,  // TR
            cx - halfD, cy + 1, cz + halfD   // TL
          );
          const n2x = 0.707, n2z = 0.707;
          for (let i = 0; i < 4; i++) {
            normals.push(n2x, 0, n2z);
            colors.push(tintR, tintG, tintB);
          }
          uvs.push(0, 1, 1, 1, 1, 0, 0, 0);
          indices.push(indexOffset, indexOffset + 1, indexOffset + 2);
          indices.push(indexOffset, indexOffset + 2, indexOffset + 3);
          indexOffset += 4;

          // Quad 2 backface
          positions.push(
            cx + halfD, cy, cz - halfD,      // BL
            cx - halfD, cy, cz + halfD,      // BR
            cx - halfD, cy + 1, cz + halfD,  // TR
            cx + halfD, cy + 1, cz - halfD   // TL
          );
          for (let i = 0; i < 4; i++) {
            normals.push(-n2x, 0, -n2z);
            colors.push(tintR, tintG, tintB);
          }
          uvs.push(0, 1, 1, 1, 1, 0, 0, 0);
          indices.push(indexOffset, indexOffset + 1, indexOffset + 2);
          indices.push(indexOffset, indexOffset + 2, indexOffset + 3);
          indexOffset += 4;
        }
      }
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      colors: new Float32Array(colors),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices)
    };
  }

  getFaceVertices(x, y, z, faceIndex, height = 1.0, waterHeights = null) {
    const X0 = x, X1 = x + 1;
    let Y0 = y;
    // Если есть waterHeights, используем их для верхних точек
    let Y1_BL, Y1_BR, Y1_TR, Y1_TL;

    if (waterHeights) {
      Y1_BL = y + waterHeights[0];
      Y1_BR = y + waterHeights[1];
      Y1_TR = y + waterHeights[2];
      Y1_TL = y + waterHeights[3];
    } else {
      const Y1 = y + height;
      Y1_BL = Y1; Y1_BR = Y1; Y1_TR = Y1; Y1_TL = Y1;
    }

    const Z0 = z, Z1 = z + 1;

    // Порядок: BL, BR, TR, TL (для правильного winding)
    switch (faceIndex) {
      case 0: // Right (X+)
        return [X1, Y0, Z1, X1, Y0, Z0, X1, Y1_BR, Z0, X1, Y1_TR, Z1];
      case 1: // Left (X-)
        return [X0, Y0, Z0, X0, Y0, Z1, X0, Y1_TL, Z1, X0, Y1_BL, Z0];
      case 2: // Top (Y+)
        // Верхняя грань теперь может быть не плоской!
        // Исправленный порядок вершин для соответствия высотам:
        // X0,Z1 (TL) -> Y1_TL
        // X1,Z1 (TR) -> Y1_TR
        // X1,Z0 (BR) -> Y1_BR
        // X0,Z0 (BL) -> Y1_BL
        return [X0, Y1_TL, Z1, X1, Y1_TR, Z1, X1, Y1_BR, Z0, X0, Y1_BL, Z0];
      case 3: // Bottom (Y-)
        return [X0, Y0, Z0, X1, Y0, Z0, X1, Y0, Z1, X0, Y0, Z1];
      case 4: // Front (Z+)
        return [X0, Y0, Z1, X1, Y0, Z1, X1, Y1_TR, Z1, X0, Y1_TL, Z1]; // Z1 -> TL, TR
      case 5: // Back (Z-)
        return [X1, Y0, Z0, X0, Y0, Z0, X0, Y1_BL, Z0, X1, Y1_BR, Z0]; // Z0 -> BR, BL
    }
    return [];
  }

  getFaceUVs(faceIndex, height = 1.0) {
    // С flipY=false: V=0 это верх текстуры в SVG
    // Для боковых граней (0,1,4,5): низ блока = низ текстуры
    // Для Top/Bottom (2,3): стандартный маппинг

    if (faceIndex === 2 || faceIndex === 3) {
      // Top и Bottom - горизонтальные грани
      // UV не зависит от высоты, просто маппим X/Z
      return [
        0, 0,
        1, 0,
        1, 1,
        0, 1
      ];
    } else {
      // Боковые грани - вертикальные
      // BL(низ) -> V=1 (низ текстуры), TL(верх) -> V=0 (верх текстуры)
      // Если height < 1.0, мы используем только нижнюю часть текстуры?
      // Или верхнюю? Обычно уровень воды опускается сверху.
      // Значит мы видим НИЖНЮЮ часть текстуры (дно то же самое), а верх обрезан.
      // V_bottom = 1.
      // V_top = 1 - height. (Если height=1 -> 0. Если height=0.5 -> 0.5)

      const vTop = 1 - height;

      return [
        0, 1,     // BL
        1, 1,     // BR  
        1, vTop,  // TR
        0, vTop   // TL
      ];
    }
  }
}

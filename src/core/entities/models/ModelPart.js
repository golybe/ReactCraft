/**
 * ModelPart - часть модели моба (аналог Minecraft ModelPart)
 * 
 * Создаёт геометрию бокса с правильным UV mapping в стиле Minecraft.
 * Поддерживает:
 * - Minecraft UV layout (развёртка)
 * - Inflate (увеличение бокса для слоёв типа шерсти)
 * - Иерархию (дочерние части)
 */
import * as THREE from 'three';

/**
 * Создаёт геометрию бокса с Minecraft UV layout
 * 
 * @param {Object} options - Параметры бокса
 * @param {number} options.width - Ширина по X (в пикселях модели)
 * @param {number} options.height - Высота по Y (в пикселях модели)
 * @param {number} options.depth - Глубина по Z (в пикселях модели)
 * @param {number} options.texU - U координата текстуры (пиксели)
 * @param {number} options.texV - V координата текстуры (пиксели)
 * @param {number} options.texWidth - Ширина текстуры (обычно 64)
 * @param {number} options.texHeight - Высота текстуры (обычно 32 или 64)
 * @param {number} [options.scale=1/16] - Масштаб (1 пиксель модели = scale юнитов)
 * @param {number} [options.inflate=0] - Расширение бокса (для слоёв)
 * @returns {THREE.BufferGeometry}
 */
export function createBox({
  width,
  height,
  depth,
  texU,
  texV,
  texWidth,
  texHeight,
  scale = 1 / 16,
  inflate = 0,
}) {
  const hw = (width / 2 + inflate) * scale;
  const hh = (height / 2 + inflate) * scale;
  const hd = (depth / 2 + inflate) * scale;

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // UV helpers (Minecraft coords: origin top-left in pixels)
  const U = (px) => px / texWidth;
  const V = (py) => 1 - py / texHeight;
  const INSET = 0.001; // Небольшой отступ чтобы не цеплять соседние пиксели

  function rectUV(px, py, wpx, hpx) {
    const u0 = U(px + INSET);
    const u1 = U(px + wpx - INSET);
    const v0 = V(py + INSET);
    const v1 = V(py + hpx - INSET);
    return { u0, u1, v0, v1 };
  }

  // Minecraft UV "net" layout:
  // 
  //        [depth] [width] [depth] [width]
  //        +-------+-------+
  // [depth]|  TOP  | BOTTOM|
  //        +-------+-------+-------+-------+
  // [height]| RIGHT | FRONT | LEFT  | BACK  |
  //        +-------+-------+-------+-------+
  //
  const UV_TOP = rectUV(texU + depth, texV, width, depth);
  const UV_BOTTOM = rectUV(texU + depth + width, texV, width, depth);
  const UV_RIGHT = rectUV(texU, texV + depth, depth, height);
  const UV_FRONT = rectUV(texU + depth, texV + depth, width, height);
  const UV_LEFT = rectUV(texU + depth + width, texV + depth, depth, height);
  const UV_BACK = rectUV(texU + depth * 2 + width, texV + depth, width, height);

  let base = 0;

  function addFace(corners, normal, uvRect, opts = {}) {
    let { u0, u1, v0, v1 } = uvRect;

    if (opts.flipU) [u0, u1] = [u1, u0];
    if (opts.flipV) [v0, v1] = [v1, v0];

    // Порядок вершин: TL, TR, BR, BL
    const faceUV = [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ];

    for (let i = 0; i < 4; i++) {
      const [x, y, z] = corners[i];
      positions.push(x, y, z);
      normals.push(normal[0], normal[1], normal[2]);
      uvs.push(faceUV[i][0], faceUV[i][1]);
    }

    indices.push(base + 0, base + 1, base + 2, base + 0, base + 2, base + 3);
    base += 4;
  }

  // Оси: X вправо, Y вверх, Z вперёд

  // FRONT (+Z)
  addFace(
    [[-hw, +hh, +hd], [+hw, +hh, +hd], [+hw, -hh, +hd], [-hw, -hh, +hd]],
    [0, 0, 1],
    UV_FRONT
  );

  // BACK (-Z)
  addFace(
    [[+hw, +hh, -hd], [-hw, +hh, -hd], [-hw, -hh, -hd], [+hw, -hh, -hd]],
    [0, 0, -1],
    UV_BACK,
    { flipU: true }
  );

  // RIGHT (+X)
  addFace(
    [[+hw, +hh, -hd], [+hw, +hh, +hd], [+hw, -hh, +hd], [+hw, -hh, -hd]],
    [1, 0, 0],
    UV_RIGHT
  );

  // LEFT (-X)
  addFace(
    [[-hw, +hh, +hd], [-hw, +hh, -hd], [-hw, -hh, -hd], [-hw, -hh, +hd]],
    [-1, 0, 0],
    UV_LEFT
  );

  // TOP (+Y)
  addFace(
    [[-hw, +hh, -hd], [+hw, +hh, -hd], [+hw, +hh, +hd], [-hw, +hh, +hd]],
    [0, 1, 0],
    UV_TOP
  );

  // BOTTOM (-Y)
  addFace(
    [[-hw, -hh, +hd], [+hw, -hh, +hd], [+hw, -hh, -hd], [-hw, -hh, -hd]],
    [0, -1, 0],
    UV_BOTTOM,
    { flipU: true }
  );

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * Класс ModelPart - представляет часть модели с позицией и поворотом
 * Аналог Minecraft ModelPart
 */
export class ModelPart {
  constructor(name, options = {}) {
    this.name = name;
    this.geometry = null;
    this.position = options.position || [0, 0, 0];
    this.rotation = options.rotation || [0, 0, 0];
    this.pivot = options.pivot || [0, 0, 0]; // Точка поворота
    this.children = [];
    this.visible = true;
  }

  /**
   * Добавляет бокс к этой части модели
   */
  addBox(boxOptions) {
    this.geometry = createBox(boxOptions);
    return this;
  }

  /**
   * Добавляет дочернюю часть
   */
  addChild(part) {
    this.children.push(part);
    return this;
  }

  /**
   * Устанавливает позицию
   */
  setPosition(x, y, z) {
    this.position = [x, y, z];
    return this;
  }

  /**
   * Устанавливает поворот (в радианах)
   */
  setRotation(x, y, z) {
    this.rotation = [x, y, z];
    return this;
  }

  /**
   * Освобождает ресурсы
   */
  dispose() {
    if (this.geometry) {
      this.geometry.dispose();
    }
    this.children.forEach(child => child.dispose());
  }
}

export default ModelPart;

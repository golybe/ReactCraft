/**
 * MobRenderer - компонент для рендеринга мобов
 * Овца максимально близко к Minecraft: размеры + UV (как ModelRenderer.addBox) + свет
 */
import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Цвета для разных типов мобов (fallback)
const MOB_COLORS = {
  zombie: 0x4a7c4a,
  skeleton: 0xd4d4d4,
  spider: 0x3d3d3d,
  creeper: 0x2d8a2d,
  pig: 0xf5b6b0,
  cow: 0x8b4513,
  sheep: 0xf5f5dc,
  chicken: 0xffffff,
};

// Пути к текстурам мобов
const MOB_TEXTURES = {
  sheep: '/textures/entity/sheep.png',
  sheep_fur: '/textures/entity/sheep_fur.png',
};

// Кэш текстур
const textureCache = new Map();

/**
 * Загрузка текстуры с кэшированием (Minecraft-style)
 *
 * ВАЖНО:
 * - НЕ трогаем flipY (оставляем true по умолчанию у three.js),
 *   а UV считаем как v = 1 - y/texH (origin сверху слева как в Minecraft).
 */
function loadTexture(path) {
  if (textureCache.has(path)) return textureCache.get(path);

  const loader = new THREE.TextureLoader();
  const texture = loader.load(
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
 * Создаёт бокс для шерсти на голове овцы (БЕЗ лицевой грани!).
 * Шерсть покрывает голову сверху и с боков, но морда остаётся открытой.
 * UV layout стандартный Minecraft для бокса width×height×depth.
 */
function createSheepWoolHeadBox(
  width,
  height,
  depth,
  texU,
  texV,
  texWidth,
  texHeight,
  scale = 1 / 16,
  inflate = 0
) {
  const hw = (width / 2 + inflate) * scale;
  const hh = (height / 2 + inflate) * scale;
  const hd = (depth / 2 + inflate) * scale;

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const U = (px) => px / texWidth;
  const V = (py) => 1 - py / texHeight;
  const INSET = 0.001;

  function rectUV(px, py, wpx, hpx) {
    const u0 = U(px + INSET);
    const u1 = U(px + wpx - INSET);
    const v0 = V(py + INSET);
    const v1 = V(py + hpx - INSET);
    return { u0, u1, v0, v1 };
  }

  // Стандартный Minecraft UV layout для бокса width×height×depth
  // TOP:    (texU + depth, texV, width, depth)
  // BOTTOM: (texU + depth + width, texV, width, depth)
  // RIGHT:  (texU, texV + depth, depth, height)
  // FRONT:  (texU + depth, texV + depth, width, height) - пропускаем для шерсти!
  // LEFT:   (texU + depth + width, texV + depth, depth, height)
  // BACK:   (texU + depth*2 + width, texV + depth, width, height)

  const UV_TOP = rectUV(texU + depth, texV, width, depth);
  const UV_BOTTOM = rectUV(texU + depth + width, texV, width, depth);
  const UV_RIGHT = rectUV(texU, texV + depth, depth, height);
  const UV_LEFT = rectUV(texU + depth + width, texV + depth, depth, height);
  const UV_BACK = rectUV(texU + depth * 2 + width, texV + depth, width, height);

  let base = 0;

  function addFace(corners, normal, uvRect, opts = {}) {
    let { u0, u1, v0, v1 } = uvRect;
    if (opts.flipU) [u0, u1] = [u1, u0];
    if (opts.flipV) [v0, v1] = [v1, v0];

    const faceUV = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

    for (let i = 0; i < 4; i++) {
      const [x, y, z] = corners[i];
      positions.push(x, y, z);
      normals.push(normal[0], normal[1], normal[2]);
      uvs.push(faceUV[i][0], faceUV[i][1]);
    }

    indices.push(base + 0, base + 1, base + 2, base + 0, base + 2, base + 3);
    base += 4;
  }

  // BACK (-Z) - шерсть на затылке
  addFace(
    [[+hw, +hh, -hd], [-hw, +hh, -hd], [-hw, -hh, -hd], [+hw, -hh, -hd]],
    [0, 0, -1],
    UV_BACK,
    { flipU: true }
  );

  // RIGHT (+X) - шерсть на правой стороне
  addFace(
    [[+hw, +hh, -hd], [+hw, +hh, +hd], [+hw, -hh, +hd], [+hw, -hh, -hd]],
    [1, 0, 0],
    UV_RIGHT
  );

  // LEFT (-X) - шерсть на левой стороне
  addFace(
    [[-hw, +hh, +hd], [-hw, +hh, -hd], [-hw, -hh, -hd], [-hw, -hh, +hd]],
    [-1, 0, 0],
    UV_LEFT
  );

  // TOP (+Y) - шерсть сверху головы
  addFace(
    [[-hw, +hh, -hd], [+hw, +hh, -hd], [+hw, +hh, +hd], [-hw, +hh, +hd]],
    [0, 1, 0],
    UV_TOP
  );

  // BOTTOM (-Y) - шерсть снизу головы
  addFace(
    [[-hw, -hh, +hd], [+hw, -hh, +hd], [+hw, -hh, -hd], [-hw, -hh, -hd]],
    [0, -1, 0],
    UV_BOTTOM,
    { flipU: true }
  );

  // FRONT (+Z) отсутствует - морда остаётся открытой!

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
 * Minecraft UV layout (как ModelRenderer.addBox).
 * width/height/depth — в "пикселях модели".
 * scale обычно 1/16.
 * inflate — "CubeDeformation": расширение на сторону (в пикселях модели).
 */
function createMinecraftBox(
  width,
  height,
  depth,
  texU,
  texV,
  texWidth,
  texHeight,
  scale = 1 / 16,
  inflate = 0
) {
  const hw = (width / 2 + inflate) * scale;
  const hh = (height / 2 + inflate) * scale;
  const hd = (depth / 2 + inflate) * scale;

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // UV helpers (Minecraft coords: origin top-left in pixels)
  const U = (px) => px / texWidth;
  const V = (py) => 1 - py / texHeight; // <-- ключевой фикс (и flipY оставляем true!)

  // маленький inset чтобы не цеплять соседние пиксели (особенно на cutout)
  const INSET = 0.001;

  function rectUV(px, py, wpx, hpx) {
    const u0 = U(px + INSET);
    const u1 = U(px + wpx - INSET);
    const v0 = V(py + INSET);
    const v1 = V(py + hpx - INSET);
    return { u0, u1, v0, v1 };
  }

  // Minecraft “net”
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

    // TL, TR, BR, BL
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
    [
      [-hw, +hh, +hd],
      [+hw, +hh, +hd],
      [+hw, -hh, +hd],
      [-hw, -hh, +hd],
    ],
    [0, 0, 1],
    UV_FRONT
  );

  // BACK (-Z) — используем UV_BACK, переворачиваем по U
  addFace(
    [
      [+hw, +hh, -hd],
      [-hw, +hh, -hd],
      [-hw, -hh, -hd],
      [+hw, -hh, -hd],
    ],
    [0, 0, -1],
    UV_BACK,
    { flipU: true }
  );

  // RIGHT (+X)
  addFace(
    [
      [+hw, +hh, -hd],
      [+hw, +hh, +hd],
      [+hw, -hh, +hd],
      [+hw, -hh, -hd],
    ],
    [1, 0, 0],
    UV_RIGHT
  );

  // LEFT (-X)
  addFace(
    [
      [-hw, +hh, +hd],
      [-hw, +hh, -hd],
      [-hw, -hh, -hd],
      [-hw, -hh, +hd],
    ],
    [-1, 0, 0],
    UV_LEFT
  );

  // TOP (+Y)
  addFace(
    [
      [-hw, +hh, -hd],
      [+hw, +hh, -hd],
      [+hw, +hh, +hd],
      [-hw, +hh, +hd],
    ],
    [0, 1, 0],
    UV_TOP
  );

  // BOTTOM (-Y) — flipU как в Minecraft net
  addFace(
    [
      [-hw, -hh, +hd],
      [+hw, -hh, +hd],
      [+hw, -hh, -hd],
      [-hw, -hh, -hd],
    ],
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
 * Компонент овцы - близко к Minecraft
 *
 * Vanilla sheep:
 * - Head: 6×6×6, UV (0,0)
 * - Body: 8×16×6, UV (28,8), ротация тела +90° по X
 * - Legs: 4×12×4, UV (0,16)
 */
const SheepMesh = ({ mob }) => {
  const groupRef = useRef();
  const legFLRef = useRef();
  const legFRRef = useRef();
  const legBLRef = useRef();
  const legBRRef = useRef();

  const TEX_W = 64;
  const TEX_H = 32;
  const SCALE = 1 / 16;

  const skinTexture = useMemo(() => loadTexture(MOB_TEXTURES.sheep), []);
  const furTexture = useMemo(() => loadTexture(MOB_TEXTURES.sheep_fur), []);

  // Геометрии
  // Голова овцы: размер 6x6x6, стандартный Minecraft UV layout
  // UV начинается с (0,0): TOP(6,0), BOTTOM(12,0), RIGHT(0,6), FRONT(6,6), LEFT(12,6), BACK(18,6)
  const headGeometry = useMemo(
    () => createMinecraftBox(6, 6, 6, 0, 0, TEX_W, TEX_H, SCALE, 0),
    []
  );

  const bodyGeometry = useMemo(
    () => createMinecraftBox(8, 16, 6, 28, 8, TEX_W, TEX_H, SCALE, 0),
    []
  );

  const legGeometry = useMemo(
    () => createMinecraftBox(4, 12, 4, 0, 16, TEX_W, TEX_H, SCALE, 0),
    []
  );

  const WOOL_INFLATE = 0.5;
  // Шерсть на голове - размер 6x6x6
  const woolHeadGeometry = useMemo(
    () => createSheepWoolHeadBox(6, 6, 6, 0, 0, TEX_W, TEX_H, SCALE, WOOL_INFLATE),
    []
  );
  const woolBodyGeometry = useMemo(
    () => createMinecraftBox(8, 16, 6, 28, 8, TEX_W, TEX_H, SCALE, WOOL_INFLATE),
    []
  );

  // Материалы
  const skinMaterial = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        map: skinTexture,
        transparent: false,
        side: THREE.DoubleSide,
      }),
    [skinTexture]
  );

  const woolMaterial = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        map: furTexture,
        transparent: false,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    [furTexture]
  );

  const shadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    []
  );

  // Цвета для “hurt flash” без аллокаций
  const emissiveOff = useMemo(() => new THREE.Color(0x000000), []);
  const emissiveOn = useMemo(() => new THREE.Color(0x330000), []);

  // Всё тело овцы на layer 1 (чтобы свет был только для мобов)
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.traverse((o) => o.layers.set(1));
  }, []);

  // Позиционирование (в духе Minecraft)
  const LEG_H = 12 * SCALE;
  const LEG_X = 3 * SCALE;
  const LEG_Z_FRONT = 7 * SCALE;
  const LEG_Z_BACK = -5 * SCALE;

  const BODY_THICK_Y = 6 * SCALE; // после поворота тела
  const BODY_Y = LEG_H + BODY_THICK_Y / 2;
  const BODY_Z = 2 * SCALE;

  const HEAD = 6 * SCALE;
  const BODY_HALF_LEN_Z = (16 * SCALE) / 2;
  const HEAD_Z = BODY_Z + BODY_HALF_LEN_Z + HEAD / 2 - 1 * SCALE;
  const HEAD_Y = BODY_Y + BODY_THICK_Y / 2 - HEAD / 2 + 2 * SCALE;

  const walkAnimRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    groupRef.current.position.set(mob.position.x, mob.position.y, mob.position.z);
    groupRef.current.rotation.y = mob.rotation?.yaw || 0;

    const speed = Math.sqrt((mob.velocity?.x || 0) ** 2 + (mob.velocity?.z || 0) ** 2);
    if (speed > 0.01) walkAnimRef.current += delta * 8;
    else walkAnimRef.current *= 0.9;

    const swing = Math.sin(walkAnimRef.current) * 0.6;
    if (legFLRef.current) legFLRef.current.rotation.x = swing;
    if (legFRRef.current) legFRRef.current.rotation.x = -swing;
    if (legBLRef.current) legBLRef.current.rotation.x = -swing;
    if (legBRRef.current) legBRRef.current.rotation.x = swing;

    if (mob.hurtAnimation > 0) {
      const flash = Math.sin(mob.hurtAnimation * 20) > 0;
      skinMaterial.emissive.copy(flash ? emissiveOn : emissiveOff);
      woolMaterial.emissive.copy(flash ? emissiveOn : emissiveOff);
    } else {
      skinMaterial.emissive.copy(emissiveOff);
      woolMaterial.emissive.copy(emissiveOff);
    }

    if (mob.isDead) groupRef.current.rotation.z = Math.PI / 2;
  });

  useEffect(() => {
    return () => {
      headGeometry.dispose();
      bodyGeometry.dispose();
      legGeometry.dispose();
      woolHeadGeometry.dispose();
      woolBodyGeometry.dispose();
      skinMaterial.dispose();
      woolMaterial.dispose();
      shadowMaterial.dispose();
    };
  }, [
    headGeometry,
    bodyGeometry,
    legGeometry,
    woolHeadGeometry,
    woolBodyGeometry,
    skinMaterial,
    woolMaterial,
    shadowMaterial,
  ]);

  if (mob.isDead && mob._deathTimer > 1.5) return null;

  return (
    <group ref={groupRef}>
      {/* Тень */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} material={shadowMaterial}>
        <circleGeometry args={[0.4, 16]} />
      </mesh>

      {/* Тело */}
      <mesh
        geometry={bodyGeometry}
        material={skinMaterial}
        position={[0, BODY_Y, BODY_Z]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <mesh
        geometry={woolBodyGeometry}
        material={woolMaterial}
        position={[0, BODY_Y, BODY_Z]}
        rotation={[Math.PI / 2, 0, 0]}
      />

      {/* Голова - кожа и шерсть */}
      <mesh geometry={headGeometry} material={skinMaterial} position={[0, HEAD_Y, HEAD_Z]} />
      <mesh geometry={woolHeadGeometry} material={woolMaterial} position={[0, HEAD_Y, HEAD_Z]} />

      {/* Ноги */}
      <group ref={legFLRef} position={[-LEG_X, LEG_H, LEG_Z_FRONT]}>
        <mesh geometry={legGeometry} material={skinMaterial} position={[0, -LEG_H / 2, 0]} />
      </group>

      <group ref={legFRRef} position={[LEG_X, LEG_H, LEG_Z_FRONT]}>
        <mesh geometry={legGeometry} material={skinMaterial} position={[0, -LEG_H / 2, 0]} />
      </group>

      <group ref={legBLRef} position={[-LEG_X, LEG_H, LEG_Z_BACK]}>
        <mesh geometry={legGeometry} material={skinMaterial} position={[0, -LEG_H / 2, 0]} />
      </group>

      <group ref={legBRRef} position={[LEG_X, LEG_H, LEG_Z_BACK]}>
        <mesh geometry={legGeometry} material={skinMaterial} position={[0, -LEG_H / 2, 0]} />
      </group>
    </group>
  );
};

/**
 * Универсальный рендерер моба
 */
const MobMesh = ({ mob }) => {
  if (mob.mobType === 'sheep') return <SheepMesh mob={mob} />;

  const meshRef = useRef();

  const material = useMemo(() => {
    const color = MOB_COLORS[mob.mobType] || 0xff00ff;
    return new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
    });
  }, [mob.mobType]);

  const shadowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    []
  );

  useEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.layers.set(1);
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    meshRef.current.position.set(mob.position.x, mob.position.y + mob.height / 2, mob.position.z);
    meshRef.current.rotation.y = mob.rotation?.yaw || 0;

    if (mob.hurtAnimation > 0) {
      material.opacity = Math.sin(mob.hurtAnimation * 20) > 0 ? 1 : 0.3;
    } else {
      material.opacity = 1;
    }

    if (mob.isDead) {
      meshRef.current.rotation.x = Math.PI / 2;
      material.opacity = Math.max(0, material.opacity - delta * 0.5);
    }
  });

  if (mob.isDead && mob._deathTimer > 1.5) return null;

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[mob.position.x, mob.position.y + 0.01, mob.position.z]}
        material={shadowMaterial}
      >
        <circleGeometry args={[mob.width / 2, 16]} />
      </mesh>

      <mesh ref={meshRef} material={material}>
        <boxGeometry args={[mob.width, mob.height, mob.width]} />
      </mesh>
    </group>
  );
};

/**
 * Менеджер рендеринга всех мобов
 * Добавляем свет на отдельном layer (1), чтобы не влиять на мир
 */
export const MobsRenderer = ({ entityManager }) => {
  const [mobs, setMobs] = useState([]);
  const lastCountRef = useRef(0);
  const { camera } = useThree();

  // Камера видит и мир (layer 0), и мобов (layer 1)
  useEffect(() => {
    camera.layers.enable(1);
  }, [camera]);

  useFrame(() => {
    if (!entityManager) return;

    const allMobs = entityManager.getAll().filter((entity) => entity.mobType !== undefined);
    if (allMobs.length !== lastCountRef.current) {
      lastCountRef.current = allMobs.length;
      setMobs([...allMobs]);
    }
  });

  useEffect(() => {
    if (!entityManager) return;
    const allMobs = entityManager.getAll().filter((entity) => entity.mobType !== undefined);
    setMobs(allMobs);
    lastCountRef.current = allMobs.length;
  }, [entityManager]);

  return (
    <group name="mobs">
      {/* Свет только для layer 1 */}
      <ambientLight
        intensity={0.9}
        onUpdate={(l) => {
          l.layers.set(1);
        }}
      />
      <directionalLight
        intensity={0.9}
        position={[20, 40, 10]}
        onUpdate={(l) => {
          l.layers.set(1);
        }}
      />

      {mobs.map((mob) => (
        <MobMesh key={mob.id} mob={mob} />
      ))}
    </group>
  );
};

export default MobsRenderer;

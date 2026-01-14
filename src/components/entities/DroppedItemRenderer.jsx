/**
 * Dropped Item Component - Refined Physics
 */
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BlockRegistry } from '../../core/blocks/BlockRegistry';
import { getBlockTextureInfo } from '../../utils/textures';
import { TextureManager } from '../../core/rendering/TextureManager';

const textureManager = TextureManager.getInstance();

// Создаём BoxGeometry с исправленными UV координатами для flipY=false
// В Three.js стандартные UV для BoxGeometry рассчитаны на flipY=true
// Нам нужно инвертировать V координату для боковых граней
function createCorrectedBoxGeometry(size) {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const uvAttribute = geometry.getAttribute('uv');
  const uvArray = uvAttribute.array;

  // BoxGeometry имеет 6 граней, каждая с 4 вершинами, каждая вершина с 2 UV координатами
  // Порядок граней в BoxGeometry: +X, -X, +Y, -Y, +Z, -Z
  // Индексы UV: face * 8 ... face * 8 + 7 (4 вершины * 2 координаты)

  // Для боковых граней (0,1,4,5) инвертируем V координату (нечетные индексы)
  // Для верхней/нижней (2,3) оставляем как есть

  for (let face = 0; face < 6; face++) {
    const baseIdx = face * 8; // 4 вершины * 2 координаты на грань

    if (face === 0 || face === 1 || face === 4 || face === 5) {
      // Боковые грани - инвертируем V
      for (let v = 0; v < 4; v++) {
        const vIdx = baseIdx + v * 2 + 1; // +1 для V координаты
        uvArray[vIdx] = 1 - uvArray[vIdx];
      }
    }
    // Для граней 2 и 3 (верх/низ) UV остаются без изменений
  }

  uvAttribute.needsUpdate = true;
  return geometry;
}

// Physics constants
const ITEM_SIZE = 0.25;
const GRAVITY = 22; // Чуть тяжелее, чтобы падали резче
const FRICTION_AIR = 0.98; // Сопротивление воздуха
const FRICTION_GROUND = 0.6; // Трение о землю (быстрая остановка)
const BOUNCE = 0.35;
const PICKUP_RADIUS = 1.5;
const MAGNET_RADIUS = 3.0; // Чуть увеличил радиус магнита
const MAGNET_SPEED = 8;
const DESPAWN_TIME = 300; // 5 минут

const DroppedItem = ({
  id,
  blockType,
  count = 1,
  durability, // Прочность инструмента
  initialPosition,
  initialVelocity = { x: 0, y: 0, z: 0 },
  playerPos,
  onPickup,
  getBlock,
  noPickupTime = 0.5 // Небольшая задержка перед подбором, чтобы не подобрать сразу как выкинул
}) => {
  const meshRef = useRef();
  const shadowRef = useRef();
  const [isPickedUp, setIsPickedUp] = useState(false);

  const state = useRef({
    x: initialPosition.x,
    y: initialPosition.y,
    z: initialPosition.z,
    vx: initialVelocity.x,
    vy: initialVelocity.y,
    vz: initialVelocity.z,
    onGround: false,
    time: 0,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 2, // Случайная скорость вращения при падении
    pickedUp: false // Флаг для предотвращения дюпликации (синхронный)
  });

  const block = useMemo(() => BlockRegistry.get(blockType), [blockType]);
  const isItem = block?.isPlaceable === false;

  // Создаём геометрию с исправленными UV один раз
  const boxGeometry = useMemo(() => createCorrectedBoxGeometry(ITEM_SIZE), []);

  // Для блоков с разными гранями создаем массив материалов
  const [materials, setMaterials] = useState(null);

  useEffect(() => {
    if (!block) {
      setMaterials(new THREE.MeshBasicMaterial({ color: 0xff00ff }));
      return;
    }

    const textureInfo = getBlockTextureInfo(blockType);

    const loadMaterials = async () => {
      if (isItem) {
        // Для предметов (спрайтов) используем одну текстуру
        const textureName = textureInfo?.all || textureInfo?.side || textureInfo?.top;
        const texture = textureName ? await textureManager.getTexture(textureName) : null;
        const spriteMat = new THREE.SpriteMaterial({
          map: texture,
          color: 0xffffff,
          transparent: true,
          rotation: Math.PI // Поворот на 180 градусов для исправления переворота
        });
        setMaterials(spriteMat);
        return;
      }

      // Для блоков
      if (textureInfo?.all) {
        // У блока одинаковые текстуры на всех гранях
        const texture = await textureManager.getTexture(textureInfo.all);
        setMaterials(new THREE.MeshBasicMaterial({
          map: texture,
          color: texture ? 0xffffff : block.color
        }));
      } else {
        // Для блоков с разными текстурами создаем массив из 6 материалов
        const sideName = textureInfo?.side || textureInfo?.front;
        const topName = textureInfo?.top || sideName;
        const bottomName = textureInfo?.bottom || sideName; // Нижняя грань - fallback на side, не на top!
        const frontName = textureInfo?.front || sideName;
        const backName = textureInfo?.back || sideName;

        // Загружаем все текстуры асинхронно
        const [sideTex, topTex, bottomTex, frontTex, backTex] = await Promise.all([
          textureManager.getTexture(sideName),
          textureManager.getTexture(topName),
          textureManager.getTexture(bottomName),
          textureManager.getTexture(frontName),
          textureManager.getTexture(backName)
        ]);

        const createMat = (tex) => {
          return new THREE.MeshBasicMaterial({
            map: tex,
            color: tex ? 0xffffff : block.color
          });
        };

        // Порядок материалов для BoxGeometry:
        // [+X, -X, +Y, -Y, +Z, -Z] = [right, left, top, bottom, front, back]
        setMaterials([
          createMat(sideTex),   // +X (right side)
          createMat(sideTex),   // -X (left side)
          createMat(topTex),    // +Y (top)
          createMat(bottomTex), // -Y (bottom)
          createMat(frontTex),  // +Z (front)
          createMat(backTex)    // -Z (back)
        ]);
      }
    };

    loadMaterials();
  }, [blockType, block, isItem]);

  const shadowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide
    });
  }, []);

  const isSolid = (x, y, z) => {
    if (!getBlock) return false;
    // Добавляем небольшой отступ, чтобы не проверять внутри соседнего блока при пограничных значениях
    const id = getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    return id && id !== 0 && id !== 7; // Игнорируем воздух и барьеры (если 7 это барьер)
  };

  const getGroundY = (x, z, itemBottomY) => {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    const startY = Math.floor(itemBottomY);

    // Ограничиваем глубину поиска 3 блоками вниз для оптимизации
    const limit = Math.max(0, startY - 3);

    for (let y = startY; y >= limit; y--) {
      if (isSolid(bx, y, bz)) {
        return y + 1;
      }
    }
    return -100;
  };

  useFrame((_, delta) => {
    if (!meshRef.current || isPickedUp) return;

    const dt = Math.min(delta, 0.05);
    const s = state.current;

    // Проверка синхронного флага для предотвращения дюпликации
    if (s.pickedUp) return;

    s.time += dt;

    if (s.time > DESPAWN_TIME) {
      s.pickedUp = true; // Устанавливаем флаг
      setIsPickedUp(true);
      if (onPickup) onPickup(id, 0); // 0 count означает удаление без добавления в инвентарь
      return;
    }

    const canPickup = s.time > noPickupTime;

    // Distances
    const dx = playerPos.x - s.x;
    const dy = (playerPos.y + 0.5) - s.y; // Центр игрока чуть выше ног
    const dz = playerPos.z - s.z;
    const distSq = dx * dx + dy * dy + dz * dz; // Используем квадрат расстояния для оптимизации sqrt
    const dist = Math.sqrt(distSq);

    // Pickup logic - используем синхронный флаг для предотвращения множественного вызова
    if (canPickup && dist < PICKUP_RADIUS) {
      s.pickedUp = true; // Устанавливаем флаг СРАЗУ (синхронно)
      setIsPickedUp(true); // React state для UI (асинхронно)
      if (onPickup) onPickup(id, count, blockType, durability); // Передаем durability
      return;
    }

    // Magnet logic
    let isMagnetized = false;
    if (canPickup && dist < MAGNET_RADIUS) {
      isMagnetized = true;
      // Экспоненциальное увеличение силы магнита при приближении
      const strength = MAGNET_SPEED * (1 - dist / MAGNET_RADIUS) + 2;

      s.vx += (dx / dist) * strength * dt;
      s.vy += (dy / dist) * strength * dt;
      s.vz += (dz / dist) * strength * dt;

      // Сильное затухание, чтобы предмет не пролетал сквозь игрока
      s.vx *= 0.85;
      s.vy *= 0.85;
      s.vz *= 0.85;
    } else {
      // Standard Physics
      s.vy -= GRAVITY * dt;
      // Terminal velocity
      if (s.vy < -20) s.vy = -20;

      // Air resistance
      s.vx *= FRICTION_AIR;
      s.vz *= FRICTION_AIR;
    }

    // Predict next position
    let newX = s.x + s.vx * dt;
    let newY = s.y + s.vy * dt;
    let newZ = s.z + s.vz * dt;

    // === COLLISION DETECTION ===
    const itemRadius = ITEM_SIZE / 2;

    // 1. Ground Collision
    const groundY = getGroundY(s.x, s.z, s.y);
    const floorY = groundY + itemRadius;

    if (newY < floorY) {
      newY = floorY;

      if (s.vy < -2) {
        // Bounce
        s.vy = -s.vy * BOUNCE;
        // При ударе теряем часть горизонтальной скорости
        s.vx *= 0.8;
        s.vz *= 0.8;
      } else {
        // Settle
        s.vy = 0;
        s.onGround = true;
        // Сильное трение на земле
        s.vx *= FRICTION_GROUND;
        s.vz *= FRICTION_GROUND;

        // Полная остановка, чтобы не дергался
        if (Math.abs(s.vx) < 0.05) s.vx = 0;
        if (Math.abs(s.vz) < 0.05) s.vz = 0;
      }
    } else {
      s.onGround = false;
    }

    // 2. Wall Collision (X)
    // Проверяем коллизию на высоте "пояса" предмета
    if (isSolid(newX + (s.vx > 0 ? itemRadius : -itemRadius), newY, s.z)) {
      newX = s.x;
      s.vx = -s.vx * 0.3; // Слабый отскок, предмет скорее "падает" вдоль стены
    }

    // 3. Wall Collision (Z)
    if (isSolid(newX, newY, newZ + (s.vz > 0 ? itemRadius : -itemRadius))) {
      newZ = s.z;
      s.vz = -s.vz * 0.3; // Слабый отскок
    }

    // Update State
    s.x = newX;
    s.y = newY;
    s.z = newZ;

    // Render Position
    let displayY = s.y;
    // Анимация парения (Bobbing) только если предмет лежит и не магнитится
    // Используем abs чтобы предмет всегда был выше или на уровне базовой позиции
    if (s.onGround && !isMagnetized && Math.abs(s.vx) < 0.1) {
      displayY += Math.abs(Math.sin(s.time * 3)) * 0.1; // Покачивание только вверх
    }

    meshRef.current.position.set(s.x, displayY, s.z);

    // Rotation logic
    if (!isItem) {
      // Если летит - крутится хаотично, если лежит - крутится красиво вокруг оси Y
      if (!s.onGround && !isMagnetized) {
        meshRef.current.rotation.x += s.rotSpeed * dt;
        meshRef.current.rotation.z += s.rotSpeed * dt;
      } else {
        // Выравниваем вращение при приземлении
        meshRef.current.rotation.x *= 0.9;
        meshRef.current.rotation.z *= 0.9;
        s.rot += dt * 1.5;
        meshRef.current.rotation.y = s.rot;
      }
    }

    // Shadow logic
    if (shadowRef.current) {
      // Тень всегда на земле, даже если предмет подпрыгивает в анимации
      const shadowY = groundY + 0.02;
      shadowRef.current.position.set(s.x, shadowY, s.z);

      const distanceFromGround = s.y - groundY;
      const shadowOpacity = Math.max(0, 0.4 - distanceFromGround * 0.25);
      shadowRef.current.material.opacity = shadowOpacity;

      // Скейлим тень, когда предмет высоко (эффект рассеивания)
      const scale = 1 + distanceFromGround * 0.2;
      shadowRef.current.scale.set(scale, scale, scale);
    }
  });

  if (isPickedUp || !block || !materials) return null;

  // Рендеринг остался тем же, но я добавил проверку на существование meshRef перед рендером
  // Группа и меши остались как у тебя, так как они сделаны правильно
  return (
    <group>
      <mesh
        ref={shadowRef}
        position={[initialPosition.x, initialPosition.y - 0.1, initialPosition.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadowMaterial}
        renderOrder={-1}
      >
        <circleGeometry args={[ITEM_SIZE * 0.8, 16]} />
      </mesh>

      {isItem ? (
        <sprite
          ref={meshRef}
          position={[initialPosition.x, initialPosition.y, initialPosition.z]}
          material={materials}
          scale={[ITEM_SIZE * 1.8, ITEM_SIZE * 1.8, 1]}
        />
      ) : (
        <mesh
          ref={meshRef}
          position={[initialPosition.x, initialPosition.y, initialPosition.z]}
          material={materials}
          geometry={boxGeometry}
        />
      )}
    </group>
  );
};

export const DroppedItemsManager = ({ items, playerPos, onPickup, getBlock }) => {
  return (
    <group>
      {items.map(item => (
        <DroppedItem
          key={item.id}
          id={item.id}
          blockType={item.blockType}
          count={item.count}
          durability={item.durability} // Передаем durability
          initialPosition={item.position}
          initialVelocity={item.velocity}
          playerPos={playerPos}
          onPickup={onPickup}
          getBlock={getBlock}
          noPickupTime={item.noPickupTime}
        />
      ))}
    </group>
  );
};

export default DroppedItem;
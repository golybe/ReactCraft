import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getBlockTextureInfo } from '../../utils/textures';
import { BLOCK_TINTS } from '../../constants/colors';
import { TextureManager } from '../../core/rendering/TextureManager';
import { BlockRegistry } from '../../core/blocks/BlockRegistry';

const textureManager = TextureManager.getInstance();

// Создаём BoxGeometry с исправленными UV координатами для flipY=false
function createCorrectedBoxGeometry(size = 1) {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const uvAttribute = geometry.getAttribute('uv');
  const uvArray = uvAttribute.array;

  // Для боковых граней (0,1,4,5) инвертируем V координату
  for (let face = 0; face < 6; face++) {
    const baseIdx = face * 8;

    if (face === 0 || face === 1 || face === 4 || face === 5) {
      for (let v = 0; v < 4; v++) {
        const vIdx = baseIdx + v * 2 + 1;
        uvArray[vIdx] = 1 - uvArray[vIdx];
      }
    }
  }

  uvAttribute.needsUpdate = true;
  return geometry;
}

// Геометрия создаётся один раз и переиспользуется
const sharedBoxGeometry = createCorrectedBoxGeometry(1);

// Простая SVG текстура кожи (шум)
const HAND_SKIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" shape-rendering="crispEdges">
  <rect width="64" height="64" fill="#a06450"/>
  <rect x="8" y="8" width="8" height="8" fill="#cd917c" fill-opacity="0.5"/>
  <rect x="24" y="8" width="8" height="8" fill="#b57b67" fill-opacity="0.5"/>
  <rect x="40" y="8" width="8" height="8" fill="#cd917c" fill-opacity="0.5"/>
  <rect x="56" y="8" width="8" height="8" fill="#b57b67" fill-opacity="0.5"/>
  <rect x="0" y="16" width="8" height="8" fill="#b57b67" fill-opacity="0.5"/>
  <rect x="16" y="16" width="8" height="8" fill="#cd917c" fill-opacity="0.5"/>
  <rect x="32" y="16" width="8" height="8" fill="#b57b67" fill-opacity="0.5"/>
  <rect x="48" y="16" width="8" height="8" fill="#cd917c" fill-opacity="0.5"/>
  <rect x="8" y="24" width="8" height="8" fill="#cd917c" fill-opacity="0.5"/>
  <rect x="24" y="24" width="8" height="8" fill="#b57b67" fill-opacity="0.5"/>
  <rect x="40" y="24" width="8" height="8" fill="#cd917c" fill-opacity="0.5"/>
  <rect x="56" y="24" width="8" height="8" fill="#b57b67" fill-opacity="0.5"/>
  <rect x="0" y="32" width="8" height="8" fill="#b57b67" fill-opacity="0.5"/>
  <rect x="16" y="32" width="8" height="8" fill="#cd917c" fill-opacity="0.5"/>
  <rect x="32" y="32" width="8" height="8" fill="#b57b67" fill-opacity="0.5"/>
  <rect x="48" y="32" width="8" height="8" fill="#cd917c" fill-opacity="0.5"/>
  <rect x="8" y="40" width="8" height="8" fill="#cd917c" fill-opacity="0.5"/>
  <rect x="24" y="40" width="8" height="8" fill="#b57b67" fill-opacity="0.5"/>
  <rect x="40" y="40" width="8" height="8" fill="#cd917c" fill-opacity="0.5"/>
  <rect x="56" y="40" width="8" height="8" fill="#b57b67" fill-opacity="0.5"/>
  <rect x="0" y="48" width="8" height="8" fill="#b57b67" fill-opacity="0.5"/>
  <rect x="16" y="48" width="8" height="8" fill="#cd917c" fill-opacity="0.5"/>
  <rect x="32" y="48" width="8" height="8" fill="#b57b67" fill-opacity="0.5"/>
  <rect x="48" y="48" width="8" height="8" fill="#cd917c" fill-opacity="0.5"/>
  <rect x="8" y="56" width="8" height="8" fill="#cd917c" fill-opacity="0.5"/>
  <rect x="24" y="56" width="8" height="8" fill="#b57b67" fill-opacity="0.5"/>
  <rect x="40" y="56" width="8" height="8" fill="#cd917c" fill-opacity="0.5"/>
  <rect x="56" y="56" width="8" height="8" fill="#b57b67" fill-opacity="0.5"/>
</svg>
`;

const HeldItem = ({ selectedBlock, lightLevel = 15, lastPunchTime, isFlying, isMining = false, isEating = false, eatingProgress = 0 }) => {
  const meshRef = useRef();
  const [materials, setMaterials] = useState(null);
  const lastLightLevel = useRef(lightLevel);
  const isHand = !selectedBlock;

  const blockProps = selectedBlock ? BlockRegistry.get(selectedBlock) : null;
  const isItem = blockProps?.isPlaceable === false || blockProps?.renderAsItem;

  const punchStartTime = useRef(0);
  const miningAnimTime = useRef(0);

  useEffect(() => {
    if (lastPunchTime) {
      punchStartTime.current = Date.now();
    }
  }, [lastPunchTime]);

  useEffect(() => {
    // Сбрасываем материалы перед загрузкой новых, чтобы не было 'призрака' старого блока
    setMaterials(null);

    if (isHand) {
      // Загружаем SVG текстуру
      const textureUrl = `data:image/svg+xml;base64,${btoa(HAND_SKIN_SVG)}`;
      const loader = new THREE.TextureLoader();
      const tex = loader.load(textureUrl);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;

      const handMat = new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.FrontSide,
        depthTest: false, // Всегда поверх всего
        depthWrite: false,
        transparent: true
      });

      // Сразу устанавливаем правильную яркость
      const brightness = Math.max(0.02, Math.pow(0.8, 15 - lightLevel));
      handMat.color.setScalar(brightness);

      setMaterials(handMat);
      lastLightLevel.current = lightLevel;
      return;
    }

    const info = getBlockTextureInfo(selectedBlock);
    if (!info) return;

    // Используем TextureManager для загрузки текстур
    const loadTex = async (name) => {
      const tex = await textureManager.getTexture(name);
      if (!tex) return null;

      // Создаем материал для HeldItem (яркость устанавливается в useFrame)
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        side: isItem ? THREE.DoubleSide : THREE.FrontSide,
        depthTest: false,
        depthWrite: false,
        transparent: true
      });

      return mat;
    };

    // Загружаем текстуры для всех сторон блока
    const loadMaterials = async () => {
      if (!info) return;

      let mats;

      if (info.all) {
        // У блока одинаковые текстуры на всех гранях
        const mat = await loadTex(info.all);
        if (mat) mats = mat;
      } else {
        // Для блоков с разными текстурами создаем массив из 6 материалов
        const sideName = info.side || info.front;
        const topName = info.top || sideName;
        const bottomName = info.bottom || sideName;
        const frontName = info.front || sideName;
        const backName = info.back || sideName;

        const [sideMat, topMat, bottomMat, frontMat, backMat] = await Promise.all([
          loadTex(sideName),
          loadTex(topName),
          loadTex(bottomName),
          loadTex(frontName),
          loadTex(backName)
        ]);

        if (sideMat) {
          mats = [
            sideMat.clone(),   // +X (right side)
            sideMat.clone(),   // -X (left side)
            topMat ? topMat.clone() : sideMat.clone(),    // +Y (top)
            bottomMat ? bottomMat.clone() : sideMat.clone(), // -Y (bottom)
            frontMat ? frontMat.clone() : sideMat.clone(),  // +Z (front)
            backMat ? backMat.clone() : sideMat.clone()     // -Z (back)
          ];
        }
      }

      if (mats) {
        // Сразу устанавливаем правильную яркость
        const brightness = Math.max(0.02, Math.pow(0.8, 15 - lightLevel));
        if (Array.isArray(mats)) {
          mats.forEach(m => m.color.setScalar(brightness));
        } else {
          mats.color.setScalar(brightness);
        }

        setMaterials(mats);
        lastLightLevel.current = lightLevel;
      }
    };

    loadMaterials();
  }, [selectedBlock, isHand, isItem]); // lightLevel специально не в зависимостях, чтобы не перезагружать текстуры. Яркость обновляется в useFrame.

  const bobTime = useRef(0);
  const lastPos = useRef(new THREE.Vector3());

  useFrame(({ camera }, delta) => {
    if (!meshRef.current || !materials) return;

    // Обновление освещения
    if (lastLightLevel.current !== lightLevel) {
      lastLightLevel.current = lightLevel;
      const minBrightness = 0.02; // Пещерная темнота
      const brightness = Math.max(Math.pow(0.8, 15 - lightLevel), minBrightness);

      // Применяем яркость одинаково для руки и блоков (как затемнение текстуры)
      if (Array.isArray(materials)) {
        materials.forEach(mat => mat.color.setScalar(brightness));
      } else {
        materials.color.setScalar(brightness);
      }
    }

    // 1. Привязка к камере
    meshRef.current.position.copy(camera.position);
    meshRef.current.quaternion.copy(camera.quaternion);

    // 2. Bobbing (покачивание при ходьбе)
    // ОТКЛЮЧАЕМ bobbing, если летим
    let bobX = 0;
    let bobY = 0;

    if (!isFlying) {
      const currentWorldPos = new THREE.Vector3();
      camera.getWorldPosition(currentWorldPos);

      const dist = currentWorldPos.distanceTo(lastPos.current);
      lastPos.current.copy(currentWorldPos);

      const speed = Math.min(dist / delta, 10);
      const isMoving = speed > 0.1;

      if (isMoving) {
        bobTime.current += delta * speed * 1.5;
      } else {
        const rest = Math.round(bobTime.current / Math.PI) * Math.PI;
        bobTime.current = THREE.MathUtils.lerp(bobTime.current, rest, delta * 5);
      }

      bobX = Math.cos(bobTime.current) * 0.05;
      bobY = Math.abs(Math.sin(bobTime.current)) * 0.05;
    } else {
      // В полете плавно возвращаем руку в центр
      const rest = Math.round(bobTime.current / Math.PI) * Math.PI;
      bobTime.current = THREE.MathUtils.lerp(bobTime.current, rest, delta * 5);
      // Небольшой дрейф в полете, чтобы не было совсем статично
      // bobX = Math.sin(Date.now() * 0.001) * 0.01; 
      // bobY = Math.cos(Date.now() * 0.001) * 0.01;
    }

    // 3. Позиционирование
    if (isHand) {
      // Позиция руки (более аутентичная)
      meshRef.current.translateX(0.55 + bobX);
      meshRef.current.translateY(-0.5 + bobY);
      meshRef.current.translateZ(-0.8);

      // Поворот руки (более естественный угол)
      // Рука выходит справа снизу и смотрит немного влево-вверх
      meshRef.current.rotateX(THREE.MathUtils.degToRad(-50));
      meshRef.current.rotateY(THREE.MathUtils.degToRad(25));
      meshRef.current.rotateZ(THREE.MathUtils.degToRad(20));

      // Влияние bobbing
      meshRef.current.rotateZ(bobX * 0.1);
      meshRef.current.rotateX(bobY * 0.1);
    } else if (isItem) {
      // Позиция ПРЕДМЕТА (спрайт)
      meshRef.current.translateX(0.6 + bobX);
      meshRef.current.translateY(-0.4 + bobY);
      meshRef.current.translateZ(-0.7);

      // В Minecraft предметы в руке повернуты на ~45 градусов по Y и немного наклонены
      meshRef.current.rotateY(THREE.MathUtils.degToRad(180)); // Лицевой стороной к камере
      meshRef.current.rotateZ(THREE.MathUtils.degToRad(180));
      meshRef.current.rotateX(THREE.MathUtils.degToRad(-10));

      meshRef.current.rotateX(bobY * 0.5);
      meshRef.current.rotateY(bobX * 0.2);
    } else {
      // Позиция блока (куб)
      meshRef.current.translateX(0.4 + bobX);
      meshRef.current.translateY(-0.6 + bobY);
      meshRef.current.translateZ(-0.7);

      meshRef.current.rotateY(THREE.MathUtils.degToRad(35));
      meshRef.current.rotateX(THREE.MathUtils.degToRad(5));
      meshRef.current.rotateZ(THREE.MathUtils.degToRad(5));

      meshRef.current.rotateX(bobY * 0.5);
      meshRef.current.rotateY(bobX * 0.2);
    }

    // 4. Анимация поедания еды (приоритет выше всех)
    if (isEating && isItem) {
      // Анимация поедания в стиле Minecraft
      // 1. Предмет перемещается в центр экрана ко рту
      const eatTargetX = -0.5; // Центр экрана по X
      const eatTargetY = -0.10; // Уровень рта (чуть ниже центра)
      const eatTargetZ = -0.15; // Очень близко к камере

      // Интерполяция позиции (быстрый вход в анимацию)
      const moveFactor = Math.min(eatingProgress * 15, 1);

      // Базовая позиция предмета (справа снизу)
      const startX = 0.6;
      const startY = -0.4;
      const startZ = -0.7;

      const curX = THREE.MathUtils.lerp(startX, eatTargetX, moveFactor);
      const curY = THREE.MathUtils.lerp(startY, eatTargetY, moveFactor);
      const curZ = THREE.MathUtils.lerp(startZ, eatTargetZ, moveFactor);

      // 2. Интенсивная тряска (shake) вверх-вниз + мелкий шум
      // В майнкрафте тряска очень быстрая и хаотичная
      const shakeFreq = 15;
      const shakeAmp = 0.04;
      const shakeY = Math.sin(eatingProgress * Math.PI * shakeFreq) * shakeAmp;
      const noiseX = (Math.random() - 0.5) * 0.01;
      const noiseY = (Math.random() - 0.5) * 0.01;

      meshRef.current.translateX(curX + noiseX);
      meshRef.current.translateY(curY + shakeY + noiseY);
      meshRef.current.translateZ(curZ);

      // 3. Поворот предмета (лицом к игроку, с наклоном)
      // Не добавляем дополнительные повороты - используем базовую ориентацию предмета
      meshRef.current.rotateY(THREE.MathUtils.degToRad(180));
      meshRef.current.rotateX(THREE.MathUtils.degToRad(-10));
      // Наклон вперед-назад в такт тряске
      meshRef.current.rotateX(THREE.MathUtils.degToRad(shakeY * 100));

      return; // Не применяем другие анимации во время поедания
    }

    // 5. Анимация удара (одиночный)
    const punchDuration = isHand ? 250 : 300;
    const punchProgress = (Date.now() - punchStartTime.current) / punchDuration;

    // 6. Анимация добычи (непрерывная при зажатом ЛКМ)
    if (isMining) {
      // Покачивание при добыче (как в Minecraft) - ~4 удара в секунду
      miningAnimTime.current += delta * 4;
      const miningSwing = Math.sin(miningAnimTime.current * Math.PI);

      if (isHand) {
        meshRef.current.rotateX(-Math.abs(miningSwing) * 0.5);
        meshRef.current.rotateY(-miningSwing * 0.15);
        meshRef.current.translateZ(-Math.abs(miningSwing) * 0.12);
      } else if (isItem) {
        // Анимация удара предметом (палкой) - легкое покачивание
        meshRef.current.rotateX(Math.abs(miningSwing) * 0.4); // Умеренный размах
        meshRef.current.rotateY(-miningSwing * 0.2);
        meshRef.current.translateZ(-Math.abs(miningSwing) * 0.2); // Легкое движение вперед
        meshRef.current.translateY(-Math.abs(miningSwing) * 0.1); // Небольшое движение вниз
      } else {
        // Анимация для блока
        meshRef.current.rotateX(-Math.abs(miningSwing) * 0.6);
        meshRef.current.rotateY(-miningSwing * 0.2);
        meshRef.current.rotateZ(-miningSwing * 0.1);
        meshRef.current.translateZ(-Math.abs(miningSwing) * 0.15);
      }
    } else if (punchProgress >= 0 && punchProgress < 1) {
      // Одиночный удар (только если не добываем)
      const punchValue = Math.sin(punchProgress * Math.PI);

      if (isHand) {
        // Свинг руки
        meshRef.current.rotateX(-punchValue * 0.8);
        meshRef.current.rotateY(-punchValue * 0.4);
        meshRef.current.rotateZ(punchValue * 0.4);
        meshRef.current.translateZ(-punchValue * 0.3);
        meshRef.current.translateY(punchValue * 0.1);
      } else if (isItem) {
        // Одиночный удар палкой (легкий взмах)
        meshRef.current.rotateX(punchValue * 0.6);
        meshRef.current.rotateY(-punchValue * 0.3);
        meshRef.current.translateZ(-punchValue * 0.3); // Умеренное движение вперед
        meshRef.current.translateY(-punchValue * 0.15); // Небольшое движение вниз
      } else {
        // Удар блоком
        meshRef.current.rotateX(-punchValue * 1.0);
        meshRef.current.rotateY(-punchValue * 0.5);
        meshRef.current.rotateZ(-punchValue * 0.5);
        meshRef.current.translateZ(-punchValue * 0.5);
        meshRef.current.translateY(-punchValue * 0.2);
      }
    } else {
      // Сбрасываем анимацию добычи, когда не добываем
      miningAnimTime.current = 0;
    }
  });

  if (!materials) return null;

  let scale = [0.4, 0.4, 0.4];
  if (isHand) {
    scale = [0.25, 0.50, 0.2];
  } else if (isItem) {
    scale = [0.7, 0.7, 0.7]; // Значительно увеличиваем предметы в руке
  }

  return (
    <mesh
      ref={meshRef}
      scale={scale}
      material={materials}
      renderOrder={999}
      castShadow
      receiveShadow
      geometry={isItem ? undefined : sharedBoxGeometry}
    >
      {isItem && <planeGeometry args={[1, 1]} />}
    </mesh>
  );
};

export default HeldItem;

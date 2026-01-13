import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getBlockTextureInfo } from '../../utils/textures';
import { BLOCK_TINTS } from '../../constants/colors';
import { TextureManager } from '../../core/rendering/TextureManager';

const textureManager = TextureManager.getInstance();

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

const HeldItem = ({ selectedBlock, lightLevel = 15, lastPunchTime, isFlying, isMining = false }) => {
  const meshRef = useRef();
  const [materials, setMaterials] = useState(null);
  const lastLightLevel = useRef(lightLevel);
  const isHand = !selectedBlock;
  
  const punchStartTime = useRef(0);
  const miningAnimTime = useRef(0);
  
  useEffect(() => {
      if (lastPunchTime) {
          punchStartTime.current = Date.now();
      }
  }, [lastPunchTime]);

  useEffect(() => {
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
        setMaterials(handMat);
        lastLightLevel.current = -1;
        return;
    }

    const info = getBlockTextureInfo(selectedBlock);
    if (!info) return;

    // Используем TextureManager для загрузки текстур
    const loadTex = async (name) => {
      const tex = await textureManager.getTexture(name);
      if (!tex) return null;
      
      // Создаем материал для HeldItem с учетом уровня света
      const brightness = Math.max(0.3, lightLevel / 15);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.FrontSide,
        depthTest: false,
        depthWrite: false,
        transparent: true
      });
      
      // Применяем яркость через цвет материала
      mat.color.setRGB(brightness, brightness, brightness);
      
      return mat;
    };

    // Загружаем текстуры для всех сторон блока
    const loadMaterials = async () => {
      if (!info) return;

      let materials;
      
      if (info.all) {
        const mat = await loadTex(info.all);
        if (mat) materials = mat;
      } else {
        // Для блоков с разными текстурами используем side
        const sideTex = info.side ? await textureManager.getTexture(info.side) : null;
        if (sideTex) {
          const brightness = Math.max(0.3, lightLevel / 15);
          materials = new THREE.MeshBasicMaterial({
            map: sideTex,
            side: THREE.FrontSide,
            depthTest: false,
            depthWrite: false,
            transparent: true
          });
          materials.color.setRGB(brightness, brightness, brightness);
        }
      }

      if (materials) {
        setMaterials(materials);
      }
    };

    loadMaterials();
  }, [selectedBlock, isHand, lightLevel]);

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
    } else {
        // Позиция блока
        meshRef.current.translateX(0.4 + bobX);      
        meshRef.current.translateY(-0.6 + bobY);     
        meshRef.current.translateZ(-0.7);            
        
        meshRef.current.rotateY(THREE.MathUtils.degToRad(35));
        meshRef.current.rotateX(THREE.MathUtils.degToRad(5));
        meshRef.current.rotateZ(THREE.MathUtils.degToRad(5));

        meshRef.current.rotateX(bobY * 0.5);
        meshRef.current.rotateY(bobX * 0.2);
    }

    // 4. Анимация удара (одиночный)
    const punchDuration = isHand ? 250 : 300;
    const punchProgress = (Date.now() - punchStartTime.current) / punchDuration;
    
    // 5. Анимация добычи (непрерывная при зажатом ЛКМ)
    if (isMining) {
        // Покачивание при добыче (как в Minecraft) - ~4 удара в секунду
        miningAnimTime.current += delta * 4;
        const miningSwing = Math.sin(miningAnimTime.current * Math.PI);
        
        if (isHand) {
            meshRef.current.rotateX(-Math.abs(miningSwing) * 0.5);
            meshRef.current.rotateY(-miningSwing * 0.15);
            meshRef.current.translateZ(-Math.abs(miningSwing) * 0.12);
        } else {
            meshRef.current.rotateX(-Math.abs(miningSwing) * 0.6);
            meshRef.current.rotateY(-miningSwing * 0.2);
            meshRef.current.rotateZ(-miningSwing * 0.1);
            meshRef.current.translateZ(-Math.abs(miningSwing) * 0.15);
        }
    } else if (punchProgress >= 0 && punchProgress < 1) {
        // Одиночный удар (только если не добываем)
        const punchValue = Math.sin(punchProgress * Math.PI);
        
        if (isHand) {
             // Свинг руки: поворот вниз и немного в центр
             meshRef.current.rotateX(-punchValue * 0.8);
             meshRef.current.rotateY(-punchValue * 0.4);
             meshRef.current.rotateZ(punchValue * 0.4);
             
             // Смещение вперед
             meshRef.current.translateZ(-punchValue * 0.3);
             meshRef.current.translateY(punchValue * 0.1);
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

  const scale = isHand ? [0.25, 0.50, 0.2] : [0.4, 0.4, 0.4];

  return (
    <mesh 
      ref={meshRef} 
      scale={scale} 
      material={materials}
      renderOrder={999} 
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
};

export default HeldItem;

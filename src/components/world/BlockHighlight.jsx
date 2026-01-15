// Компонент выделения блока (как в Minecraft)
import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { REACH_DISTANCE, CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants/world';
import { BLOCK_TYPES } from '../../constants/blocks';
import { BlockRegistry } from '../../core/blocks/BlockRegistry';

const BlockHighlight = ({ chunks }) => {
  const { camera, scene } = useThree();
  const groupRef = useRef(null);
  const raycaster = useRef(new THREE.Raycaster());
  // Reuse Vector2 to avoid allocation every frame
  const screenCenter = useRef(new THREE.Vector2(0, 0));
  
  // Кэш для геометрий разных размеров
  const geometryCache = useRef({});

  // Функция для получения или создания геометрии выделения
  const getHighlightGeometry = (boundingBox) => {
    if (!boundingBox) {
      // Стандартный блок
      if (!geometryCache.current.default) {
        geometryCache.current.default = new THREE.BoxGeometry(1.005, 1.005, 1.005);
      }
      return geometryCache.current.default;
    }
    
    // Кастомный bounding box
    const key = `${boundingBox.minX}_${boundingBox.maxX}_${boundingBox.minY}_${boundingBox.maxY}_${boundingBox.minZ}_${boundingBox.maxZ}`;
    if (!geometryCache.current[key]) {
      const width = (boundingBox.maxX - boundingBox.minX) + 0.005;
      const height = (boundingBox.maxY - boundingBox.minY) + 0.005;
      const depth = (boundingBox.maxZ - boundingBox.minZ) + 0.005;
      geometryCache.current[key] = new THREE.BoxGeometry(width, height, depth);
    }
    return geometryCache.current[key];
  };

  // Геометрия выделения по умолчанию (для блоков без кастомного bounding box)
  const defaultGeometry = useMemo(() => {
    return new THREE.BoxGeometry(1.005, 1.005, 1.005);
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;

    raycaster.current.far = REACH_DISTANCE;
    raycaster.current.setFromCamera(screenCenter.current, camera);

    // Ищем пересечения
    const intersects = raycaster.current.intersectObjects(scene.children, true);

    let found = false;
    
    for (const hit of intersects) {
      if (hit.distance > REACH_DISTANCE) continue;
      
      // Проверяем, что это блок (по имени меша или инстанса)
      const isBlock = hit.object.name === 'block-mesh' || hit.object.isInstancedMesh;
      if (!isBlock) continue;
      
      // Игнорируем жидкости (вода не выделяется и сквозь нее проходит луч)
      if (hit.object.userData?.isLiquid) continue;

      const point = hit.point;
      const normal = hit.face?.normal;
      if (!normal) continue;

      // Вычисляем координаты блока (уходим "внутрь" блока от точки касания)
      const blockX = Math.floor(point.x - normal.x * 0.5);
      const blockY = Math.floor(point.y - normal.y * 0.5);
      const blockZ = Math.floor(point.z - normal.z * 0.5);

      // Проверяем наличие блока в данных чанков
      const cx = Math.floor(blockX / CHUNK_SIZE);
      const cz = Math.floor(blockZ / CHUNK_SIZE);
      const key = `${cx},${cz}`;
      
      if (chunks && chunks[key]) {
        const lx = ((blockX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((blockZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        
        // Используем getBlock из класса Chunk
        const blockId = chunks[key].getBlock(lx, blockY, lz);
           
        if (blockId && blockId !== BLOCK_TYPES.AIR) {
          // Получаем данные блока для определения bounding box
          const blockData = BlockRegistry.get(blockId);
          let boundingBox = blockData?.boundingBox;
          
          // Для блоков с metadata (факелы на стенах) корректируем bounding box
          if (boundingBox && blockData?.renderType === 'torch') {
            const meta = chunks[key].getMetadata ? chunks[key].getMetadata(lx, blockY, lz) : 0;
            if (meta > 0) {
              // Настенный факел - смещаем и наклоняем bounding box
              const wallBB = { ...boundingBox };
              wallBB.minY = 0.2;
              wallBB.maxY = 0.8;
              
              if (meta === 1) { // East wall (X+) - наклонен к X-
                wallBB.minX = 0.5; wallBB.maxX = 1.0;
                wallBB.minZ = 0.35; wallBB.maxZ = 0.65;
              } else if (meta === 2) { // West wall (X-) - наклонен к X+
                wallBB.minX = 0.0; wallBB.maxX = 0.5;
                wallBB.minZ = 0.35; wallBB.maxZ = 0.65;
              } else if (meta === 3) { // South wall (Z+) - наклонен к Z-
                wallBB.minZ = 0.5; wallBB.maxZ = 1.0;
                wallBB.minX = 0.35; wallBB.maxX = 0.65;
              } else if (meta === 4) { // North wall (Z-) - наклонен к Z+
                wallBB.minZ = 0.0; wallBB.maxZ = 0.5;
                wallBB.minX = 0.35; wallBB.maxX = 0.65;
              }
              boundingBox = wallBB;
            }
          }
          
          // Обновляем геометрию и позицию
          const geometry = getHighlightGeometry(boundingBox);
          const edgesGeom = groupRef.current.children[0];
          if (edgesGeom && edgesGeom.geometry) {
            edgesGeom.geometry.dispose();
            edgesGeom.geometry = new THREE.EdgesGeometry(geometry);
          }
          
          if (boundingBox) {
            // Позиция с учётом смещения bounding box
            const centerX = blockX + (boundingBox.minX + boundingBox.maxX) / 2;
            const centerY = blockY + (boundingBox.minY + boundingBox.maxY) / 2;
            const centerZ = blockZ + (boundingBox.minZ + boundingBox.maxZ) / 2;
            groupRef.current.position.set(centerX, centerY, centerZ);
          } else {
            // Стандартный блок - центр в центре блока
            groupRef.current.position.set(blockX + 0.5, blockY + 0.5, blockZ + 0.5);
          }
          
          groupRef.current.visible = true;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      groupRef.current.visible = false;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <lineSegments>
        <edgesGeometry args={[defaultGeometry]} />
        <lineBasicMaterial color={0x000000} toneMapped={false} linewidth={2} />
      </lineSegments>
    </group>
  );
};

export default BlockHighlight;
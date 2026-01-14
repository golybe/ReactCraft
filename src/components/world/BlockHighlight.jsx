// Компонент выделения блока (как в Minecraft)
import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { REACH_DISTANCE, CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants/world';
import { BLOCK_TYPES } from '../../constants/blocks';

const BlockHighlight = ({ chunks }) => {
  const { camera, scene } = useThree();
  const groupRef = useRef(null);
  const raycaster = useRef(new THREE.Raycaster());
  // Reuse Vector2 to avoid allocation every frame
  const screenCenter = useRef(new THREE.Vector2(0, 0));

  // Геометрия выделения (чуть больше блока, чтобы не мерцало)
  const geometry = useMemo(() => {
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
             // Блок найден и он не воздух
             groupRef.current.position.set(blockX + 0.5, blockY + 0.5, blockZ + 0.5);
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
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color={0x000000} toneMapped={false} linewidth={2} />
      </lineSegments>
    </group>
  );
};

export default BlockHighlight;
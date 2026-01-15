import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getBlockTextureInfo } from '../../utils/textures';
import { TextureManager } from '../../core/rendering/TextureManager';

const textureManager = TextureManager.getInstance();

const FallingBlockMesh = ({ entity }) => {
  const meshRef = useRef();

  const material = useMemo(() => {
    const info = getBlockTextureInfo(entity.blockType);
    const texName = info?.all || info?.side || info?.top || 'stone';
    const map = textureManager.getTextureSync(texName);
    
    return new THREE.MeshBasicMaterial({
      map: map,
      color: 0xffffff,
      transparent: true,
      opacity: 1.0
    });
  }, [entity.blockType]);

  useFrame(() => {
    if (!meshRef.current) return;
    // Устанавливаем позицию меша из позиции сущности
    // Сущность центрирована по X/Z, а Y - это низ блока
    meshRef.current.position.set(
      entity.position.x,
      entity.position.y + 0.5,
      entity.position.z
    );
  });

  return (
    <mesh ref={meshRef} material={material}>
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
};

export const FallingBlocksRenderer = ({ entityManager }) => {
  if (!entityManager) return null;

  // Получаем все падающие блоки
  const fallingBlocks = entityManager.getAll().filter(entity =>
    entity.isFallingBlock === true
  );

  return (
    <group name="falling-blocks">
      {fallingBlocks.map(block => (
        <FallingBlockMesh key={block.id} entity={block} />
      ))}
    </group>
  );
};

export default FallingBlocksRenderer;

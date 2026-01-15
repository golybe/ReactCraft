/**
 * BlockInteraction - компонент для raycasting и взаимодействия с блоками
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { REACH_DISTANCE } from '../../constants/world';
import { BlockRegistry } from '../../core/blocks/BlockRegistry';

export const BlockInteraction = ({
  chunks,
  onBlockDestroy,
  onBlockPlace,
  selectedBlock,
  onPunch,
  onMouseStateChange,
  onStopMining,
  onLookingAtBlock,
  isMouseDown,
  isDead,
  onStartEating,
  onStopEating
}) => {
  const { camera, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const lastLookTarget = useRef(null);

  // Используем рефы для пропсов, чтобы не пересоздавать обработчики событий слишком часто
  const propsRef = useRef({
    isDead,
    selectedBlock,
    onPunch,
    onMouseStateChange,
    onStopMining,
    onBlockDestroy,
    onBlockPlace,
    onStartEating,
    onStopEating,
    onLookingAtBlock
  });

  useEffect(() => {
    propsRef.current = {
      isDead,
      selectedBlock,
      onPunch,
      onMouseStateChange,
      onStopMining,
      onBlockDestroy,
      onBlockPlace,
      onStartEating,
      onStopEating,
      onLookingAtBlock
    };
  }, [isDead, selectedBlock, onPunch, onMouseStateChange, onStopMining, onBlockDestroy, onBlockPlace, onStartEating, onStopEating, onLookingAtBlock]);

  useEffect(() => {
    raycaster.current.far = REACH_DISTANCE;
  }, []);

  // Raycast helper function
  const doRaycast = useCallback(() => {
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.current.intersectObjects(scene.children, true);

    for (const hit of intersects) {
      if (hit.distance > REACH_DISTANCE) continue;
      if (hit.object.name !== 'block-mesh' && !hit.object.isInstancedMesh) continue;
      if (hit.object.userData?.isLiquid) continue;

      const point = hit.point;
      const normal = hit.face?.normal;

      if (!normal) continue;

      return {
        breakPos: {
          x: Math.floor(point.x - normal.x * 0.05),
          y: Math.floor(point.y - normal.y * 0.05),
          z: Math.floor(point.z - normal.z * 0.05)
        },
        placePos: {
          x: Math.floor(point.x + normal.x * 0.05),
          y: Math.floor(point.y + normal.y * 0.05),
          z: Math.floor(point.z + normal.z * 0.05)
        },
        faceNormal: { x: normal.x, y: normal.y, z: normal.z }
      };
    }
    return null;
  }, [camera, scene]);

  // Continuous raycast while mining (useFrame)
  useFrame(() => {
    // Блокируем взаимодействие если игрок мертв
    if (propsRef.current.isDead || !isMouseDown) {
      lastLookTarget.current = null;
      return;
    }

    if (document.pointerLockElement !== document.body) return;

    const target = doRaycast();

    if (target) {
      const { breakPos } = target;
      const key = `${breakPos.x},${breakPos.y},${breakPos.z}`;

      // If looking at a different block, notify
      if (lastLookTarget.current !== key) {
        lastLookTarget.current = key;
        if (propsRef.current.onLookingAtBlock) {
          propsRef.current.onLookingAtBlock(breakPos.x, breakPos.y, breakPos.z);
        }
      }
    } else {
      // Looking at nothing
      if (lastLookTarget.current !== null) {
        lastLookTarget.current = null;
        if (propsRef.current.onStopMining) propsRef.current.onStopMining();
      }
    }
  });

  useEffect(() => {
    const handleMouseDown = (e) => {
      const { isDead, onPunch, onMouseStateChange, selectedBlock, onStartEating, onBlockDestroy } = propsRef.current;
      
      // Блокируем взаимодействие если игрок мертв
      if (isDead || document.pointerLockElement !== document.body) return;

      if (e.button === 0) {
        if (onPunch) onPunch();
        if (onMouseStateChange) onMouseStateChange(true);

        // Initial raycast on mousedown
        const target = doRaycast();
        if (target) {
          onBlockDestroy(target.breakPos.x, target.breakPos.y, target.breakPos.z);
        }
      } else if (e.button === 2) {
        // Проверяем, является ли выбранный предмет едой
        const block = BlockRegistry.get(selectedBlock);
        if (block && block.isFood) {
          // Начинаем поедание еды (требуется удержание ПКМ)
          if (onStartEating) {
            onStartEating(selectedBlock, block.healAmount || 0);
          }
        } else {
          // Размещаем блок
          const target = doRaycast();
          if (target) {
            const { onBlockPlace } = propsRef.current;
            // Pass positions and face normal for directional blocks (torches)
            onBlockPlace(target.placePos.x, target.placePos.y, target.placePos.z, target.breakPos, target.faceNormal);
          }
        }
      }
    };

    const handleMouseUp = (e) => {
      const { onMouseStateChange, onStopMining, onStopEating } = propsRef.current;
      
      if (e.button === 0) {
        if (onMouseStateChange) onMouseStateChange(false);
        if (onStopMining) onStopMining();
        lastLookTarget.current = null;
      } else if (e.button === 2) {
        // Отпустили ПКМ - прекращаем поедание
        if (onStopEating) {
          onStopEating();
        }
      }
    };

    const handleContextMenu = (e) => {
      if (document.pointerLockElement === document.body) {
        e.preventDefault();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [camera, scene, doRaycast]); // Теперь только стабильные зависимости

  return null;
};

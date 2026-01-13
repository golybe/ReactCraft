/**
 * BlockInteraction - компонент для raycasting и взаимодействия с блоками
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { REACH_DISTANCE } from '../../constants/world';

export const BlockInteraction = ({ 
  chunks, 
  onBlockDestroy, 
  onBlockPlace, 
  selectedBlock, 
  onPunch,
  onMouseStateChange,
  onStopMining,
  onLookingAtBlock,
  isMouseDown
}) => {
  const { camera, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const lastLookTarget = useRef(null);

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
          x: Math.floor(point.x - normal.x * 0.5),
          y: Math.floor(point.y - normal.y * 0.5),
          z: Math.floor(point.z - normal.z * 0.5)
        },
        placePos: {
          x: Math.floor(point.x + normal.x * 0.5),
          y: Math.floor(point.y + normal.y * 0.5),
          z: Math.floor(point.z + normal.z * 0.5)
        }
      };
    }
    return null;
  }, [camera, scene]);

  // Continuous raycast while mining (useFrame)
  useFrame(() => {
    if (!isMouseDown) {
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
        if (onLookingAtBlock) {
          onLookingAtBlock(breakPos.x, breakPos.y, breakPos.z);
        }
      }
    } else {
      // Looking at nothing
      if (lastLookTarget.current !== null) {
        lastLookTarget.current = null;
        if (onStopMining) onStopMining();
      }
    }
  });

  useEffect(() => {
    const handleMouseDown = (e) => {
      if (document.pointerLockElement !== document.body) return;

      if (e.button === 0) {
        if (onPunch) onPunch();
        if (onMouseStateChange) onMouseStateChange(true);
        
        // Initial raycast on mousedown
        const target = doRaycast();
        if (target) {
          onBlockDestroy(target.breakPos.x, target.breakPos.y, target.breakPos.z);
        }
      } else if (e.button === 2) {
        const target = doRaycast();
        if (target) {
          onBlockPlace(target.placePos.x, target.placePos.y, target.placePos.z);
        }
      }
    };

    const handleMouseUp = (e) => {
      if (e.button === 0) {
        if (onMouseStateChange) onMouseStateChange(false);
        if (onStopMining) onStopMining();
        lastLookTarget.current = null;
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
  }, [camera, scene, onBlockDestroy, onBlockPlace, onMouseStateChange, onStopMining, doRaycast, onPunch]);

  return null;
};

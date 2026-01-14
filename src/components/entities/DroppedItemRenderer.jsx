/**
 * Dropped Item Component - Simple Minecraft-style physics
 */
import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BlockRegistry } from '../../core/blocks/BlockRegistry';
import { getBlockTextureInfo } from '../../utils/textures';
import { TextureManager } from '../../core/rendering/TextureManager';

const textureManager = TextureManager.getInstance();

// Physics constants
const ITEM_SIZE = 0.25;
const GRAVITY = 20;
const FRICTION = 0.8;
const BOUNCE = 0.4; // Чуть более прыгучие
const PICKUP_RADIUS = 1.5;
const MAGNET_RADIUS = 2.5;
const MAGNET_SPEED = 6;
const DESPAWN_TIME = 300;

const DroppedItem = ({ 
  id,
  blockType, 
  count = 1,
  initialPosition, 
  initialVelocity = { x: 0, y: 0, z: 0 },
  playerPos,
  onPickup,
  getBlock,
  noPickupTime = 0
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
    rot: Math.random() * Math.PI * 2
  });
  
  const block = useMemo(() => BlockRegistry.get(blockType), [blockType]);
  
  const isItem = block?.isPlaceable === false;
  
  const material = useMemo(() => {
    if (!block) return new THREE.MeshBasicMaterial({ color: 0xff00ff });
    const textureInfo = getBlockTextureInfo(blockType);
    const textureName = textureInfo?.all || textureInfo?.side || textureInfo?.top;
    const texture = textureName ? textureManager.getTextureSync(textureName) : null;
    
    if (isItem) {
      return new THREE.SpriteMaterial({
        map: texture,
        color: 0xffffff,
        transparent: true
      });
    }

    return new THREE.MeshBasicMaterial({
      map: texture,
      color: texture ? 0xffffff : block.color
    });
  }, [blockType, block, isItem]);

  // Материал для тени (круглая тень как в Minecraft)
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
    const id = getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    return id && id !== 0 && id !== 7;
  };

  // Исправленный поиск земли - ищем строго ПОД предметом
  const getGroundY = (x, z, itemBottomY) => {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    // Начинаем поиск с блока, в котором находятся "ноги" предмета
    const startY = Math.floor(itemBottomY);
    
    for (let y = startY; y >= 0; y--) {
      if (isSolid(bx, y, bz)) {
        return y + 1; // Верхняя грань блока
      }
    }
    return -100;
  };

  useFrame((_, delta) => {
    if (!meshRef.current || isPickedUp) return;
    
    const dt = Math.min(delta, 0.05);
    const s = state.current;
    
    s.time += dt;
    
    if (s.time > DESPAWN_TIME) {
      if (onPickup) onPickup(id, 0);
      return;
    }
    
    const canPickup = s.time > noPickupTime;
    
    // Distances
    const dx = playerPos.x - s.x;
    const dy = (playerPos.y + 0.5) - s.y;
    const dz = playerPos.z - s.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Pickup
    if (canPickup && dist < PICKUP_RADIUS) {
      setIsPickedUp(true);
      if (onPickup) onPickup(id, count, blockType);
      return;
    }
    
    // Magnet
    let isMagnetized = false;
    if (canPickup && dist < MAGNET_RADIUS) {
      isMagnetized = true;
      const strength = MAGNET_SPEED * (1 - dist / MAGNET_RADIUS);
      s.vx += (dx / dist) * strength * dt;
      s.vy += (dy / dist) * strength * dt;
      s.vz += (dz / dist) * strength * dt;
      // Damping при магнетизме, чтобы не улетали в космос
      s.vx *= 0.9;
      s.vy *= 0.9;
      s.vz *= 0.9;
    } else {
      // Gravity
      s.vy -= GRAVITY * dt;
      if (s.vy < -20) s.vy = -20;
    }
    
    // Predict next position
    let newX = s.x + s.vx * dt;
    let newY = s.y + s.vy * dt;
    let newZ = s.z + s.vz * dt;
    
    // === COLLISION DETECTION ===
    const itemRadius = ITEM_SIZE / 2;
    
    // 1. Ground Collision
    // Ищем землю под предполагаемой новой позицией
    const groundY = getGroundY(s.x, s.z, s.y - itemRadius + 0.1); 
    const floorY = groundY + itemRadius;
    
    if (newY < floorY) {
      // Hit ground
      newY = floorY;
      
      if (s.vy < -2) {
        // Bounce
        s.vy = -s.vy * BOUNCE;
        s.vx *= FRICTION;
        s.vz *= FRICTION;
      } else {
        // Settle
        s.vy = 0;
        s.onGround = true;
        s.vx *= 0.8; // Strong friction on ground
        s.vz *= 0.8;
        if (Math.abs(s.vx) < 0.05) s.vx = 0;
        if (Math.abs(s.vz) < 0.05) s.vz = 0;
      }
    } else {
      s.onGround = false;
    }
    
    // 2. Wall Collision (X)
    if (isSolid(newX + (s.vx > 0 ? itemRadius : -itemRadius), s.y, s.z)) {
      newX = s.x;
      s.vx = -s.vx * 0.5; // Отскок от стены
    }
    
    // 3. Wall Collision (Z)
    if (isSolid(newX, s.y, newZ + (s.vz > 0 ? itemRadius : -itemRadius))) {
      newZ = s.z;
      s.vz = -s.vz * 0.5; // Отскок от стены
    }
    
    // Update State
    s.x = newX;
    s.y = newY;
    s.z = newZ;
    
    // Render
    let displayY = s.y;
    // Анимация парения только когда лежит спокойно
    if (s.onGround && !isMagnetized && Math.abs(s.vx) < 0.1 && Math.abs(s.vz) < 0.1) {
      displayY += Math.sin(s.time * 2.5) * 0.05;
    }
    
    meshRef.current.position.set(s.x, displayY, s.z);
    
    // Вращаем только если это блок. Спрайты всегда смотрят на камеру.
    if (!isItem) {
      const rotSpeed = s.onGround ? 1 : 3;
      s.rot += dt * rotSpeed;
      meshRef.current.rotation.y = s.rot;
    }

    // Обновляем позицию тени (круглая тень на земле)
    if (shadowRef.current) {
      const shadowY = groundY + 0.01; // Немного выше земли, чтобы не зарываться
      shadowRef.current.position.set(s.x, shadowY, s.z);
      
      // Затухание тени в зависимости от высоты предмета над землей
      const distanceFromGround = s.y - groundY;
      const shadowOpacity = Math.max(0, 0.3 - distanceFromGround * 0.1);
      shadowRef.current.material.opacity = shadowOpacity;
    }
  });

  if (isPickedUp || !block) return null;

  if (isItem) {
    return (
      <group>
        {/* Круглая тень на земле */}
        <mesh
          ref={shadowRef}
          position={[initialPosition.x, initialPosition.y - 0.1, initialPosition.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={shadowMaterial}
          renderOrder={-1}
        >
          <circleGeometry args={[ITEM_SIZE * 0.8, 16]} />
        </mesh>
        
        {/* Спрайт предмета */}
        <sprite
          ref={meshRef}
          position={[initialPosition.x, initialPosition.y, initialPosition.z]}
          material={material}
          scale={[ITEM_SIZE * 1.8, ITEM_SIZE * 1.8, 1]}
        />
      </group>
    );
  }

  return (
    <group>
      {/* Круглая тень на земле */}
      <mesh
        ref={shadowRef}
        position={[initialPosition.x, initialPosition.y - 0.1, initialPosition.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadowMaterial}
        renderOrder={-1}
      >
        <circleGeometry args={[ITEM_SIZE * 0.8, 16]} />
      </mesh>
      
      {/* Блок */}
      <mesh
        ref={meshRef}
        position={[initialPosition.x, initialPosition.y, initialPosition.z]}
        material={material}
      >
        <boxGeometry args={[ITEM_SIZE, ITEM_SIZE, ITEM_SIZE]} />
      </mesh>
    </group>
  );
};

export const DroppedItemsManager = ({ 
  items, 
  playerPos, 
  onPickup, 
  getBlock 
}) => {
  return (
    <group>
      {items.map(item => (
        <DroppedItem
          key={item.id}
          id={item.id}
          blockType={item.blockType}
          count={item.count}
          initialPosition={item.position}
          initialVelocity={item.velocity}
          playerPos={playerPos}
          onPickup={onPickup}
          getBlock={getBlock}
          noPickupTime={item.noPickupTime || 0}
        />
      ))}
    </group>
  );
};

export default DroppedItem;

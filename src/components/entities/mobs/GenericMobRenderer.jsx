/**
 * GenericMobRenderer - рендерер для мобов без кастомной модели
 * 
 * Отображает моба как простой цветной бокс.
 * Используется как fallback для незарегистрированных мобов.
 */
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MobRegistry } from '../../../core/entities/MobRegistry';

/**
 * Простой рендерер моба (цветной бокс)
 */
const GenericMobRenderer = ({ mob }) => {
  const meshRef = useRef();

  // Получаем цвет для моба
  const color = useMemo(
    () => MobRegistry.getDefaultColor(mob.mobType),
    [mob.mobType]
  );

  // Материал
  const material = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
      }),
    [color]
  );

  // Материал тени
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

  // Установка layer
  useEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.layers.set(1);
  }, []);

  // Анимация
  useFrame((_, delta) => {
    if (!meshRef.current) return;

    meshRef.current.position.set(
      mob.position.x,
      mob.position.y + mob.height / 2,
      mob.position.z
    );
    meshRef.current.rotation.y = mob.rotation?.yaw || 0;

    // Эффект урона
    if (mob.hurtAnimation > 0) {
      material.opacity = Math.sin(mob.hurtAnimation * 20) > 0 ? 1 : 0.3;
    } else {
      material.opacity = 1;
    }

    // Смерть
    if (mob.isDead) {
      meshRef.current.rotation.x = Math.PI / 2;
      material.opacity = Math.max(0, material.opacity - delta * 0.5);
    }
  });

  // Cleanup
  useEffect(() => {
    return () => {
      material.dispose();
      shadowMaterial.dispose();
    };
  }, [material, shadowMaterial]);

  if (mob.isDead && mob._deathTimer > 1.5) return null;

  return (
    <group>
      {/* Тень */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[mob.position.x, mob.position.y + 0.01, mob.position.z]}
        material={shadowMaterial}
      >
        <circleGeometry args={[mob.width / 2, 16]} />
      </mesh>

      {/* Моб */}
      <mesh ref={meshRef} material={material}>
        <boxGeometry args={[mob.width, mob.height, mob.width]} />
      </mesh>
    </group>
  );
};

export default GenericMobRenderer;

/**
 * MobRenderer - компонент для рендеринга мобов
 * Рендерит моба как простой box или sprite с анимациями
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MobState } from '../../core/entities/Mob';

// Цвета для разных типов мобов (временно, пока нет текстур)
const MOB_COLORS = {
  zombie: 0x4a7c4a,    // Зелёный
  skeleton: 0xd4d4d4,  // Серый
  spider: 0x3d3d3d,    // Тёмно-серый
  creeper: 0x2d8a2d,   // Ярко-зелёный
  pig: 0xf5b6b0,       // Розовый
  cow: 0x8b4513,       // Коричневый
  sheep: 0xf5f5f5,     // Белый
  chicken: 0xffffff    // Белый
};

/**
 * Рендеринг одного моба
 */
const MobMesh = ({ mob }) => {
  const meshRef = useRef();
  const shadowRef = useRef();

  // Материал моба
  const material = useMemo(() => {
    const color = MOB_COLORS[mob.mobType] || 0xff00ff;
    return new THREE.MeshLambertMaterial({
      color: color,
      transparent: true,
      opacity: 1.0
    });
  }, [mob.mobType]);

  // Материал тени
  const shadowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide
    });
  }, []);

  // Обновление позиции и анимации
  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Позиция
    meshRef.current.position.set(
      mob.position.x,
      mob.position.y + mob.height / 2,
      mob.position.z
    );

    // Поворот к направлению движения
    meshRef.current.rotation.y = mob.rotation.yaw;

    // Анимация получения урона (мигание)
    if (mob.hurtAnimation > 0) {
      material.opacity = Math.sin(mob.hurtAnimation * 20) > 0 ? 1 : 0.3;
      material.color.setHex(0xff0000);
    } else {
      material.opacity = 1;
      material.color.setHex(MOB_COLORS[mob.mobType] || 0xff00ff);
    }

    // Анимация ходьбы (покачивание)
    if (mob.walkAnimation > 0) {
      meshRef.current.rotation.z = Math.sin(mob.walkAnimation * 4) * 0.1;
    } else {
      meshRef.current.rotation.z = 0;
    }

    // Анимация смерти
    if (mob.isDead) {
      meshRef.current.rotation.x = Math.PI / 2; // Падает на бок
      material.opacity = Math.max(0, material.opacity - delta * 0.5);
    }

    // Тень
    if (shadowRef.current) {
      shadowRef.current.position.set(
        mob.position.x,
        mob.position.y + 0.01,
        mob.position.z
      );
    }
  });

  // Не рендерим полностью мёртвых мобов
  if (mob.isDead && mob._deathTimer > 1.5) {
    return null;
  }

  return (
    <group>
      {/* Тень */}
      <mesh
        ref={shadowRef}
        rotation={[-Math.PI / 2, 0, 0]}
        material={shadowMaterial}
        renderOrder={-1}
      >
        <circleGeometry args={[mob.width * 0.8, 16]} />
      </mesh>

      {/* Тело моба */}
      <mesh
        ref={meshRef}
        material={material}
      >
        <boxGeometry args={[mob.width, mob.height, mob.width * 0.5]} />
      </mesh>
    </group>
  );
};

/**
 * Менеджер рендеринга всех мобов
 */
export const MobsRenderer = ({ entityManager }) => {
  if (!entityManager) return null;

  // Получаем всех мобов из EntityManager
  // (В будущем фильтровать по классу Mob)
  const mobs = entityManager.getAll().filter(entity =>
    entity.mobType !== undefined
  );

  return (
    <group name="mobs">
      {mobs.map(mob => (
        <MobMesh key={mob.id} mob={mob} />
      ))}
    </group>
  );
};

/**
 * Компонент для рендеринга одного моба (для отладки)
 */
export const SingleMobRenderer = ({ mob }) => {
  if (!mob) return null;
  return <MobMesh mob={mob} />;
};

export default MobsRenderer;

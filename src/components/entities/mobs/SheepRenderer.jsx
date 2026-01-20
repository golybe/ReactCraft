/**
 * SheepRenderer - React компонент для рендеринга овцы
 * 
 * Использует SheepModel для геометрии и материалов.
 * Отвечает только за отображение, логика модели в SheepModel.
 */
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { MobRegistry } from '../../../core/entities/MobRegistry';

/**
 * Компонент рендеринга овцы
 */
const SheepRenderer = ({ mob }) => {
  const groupRef = useRef();
  const headRef = useRef(); // Группа для головы (анимация еды)
  const legFLRef = useRef();
  const legFRRef = useRef();
  const legBLRef = useRef();
  const legBRRef = useRef();
  
  // Плавный угол наклона головы
  const headPitchRef = useRef(0);
  const headYawRef = useRef(0);

  // Получаем модель овцы (singleton)
  const model = useMemo(() => MobRegistry.getModel('sheep'), []);
  
  // Получаем конфигурацию рендера
  const config = useMemo(() => model?.getRenderConfig(), [model]);

  // Установка layer для освещения
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.traverse((o) => o.layers.set(1));
  }, []);

  // Анимация
  useFrame((_, delta) => {
    if (!groupRef.current || !model) return;

    // Позиция и поворот
    groupRef.current.position.set(mob.position.x, mob.position.y, mob.position.z);
    groupRef.current.rotation.y = mob.rotation?.yaw || 0;

    // Анимация модели (ноги)
    model.animate(mob, delta, {
      legFL: legFLRef.current,
      legFR: legFRRef.current,
      legBL: legBLRef.current,
      legBR: legBRRef.current,
    });
    
    const normalizeAngle = (angle) => {
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;
      return angle;
    };

    // Анимация головы
    if (headRef.current) {
      const targetYaw = mob.rotation?.headYaw || 0;
      const lookPitch = mob.rotation?.headPitch || 0;
      const eatPitch = mob.isEating ? (Math.PI * 0.45 + (mob.headShake || 0)) : null;
      const targetPitch = eatPitch !== null ? eatPitch : lookPitch;

      const yawAlpha = 1 - Math.exp(-10 * delta);
      const pitchAlpha = 1 - Math.exp(-12 * delta);

      const yawDiff = normalizeAngle(targetYaw - headYawRef.current);
      headYawRef.current = normalizeAngle(headYawRef.current + yawDiff * yawAlpha);
      headPitchRef.current += (targetPitch - headPitchRef.current) * pitchAlpha;

      headRef.current.rotation.y = headYawRef.current;
      headRef.current.rotation.x = headPitchRef.current;
    }

    // Смерть
    if (mob.isDead) {
      groupRef.current.rotation.z = Math.PI / 2;
    }
  });

  // Cleanup
  useEffect(() => {
    return () => {
      // Модель не диспозим, т.к. она singleton
    };
  }, []);

  if (!model || !config) return null;
  if (mob.isDead && mob._deathTimer > 1.5) return null;

  const { geometries, materials, positions } = config;

  return (
    <group ref={groupRef}>
      {/* Тень */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        material={materials.shadow}
      >
        <circleGeometry args={[0.4, 16]} />
      </mesh>

      {/* Тело (кожа) */}
      <mesh
        geometry={geometries.body}
        material={materials.skin}
        position={[0, positions.body.y, positions.body.z]}
        rotation={[Math.PI / 2, 0, 0]}
      />

      {/* Тело (шерсть) */}
      <mesh
        geometry={geometries.woolBody}
        material={materials.wool}
        position={[0, positions.body.y, positions.body.z]}
        rotation={[Math.PI / 2, 0, 0]}
      />

      {/* Голова (группа для анимации еды) */}
      <group 
        ref={headRef} 
        position={[0, positions.head.y, positions.head.z]}
      >
        {/* Точка вращения — задняя часть головы */}
        <group position={[0, 0, -positions.head.z * 0.3]}>
          {/* Голова (кожа) */}
          <mesh
            geometry={geometries.head}
            material={materials.skin}
            position={[0, 0, positions.head.z * 0.3]}
          />

          {/* Голова (шерсть) - сдвинута назад */}
          <mesh
            geometry={geometries.woolHead}
            material={!mob.isSheared ? materials.wool : null}
            position={[0, 0, positions.woolHead.z - positions.head.z + positions.head.z * 0.3]}
            visible={!mob.isSheared}
          />
        </group>
      </group>

      {/* Передняя левая нога */}
      <group ref={legFLRef} position={[positions.legFL.x, positions.legFL.y, positions.legFL.z]}>
        <mesh
          geometry={geometries.leg}
          material={materials.skin}
          position={[0, positions.legOffset, 0]}
        />
      </group>

      {/* Передняя правая нога */}
      <group ref={legFRRef} position={[positions.legFR.x, positions.legFR.y, positions.legFR.z]}>
        <mesh
          geometry={geometries.leg}
          material={materials.skin}
          position={[0, positions.legOffset, 0]}
        />
      </group>

      {/* Задняя левая нога */}
      <group ref={legBLRef} position={[positions.legBL.x, positions.legBL.y, positions.legBL.z]}>
        <mesh
          geometry={geometries.leg}
          material={materials.skin}
          position={[0, positions.legOffset, 0]}
        />
      </group>

      {/* Задняя правая нога */}
      <group ref={legBRRef} position={[positions.legBR.x, positions.legBR.y, positions.legBR.z]}>
        <mesh
          geometry={geometries.leg}
          material={materials.skin}
          position={[0, positions.legOffset, 0]}
        />
      </group>
    </group>
  );
};

export default SheepRenderer;

/**
 * MobRenderer - менеджер рендеринга всех мобов
 * 
 * Использует MobRegistry для получения рендереров конкретных типов мобов.
 * Автоматически выбирает правильный рендерер на основе mobType.
 * 
 * Структура (аналог Minecraft):
 * - MobRegistry: регистрация мобов и их моделей
 * - MobModel: базовый класс модели (геометрия, материалы, анимация)
 * - SheepModel, CowModel, etc.: конкретные модели
 * - SheepRenderer, etc.: React компоненты для рендеринга
 */
import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

// Рендереры мобов
import SheepRenderer from './mobs/SheepRenderer';
import GenericMobRenderer from './mobs/GenericMobRenderer';

// Реестр мобов
import { MobRegistry } from '../../core/entities/MobRegistry';

/**
 * Маппинг типов мобов на их рендереры
 * Добавляйте новых мобов сюда
 */
const MOB_RENDERERS = {
  sheep: SheepRenderer,
  // cow: CowRenderer,
  // pig: PigRenderer,
  // chicken: ChickenRenderer,
  // zombie: ZombieRenderer,
  // skeleton: SkeletonRenderer,
  // creeper: CreeperRenderer,
  // spider: SpiderRenderer,
};

/**
 * Компонент выбора рендерера для моба
 */
const MobMesh = ({ mob }) => {
  // Получаем рендерер для типа моба
  const Renderer = MOB_RENDERERS[mob.mobType] || GenericMobRenderer;
  return <Renderer mob={mob} />;
};

/**
 * Менеджер рендеринга всех мобов
 * 
 * Добавляет свет на отдельном layer (1), чтобы не влиять на мир.
 * Автоматически обновляет список мобов из entityManager.
 */
export const MobsRenderer = ({ entityManager }) => {
  const [mobs, setMobs] = useState([]);
  const lastCountRef = useRef(0);
  const { camera } = useThree();

  // Камера видит и мир (layer 0), и мобов (layer 1)
  useEffect(() => {
    camera.layers.enable(1);
  }, [camera]);

  // Обновление списка мобов
  useFrame(() => {
    if (!entityManager) return;

    const allMobs = entityManager.getAll().filter((entity) => entity.mobType !== undefined);
    
    // Обновляем только при изменении количества
    if (allMobs.length !== lastCountRef.current) {
      lastCountRef.current = allMobs.length;
      setMobs([...allMobs]);
    }
  });

  // Начальная загрузка мобов
  useEffect(() => {
    if (!entityManager) return;
    const allMobs = entityManager.getAll().filter((entity) => entity.mobType !== undefined);
    setMobs(allMobs);
    lastCountRef.current = allMobs.length;
  }, [entityManager]);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      // Очищаем кэш моделей при hot reload
      MobRegistry.clearCache();
    };
  }, []);

  return (
    <group name="mobs">
      {/* Свет только для layer 1 (мобы) */}
      <ambientLight
        intensity={0.9}
        onUpdate={(l) => {
          l.layers.set(1);
        }}
      />
      <directionalLight
        intensity={0.9}
        position={[20, 40, 10]}
        onUpdate={(l) => {
          l.layers.set(1);
        }}
      />

      {/* Рендерим всех мобов */}
      {mobs.map((mob) => (
        <MobMesh key={mob.id} mob={mob} />
      ))}
    </group>
  );
};

export default MobsRenderer;

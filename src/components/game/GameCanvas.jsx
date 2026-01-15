/**
 * GameCanvas - Three.js Canvas и рендеринг игрового мира
 */
import React from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import { SEA_LEVEL } from '../../constants/world';
import { GAME_MODES } from '../../constants/gameMode';
import WorldRenderer from '../world/WorldRenderer';
import PlayerRenderer from '../entities/PlayerRenderer';
import BlockHighlight from '../world/BlockHighlight';
import HeldItem from '../entities/HeldItem';
import Debris from '../entities/Debris';
import BlockBreakOverlay from '../world/BlockBreakOverlay';
import { DroppedItemsManager } from '../entities/DroppedItemRenderer';
import { MobsRenderer } from '../entities/MobRenderer';
import { FallingBlocksRenderer } from '../entities/FallingBlockRenderer';
import { PerformanceMetrics } from '../../utils/performance';
import { BlockInteraction } from './BlockInteraction';

// Компонент физики жидкости
const PhysicsLoop = ({ simulator, onChanges }) => {
  useFrame(() => {
    PerformanceMetrics.startFrame();

    PerformanceMetrics.measure('physics', () => {
      if (simulator && simulator.update()) {
        PerformanceMetrics.measure('chunkUpdate', onChanges);
      }
    });

    PerformanceMetrics.endFrame();
  });
  return null;
};

// Компонент добычи блоков (Survival)
const MiningLoop = ({ miningManager, isMouseDown }) => {
  const lastTimeRef = React.useRef(performance.now());

  useFrame(() => {
    if (!miningManager) return;

    const now = performance.now();
    const delta = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;

    if (isMouseDown && miningManager.currentTarget) {
      miningManager.update(delta);
    }
  });

  return null;
};

// Компонент освещения
const GameLights = () => {
  return (
    <>
      <Sky
        sunPosition={[100, 60, 100]}
        turbidity={0.8}
        rayleigh={0.5}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
    </>
  );
};

/**
 * Основной компонент Canvas
 */
export const GameCanvas = ({
  chunks,
  chunkManager,
  liquidSimulator,
  miningManager,
  entityManager,
  gameMode,
  isMouseDown,
  miningState,
  droppedItems,
  debrisList,
  playerPos,
  selectedBlock,
  isFlying,
  lastPunchTime,
  initialPlayerPos,
  noclipMode,
  canFly,
  speedMultiplier,
  isChatOpen,
  isInventoryOpen,
  isDead,
  teleportPos,
  onPlayerMove,
  onBlockDestroy,
  onBlockPlace,
  onPunch,
  onMouseStateChange,
  onStopMining,
  onLookingAtBlock,
  onItemPickup,
  getBlockAt,
  onChunksUpdate,
  onPlayerDeath,
  onPlayerRef,
  onStartEating,
  onStopEating,
  isEating,
  eatingProgress
}) => {
  return (
    <Canvas
      camera={{ position: [0, SEA_LEVEL + 12, 0], fov: 75 }}
      gl={{
        antialias: false,
        powerPreference: 'high-performance'
      }}
      onCreated={({ gl, scene }) => {
        // Небесно-голубой фон
        gl.setClearColor(new THREE.Color(0x87CEEB));

        // Туман для глубины и скрытия границ рендера
        scene.fog = new THREE.Fog(0x87CEEB, 80, 180);

        // sRGB для правильных цветов
        gl.outputColorSpace = THREE.SRGBColorSpace;

        // Без тонмаппинга — чистые цвета как в Minecraft
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      <GameLights />

      <PhysicsLoop
        simulator={liquidSimulator}
        onChanges={() => {
          if (onChunksUpdate && chunkManager) {
            onChunksUpdate({ ...chunkManager.chunks });
          }
        }}
      />

      {/* Mining loop для Survival */}
      {gameMode === GAME_MODES.SURVIVAL && (
        <MiningLoop
          miningManager={miningManager}
          isMouseDown={isMouseDown}
        />
      )}

      {chunks && (
        <>
          <WorldRenderer
            chunks={chunks}
            chunkManager={chunkManager}
          />
          <PlayerRenderer
            onMove={onPlayerMove}
            chunks={chunks}
            initialPosition={initialPlayerPos}
            noclipMode={noclipMode}
            canFly={canFly}
            isFlying={isFlying}
            speedMultiplier={speedMultiplier}
            isChatOpen={isChatOpen}
            isInventoryOpen={isInventoryOpen}
            isDead={isDead}
            teleportPos={teleportPos}
            onDeath={onPlayerDeath}
            onPlayerRef={onPlayerRef}
          />
          <BlockHighlight chunks={chunks} />

          {/* Анимация трещин при добыче (Survival) */}
          {gameMode === GAME_MODES.SURVIVAL && miningState?.target && (
            <BlockBreakOverlay
              target={miningState.target}
              stage={miningState.stage}
            />
          )}

          {/* Выпавшие предметы (Survival) */}
          {gameMode === GAME_MODES.SURVIVAL && droppedItems && droppedItems.length > 0 && (
            <DroppedItemsManager
              items={droppedItems}
              playerPos={playerPos}
              onPickup={onItemPickup}
              getBlock={getBlockAt}
              chunkManager={chunkManager}
            />
          )}

          {/* Рендеринг мобов */}
          {entityManager && (
            <MobsRenderer entityManager={entityManager} />
          )}

          {/* Рендеринг падающих блоков */}
          {entityManager && (
            <FallingBlocksRenderer entityManager={entityManager} />
          )}

          {/* Рендеринг эффектов разрушения */}
          {debrisList && debrisList.map(debris => (
            <Debris key={debris.id} {...debris} />
          ))}

          <BlockInteraction
            chunks={chunks}
            onBlockDestroy={onBlockDestroy}
            onBlockPlace={onBlockPlace}
            selectedBlock={selectedBlock}
            onPunch={onPunch}
            onMouseStateChange={onMouseStateChange}
            onStopMining={onStopMining}
            onLookingAtBlock={onLookingAtBlock}
            isMouseDown={isMouseDown}
            isDead={isDead}
            onStartEating={onStartEating}
            onStopEating={onStopEating}
          />

          <HeldItem
            selectedBlock={selectedBlock}
            isMining={gameMode === GAME_MODES.SURVIVAL && isMouseDown && miningState?.target !== null}
            lastPunchTime={lastPunchTime}
            isFlying={isFlying}
            isEating={isEating}
            eatingProgress={eatingProgress}
            lightLevel={chunkManager ?
              chunkManager.getLightLevel(
                Math.floor(playerPos?.x || 0),
                Math.floor(playerPos?.y || 64),
                Math.floor(playerPos?.z || 0)
              ) : 15
            }
          />
        </>
      )}
    </Canvas>
  );
};

// Компонент игрока - рендеринг и управление камерой
import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Player as PlayerClass } from '../../core/entities/Player';
import { PhysicsEngine } from '../../core/physics/PhysicsEngine';
import { PLAYER_HEIGHT } from '../../constants/world';
import { log } from '../../utils/logger';

const Player = ({ onMove, chunks, initialPosition, noclipMode, canFly, isFlying, speedMultiplier, isChatOpen, isInventoryOpen, teleportPos }) => {
  const { camera } = useThree();
  const playerRef = useRef(null);
  const physicsEngineRef = useRef(null);
  const lastSpaceTime = useRef(0);
  const isInitializedRef = useRef(false);

  // Инициализация PhysicsEngine и игрока
  useEffect(() => {
    if (isInitializedRef.current) return;

    // Создаем PhysicsEngine
    physicsEngineRef.current = new PhysicsEngine(chunks);

    const spawn = PlayerClass.findSpawnPoint(chunks, initialPosition);
    log('Player', 'Spawn point found:', spawn);

    // Создаем экземпляр Player класса
    playerRef.current = new PlayerClass(spawn.x, spawn.y, spawn.z);
    playerRef.current.setPhysicsEngine(physicsEngineRef.current);
    playerRef.current.onMove = onMove;
    playerRef.current.noclipMode = noclipMode;
    playerRef.current.canFly = canFly;
    playerRef.current.speedMultiplier = speedMultiplier || 1;
    playerRef.current.onGround = spawn.foundGround;

    camera.position.set(spawn.x, spawn.y + PLAYER_HEIGHT - 0.2, spawn.z);
    camera.rotation.order = 'YXZ';

    isInitializedRef.current = true;
    log('Player', 'Initialized at', spawn);
  }, [camera, chunks, initialPosition, onMove, noclipMode, canFly, speedMultiplier]);

  // Обновление чанков в PhysicsEngine
  useEffect(() => {
    if (physicsEngineRef.current && chunks) {
      physicsEngineRef.current.setChunks(chunks);
    }
  }, [chunks]);

  // Обновление свойств игрока при изменении пропсов
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.noclipMode = noclipMode;
      playerRef.current.canFly = canFly;
      playerRef.current.speedMultiplier = speedMultiplier || 1;
      playerRef.current.onMove = onMove;
      // Синхронизируем isFlying
      if (playerRef.current.isFlying !== isFlying) {
        playerRef.current.setFlying(isFlying);
      }
    }
  }, [noclipMode, canFly, speedMultiplier, onMove, isFlying]);

  // Обработка телепортации
  useEffect(() => {
    if (teleportPos && playerRef.current) {
      playerRef.current.teleport(teleportPos.x, teleportPos.y, teleportPos.z);
    }
  }, [teleportPos]);

  // Сброс всех клавиш при открытии чата
  useEffect(() => {
    if (isChatOpen && playerRef.current) {
      // Сбрасываем все зажатые клавиши
      playerRef.current.keys.forward = false;
      playerRef.current.keys.backward = false;
      playerRef.current.keys.left = false;
      playerRef.current.keys.right = false;
      playerRef.current.keys.jump = false;
      playerRef.current.keys.shift = false;
    }
  }, [isChatOpen]);

  // Обработка клавиатуры
  useEffect(() => {
    const handleKeyDown = (e) => {
      // КРИТИЧЕСКИ ВАЖНО: Если фокус в чате или инвентаре (любой input), блокируем движение
      if (isChatOpen || isInventoryOpen || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.repeat) return;
      if (!playerRef.current) return;

      if (e.code === 'Space' && canFly) {
        const now = Date.now();
        if (now - lastSpaceTime.current < 300) {
          playerRef.current.setFlying(!isFlying);
          lastSpaceTime.current = 0;
        } else {
          lastSpaceTime.current = now;
        }
      }

      switch (e.code) {
        case 'KeyW': case 'ArrowUp': playerRef.current.keys.forward = true; break;
        case 'KeyS': case 'ArrowDown': playerRef.current.keys.backward = true; break;
        case 'KeyA': case 'ArrowLeft': playerRef.current.keys.left = true; break;
        case 'KeyD': case 'ArrowRight': playerRef.current.keys.right = true; break;
        case 'Space': playerRef.current.keys.jump = true; break;
        case 'ShiftLeft': playerRef.current.keys.shift = true; break;
      }
    };

    const handleKeyUp = (e) => {
      if (!playerRef.current) return;

      // Всегда обрабатываем keyup, чтобы сбрасывать зажатые клавиши
      // даже если чат открыт
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': playerRef.current.keys.forward = false; break;
        case 'KeyS': case 'ArrowDown': playerRef.current.keys.backward = false; break;
        case 'KeyA': case 'ArrowLeft': playerRef.current.keys.left = false; break;
        case 'KeyD': case 'ArrowRight': playerRef.current.keys.right = false; break;
        case 'Space': playerRef.current.keys.jump = false; break;
        case 'ShiftLeft': playerRef.current.keys.shift = false; break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isChatOpen, isInventoryOpen, canFly, isFlying]);

  // Обработка мыши
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (document.pointerLockElement !== document.body || !playerRef.current) return;

      playerRef.current.rotate(e.movementX * 0.002, e.movementY * 0.002);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Игровой цикл
  useFrame((_, delta) => {
    const player = playerRef.current;

    if (!player) return;

    // Обновляем игрока (вся логика физики внутри класса)
    player.update(delta, chunks, isChatOpen);

    // === ОБНОВЛЕНИЕ КАМЕРЫ ===
    camera.rotation.y = player.rotation.yaw;
    camera.rotation.x = player.rotation.pitch;
    camera.position.set(
      player.position.x,
      player.position.y + PLAYER_HEIGHT - 0.2, // Глаза чуть ниже верха
      player.position.z
    );
  });

  return null;
};

export default Player;
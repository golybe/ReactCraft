// Компонент игрока - рендеринг и управление камерой
import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Player as PlayerClass } from '../../core/entities/Player';
import { PhysicsEngine } from '../../core/physics/PhysicsEngine';
import { PLAYER_HEIGHT } from '../../constants/world';
import { log } from '../../utils/logger';

const Player = ({ onMove, chunks, initialPosition, initialYaw, initialPitch, initialHealth, initialMaxHealth, noclipMode, canFly, isFlying, speedMultiplier, isChatOpen, isInventoryOpen, isDead, teleportPos, onDeath, onPlayerRef }) => {
  const { camera } = useThree();
  const playerRef = useRef(null);
  const physicsEngineRef = useRef(null);
  const lastSpaceTime = useRef(0);
  const isInitializedRef = useRef(false);
  const canFlyRef = useRef(canFly); // Ref для актуального значения canFly

  // Camera shake state (Minecraft-style damage shake)
  const shakeRef = useRef({
    intensity: 0,      // Current shake intensity (0-1)
    time: 0,           // Time since shake started
    duration: 0.4,     // Total shake duration in seconds
    offsetX: 0,        // Current X offset
    offsetY: 0,        // Current Y offset
    rotationOffset: 0  // Current rotation offset (tilt)
  });

  // Инициализация PhysicsEngine и игрока
  useEffect(() => {
    if (isInitializedRef.current) return;

    // Создаем PhysicsEngine
    physicsEngineRef.current = new PhysicsEngine(chunks);

    console.log('[PlayerRenderer] initialPosition prop:', initialPosition);
    const spawn = PlayerClass.findSpawnPoint(chunks, initialPosition);
    console.log('[PlayerRenderer] Spawn point found:', spawn);
    console.log('[PlayerRenderer] Initial yaw:', initialYaw, 'pitch:', initialPitch, 'health:', initialHealth, '/', initialMaxHealth);
    log('Player', 'Spawn point found:', spawn);

    // Создаем экземпляр Player класса с начальными yaw, pitch, health, maxHealth
    playerRef.current = new PlayerClass(
      spawn.x, spawn.y, spawn.z, 
      initialYaw ?? 0, 
      initialPitch ?? 0, 
      initialHealth ?? 20, 
      initialMaxHealth ?? 20
    );
    playerRef.current.setPhysicsEngine(physicsEngineRef.current);
    playerRef.current.onMove = onMove;
    playerRef.current.noclipMode = noclipMode;
    playerRef.current.canFly = canFly;
    playerRef.current.speedMultiplier = speedMultiplier || 1;
    playerRef.current.onGround = spawn.foundGround;

    // Callback для получения актуального canFly из React state
    playerRef.current.getCanFly = () => canFlyRef.current;

    // Настраиваем callback на смерть
    playerRef.current.onDeath = (source) => {
      if (onDeath) {
        onDeath(source);
      }
    };

    // Настраиваем callback на получение урона (тряска камеры)
    playerRef.current.onDamage = (amount, source) => {
      // Интенсивность зависит от урона: 1 HP = 0.3, 3 HP = 0.9, 5+ HP = 1.0
      const intensity = Math.min(1.0, amount * 0.3);
      shakeRef.current.intensity = intensity;
      shakeRef.current.time = 0;
      shakeRef.current.duration = 0.25 + intensity * 0.25; // 0.25-0.5 секунд
    };

    // Передаем ссылку на игрока наружу
    if (onPlayerRef) {
      onPlayerRef(playerRef.current);
    }

    // Устанавливаем начальную позицию и ротацию камеры
    camera.position.set(spawn.x, spawn.y + PLAYER_HEIGHT - 0.2, spawn.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.x = initialPitch ?? 0; // pitch
    camera.rotation.y = initialYaw ?? 0;   // yaw

    isInitializedRef.current = true;
    log('Player', 'Initialized at', spawn);
  }, [camera, chunks, initialPosition, initialYaw, initialPitch, initialHealth, initialMaxHealth, onMove, noclipMode, canFly, speedMultiplier, onDeath, onPlayerRef]);

  // Обновление чанков в PhysicsEngine
  useEffect(() => {
    if (physicsEngineRef.current && chunks) {
      physicsEngineRef.current.setChunks(chunks);
    }
  }, [chunks]);

  // Синхронизация canFly через ref для мгновенного доступа
  useEffect(() => {
    canFlyRef.current = canFly;
  }, [canFly]);

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

  // Сброс всех клавиш при открытии чата или смерти
  useEffect(() => {
    if ((isChatOpen || isDead) && playerRef.current) {
      // Сбрасываем все зажатые клавиши
      playerRef.current.keys.forward = false;
      playerRef.current.keys.backward = false;
      playerRef.current.keys.left = false;
      playerRef.current.keys.right = false;
      playerRef.current.keys.jump = false;
      playerRef.current.keys.shift = false;
    }
  }, [isChatOpen, isDead]);

  // Обработка клавиатуры
  useEffect(() => {
    const handleKeyDown = (e) => {
      // КРИТИЧЕСКИ ВАЖНО: Если фокус в чате, игрок мертв или инвентаре (любой input), блокируем движение
      if (isDead || isChatOpen || isInventoryOpen || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
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
  }, [isDead, isChatOpen, isInventoryOpen, canFly, isFlying]);

  // Обработка мыши
  useEffect(() => {
    const handleMouseMove = (e) => {
      // Блокируем вращение камеры если игрок мертв
      if (isDead || document.pointerLockElement !== document.body || !playerRef.current) return;

      playerRef.current.rotate(e.movementX * 0.002, e.movementY * 0.002);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isDead]);

  // Игровой цикл
  useFrame((_, delta) => {
    const player = playerRef.current;

    if (!player) return;

    // Не обновляем физику если игрок мертв
    if (isDead) return;

    // Обновляем игрока (вся логика физики внутри класса)
    player.update(delta, chunks, isChatOpen);

    // === CAMERA SHAKE UPDATE ===
    const shake = shakeRef.current;
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;
    let shakeRotation = 0;

    if (shake.intensity > 0) {
      shake.time += delta;

      // Progress from 0 to 1 over duration
      const progress = Math.min(shake.time / shake.duration, 1);

      // Ease out - shake reduces over time
      const easeOut = 1 - progress;
      const currentIntensity = shake.intensity * easeOut * easeOut;

      // Minecraft-style shake: quick oscillation with decay
      // Use sin waves at different frequencies for natural feel
      const freq1 = shake.time * 35; // Fast shake
      const freq2 = shake.time * 23; // Medium shake

      // Position offset (more noticeable)
      shakeOffsetX = Math.sin(freq1) * currentIntensity * 0.15;
      shakeOffsetY = Math.cos(freq2) * currentIntensity * 0.1;

      // Rotation offset (tilt effect - very noticeable)
      shakeRotation = Math.sin(freq1 * 0.7) * currentIntensity * 0.2;

      // Reset when done
      if (progress >= 1) {
        shake.intensity = 0;
      }
    }

    // === ОБНОВЛЕНИЕ КАМЕРЫ ===
    camera.rotation.y = player.rotation.yaw;
    camera.rotation.x = player.rotation.pitch + shakeRotation;
    camera.rotation.z = shakeRotation * 0.5; // Slight roll for extra effect
    camera.position.set(
      player.position.x + shakeOffsetX,
      player.position.y + PLAYER_HEIGHT - 0.2 + shakeOffsetY,
      player.position.z
    );
  });

  return null;
};

export default Player;
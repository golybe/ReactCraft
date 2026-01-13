// Компонент игрока с правильной физикой
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getBlock } from '../utils/noise';
import { isSolid, BLOCK_TYPES } from '../constants/blocks';
import { log } from '../utils/logger';
import {
  SEA_LEVEL,
  CHUNK_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_WIDTH
} from '../constants/world';

// Физические константы (настроены для реалистичного ощущения)
const MOVE_SPEED = 4.3; // блоков в секунду (как в Minecraft)
const JUMP_VELOCITY = 8.5; // начальная скорость прыжка
const GRAVITY = 28; // ускорение падения
const MAX_FALL_SPEED = 50; // максимальная скорость падения
const GROUND_CHECK_DIST = 0.05; // расстояние проверки земли

const Player = ({ onMove, chunks, initialPosition, noclipMode, canFly, speedMultiplier, isChatOpen, teleportPos }) => {
  const { camera } = useThree();
  const playerRef = useRef(null);
  const [isFlying, setIsFlying] = useState(false);
  const lastSpaceTime = useRef(0);
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    shift: false
  });
  const isInitializedRef = useRef(false);

  // Найти безопасную точку спавна
  const findSpawnPoint = useCallback(() => {
    // Если есть сохранённая позиция - используем её
    if (initialPosition) {
      return {
        x: initialPosition.x,
        y: initialPosition.y,
        z: initialPosition.z,
        foundGround: true
      };
    }

    if (!chunks || Object.keys(chunks).length === 0) {
      return { x: 0.5, y: CHUNK_HEIGHT - 5, z: 0.5, foundGround: false };
    }

    // Ищем землю в центре мира
    for (let y = CHUNK_HEIGHT - 2; y >= 0; y--) {
      const block = getBlock(chunks, 0, y, 0);
      if (isSolid(block) && block !== BLOCK_TYPES.WATER) {
        return { x: 0.5, y: y + 1.01, z: 0.5, foundGround: true };
      }
    }

    // Fallback
    return { x: 0.5, y: SEA_LEVEL + 10, z: 0.5, foundGround: false };
  }, [chunks, initialPosition]);

  // Инициализация игрока
  useEffect(() => {
    if (isInitializedRef.current) return;

    // ВАЖНО: Убираем проверку на пустые чанки, чтобы игрок спавнился даже если мир еще грузится
    // Но проверяем, что чанки вообще существуют как объект (если undefined - ждем)
    // Хотя если chunks undefined, мы все равно можем создать игрока, просто без коллизий.
    // Оставим полную свободу.
    
    const spawn = findSpawnPoint();
    log('Player', 'Spawn point found:', spawn);

    playerRef.current = {
      position: new THREE.Vector3(spawn.x, spawn.y, spawn.z),
      velocity: new THREE.Vector3(0, 0, 0),
      yaw: 0,
      pitch: 0,
      onGround: spawn.foundGround
    };

    camera.position.set(spawn.x, spawn.y + PLAYER_HEIGHT - 0.2, spawn.z);
    camera.rotation.order = 'YXZ';

    isInitializedRef.current = true;
    log('Player', 'Initialized at', spawn);
  }, [camera, chunks, findSpawnPoint]);

  // Обработка телепортации
  useEffect(() => {
    if (teleportPos && playerRef.current) {
        playerRef.current.position.set(teleportPos.x, teleportPos.y, teleportPos.z);
        playerRef.current.velocity.set(0, 0, 0);
    }
  }, [teleportPos]);

  // Обработка клавиатуры
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return;
      if (isChatOpen) return; // Блокируем управление при открытом чате

      if (e.code === 'Space' && canFly) {
        const now = Date.now();
        if (now - lastSpaceTime.current < 300) {
          setIsFlying(prev => !prev);
          lastSpaceTime.current = 0;
        } else {
          lastSpaceTime.current = now;
        }
      }

      switch (e.code) {
        case 'KeyW': case 'ArrowUp': keysRef.current.forward = true; break;
        case 'KeyS': case 'ArrowDown': keysRef.current.backward = true; break;
        case 'KeyA': case 'ArrowLeft': keysRef.current.left = true; break;
        case 'KeyD': case 'ArrowRight': keysRef.current.right = true; break;
        case 'Space': keysRef.current.jump = true; break;
        case 'ShiftLeft': keysRef.current.shift = true; break; // Для спуска в полете
      }
    };

    const handleKeyUp = (e) => {
      // Отпускание клавиш должно работать всегда, чтобы не залипало при открытии чата
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': keysRef.current.forward = false; break;
        case 'KeyS': case 'ArrowDown': keysRef.current.backward = false; break;
        case 'KeyA': case 'ArrowLeft': keysRef.current.left = false; break;
        case 'KeyD': case 'ArrowRight': keysRef.current.right = false; break;
        case 'Space': keysRef.current.jump = false; break;
        case 'ShiftLeft': keysRef.current.shift = false; break;
      }
    };

    // Добавляем обработчики к document, а не window, для надежности
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isChatOpen]);

  // Обработка мыши
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (document.pointerLockElement !== document.body || !playerRef.current) return;

      playerRef.current.yaw -= e.movementX * 0.002;
      playerRef.current.pitch -= e.movementY * 0.002;
      playerRef.current.pitch = Math.max(
        -Math.PI / 2 + 0.01,
        Math.min(Math.PI / 2 - 0.01, playerRef.current.pitch)
      );
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Проверка коллизии в точке
  const isBlockSolid = useCallback((x, y, z) => {
    if (!chunks) return false;
    return isSolid(getBlock(chunks, Math.floor(x), Math.floor(y), Math.floor(z)));
  }, [chunks]);

  // Проверка коллизии AABB игрока
  const checkCollision = useCallback((x, y, z) => {
    if (!chunks) return false;

    const hw = PLAYER_WIDTH / 2 - 0.01; // Немного меньше для предотвращения застревания
    const height = PLAYER_HEIGHT - 0.01;

    // Проверяем углы и центр на разных высотах
    const checkPoints = [
      // Ноги
      [x - hw, y, z - hw],
      [x + hw, y, z - hw],
      [x - hw, y, z + hw],
      [x + hw, y, z + hw],
      // Середина
      [x - hw, y + height / 2, z - hw],
      [x + hw, y + height / 2, z - hw],
      [x - hw, y + height / 2, z + hw],
      [x + hw, y + height / 2, z + hw],
      // Голова
      [x - hw, y + height, z - hw],
      [x + hw, y + height, z - hw],
      [x - hw, y + height, z + hw],
      [x + hw, y + height, z + hw],
    ];

    for (const [px, py, pz] of checkPoints) {
      if (isBlockSolid(px, py, pz)) {
        return true;
      }
    }
    return false;
  }, [chunks, isBlockSolid]);

  // Проверка земли под игроком
  const checkGround = useCallback((x, y, z) => {
    if (!chunks) return false;

    const hw = PLAYER_WIDTH / 2 - 0.01;
    const checkY = y - GROUND_CHECK_DIST;

    return (
      isBlockSolid(x - hw, checkY, z - hw) ||
      isBlockSolid(x + hw, checkY, z - hw) ||
      isBlockSolid(x - hw, checkY, z + hw) ||
      isBlockSolid(x + hw, checkY, z + hw) ||
      isBlockSolid(x, checkY, z) // Центр тоже проверяем
    );
  }, [chunks, isBlockSolid]);

  // Найти позицию на земле (для snap)
  const findGroundY = useCallback((x, y, z) => {
    const hw = PLAYER_WIDTH / 2 - 0.01;
    let groundY = -Infinity;

    // Проверяем все 4 угла и центр
    const checkPositions = [
      [x - hw, z - hw],
      [x + hw, z - hw],
      [x - hw, z + hw],
      [x + hw, z + hw],
      [x, z]
    ];

    for (const [px, pz] of checkPositions) {
      for (let checkY = Math.floor(y); checkY >= Math.floor(y) - 2; checkY--) {
        if (isBlockSolid(px, checkY, pz)) {
          groundY = Math.max(groundY, checkY + 1);
          break;
        }
      }
    }

    return groundY > -Infinity ? groundY : y;
  }, [isBlockSolid]);

  // Игровой цикл
  useFrame((_, delta) => {
    const player = playerRef.current;
    
    if (!player) return; // Если игрока нет, ничего не делаем

    // Ограничиваем delta для стабильной физики
    const dt = Math.min(delta, 0.05);
    const keys = keysRef.current;
    let currentSpeed = MOVE_SPEED * (speedMultiplier || 1);
    
    // При полете скорость в 3 раза выше
    if (isFlying) {
        currentSpeed *= 3.0;
    }

    // === ГОРИЗОНТАЛЬНОЕ ДВИЖЕНИЕ ===
    let inputX = 0, inputZ = 0;

    // ВАЖНО: Читаем ввод только если чат закрыт!
    if (!isChatOpen) {
      if (keys.forward) {
        inputX -= Math.sin(player.yaw);
        inputZ -= Math.cos(player.yaw);
      }
      if (keys.backward) {
        inputX += Math.sin(player.yaw);
        inputZ += Math.cos(player.yaw);
      }
      if (keys.left) {
        inputX -= Math.cos(player.yaw);
        inputZ += Math.sin(player.yaw);
      }
      if (keys.right) {
        inputX += Math.cos(player.yaw);
        inputZ -= Math.sin(player.yaw);
      }
    }

    // Нормализуем диагональное движение
    const inputLen = Math.sqrt(inputX * inputX + inputZ * inputZ);
    if (inputLen > 0) {
      inputX /= inputLen;
      inputZ /= inputLen;
    }

    const moveX = inputX * currentSpeed * dt;
    const moveZ = inputZ * currentSpeed * dt;

    // === РЕЖИМ NOCLIP (Сквозь стены) ===
    if (noclipMode) {
        player.position.x += moveX * 3; // Очень быстро
        player.position.z += moveZ * 3;
        
        // Вертикальное перемещение
        if (keys.jump) player.position.y += currentSpeed * dt * 2;
        if (keys.shift) player.position.y -= currentSpeed * dt * 2;
        
        player.velocity.set(0, 0, 0); 
    } 
    // === РЕЖИМ ПОЛЕТА (Creative) ===
    else if (isFlying) {
        // Горизонтальное движение с коллизиями
        const newX = player.position.x + moveX;
        if (!checkCollision(newX, player.position.y, player.position.z)) {
          player.position.x = newX;
        }

        const newZ = player.position.z + moveZ;
        if (!checkCollision(player.position.x, player.position.y, newZ)) {
          player.position.z = newZ;
        }

        // Вертикальное движение (без гравитации, но с коллизиями)
        let vertMove = 0;
        if (keys.jump) vertMove += currentSpeed * dt;
        if (keys.shift) vertMove -= currentSpeed * dt;

        const newY = player.position.y + vertMove;
        // Проверяем коллизию только если двигаемся (чтобы не застрять если уже внутри)
        if (vertMove !== 0) {
             if (!checkCollision(player.position.x, newY, player.position.z)) {
                player.position.y = newY;
             }
        } else {
             // Если стоим, не двигаем Y
        }
        
        // Сбрасываем скорость падения, чтобы при отключении полета начать падать с 0 (или можно оставить инерцию, но в Creative она сбрасывается)
        player.velocity.set(0, 0, 0); 
    }
    // === ОБЫЧНАЯ ФИЗИКА ===
    else {
        // Пробуем двигаться по X
        const newX = player.position.x + moveX;
        if (!checkCollision(newX, player.position.y, player.position.z)) {
          player.position.x = newX;
        }

        // Пробуем двигаться по Z
        const newZ = player.position.z + moveZ;
        if (!checkCollision(player.position.x, player.position.y, newZ)) {
          player.position.z = newZ;
        }

        // === ВЕРТИКАЛЬНОЕ ДВИЖЕНИЕ ===
        const onGround = checkGround(player.position.x, player.position.y, player.position.z);

        if (!onGround) {
          player.velocity.y -= GRAVITY * dt;
          player.velocity.y = Math.max(player.velocity.y, -MAX_FALL_SPEED);
          player.onGround = false;
        } else {
          if (player.velocity.y < 0) {
            player.velocity.y = 0;
            const groundY = findGroundY(player.position.x, player.position.y, player.position.z);
            if (groundY > player.position.y - 0.5) {
              player.position.y = groundY;
            }
          }
          player.onGround = true;
        }

        if (keys.jump && player.onGround && player.velocity.y <= 0) {
          player.velocity.y = JUMP_VELOCITY;
          player.onGround = false;
        }
        
        const newY = player.position.y + player.velocity.y * dt;

        if (player.velocity.y > 0) {
          if (!checkCollision(player.position.x, newY, player.position.z)) {
            player.position.y = newY;
          } else {
            player.velocity.y = 0;
          }
        } else if (player.velocity.y < 0) {
          if (!checkCollision(player.position.x, newY, player.position.z)) {
            player.position.y = newY;
          } else {
            player.velocity.y = 0;
            player.onGround = true;
            const groundY = findGroundY(player.position.x, player.position.y, player.position.z);
            player.position.y = groundY;
          }
        }
    }

    // Защита от падения в пустоту (если не летим и не ноклип)
    if (!noclipMode && !isFlying && player.position.y < -20) {
      const spawn = findSpawnPoint();
      player.position.set(spawn.x, spawn.y, spawn.z);
      player.velocity.set(0, 0, 0);
    }
    
    // === ОБНОВЛЕНИЕ КАМЕРЫ ===
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
    camera.position.set(
      player.position.x,
      player.position.y + PLAYER_HEIGHT - 0.2, // Глаза чуть ниже верха
      player.position.z
    );

    // Уведомляем о позиции и направлении взгляда
    onMove?.({
      type: 'position',
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      yaw: player.yaw,
      pitch: player.pitch,
      isFlying: isFlying || noclipMode
    });
  });

  return null;
};

export default Player;
// Хук для pointer lock (захвата курсора)
import { useEffect, useState, useRef } from 'react';

export const usePointerLock = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [movement, setMovement] = useState({ x: 0, y: 0 });
  const pendingMovement = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (document.pointerLockElement === document.body) {
        pendingMovement.current.x += e.movementX;
        pendingMovement.current.y += e.movementY;
      }
    };

    const handlePointerLockChange = () => {
      setIsLocked(document.pointerLockElement === document.body);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    // Сбрасываем накопленное движение каждый кадр
    const animationFrame = () => {
      setMovement({ ...pendingMovement.current });
      pendingMovement.current = { x: 0, y: 0 };
      requestAnimationFrame(animationFrame);
    };
    animationFrame();

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, []);

  const requestLock = () => {
    document.body.requestPointerLock();
  };

  const exitLock = () => {
    document.exitPointerLock();
  };

  return {
    isLocked,
    movement,
    requestLock,
    exitLock
  };
};

export default usePointerLock;

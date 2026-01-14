import { useState, useCallback, useEffect } from 'react';
import { SEA_LEVEL } from '../constants/world';
import { getGameModeDefaults } from '../constants/gameMode';

/**
 * Hook for managing player position and movement state
 */
export function usePlayerMovement({
  initialPlayerPos,
  gameMode
}) {
  const gameModeDefaults = getGameModeDefaults(gameMode);

  const [playerPos, setPlayerPos] = useState(
    initialPlayerPos || { x: 0, y: SEA_LEVEL + 10, z: 0 }
  );
  const [playerYaw, setPlayerYaw] = useState(0);
  const [playerPitch, setPlayerPitch] = useState(0);
  const [isFlying, setIsFlying] = useState(false);
  const [canFly, setCanFly] = useState(gameModeDefaults.canFly);
  const [noclipMode, setNoclipMode] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [teleportPos, setTeleportPos] = useState(null);

  // Water states
  const [isInWater, setIsInWater] = useState(false);
  const [isHeadUnderwater, setIsHeadUnderwater] = useState(false);

  // Update canFly when game mode changes
  useEffect(() => {
    const defaults = getGameModeDefaults(gameMode);
    setCanFly(defaults.canFly);
  }, [gameMode]);

  const handlePlayerMove = useCallback((data) => {
    if (data.type === 'position') {
      setPlayerPos(prev => {
        if (prev.x === data.x && prev.y === data.y && prev.z === data.z) return prev;
        return { x: data.x, y: data.y, z: data.z };
      });

      setIsFlying(prev => prev !== data.isFlying ? data.isFlying : prev);

      if (data.yaw !== undefined) {
        setPlayerYaw(prev => prev !== data.yaw ? data.yaw : prev);
      }
      if (data.pitch !== undefined) {
        setPlayerPitch(prev => prev !== data.pitch ? data.pitch : prev);
      }

      // Update water states
      if (data.isInWater !== undefined) {
        setIsInWater(prev => prev !== data.isInWater ? data.isInWater : prev);
      }
      if (data.isHeadUnderwater !== undefined) {
        setIsHeadUnderwater(prev => prev !== data.isHeadUnderwater ? data.isHeadUnderwater : prev);
      }
    }
  }, []);

  const teleportTo = useCallback((x, y, z) => {
    setTeleportPos({ x, y, z });
    setPlayerPos({ x, y, z });
  }, []);

  const toggleNoclip = useCallback(() => {
    setNoclipMode(prev => !prev);
    return !noclipMode;
  }, [noclipMode]);

  const toggleFlight = useCallback(() => {
    setCanFly(prev => !prev);
    return !canFly;
  }, [canFly]);

  return {
    playerPos,
    setPlayerPos,
    playerYaw,
    setPlayerYaw,
    playerPitch,
    setPlayerPitch,
    isFlying,
    setIsFlying,
    canFly,
    setCanFly,
    noclipMode,
    setNoclipMode,
    speedMultiplier,
    setSpeedMultiplier,
    teleportPos,
    setTeleportPos,
    isInWater,
    isHeadUnderwater,
    handlePlayerMove,
    teleportTo,
    toggleNoclip,
    toggleFlight
  };
}

export default usePlayerMovement;

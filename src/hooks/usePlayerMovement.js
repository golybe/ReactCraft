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
      setPlayerPos({ x: data.x, y: data.y, z: data.z });
      setIsFlying(data.isFlying);
      if (data.yaw !== undefined) setPlayerYaw(data.yaw);
      if (data.pitch !== undefined) setPlayerPitch(data.pitch);

      // Update water states
      if (data.isInWater !== undefined) setIsInWater(data.isInWater);
      if (data.isHeadUnderwater !== undefined) setIsHeadUnderwater(data.isHeadUnderwater);
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

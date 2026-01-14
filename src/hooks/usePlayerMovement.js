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

  const [playerPos, setPlayerPos] = useState(() => {
    const pos = initialPlayerPos || { x: 0, y: SEA_LEVEL + 10, z: 0 };
    console.log('[usePlayerMovement] Initial position:', pos);
    return pos;
  });
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

  // Health states
  const [health, setHealth] = useState(20);
  const [maxHealth, setMaxHealth] = useState(20);

  // Update canFly when game mode changes
  useEffect(() => {
    const defaults = getGameModeDefaults(gameMode);
    setCanFly(defaults.canFly);
    // If new mode doesn't allow flying, disable flight state
    if (!defaults.canFly) {
      setIsFlying(false);
    }
  }, [gameMode]);

  // Auto-disable flying if capability is lost
  useEffect(() => {
    if (!canFly && isFlying) {
      setIsFlying(false);
    }
  }, [canFly, isFlying]);

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

      // Update health states
      if (data.health !== undefined) {
        setHealth(prev => prev !== data.health ? data.health : prev);
      }
      if (data.maxHealth !== undefined) {
        setMaxHealth(prev => prev !== data.maxHealth ? data.maxHealth : prev);
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
    health,
    maxHealth,
    handlePlayerMove,
    teleportTo,
    toggleNoclip,
    toggleFlight
  };
}

export default usePlayerMovement;

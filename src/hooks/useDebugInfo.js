import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Hook for managing debug information (FPS, chunks count, blocks count)
 */
export function useDebugInfo() {
  const [debugInfo, setDebugInfo] = useState({
    chunksCount: 0,
    blocksCount: 0,
    fps: 0
  });

  const frameTimesRef = useRef([]);
  const lastFrameTimeRef = useRef(performance.now());

  // FPS calculation loop
  useEffect(() => {
    let animationId;

    const updateFPS = () => {
      const now = performance.now();
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      frameTimesRef.current.push(delta);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      const avgDelta = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
      const fps = Math.round(1000 / avgDelta);

      setDebugInfo(prev => ({ ...prev, fps }));
      animationId = requestAnimationFrame(updateFPS);
    };

    animationId = requestAnimationFrame(updateFPS);
    return () => cancelAnimationFrame(animationId);
  }, []);

  const setChunksCount = useCallback((count) => {
    setDebugInfo(prev => ({ ...prev, chunksCount: count }));
  }, []);

  const setBlocksCount = useCallback((count) => {
    setDebugInfo(prev => ({ ...prev, blocksCount: count }));
  }, []);

  return {
    debugInfo,
    setChunksCount,
    setBlocksCount
  };
}

export default useDebugInfo;

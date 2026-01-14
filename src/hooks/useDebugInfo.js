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

  // FPS calculation loop - optimized to reduce React re-renders
  useEffect(() => {
    let animationId;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 500; // Update React state only every 500ms

    const updateFPS = () => {
      const now = performance.now();
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      // Always track frame times for accurate FPS calculation
      frameTimesRef.current.push(delta);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      // Only update React state every UPDATE_INTERVAL ms to avoid constant re-renders
      if (now - lastUpdateTime >= UPDATE_INTERVAL) {
        lastUpdateTime = now;
        const avgDelta = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
        const fps = Math.round(1000 / avgDelta);

        setDebugInfo(prev => {
          // Avoid re-render if FPS hasn't changed
          if (prev.fps === fps) return prev;
          return { ...prev, fps };
        });
      }

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

/**
 * Block Break Overlay - Shows Minecraft-style crack animation
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Create Minecraft-style break texture
 * Black pixelated cracks on transparent background
 */
const createBreakTexture = (stage) => {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Transparent background
  ctx.clearRect(0, 0, size, size);
  
  if (stage <= 0) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }

  // Minecraft-style crack patterns for each stage
  // Each pattern is array of [x, y] pixels to draw
  const crackPatterns = [
    // Stage 1 - minimal cracks
    [[7,3],[8,4],[7,5],[8,6]],
    
    // Stage 2
    [[7,3],[8,4],[7,5],[8,6],[9,7],[3,8],[4,9],[5,9]],
    
    // Stage 3
    [[7,2],[7,3],[8,4],[7,5],[8,6],[9,7],[10,8],
     [3,7],[4,8],[5,9],[4,10],[3,11]],
    
    // Stage 4
    [[6,1],[7,2],[7,3],[8,4],[7,5],[8,6],[9,7],[10,8],[11,9],
     [2,6],[3,7],[4,8],[5,9],[4,10],[3,11],[2,12],
     [10,3],[11,4],[12,4]],
    
    // Stage 5
    [[5,0],[6,1],[7,2],[7,3],[8,4],[7,5],[8,6],[9,7],[10,8],[11,9],[12,10],
     [1,5],[2,6],[3,7],[4,8],[5,9],[4,10],[3,11],[2,12],[1,13],
     [9,2],[10,3],[11,4],[12,4],[13,5],
     [4,3],[5,4],[4,5]],
    
    // Stage 6
    [[4,0],[5,0],[6,1],[7,2],[7,3],[8,4],[7,5],[8,6],[9,7],[10,8],[11,9],[12,10],[13,11],
     [0,4],[1,5],[2,6],[3,7],[4,8],[5,9],[4,10],[3,11],[2,12],[1,13],[0,14],
     [9,1],[9,2],[10,3],[11,4],[12,4],[13,5],[14,6],
     [3,2],[4,3],[5,4],[4,5],[3,6],
     [11,11],[12,12],[11,13]],
    
    // Stage 7
    [[3,0],[4,0],[5,0],[6,1],[7,2],[7,3],[8,4],[7,5],[8,6],[9,7],[10,8],[11,9],[12,10],[13,11],[14,12],
     [0,3],[0,4],[1,5],[2,6],[3,7],[4,8],[5,9],[4,10],[3,11],[2,12],[1,13],[0,14],[0,15],
     [8,0],[9,1],[9,2],[10,3],[11,4],[12,4],[13,5],[14,6],[15,7],
     [2,1],[3,2],[4,3],[5,4],[4,5],[3,6],[2,7],
     [10,10],[11,11],[12,12],[11,13],[10,14],
     [6,11],[7,12],[6,13]],
    
    // Stage 8
    [[2,0],[3,0],[4,0],[5,0],[6,1],[7,2],[7,3],[8,4],[7,5],[8,6],[9,7],[10,8],[11,9],[12,10],[13,11],[14,12],[15,13],
     [0,2],[0,3],[0,4],[1,5],[2,6],[3,7],[4,8],[5,9],[4,10],[3,11],[2,12],[1,13],[0,14],[0,15],
     [7,0],[8,0],[9,1],[9,2],[10,3],[11,4],[12,4],[13,5],[14,6],[15,7],
     [1,1],[2,1],[3,2],[4,3],[5,4],[4,5],[3,6],[2,7],[1,8],
     [9,9],[10,10],[11,11],[12,12],[11,13],[10,14],[9,15],
     [5,10],[6,11],[7,12],[6,13],[5,14],
     [13,2],[14,3],[15,4]],
    
    // Stage 9 - maximum cracks (almost broken)
    [[1,0],[2,0],[3,0],[4,0],[5,0],[6,1],[7,2],[7,3],[8,4],[7,5],[8,6],[9,7],[10,8],[11,9],[12,10],[13,11],[14,12],[15,13],[15,14],
     [0,1],[0,2],[0,3],[0,4],[1,5],[2,6],[3,7],[4,8],[5,9],[4,10],[3,11],[2,12],[1,13],[0,14],[0,15],
     [6,0],[7,0],[8,0],[9,1],[9,2],[10,3],[11,4],[12,4],[13,5],[14,6],[15,7],[15,8],
     [0,0],[1,1],[2,1],[3,2],[4,3],[5,4],[4,5],[3,6],[2,7],[1,8],[0,9],
     [8,8],[9,9],[10,10],[11,11],[12,12],[11,13],[10,14],[9,15],[8,15],
     [4,9],[5,10],[6,11],[7,12],[6,13],[5,14],[4,15],
     [12,1],[13,2],[14,3],[15,4],[15,5],
     [12,14],[13,15],[14,15],
     [1,11],[2,10],[3,9]]
  ];

  // Get pattern for this stage (1-9)
  const patternIndex = Math.min(stage - 1, crackPatterns.length - 1);
  const pattern = crackPatterns[patternIndex];
  
  // Draw crack pixels
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  
  pattern.forEach(([x, y]) => {
    ctx.fillRect(x, y, 1, 1);
  });
  
  // Add slight darkening as damage increases
  if (stage >= 5) {
    ctx.fillStyle = `rgba(0, 0, 0, ${(stage - 4) * 0.03})`;
    ctx.fillRect(0, 0, size, size);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
};

// Pre-generate all 10 stages (0 = no damage, 1-9 = increasing damage)
const breakTextures = Array.from({ length: 10 }, (_, i) => createBreakTexture(i));

const BlockBreakOverlay = ({ target, stage }) => {
  const material = useMemo(() => {
    const stageIndex = Math.min(9, Math.max(0, Math.floor(stage)));
    const texture = breakTextures[stageIndex];
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
  }, [stage]);

  if (!target || stage <= 0) return null;

  const offset = 0.002;
  const faces = [
    { pos: [0, 0.5 + offset, 0], rot: [-Math.PI / 2, 0, 0] },
    { pos: [0, -0.5 - offset, 0], rot: [Math.PI / 2, 0, 0] },
    { pos: [0, 0, 0.5 + offset], rot: [0, 0, 0] },
    { pos: [0, 0, -0.5 - offset], rot: [0, Math.PI, 0] },
    { pos: [0.5 + offset, 0, 0], rot: [0, Math.PI / 2, 0] },
    { pos: [-0.5 - offset, 0, 0], rot: [0, -Math.PI / 2, 0] }
  ];

  return (
    <group position={[target.x + 0.5, target.y + 0.5, target.z + 0.5]}>
      {faces.map((face, i) => (
        <mesh
          key={i}
          position={face.pos}
          rotation={face.rot}
          material={material}
        >
          <planeGeometry args={[1.002, 1.002]} />
        </mesh>
      ))}
    </group>
  );
};

export default BlockBreakOverlay;

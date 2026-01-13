import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { NoiseGenerators } from '../../utils/noise.js';
import { getBiome } from '../../utils/biomes.js';
import { CONTINENTALNESS_SPLINE, EROSION_SPLINE, PV_SPLINE } from '../../utils/terrain.js';
import { SEA_LEVEL } from '../../constants/world.js';

// --- TERRAIN LOGIC MIMICING src/utils/terrain.js ---

const sampleTerrainAt = (noise, worldX, worldZ) => {
    // Round to 4-block grid (Minecraft 1.12 style sampling)
    const gridX = Math.floor(worldX / 4) * 4;
    const gridZ = Math.floor(worldZ / 4) * 4;
    
    const params = noise.sampleTerrainParams(gridX, gridZ);
    const biome = getBiome(params.temperature, params.humidity, params.continentalness);
    
    let baseHeight = SEA_LEVEL + CONTINENTALNESS_SPLINE.getValue(params.continentalness);
    baseHeight += EROSION_SPLINE.getValue(params.erosion);
    
    // Apply PV only on land
    if (params.continentalness > -0.2) {
        const pvWeight = Math.min(1, (params.continentalness + 0.2) / 0.5);
        baseHeight += PV_SPLINE.getValue(params.pv) * pvWeight;
    }
    
    baseHeight += biome.heightOffset || 0;
    
    // River logic matching TerrainDensitySampler
    const riverVal = noise.sampleRiver(gridX, gridZ);
    const riverThreshold = 0.85;
    const isRiver = riverVal > riverThreshold && baseHeight > SEA_LEVEL - 2;
    
    if (isRiver) {
        const riverDepth = (riverVal - riverThreshold) / (1 - riverThreshold);
        const riverBed = SEA_LEVEL - 4;
        baseHeight = riverBed + (baseHeight - riverBed) * (1 - riverDepth * 0.8);
    }
    
    return {
        baseHeight: Math.floor(baseHeight),
        isRiver,
        biome
    };
};

const getTerrainDataInterpolated = (noise, worldX, worldZ) => {
    const gridX = Math.floor(worldX / 4) * 4;
    const gridZ = Math.floor(worldZ / 4) * 4;
    
    const fx = (worldX - gridX) / 4;
    const fz = (worldZ - gridZ) / 4;
    
    // Optimisation: if we are exactly on grid, skip interpolation
    // But worldX/Z are usually floats due to zoom/scroll, so unlikely.
    
    // We sample 4 corners. 
    // In a real optimized renderer, we would cache these or process in 4x4 blocks.
    // For this preview, direct sampling is acceptable given chunks.
    const c00 = sampleTerrainAt(noise, gridX, gridZ);
    const c10 = sampleTerrainAt(noise, gridX + 4, gridZ);
    const c01 = sampleTerrainAt(noise, gridX, gridZ + 4);
    const c11 = sampleTerrainAt(noise, gridX + 4, gridZ + 4);
    
    // Bilinear interpolation of height
    const h0 = c00.baseHeight + (c10.baseHeight - c00.baseHeight) * fx;
    const h1 = c01.baseHeight + (c11.baseHeight - c01.baseHeight) * fx;
    const finalHeight = h0 + (h1 - h0) * fz;
    
    // Biome: nearest neighbor
    const nearest = fx < 0.5
      ? (fz < 0.5 ? c00 : c01)
      : (fz < 0.5 ? c10 : c11);
      
    return {
        height: finalHeight,
        biome: nearest.biome,
        isRiver: nearest.isRiver
    };
};

const WorldPreview = ({ seed, width = 512, height = 512, initialScale = 4 }) => {
  const canvasRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // View State
  const [view, setView] = useState({ x: 0, z: 0, zoom: initialScale });
  const [spawnPoint, setSpawnPoint] = useState(null);
  
  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, z: 0 });
  
  // Generation Ref to handle cancellation
  const generationRef = useRef({ cancelled: false, id: 0 });

  // Memoized Noise
  const noise = useMemo(() => {
    if (seed === undefined || seed === null) return null;
    return new NoiseGenerators(seed);
  }, [seed]);

  // 1. Find Spawn Point (Once per seed)
  useEffect(() => {
    if (!noise) return;

    const findSpawn = () => {
      // Spiral search
      for (let radius = 0; radius < 500; radius += 16) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          const testX = Math.floor(Math.cos(angle) * radius);
          const testZ = Math.floor(Math.sin(angle) * radius);
          
          const { height } = getTerrainDataInterpolated(noise, testX, testZ);
          
          if (height > SEA_LEVEL + 4) {
             return { x: testX, z: testZ };
          }
        }
      }
      return { x: 0, z: 0 };
    };

    setSpawnPoint(findSpawn());
  }, [noise]);

  // 2. Generate Map
  const generateMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !noise) return;
    
    const ctx = canvas.getContext('2d');
    
    // Cancel previous
    generationRef.current.cancelled = true;
    const currentGenId = Date.now();
    generationRef.current = { cancelled: false, id: currentGenId };
    
    setIsGenerating(true);
    setProgress(0);

    // Clear canvas completely to avoid artifacts
    // (We removed the shifting optimization to fix the "world changing" bug)
    ctx.clearRect(0, 0, width, height);

    let currentY = 0;
    // Processing fewer rows per frame to maintain 60fps responsiveness during drag
    // 512 width * 20 rows * 4 samples = ~40k noise calls per frame. Very safe.
    const CHUNK_Y = 20; 

    const generateStep = () => {
      if (generationRef.current.id !== currentGenId || generationRef.current.cancelled) return;

      const endY = Math.min(currentY + CHUNK_Y, height);
      const imgData = ctx.createImageData(width, endY - currentY);
      const data = imgData.data;

      for (let y = currentY; y < endY; y++) {
        const stripY = y - currentY;
        for (let x = 0; x < width; x++) {
          const worldX = view.x + (x - width / 2) * view.zoom;
          const worldZ = view.z + (y - height / 2) * view.zoom;

          // Get terrain data (interpolated)
          const terrain = getTerrainDataInterpolated(noise, worldX, worldZ);
          
          // Colors
          let color = terrain.biome.color || '#7CFC00';
          if (terrain.isRiver) color = '#4169E1';
          
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);

          // Shading: sample next point to approximate gradient
          // We assume light comes from top-left
          const nextTerrain = getTerrainDataInterpolated(noise, worldX + view.zoom, worldZ + view.zoom);
          const heightDiff = nextTerrain.height - terrain.height;
          
          // Amplify slope effect for visibility
          const shade = heightDiff * 2.0; 
          const factor = 1 + Math.max(-0.4, Math.min(0.4, shade / 20));

          const idx = (stripY * width + x) * 4;
          data[idx] = Math.max(0, Math.min(255, r * factor));
          data[idx+1] = Math.max(0, Math.min(255, g * factor));
          data[idx+2] = Math.max(0, Math.min(255, b * factor));
          data[idx+3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, currentY);
      
      currentY = endY;
      setProgress(Math.round((currentY / height) * 100));

      if (currentY < height) {
        requestAnimationFrame(generateStep);
      } else {
        setIsGenerating(false);
      }
    };

    requestAnimationFrame(generateStep);

  }, [noise, view, width, height]);

  // Trigger generation on view/seed change
  useEffect(() => {
    generateMap();
  }, [generateMap]);


  // Event Handlers
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1.25 : 0.8;
    setView(v => ({ ...v, zoom: Math.max(0.5, Math.min(50, v.zoom * delta)) }));
  }, []);

  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, z: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStart.x;
    const dz = e.clientY - dragStart.z;
    
    setView(v => ({
      ...v,
      x: v.x - dx * v.zoom, 
      z: v.z - dz * v.zoom
    }));
    
    setDragStart({ x: e.clientX, z: e.clientY });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleReset = useCallback(() => {
    if (spawnPoint) {
      setView({ x: spawnPoint.x, z: spawnPoint.z, zoom: initialScale });
    } else {
      setView({ x: 0, z: 0, zoom: initialScale });
    }
  }, [spawnPoint, initialScale]);


  // Spawn Marker Calculation
  const spawnScreenX = spawnPoint ? width / 2 + (spawnPoint.x - view.x) / view.zoom : -100;
  const spawnScreenZ = spawnPoint ? height / 2 + (spawnPoint.z - view.z) / view.zoom : -100;
  const isSpawnVisible = spawnScreenX >= 0 && spawnScreenX <= width && spawnScreenZ >= 0 && spawnScreenZ <= height;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <div style={{ 
        position: 'relative', 
        width, 
        height, 
        border: '4px solid #000', 
        backgroundColor: '#1a1a1a',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        overflow: 'hidden'
      }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas 
          ref={canvasRef} 
          width={width} 
          height={height} 
          style={{ display: 'block', imageRendering: 'pixelated' }}
        />
        
        {/* Overlays */}
        <svg 
            width={width} 
            height={height} 
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
             {isSpawnVisible && (
                 <g transform={`translate(${spawnScreenX}, ${spawnScreenZ})`}>
                     <circle r="6" stroke="#FF0000" strokeWidth="2" fill="rgba(255,0,0,0.2)" />
                     <line x1="-4" y1="0" x2="4" y2="0" stroke="#FF0000" strokeWidth="2" />
                     <line x1="0" y1="-4" x2="0" y2="4" stroke="#FF0000" strokeWidth="2" />
                 </g>
             )}
             
             <line x1={width/2 - 5} y1={height/2} x2={width/2 + 5} y2={height/2} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
             <line x1={width/2} y1={height/2 - 5} x2={width/2} y2={height/2 + 5} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        </svg>

        {isGenerating && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: `${progress}%`,
            height: '4px',
            backgroundColor: '#00FF00',
            transition: 'width 0.1s linear'
          }} />
        )}
      </div>
      
      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: '8px 15px',
        borderRadius: '8px',
        border: '1px solid #444',
        backdropFilter: 'blur(4px)'
      }}>
        <div style={{ display: 'flex', gap: '5px' }}>
            <button 
            onClick={() => setView(v => ({ ...v, zoom: Math.max(0.5, v.zoom * 0.8) }))}
            style={btnStyle} title="Приблизить">+</button>
            <button 
            onClick={() => setView(v => ({ ...v, zoom: Math.min(50, v.zoom * 1.2) }))}
            style={btnStyle} title="Отдалить">−</button>
        </div>
        
        <span style={{ color: '#fff', minWidth: '80px', textAlign: 'center', fontFamily: 'monospace' }}>
          x{view.zoom.toFixed(1)}
        </span>
        
        <div style={{ width: '1px', height: '20px', background: '#666', margin: '0 5px' }}></div>

        <button 
          onClick={handleReset}
          style={{ ...btnStyle, width: 'auto', padding: '5px 15px' }}
        >
          {spawnPoint ? `🎯 Спавн [${spawnPoint.x}, ${spawnPoint.z}]` : 'Спавн'}
        </button>
        
        <div style={{ width: '1px', height: '20px', background: '#666', margin: '0 5px' }}></div>
        
        <div style={{ color: '#ccc', fontSize: '12px', fontFamily: 'monospace' }}>
           X: {Math.round(view.x)} Z: {Math.round(view.z)}
        </div>
      </div>
    </div>
  );
};

const btnStyle = {
    backgroundColor: '#333',
    border: '1px solid #555',
    color: '#fff',
    width: '30px',
    height: '30px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'background 0.2s'
};

export default WorldPreview;
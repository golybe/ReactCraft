import { BLOCK_TYPES } from '../../constants/blocks';
import { PerformanceMetrics } from '../../utils/performance';

export class LiquidSimulator {
  constructor(chunkManager) {
    this.chunkManager = chunkManager;
    this.activeLiquids = new Set();
    this.MAX_LEVEL = 255; // Increased precision for smoother flow
    // tickRate removed - update every frame for smooth animation
    
    // Limits for smooth animation (per frame at 60fps)
    this.MAX_FALL_SPEED = 8; // Max units per frame when falling (slower)
    this.MAX_SPREAD_SPEED = 4; // Max units per frame when spreading sideways
    
    // Порог стабильности — если разница меньше, вода "засыпает"
    this.STABILITY_THRESHOLD = 16;
  }

  // Add a coordinate to be checked
  addActiveLiquid(x, y, z) {
    this.activeLiquids.add(`${x},${y},${z}`);
  }

  // Handle external block updates (placement/destruction)
  onBlockUpdate(x, y, z) {
    this.activeLiquids.add(`${x},${y},${z}`);
    this.wakeNeighbors(x, y, z, this.activeLiquids);
  }

  update() {
    // Update every frame for smooth animation
    if (this.activeLiquids.size === 0) return false;

    const startTime = performance.now();
    const TIME_BUDGET = 3; // ms

    // Swap sets to avoid Array.from allocation and copy overhead
    const currentSet = this.activeLiquids;
    this.activeLiquids = new Set(); // New set for next tick + deferred items
    
    const nextSet = new Set(); // Triggered neighbors
    
    // Start Batch Update
    this.chunkManager.startBatch();

    let changesMade = false;
    let count = 0;
    let processedCount = 0;

    for (const key of currentSet) {
        count++;
        
        // Check budget every 5 blocks
        if (count % 5 === 0) {
            const timeBudgetExceeded = (performance.now() - startTime) > TIME_BUDGET;
            const dirtyChunksExceeded = this.chunkManager.batcher?.batchLightingDirtyKeys?.size >= 2;
            
            if (timeBudgetExceeded || dirtyChunksExceeded) {
                // Time limit reached!
                // Push current item and ALL remaining items to deferred set (activeLiquids)
                this.activeLiquids.add(key);
                continue; // Loop continues, but we just re-add to queue
            }
        }
        
        // If we are in "skip mode" (determined by continue above, but for subsequent items)
        // Wait, 'continue' only skips current iteration.
        // We need a flag.
        if ((performance.now() - startTime) > TIME_BUDGET) {
             this.activeLiquids.add(key);
             continue;
        }

        const parts = key.split(',');
        const x = parseInt(parts[0]);
        const y = parseInt(parts[1]);
        const z = parseInt(parts[2]);
        
        this.simulateBlock(x, y, z, nextSet);
        processedCount++;
    }
    
    // Commit Batch Update
    changesMade = this.chunkManager.commitBatch();

    // Add triggered updates to the main set
    for (const key of nextSet) {
      this.activeLiquids.add(key);
    }
    
    // Update metric
    PerformanceMetrics.setMetric('activeLiquids', currentSet.size);
    PerformanceMetrics.setMetric('processedLiquids', processedCount);
    
    return changesMade;
  }

  simulateBlock(x, y, z, nextSet) {
    const block = this.chunkManager.getBlock(x, y, z);
    
    // Если это не вода, нам не нужно ничего делать.
    if (block !== BLOCK_TYPES.WATER) {
        return;
    }

    let meta = this.chunkManager.getMetadata(x, y, z);
    let mass = meta === 0 ? this.MAX_LEVEL : meta;

    // 1. ОПТИМИЗАЦИЯ "ГЛУБОКОЙ ВОДЫ" (SURFACE ONLY)
    // Если блок полный (255) и сверху тоже есть вода - он под давлением.
    // Его не нужно симулировать, пока вода сверху не исчезнет.
    if (mass === this.MAX_LEVEL) {
        const aboveBlock = this.chunkManager.getBlock(x, y + 1, z);
        if (aboveBlock === BLOCK_TYPES.WATER) {
            return; // Спим, пока нас не разбудят изменения сверху
        }
    }

    if (mass <= 0) {
        this.chunkManager.setBlock(x, y, z, BLOCK_TYPES.AIR);
        this.wakeNeighbors(x, y, z, nextSet);
        return;
    }

    // 1. Flow Down (Gravity)
    // Priority: Move mass downwards
    if (y > 0) {
        const belowBlock = this.chunkManager.getBlock(x, y - 1, z);
        
        if (belowBlock === BLOCK_TYPES.AIR) {
            // Drop mass with limited speed for smooth animation
            const transfer = Math.min(mass, this.MAX_FALL_SPEED);
            
            this.chunkManager.setBlock(x, y - 1, z, BLOCK_TYPES.WATER, transfer);
            mass -= transfer;
            
            if (mass <= 0) {
                this.chunkManager.setBlock(x, y, z, BLOCK_TYPES.AIR);
            } else {
                this.chunkManager.setBlock(x, y, z, BLOCK_TYPES.WATER, mass);
            }
            
            nextSet.add(`${x},${y-1},${z}`);
            if (mass > 0) nextSet.add(`${x},${y},${z}`);
            this.wakeNeighbors(x, y, z, nextSet);
            return;
        } else if (belowBlock === BLOCK_TYPES.WATER) {
            const belowMeta = this.chunkManager.getMetadata(x, y - 1, z);
            const belowMass = belowMeta === 0 ? this.MAX_LEVEL : belowMeta;

            if (belowMass < this.MAX_LEVEL) {
                const space = this.MAX_LEVEL - belowMass;
                const transfer = Math.min(mass, space, this.MAX_FALL_SPEED);

                if (transfer > 0) {
                    this.chunkManager.setBlock(x, y - 1, z, BLOCK_TYPES.WATER, belowMass + transfer);
                    mass -= transfer;
                    nextSet.add(`${x},${y-1},${z}`);

                    if (mass <= 0) {
                        this.chunkManager.setBlock(x, y, z, BLOCK_TYPES.AIR);
                        this.wakeNeighbors(x, y, z, nextSet);
                        return;
                    } else {
                        this.chunkManager.setBlock(x, y, z, BLOCK_TYPES.WATER, mass);
                        nextSet.add(`${x},${y},${z}`);
                    }
                }
            }
        }
    }

    // 2. Flow Sideways (Spread)
    // Only if we still have mass and didn't fall completely
    if (mass > 0) {
        const neighbors = [
            { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
            { dx: 0, dz: 1 }, { dx: 0, dz: -1 }
        ];

        let validNeighbors = [];
        let totalMass = mass;

        // Collect valid neighbors
        for (const { dx, dz } of neighbors) {
            const nx = x + dx;
            const nz = z + dz;
            
            // Пропускаем незагруженные чанки (предотвращает утечку в пустоту)
            if (!this.chunkManager.isChunkLoaded(nx, nz)) continue;

            const nBlock = this.chunkManager.getBlock(nx, y, nz);
            
            // Skip solid blocks
            if (nBlock !== BLOCK_TYPES.AIR && nBlock !== BLOCK_TYPES.WATER) continue;

            let nMass = 0;
            if (nBlock === BLOCK_TYPES.WATER) {
                const nMeta = this.chunkManager.getMetadata(nx, y, nz);
                nMass = nMeta === 0 ? this.MAX_LEVEL : nMeta;
            }

            // Water flows only to lower level
            if (mass > nMass) {
                validNeighbors.push({ x: nx, z: nz, mass: nMass });
                totalMass += nMass;
            }
        }

        // If there are places to flow
        if (validNeighbors.length > 0) {
            // Calculate average mass (communicating vessels)
            const averageMass = Math.floor(totalMass / (validNeighbors.length + 1));
            
            // Порог стабильности: если изменение слишком маленькое — засыпаем
            if (Math.abs(averageMass - mass) < this.STABILITY_THRESHOLD) {
                return; // Стабильно — НЕ добавляем в nextSet!
            }

            let totalTransferred = 0;

            // Distribute to neighbors with limited speed for smooth animation
            for (const neighbor of validNeighbors) {
                // Сколько хотим передать этому соседу
                const targetMass = averageMass;
                const diff = targetMass - neighbor.mass;
                
                if (diff <= 0) continue; // Сосед уже на уровне или выше
                
                // Ограничиваем скорость и не передаём больше, чем осталось
                const maxCanTransfer = mass - totalTransferred;
                if (maxCanTransfer <= 0) break;
                
                const transfer = Math.min(diff, this.MAX_SPREAD_SPEED, maxCanTransfer);
                
                if (transfer <= 0) continue;
                
                const newNeighborMass = Math.min(neighbor.mass + transfer, this.MAX_LEVEL);
                const actualTransfer = newNeighborMass - neighbor.mass;
                
                if (actualTransfer > 0) {
                    this.chunkManager.setBlock(neighbor.x, y, neighbor.z, BLOCK_TYPES.WATER, newNeighborMass);
                    nextSet.add(`${neighbor.x},${y},${neighbor.z}`);
                    totalTransferred += actualTransfer;
                }
            }

            // Обновляем себя
            if (totalTransferred > 0) {
                mass -= totalTransferred;
                
                if (mass <= 0) {
                    this.chunkManager.setBlock(x, y, z, BLOCK_TYPES.AIR);
                } else {
                    this.chunkManager.setBlock(x, y, z, BLOCK_TYPES.WATER, mass);
                }
                
                nextSet.add(`${x},${y},${z}`);
                
                // Будим соседей только при значительных изменениях
                if (totalTransferred > this.STABILITY_THRESHOLD) {
                    this.wakeNeighbors(x, y, z, nextSet);
                }
            }
        }
    }
  }

  wakeNeighbors(x, y, z, set) {
    set.add(`${x+1},${y},${z}`);
    set.add(`${x-1},${y},${z}`);
    set.add(`${x},${y},${z+1}`);
    set.add(`${x},${y},${z-1}`);
    set.add(`${x},${y+1},${z}`);
  }
}
/**
 * Block Mining System
 * 
 * Manages block breaking progress, timing, and animations.
 * Used in Survival mode for delayed block destruction.
 */

import { BlockRegistry } from '../blocks/BlockRegistry';
import { TOOL_TYPES } from '../blocks/Block';

export class BlockMiningManager {
  constructor() {
    this.currentTarget = null; // { x, y, z, blockId }
    this.progress = 0; // 0-1
    this.breakTime = 0; // Total time needed (seconds)
    this.elapsedTime = 0; // Time spent mining (seconds)
    this.onProgressChange = null;
    this.onBlockBroken = null;
  }

  /**
   * Start mining a block
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @param {number} blockId 
   * @param {string} toolType - current tool type
   * @param {number} toolEfficiency - tool efficiency modifier
   */
  startMining(x, y, z, blockId, toolType = TOOL_TYPES.HAND, toolEfficiency = 1.0) {
    const block = BlockRegistry.get(blockId);
    if (!block) return false;
    
    // Unbreakable blocks
    if (block.unbreakable) return false;
    
    // Calculate break time
    const breakTime = block.getBreakTime(toolType, toolEfficiency);
    
    // If same block, continue mining but update break time (in case tool changed)
    if (this.currentTarget && 
        this.currentTarget.x === x && 
        this.currentTarget.y === y && 
        this.currentTarget.z === z) {
      
      // Если время добычи изменилось (сменили инструмент), нужно скорректировать прогресс
      if (this.breakTime !== breakTime && breakTime > 0) {
        // Сохраняем текущий прогресс в процентах, чтобы он не прыгал
        const currentProgress = this.elapsedTime / this.breakTime;
        this.breakTime = breakTime;
        this.elapsedTime = currentProgress * breakTime;
      }
      return true;
    }
    
    // New target - reset progress
    this.currentTarget = { x, y, z, blockId };
    this.breakTime = breakTime;
    this.elapsedTime = 0;
    this.progress = 0;
    
    this._notifyProgress();
    return true;
  }

  /**
   * Update mining progress
   * @param {number} deltaTime - time since last update (seconds)
   * @returns {boolean} - true if block was broken
   */
  update(deltaTime) {
    if (!this.currentTarget) return false;
    
    this.elapsedTime += deltaTime;
    this.progress = Math.min(1, this.elapsedTime / this.breakTime);
    
    this._notifyProgress();
    
    // Check if block is broken
    if (this.progress >= 1) {
      const target = this.currentTarget;
      this.reset();
      
      if (this.onBlockBroken) {
        this.onBlockBroken(target.x, target.y, target.z, target.blockId);
      }
      return true;
    }
    
    return false;
  }

  /**
   * Stop mining (player released button or looked away)
   */
  stopMining() {
    if (this.currentTarget) {
      this.reset();
    }
  }

  /**
   * Reset mining state
   */
  reset() {
    this.currentTarget = null;
    this.progress = 0;
    this.breakTime = 0;
    this.elapsedTime = 0;
    this._notifyProgress();
  }

  /**
   * Check if currently mining a specific block
   */
  isMining(x, y, z) {
    if (!this.currentTarget) return false;
    return this.currentTarget.x === x && 
           this.currentTarget.y === y && 
           this.currentTarget.z === z;
  }

  /**
   * Get current mining target
   */
  getTarget() {
    return this.currentTarget;
  }

  /**
   * Get current progress (0-1)
   */
  getProgress() {
    return this.progress;
  }

  /**
   * Get the break stage (0-9) for texture animation
   */
  getBreakStage() {
    return Math.min(9, Math.floor(this.progress * 10));
  }

  _notifyProgress() {
    if (this.onProgressChange) {
      this.onProgressChange({
        target: this.currentTarget,
        progress: this.progress,
        stage: this.getBreakStage()
      });
    }
  }
}

// Singleton instance
let miningManager = null;

export const getMiningManager = () => {
  if (!miningManager) {
    miningManager = new BlockMiningManager();
  }
  return miningManager;
};

export const resetMiningManager = () => {
  if (miningManager) {
    miningManager.reset();
  }
  miningManager = null;
};

export default {
  BlockMiningManager,
  getMiningManager,
  resetMiningManager
};

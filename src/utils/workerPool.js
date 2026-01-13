/**
 * Worker Pool Manager
 *
 * Manages a pool of Web Workers for parallel chunk generation.
 * Features:
 * - Automatic pool sizing based on hardware
 * - Task queue with priority
 * - Transferable ArrayBuffer support
 * - Graceful fallback for environments without workers
 */

import { log } from './logger';

// =====================================================
// WORKER POOL
// =====================================================

export class WorkerPool {
  constructor(WorkerClass, poolSize = null) {
    this.WorkerClass = WorkerClass;
    // Минимум 2 воркера, максимум 6
    const cores = navigator.hardwareConcurrency || 4;
    this.poolSize = poolSize || Math.max(2, Math.min(cores - 1, 6));
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.taskCounter = 0;
    this.pendingTasks = new Map(); // taskId -> { resolve, reject, timeout }
    this.isReady = false;

    log('WorkerPool', `Initializing pool with ${this.poolSize} workers`);
    
    this.initWorkers();
  }

  /**
   * Initialize worker pool
   */
  initWorkers() {
    log('WorkerPool', `initWorkers starting, poolSize: ${this.poolSize}, WorkerClass: ${this.WorkerClass?.name || typeof this.WorkerClass}`);
    
    if (!this.WorkerClass) {
      log('WorkerPool', 'ERROR: WorkerClass is null/undefined!');
      console.error('[WorkerPool] WorkerClass is null/undefined!');
      return;
    }
    
    for (let i = 0; i < this.poolSize; i++) {
      try {
        log('WorkerPool', `Creating worker ${i}/${this.poolSize}...`);
        const worker = new this.WorkerClass();
        
        if (!worker) {
          log('WorkerPool', `Worker ${i} is null after creation!`);
          continue;
        }
        
        worker.onmessage = (e) => this.handleWorkerMessage(i, e.data);
        worker.onerror = (error) => this.handleWorkerError(i, error);
        
        this.workers.push(worker);
        this.availableWorkers.push(i);
        log('WorkerPool', `Worker ${i} created and added to pool`);
      } catch (e) {
        log('WorkerPool', `FAILED to create worker ${i}: ${e.message}`);
        log('WorkerPool', `Stack: ${e.stack}`);
        console.error(`[WorkerPool] Failed to create worker ${i}:`, e);
      }
    }

    log('WorkerPool', `initWorkers complete: ${this.workers.length} workers created, ${this.availableWorkers.length} available`);

    // Mark as ready immediately
    this.checkReadyState();
  }

  /**
   * Check if all workers are ready
   */
  checkReadyState() {
    // Воркеры готовы сразу после создания в современных браузерах
    this.isReady = true;
    log('WorkerPool', `Pool marked as READY: ${this.workers.length} workers, ${this.availableWorkers.length} available`);
    
    // Сразу начинаем обработку если есть задачи
    if (this.taskQueue.length > 0) {
      log('WorkerPool', `Processing ${this.taskQueue.length} queued tasks immediately`);
      this.processQueue();
    }
  }

  /**
   * Handle message from worker
   */
  handleWorkerMessage(workerId, data) {
    const { taskId, type, result, error } = data;

    log('WorkerPool', `Message from worker ${workerId}: taskId=${taskId}, type=${type}, error=${error || 'none'}`);

    // Worker ready signal
    if (type === 'ready') {
      log('WorkerPool', `Worker ${workerId} is ready`);
      return;
    }

    // Task completion
    if (taskId !== undefined) {
      const task = this.pendingTasks.get(taskId);
      
      if (task) {
        // Clear timeout
        if (task.timeout) {
          clearTimeout(task.timeout);
        }

        // Remove from pending
        this.pendingTasks.delete(taskId);

        // Return worker to pool
        this.availableWorkers.push(workerId);

        // Resolve or reject
        if (error) {
          task.reject(new Error(error));
        } else {
          task.resolve(result);
        }

        // Process next task in queue
        this.processQueue();
      }
    }
  }

  /**
   * Handle worker error
   */
  handleWorkerError(workerId, error) {
    log('WorkerPool', `Worker ${workerId} ERROR: ${error?.message}`);
    log('WorkerPool', `Error filename: ${error?.filename}`);
    log('WorkerPool', `Error lineno: ${error?.lineno}`);
    console.error(`[WorkerPool] Worker ${workerId} error:`, error);
    
    // Find any tasks assigned to this worker and reject them
    // (This is complex, for now just log)
  }

  /**
   * Enqueue a task
   */
  enqueueTask(type, data, priority = 0) {
    return new Promise((resolve, reject) => {
      const taskId = this.taskCounter++;
      
      log('WorkerPool', `Enqueuing task ${taskId}: ${type}, priority ${priority}`);
      
      this.taskQueue.push({
        taskId,
        type,
        data,
        priority,
        resolve,
        reject
      });

      // Sort by priority (higher priority first)
      this.taskQueue.sort((a, b) => b.priority - a.priority);

      // Try to process immediately
      this.processQueue();
    });
  }

  /**
   * Process task queue
   */
  processQueue() {
    if (!this.isReady) {
      log('WorkerPool', 'processQueue called but not ready yet');
      return;
    }

    log('WorkerPool', `processQueue: ${this.taskQueue.length} tasks, ${this.availableWorkers.length} available workers`);

    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const task = this.taskQueue.shift();
      const workerId = this.availableWorkers.shift();
      
      log('WorkerPool', `Dispatching task ${task.taskId} to worker ${workerId}`);

      // Create timeout (30 seconds max)
      const timeout = setTimeout(() => {
        log('WorkerPool', `Task ${task.taskId} TIMED OUT`);
        this.pendingTasks.delete(task.taskId);
        this.availableWorkers.push(workerId); // Return worker
        task.reject(new Error('Task timeout'));
      }, 30000);

      // Store task
      this.pendingTasks.set(task.taskId, {
        ...task,
        timeout
      });

      // Send to worker
      this.workers[workerId].postMessage({
        taskId: task.taskId,
        type: task.type,
        ...task.data
      });
    }
  }

  /**
   * Generate chunk (convenience method)
   */
  generateChunk(chunkX, chunkZ, seed, priority = 0) {
    return this.enqueueTask('generateChunk', { chunkX, chunkZ, seed }, priority);
  }

  /**
   * Terminate all workers (or just clear queue if global pool)
   */
  terminate(forceTerminate = false) {
    if (!forceTerminate) {
      // Для глобального пула - только очищаем очередь, не терминируем воркеры
      log('WorkerPool', 'Soft terminate: clearing task queue only, keeping workers');
      
      // Reject all pending tasks
      for (const [taskId, task] of this.pendingTasks) {
        if (task.timeout) {
          clearTimeout(task.timeout);
        }
        task.reject(new Error('Task cancelled'));
      }
      
      this.pendingTasks.clear();
      this.taskQueue.length = 0;
      // НЕ сбрасываем isReady и не терминируем воркеры!
      return;
    }
    
    // Принудительная терминация - только при закрытии приложения
    log('WorkerPool', 'FORCE terminating all workers');
    
    // Reject all pending tasks
    for (const [taskId, task] of this.pendingTasks) {
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
      task.reject(new Error('Worker pool terminated'));
    }
    
    this.pendingTasks.clear();
    this.taskQueue.length = 0;

    // Terminate workers
    for (const worker of this.workers) {
      worker.terminate();
    }

    this.workers.length = 0;
    this.availableWorkers.length = 0;
    this.isReady = false;
  }

  /**
   * Get pool status
   */
  getStatus() {
    return {
      poolSize: this.poolSize,
      availableWorkers: this.availableWorkers.length,
      queuedTasks: this.taskQueue.length,
      pendingTasks: this.pendingTasks.size,
      isReady: this.isReady
    };
  }
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

let globalPool = null;
let globalWorkerClass = null;

export function getWorkerPool(WorkerClass) {
  // Если пул уже существует и готов - возвращаем его
  if (globalPool && globalPool.workers.length > 0) {
    log('WorkerPool', `Returning existing pool with ${globalPool.workers.length} workers`);
    return globalPool;
  }
  
  // Если пул существует но без воркеров - пересоздаём
  if (globalPool) {
    log('WorkerPool', 'Pool exists but has no workers, recreating...');
    globalPool = null;
  }
  
  // Создаём новый пул
  log('WorkerPool', 'Creating new global WorkerPool...');
  globalWorkerClass = WorkerClass;
  globalPool = new WorkerPool(WorkerClass);
  log('WorkerPool', `Global pool created with ${globalPool.workers.length} workers`);
  return globalPool;
}

export function terminateWorkerPool() {
  // НЕ терминируем глобальный пул - он должен жить всё время работы приложения
  log('WorkerPool', 'terminateWorkerPool called - ignoring for global pool');
}

export function forceTerminateWorkerPool() {
  // Принудительная терминация - только для полного закрытия приложения
  if (globalPool) {
    log('WorkerPool', 'Force terminating global pool');
    globalPool.terminate(true); // forceTerminate = true
    globalPool = null;
    globalWorkerClass = null;
  }
}

export default {
  WorkerPool,
  getWorkerPool,
  terminateWorkerPool,
  forceTerminateWorkerPool
};

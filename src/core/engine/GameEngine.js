/**
 * GameEngine - главный класс игры
 * Управляет состоянием игры и координирует взаимодействие между системами
 */
import { World } from '../world/World';
import { BlockMiningManager } from '../physics/BlockMining';
import { Inventory } from '../inventory/Inventory';
import { EntityManager } from '../entities/EntityManager';
import { Mob } from '../entities/Mob';
import { MobRegistry } from '../entities/MobRegistry';
import { BLOCK_TYPES } from '../../constants/blocks';
import { GAME_MODES } from '../../constants/gameMode';
import { TOTAL_INVENTORY_SIZE } from '../../utils/inventory';
import { registerDefaultMobs } from '../../constants/mobs';

export class GameEngine {
  constructor(worldInfo, initialChunks, initialPlayerPos) {
    this.worldInfo = worldInfo;
    this.initialChunks = initialChunks;
    this.initialPlayerPos = initialPlayerPos;
    
    // Игровые системы
    this.world = null;
    this.miningManager = null;
    this.inventory = null;
    this.entityManager = new EntityManager();

    // Регистрируем типы мобов
    registerDefaultMobs();
    
    // Состояние игры
    this.gameMode = worldInfo?.gameMode ?? GAME_MODES.SURVIVAL;
    this.isPaused = false;
    this.isLoading = true;
    
    // Инвентарь (используем Inventory класс)
    this.inventory = this.initializeInventory(worldInfo?.inventory);
    this.selectedSlot = 0;
    
    // Позиция игрока
    this.playerPos = initialPlayerPos || { x: 0, y: 64, z: 0 };
    this.playerYaw = 0;
    this.playerPitch = 0;
    this.isFlying = false;
    
    // UI состояние
    this.isChatOpen = false;
    this.isInventoryOpen = false;
    
    // Выпавшие предметы (Survival)
    this.droppedItems = [];
    
    // Состояние добычи (Survival)
    this.miningState = { target: null, progress: 0, stage: 0 };
    this.isMouseDown = false;
    
    // Callbacks для React
    this.onStateChange = null;
    this.onChunksUpdate = null;
    this.onInventoryChange = null;
  }

  /**
   * Инициализация инвентаря
   */
  initializeInventory(savedInventory) {
    if (savedInventory) {
      return Inventory.deserialize(savedInventory, TOTAL_INVENTORY_SIZE);
    }
    return new Inventory(TOTAL_INVENTORY_SIZE);
  }

  /**
   * Инициализация игры
   */
  async initialize() {
    if (!this.world && this.worldInfo) {
      // Создаем World (включает ChunkManager и LiquidSimulator)
      this.world = new World(this.worldInfo.seed, this.initialChunks || {});
      
      // Инициализация Mining Manager
      this.miningManager = new BlockMiningManager();
      this.miningManager.onProgressChange = (state) => {
        this.miningState = state;
        this.notifyStateChange();
      };
      
      // Callback для обновления чанков
      this.world.setOnChunksUpdated(() => {
        if (this.onChunksUpdate) {
          this.onChunksUpdate({ ...this.world.chunks });
        }
        this.notifyStateChange();
      });
      
      // Первая загрузка чанков
      this.world.update(this.playerPos);
    }
  }

  /**
   * Обновление игры (вызывается каждый кадр)
   */
  update(deltaTime) {
    if (this.isPaused || this.isLoading) return;

    // Обновление мира (чанки и физика жидкости)
    if (this.world) {
      this.world.update(this.playerPos);
    }

    // Обновление сущностей (мобов)
    if (this.entityManager) {
      this.entityManager.update(deltaTime, this.world?.chunks, {
        player: this.playerRef, // Ссылка на игрока для AI
        playerPos: this.playerPos
      });
    }
  }

  /**
   * Спавн моба в мире
   * @param {string} mobType - тип моба из MOB_TYPES
   * @param {number} x - X координата
   * @param {number} y - Y координата
   * @param {number} z - Z координата
   * @returns {Mob|null} - созданный моб или null при ошибке
   */
  spawnMob(mobType, x, y, z) {
    if (!MobRegistry.exists(mobType)) {
      console.error(`[GameEngine] Unknown mob type: ${mobType}`);
      return null;
    }

    const mob = new Mob(x, y, z, mobType);

    // Если есть PhysicsEngine, устанавливаем его
    if (this.physicsEngine) {
      mob.setPhysicsEngine(this.physicsEngine);
    }

    this.entityManager.spawn(mob);
    this.notifyStateChange();

    return mob;
  }

  /**
   * Удалить моба
   * @param {string} mobId - ID моба
   */
  despawnMob(mobId) {
    this.entityManager.despawn(mobId);
    this.notifyStateChange();
  }

  /**
   * Получить всех мобов
   * @returns {Mob[]}
   */
  getMobs() {
    return this.entityManager.getAll().filter(e => e instanceof Mob);
  }

  /**
   * Установить ссылку на игрока (для AI мобов)
   * @param {Player} player
   */
  setPlayerRef(player) {
    this.playerRef = player;
  }

  /**
   * Уведомление об изменении состояния
   */
  notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        gameMode: this.gameMode,
        isPaused: this.isPaused,
        isLoading: this.isLoading,
        inventory: this.inventory ? this.inventory.getSlots() : [],
        selectedSlot: this.selectedSlot,
        playerPos: this.playerPos,
        playerYaw: this.playerYaw,
        playerPitch: this.playerPitch,
        isFlying: this.isFlying,
        isChatOpen: this.isChatOpen,
        isInventoryOpen: this.isInventoryOpen,
        droppedItems: this.droppedItems,
        miningState: this.miningState,
        isMouseDown: this.isMouseDown
      });
    }
  }

  /**
   * Установить режим игры
   */
  setGameMode(mode) {
    this.gameMode = mode;
    this.notifyStateChange();
  }

  /**
   * Пауза/возобновление
   */
  pause() {
    this.isPaused = true;
    this.notifyStateChange();
  }

  resume() {
    this.isPaused = false;
    this.notifyStateChange();
  }

  /**
   * Разрушение блока
   */
  breakBlock(x, y, z) {
    if (!this.world) return false;
    
    const blockId = this.world.getBlock(x, y, z);
    if (!blockId || blockId === BLOCK_TYPES.AIR) return false;
    
    // Удаляем блок из мира
    const success = this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
    if (success && this.onChunksUpdate) {
      this.onChunksUpdate({ ...this.world.chunks });
    }
    
    return success;
  }

  /**
   * Установка блока
   */
  placeBlock(x, y, z, blockType) {
    if (!this.world || !blockType) return false;
    
    // Проверяем, есть ли блок в инвентаре (Survival режим)
    if (this.gameMode === GAME_MODES.SURVIVAL && this.inventory) {
      const hasItem = this.inventory.hasItems(blockType, 1);
      if (!hasItem) return false;
    }
    
    // Устанавливаем блок
    const success = this.world.setBlock(x, y, z, blockType);
    if (success) {
      // Расходуем предмет из инвентаря (Survival режим)
      if (this.gameMode === GAME_MODES.SURVIVAL && this.inventory) {
        this.inventory.removeFromSlot(this.selectedSlot, 1);
        this.notifyStateChange();
      }
      
      if (this.onChunksUpdate) {
        this.onChunksUpdate({ ...this.world.chunks });
      }
    }
    
    return success;
  }
  
  /**
   * Получить блок в позиции
   */
  getBlock(x, y, z) {
    if (!this.world) return BLOCK_TYPES.AIR;
    return this.world.getBlock(x, y, z);
  }
  
  /**
   * Добавить предмет в инвентарь
   */
  addItemToInventory(type, count = 1) {
    if (!this.inventory) return { remaining: count };
    const result = this.inventory.addToFullInventory(type, count);
    this.notifyStateChange();
    return result;
  }
  
  /**
   * Установить выбранный слот
   */
  setSelectedSlot(slot) {
    if (slot >= 0 && slot < 9) {
      this.selectedSlot = slot;
      if (this.inventory) {
        this.inventory.setSelectedSlot(slot);
      }
      this.notifyStateChange();
    }
  }

  /**
   * Сохранение игры
   */
  async saveGame() {
    if (this.world && this.inventory) {
      const modifiedData = this.world.getSaveData();
      return {
        chunks: modifiedData,
        playerPos: this.playerPos,
        gameState: {
          gameMode: this.gameMode,
          inventory: this.inventory.serialize()
        }
      };
    }
    return null;
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    if (this.world) {
      this.world.terminate();
    }
    if (this.miningManager) {
      this.miningManager.reset();
    }
    if (this.entityManager) {
      this.entityManager.clear();
    }
  }
  
  /**
   * Получить World экземпляр
   */
  getWorld() {
    return this.world;
  }
  
  /**
   * Получить Inventory экземпляр
   */
  getInventory() {
    return this.inventory;
  }
  
  /**
   * Получить MiningManager экземпляр
   */
  getMiningManager() {
    return this.miningManager;
  }

  /**
   * Получить EntityManager экземпляр
   */
  getEntityManager() {
    return this.entityManager;
  }
}

// Менеджер миров - сохранение и загрузка через сервер
import { GAME_MODES } from '../constants/gameMode';

const API_URL = '/api/worlds';

// Получить список сохраненных миров
export const getSavedWorlds = async () => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Failed to fetch worlds');
    return await response.json();
  } catch (e) {
    console.error('Error loading worlds list:', e);
    return [];
  }
};

// Создать новый мир
export const createWorld = async (name, seed, gameMode = GAME_MODES.SURVIVAL) => {
  const id = `world_${Date.now()}`;
  const worldInfo = {
    id,
    name,
    seed,
    gameMode, // Сохраняем режим игры
    createdAt: Date.now(),
    lastPlayed: Date.now()
  };

  // Сохраняем только метаданные при создании
  try {
      await fetch(`${API_URL}/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metadata: worldInfo })
      });
  } catch (e) {
      console.error('Error creating world:', e);
  }

  return worldInfo;
};

// Сохранить данные мира (чанки и состояние)
export const saveWorldData = async (worldId, chunks, playerPos, gameState = {}) => {
  try {
    // Получаем текущий список миров, чтобы найти наш мир и обновить мету
    const worlds = await getSavedWorlds();
    let worldInfo = worlds.find(w => w.id === worldId);
    
    if (!worldInfo) {
        worldInfo = { id: worldId, name: 'Unknown World', createdAt: Date.now() };
    }
    
    worldInfo.lastPlayed = Date.now();
    worldInfo.playerPos = playerPos;
    
    // Обновляем gameMode если передан
    if (gameState.gameMode !== undefined) {
      worldInfo.gameMode = gameState.gameMode;
    }
    
    // Сохраняем инвентарь
    if (gameState.inventory !== undefined) {
      worldInfo.inventory = gameState.inventory;
    }
    
    // Сохраняем здоровье игрока
    if (gameState.health !== undefined) {
      worldInfo.health = gameState.health;
    }
    if (gameState.maxHealth !== undefined) {
      worldInfo.maxHealth = gameState.maxHealth;
    }
    
    // Сохраняем направление взгляда (yaw и pitch)
    if (gameState.playerYaw !== undefined) {
      worldInfo.playerYaw = gameState.playerYaw;
    }
    if (gameState.playerPitch !== undefined) {
      worldInfo.playerPitch = gameState.playerPitch;
    }

    await fetch(`${API_URL}/${worldId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            metadata: worldInfo,
            chunks: chunks // Это RLE сжатые данные
        })
    });

    return true;
  } catch (e) {
    console.error('Error saving world:', e);
    return false;
  }
};

// Загрузить данные мира (чанки)
export const loadWorldData = async (worldId) => {
  try {
    const response = await fetch(`${API_URL}/${worldId}/chunks`);
    if (!response.ok) return {}; 
    const data = await response.json();
    return data;
  } catch (e) {
    console.error('Error loading world chunks:', e);
    return {};
  }
};

// Удалить мир
export const deleteWorld = async (worldId) => {
  try {
    await fetch(`${API_URL}/${worldId}`, { method: 'DELETE' });
    return true;
  } catch (e) {
    console.error('Error deleting world:', e);
    return false;
  }
};

// Удалить ВСЕ миры
export const deleteAllWorlds = async () => {
    try {
        await fetch(API_URL, { method: 'DELETE' });
        return true;
    } catch (e) {
        console.error('Error deleting all worlds:', e);
        return false;
    }
};

// Заглушки для импорта/экспорта (так как теперь файлы доступны напрямую)
export const exportWorldToJSON = () => null;
export const importWorldFromJSON = () => null;

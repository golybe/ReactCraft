// Главный компонент приложения с меню
import React, { useState, useEffect, useCallback } from 'react';
import Game from './components/Game';
import MainMenu from './components/ui/MainMenu';
import { getSavedWorlds, createWorld, loadWorldData, saveWorldData } from './utils/worldManager';
import { setWorldSeed } from './utils/noise';

function App() {
  const [gameState, setGameState] = useState('menu'); // 'menu' | 'loading' | 'playing'
  const [savedWorlds, setSavedWorlds] = useState([]);
  const [currentWorld, setCurrentWorld] = useState(null);
  const [initialChunks, setInitialChunks] = useState(null);
  const [initialPlayerPos, setInitialPlayerPos] = useState(null);

  // Загружаем список сохраненных миров
  useEffect(() => {
    getSavedWorlds().then(setSavedWorlds);
  }, []);

  // Создание нового мира
  const handleStartGame = useCallback(async (worldConfig) => {
    const { name, seed, gameMode } = worldConfig;

    // Устанавливаем seed для генерации
    setWorldSeed(seed);

    // Создаём запись о мире (с режимом игры)
    const worldInfo = await createWorld(name, seed, gameMode);
    setCurrentWorld(worldInfo);

    // Для нового мира - начинаем без сохранённых чанков
    setInitialChunks(null);
    setInitialPlayerPos(null);
    setGameState('playing');
  }, []);

  // Загрузка существующего мира
  const handleLoadWorld = useCallback(async (world) => {
    setWorldSeed(world.seed);

    // Загружаем чанки (RLE данные)
    const chunks = await loadWorldData(world.id);

    // Позиция игрока хранится в метаданных мира (world.playerPos)
    console.log('[LOAD] Loading world:', world.name);
    console.log('[LOAD] Player position from save:', world.playerPos);
    setInitialChunks(chunks || {});
    setInitialPlayerPos(world.playerPos || null);

    setCurrentWorld(world);
    setGameState('playing');
  }, []);

  // Сохранение мира
  const handleSaveWorld = useCallback(async (chunks, playerPos, gameState = {}) => {
    if (currentWorld) {
      await saveWorldData(currentWorld.id, chunks, playerPos, gameState);
    }
  }, [currentWorld]);

  // Возврат в меню
  const handleExitToMenu = useCallback(() => {
    setGameState('menu');
    setCurrentWorld(null);
    setInitialChunks(null);
    setInitialPlayerPos(null);
    getSavedWorlds().then(setSavedWorlds); // Обновляем список миров
  }, []);

  if (gameState === 'menu') {
    return (
      <MainMenu
        onStartGame={handleStartGame}
        onLoadWorld={handleLoadWorld}
        savedWorlds={savedWorlds}
      />
    );
  }

  return (
    <Game
      worldInfo={currentWorld}
      initialChunks={initialChunks}
      initialPlayerPos={initialPlayerPos}
      onSaveWorld={handleSaveWorld}
      onExitToMenu={handleExitToMenu}
    />
  );
}

export default App;

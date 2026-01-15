// Главное меню в стиле Minecraft
import React, { useState, useEffect, useRef } from 'react';
import { deleteWorld, deleteAllWorlds } from '../../utils/worldManager';
import { GAME_MODES, GAME_MODE_NAMES } from '../../constants/gameMode';
import WorldPreview from '../preview/WorldPreview';
import '../../styles/common.css';
import '../../styles/menu.css';

// Компонент кнопки в стиле Minecraft
const MCButton = ({ children, onClick, style, className, disabled }) => (
  <button
    className={`mc-button ${className || ''} ${disabled ? 'disabled' : ''}`}
    onClick={disabled ? undefined : onClick}
    style={{ ...style, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
  >
    {children}
  </button>
);

// Компонент переключателя режима игры
const GameModeSelector = ({ value, onChange }) => {
  return (
    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
      <button
        onClick={() => onChange(GAME_MODES.SURVIVAL)}
        style={{
          flex: 1,
          padding: '12px',
          backgroundColor: value === GAME_MODES.SURVIVAL ? '#4a7c4e' : '#555',
          border: `3px solid ${value === GAME_MODES.SURVIVAL ? '#6abd6e' : '#777'}`,
          color: '#fff',
          fontFamily: "'Monocraft', monospace",
          fontSize: '18px',
          cursor: 'pointer',
          textShadow: '2px 2px 0 #000',
          transition: 'all 0.2s'
        }}
      >
        ⚔️ {GAME_MODE_NAMES[GAME_MODES.SURVIVAL]}
      </button>
      <button
        onClick={() => onChange(GAME_MODES.CREATIVE)}
        style={{
          flex: 1,
          padding: '12px',
          backgroundColor: value === GAME_MODES.CREATIVE ? '#4a6c7c' : '#555',
          border: `3px solid ${value === GAME_MODES.CREATIVE ? '#6aadbd' : '#777'}`,
          color: '#fff',
          fontFamily: "'Monocraft', monospace",
          fontSize: '18px',
          cursor: 'pointer',
          textShadow: '2px 2px 0 #000',
          transition: 'all 0.2s'
        }}
      >
        🎨 {GAME_MODE_NAMES[GAME_MODES.CREATIVE]}
      </button>
    </div>
  );
};

const MainMenu = ({ onStartGame, onLoadWorld, savedWorlds }) => {
  const [showWorldList, setShowWorldList] = useState(false);
  const [showCreateWorld, setShowCreateWorld] = useState(false);
  const [worldName, setWorldName] = useState('');
  const [worldSeed, setWorldSeed] = useState('');
  const [gameMode, setGameMode] = useState(GAME_MODES.SURVIVAL);
  const [showPreview, setShowPreview] = useState(false);
  const [previewSeed, setPreviewSeed] = useState(null);
  
  // Анимация панорамы (простая имитация через CSS)
  const [offset, setOffset] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setOffset(prev => (prev + 0.5) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Генерируем случайный seed
  const generateRandomSeed = () => {
    return Math.floor(Math.random() * 999999999).toString();
  };

  const handleCreateWorld = () => {
    const name = worldName.trim() || `Мир ${Date.now()}`;
    const seed = worldSeed.trim() || generateRandomSeed();
    onStartGame({ 
      name, 
      seed: parseInt(seed) || Date.now(), 
      gameMode,
      isNew: true 
    });
  };

  const handleLoadWorld = (world) => {
    onLoadWorld(world);
  };

  const handleDeleteWorld = async (worldId, e) => {
    e.stopPropagation();
    if (confirm('Удалить этот мир? Это удалит папку с миром с диска.')) {
      await deleteWorld(worldId);
      window.location.reload();
    }
  };

  const handleDeleteAllWorlds = async () => {
    if (confirm('ВЫ УВЕРЕНЫ? Это удалит ВСЕ ваши миры безвозвратно!')) {
       if (confirm('Точно-точно? Все файлы в папке saves будут удалены.')) {
          await deleteAllWorlds();
          window.location.reload();
       }
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: '#333'
    }}>
      {/* Панорамный фон */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'64\' height=\'64\' viewBox=\'0 0 64 64\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M8 16c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm0-2c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zm33.414-6l5.95-5.95L45.95.636 40 6.586 34.05.636 32.636 2.05 38.586 8l-5.95 5.95 1.414 1.414L40 9.414l5.95 5.95 1.414-1.414L41.414 8zM40 48c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm0-2c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zM9.414 40l5.95-5.95-1.414-1.414L8 38.586l-5.95-5.95L.636 34.05 6.586 40l-5.95 5.95 1.414 1.414L8 41.414l5.95 5.95 1.414-1.414L9.414 40z\' fill=\'%235d5d5d\' fill-opacity=\'0.2\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
        backgroundPosition: `${offset}px ${offset / 2}px`,
        filter: 'blur(2px) brightness(0.6)',
        transform: 'scale(1.1)'
      }} />

      {/* Оверлей виньетки */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle, transparent 50%, rgba(0,0,0,0.8) 100%)',
        pointerEvents: 'none'
      }} />

      {/* Логотип */}
      <div style={{
        marginBottom: '40px',
        textAlign: 'center',
        zIndex: 10,
        transform: 'scale(1.2)'
      }}>
        <h1 style={{
          fontSize: '80px',
          color: '#b0b0b0',
          fontFamily: "'Monocraft', monospace",
          textShadow: `
            0 4px 0 #555,
            0 8px 0 #333,
            4px 8px 0 #222,
            4px 4px 0 #000
          `,
          margin: 0,
          letterSpacing: '-2px',
          lineHeight: 1
        }}>
          MINECRAFT
        </h1>
        <p style={{
          fontSize: '28px',
          color: '#FFFF55',
          margin: '-10px 0 0 80px',
          transform: 'rotate(-10deg)',
          textShadow: '2px 2px 0 #333',
          fontFamily: "'Monocraft', monospace",
          animation: 'pulse 1s infinite alternate'
        }}>
          React Edition!
        </p>
      </div>

      {/* Контент меню */}
      <div style={{ 
        zIndex: 10, 
        width: '100%', 
        maxWidth: '400px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {!showWorldList && !showCreateWorld && (
          <>
            <MCButton onClick={() => setShowCreateWorld(true)}>
              Одиночная игра
            </MCButton>
            
            {savedWorlds.length > 0 && (
              <MCButton onClick={() => setShowWorldList(true)}>
                Загрузить мир
              </MCButton>
            )}

            <MCButton onClick={() => alert('Настройки пока недоступны!')}>
              Настройки
            </MCButton>

            <MCButton onClick={() => window.close()}>
              Выйти из игры
            </MCButton>
          </>
        )}

        {/* Экран создания мира */}
        {showCreateWorld && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            width: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '20px',
            border: '2px solid #fff'
          }}>
            <h2 style={{ color: '#fff', textAlign: 'center', textShadow: '2px 2px 0 #000' }}>Создать новый мир</h2>
            
            <div>
              <label style={{ color: '#a0a0a0', display: 'block', marginBottom: '5px' }}>Название мира</label>
              <input
                className="mc-input"
                value={worldName}
                onChange={(e) => setWorldName(e.target.value)}
                placeholder="Новый мир"
              />
            </div>

            <div>
              <label style={{ color: '#a0a0a0', display: 'block', marginBottom: '5px' }}>Ключ генерации (Seed)</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input
                  className="mc-input"
                  value={worldSeed}
                  onChange={(e) => setWorldSeed(e.target.value)}
                  placeholder="Случайный"
                  style={{ flex: 1 }}
                />
                <button 
                  onClick={() => {
                    const seed = worldSeed.trim() || generateRandomSeed();
                    if (!worldSeed.trim()) setWorldSeed(seed);
                    setPreviewSeed(parseInt(seed) || 0);
                    setShowPreview(true);
                  }}
                  style={{
                    backgroundColor: '#555',
                    border: '2px solid #888',
                    color: '#fff',
                    padding: '0 10px',
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                  title="Предпросмотр карты"
                >
                  👁️
                </button>
              </div>
            </div>

            <div>
              <label style={{ color: '#a0a0a0', display: 'block', marginBottom: '8px' }}>Режим игры</label>
              <GameModeSelector value={gameMode} onChange={setGameMode} />
              <p style={{ 
                color: '#888', 
                fontSize: '14px', 
                marginTop: '8px',
                textAlign: 'center'
              }}>
                {gameMode === GAME_MODES.SURVIVAL 
                  ? 'Добывайте ресурсы, выживайте' 
                  : 'Бесконечные блоки, полет, мгновенная добыча'}
              </p>
            </div>

            {/* Модальное окно предпросмотра */}
            {showPreview && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0,0,0,0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
              }}>
                <h3 style={{ color: '#fff', marginBottom: '15px' }}>Карта мира (Seed: {previewSeed})</h3>
                <WorldPreview seed={previewSeed} />
                <MCButton 
                  onClick={() => setShowPreview(false)}
                  style={{ marginTop: '20px', width: '200px' }}
                >
                  Закрыть
                </MCButton>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <MCButton onClick={handleCreateWorld}>Создать</MCButton>
              <MCButton onClick={() => setShowCreateWorld(false)}>Отмена</MCButton>
            </div>
          </div>
        )}

        {/* Список миров */}
        {showWorldList && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '20px',
            border: '2px solid #fff',
            maxHeight: '60vh',
            overflowY: 'auto'
          }}>
             <h2 style={{ color: '#fff', textAlign: 'center', textShadow: '2px 2px 0 #000' }}>Выбор мира</h2>
             
             {savedWorlds.map(world => (
               <div
                 key={world.id}
                 onClick={() => handleLoadWorld(world)}
                 style={{
                   border: '2px solid #888',
                   padding: '10px',
                   backgroundColor: 'rgba(0,0,0,0.5)',
                   cursor: 'pointer',
                   display: 'flex',
                   justifyContent: 'space-between',
                   alignItems: 'center'
                 }}
                 onMouseEnter={e => e.currentTarget.style.borderColor = '#fff'}
                 onMouseLeave={e => e.currentTarget.style.borderColor = '#888'}
               >
                 <div>
                   <div style={{ color: '#fff', fontSize: '20px' }}>{world.name}</div>
                   <div style={{ color: '#aaa', fontSize: '16px' }}>
                     Seed: {world.seed} | {GAME_MODE_NAMES[world.gameMode] || 'Выживание'}
                   </div>
                   <div style={{ color: '#777', fontSize: '12px' }}>ID: {world.id}</div>
                 </div>
                 <div style={{ display: 'flex', gap: '8px' }}>
                   <button
                      onClick={(e) => handleDeleteWorld(world.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ff5555',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '24px'
                      }}
                      title="Удалить"
                   >
                     ×
                   </button>
                 </div>
               </div>
             ))}

             {savedWorlds.length > 0 && (
               <MCButton 
                  onClick={handleDeleteAllWorlds}
                  style={{ backgroundColor: '#500000', color: '#ffaaaa', marginBottom: '10px' }}
               >
                  Удалить все миры
               </MCButton>
             )}

             <MCButton onClick={() => setShowWorldList(false)}>Отмена</MCButton>
          </div>
        )}
      </div>
      
      {/* Футер */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        width: '100%',
        textAlign: 'center',
        color: '#fff',
        fontSize: '16px',
        textShadow: '1px 1px 0 #000'
      }}>
        Minecraft Clone (React + Three.js)
      </div>

    </div>
  );
};

export default MainMenu;

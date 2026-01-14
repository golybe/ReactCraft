/**
 * HealthBar - отображение здоровья игрока в виде сердечек
 *
 * Использует спрайтшит icons.png из Minecraft
 * Каждое сердечко = 2 HP (как в оригинале)
 */
import React from 'react';
import './HealthBar.css';

// Координаты спрайтов в icons.png (256x256)
// Каждая иконка 9x9 пикселей
const SPRITE = {
  // Контейнер (пустое сердце) - серый контур
  CONTAINER: { x: 16, y: 0 },
  // Полное сердце - красное
  FULL: { x: 52, y: 0 },
  // Половина сердца
  HALF: { x: 61, y: 0 },
  // Размер иконки
  SIZE: 9
};

// Масштаб отображения (9px * 2 = 18px)
const SCALE = 2;
const ICON_SIZE = SPRITE.SIZE * SCALE; // 18px
const SPACING = -1; // Небольшое перекрытие для компактности

/**
 * Одно сердечко (может быть пустым, половинкой или полным)
 */
const Heart = ({ type }) => {
  let spritePos;

  switch (type) {
    case 'full':
      spritePos = SPRITE.FULL;
      break;
    case 'half':
      spritePos = SPRITE.HALF;
      break;
    case 'empty':
    default:
      spritePos = SPRITE.CONTAINER;
      break;
  }

  const style = {
    width: `${ICON_SIZE}px`,
    height: `${ICON_SIZE}px`,
    backgroundImage: 'url(/textures/gui/icons.png)',
    backgroundSize: `${256 * SCALE}px ${256 * SCALE}px`,
    backgroundPosition: `-${spritePos.x * SCALE}px -${spritePos.y * SCALE}px`,
    imageRendering: 'pixelated'
  };

  return <div className="heart" style={style} />;
};

/**
 * Сердечко с контейнером (контейнер + содержимое поверх)
 */
const HeartWithContainer = ({ fillType, index, isLowHealth, isCritical }) => {
  const className = `heart-container-wrapper ${isCritical ? 'critical' : isLowHealth ? 'low-health' : ''}`;
  
  return (
    <div 
      className={className}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Контейнер (всегда отображается) */}
      <Heart type="empty" />
      {/* Заполнение поверх контейнера */}
      {fillType !== 'empty' && (
        <div className="heart-fill">
          <Heart type={fillType} />
        </div>
      )}
    </div>
  );
};

/**
 * Полоса здоровья
 * @param {number} health - текущее здоровье (0-20)
 * @param {number} maxHealth - максимальное здоровье (по умолчанию 20)
 */
const HealthBar = ({ health = 20, maxHealth = 20 }) => {
  // Количество сердечек (каждое = 2 HP)
  const totalHearts = Math.ceil(maxHealth / 2);
  const hearts = [];

  // Определяем состояние здоровья
  const isLowHealth = health <= 6; // <= 3 сердца
  const isCritical = health <= 4;  // <= 2 сердца

  for (let i = 0; i < totalHearts; i++) {
    const heartHealth = health - (i * 2);

    let fillType;
    if (heartHealth >= 2) {
      fillType = 'full';
    } else if (heartHealth === 1) {
      fillType = 'half';
    } else {
      fillType = 'empty';
    }

    hearts.push(
      <HeartWithContainer 
        key={i} 
        fillType={fillType}
        index={i}
        isLowHealth={isLowHealth}
        isCritical={isCritical}
      />
    );
  }

  return (
    <div className="health-bar">
      {hearts}
    </div>
  );
};

export default HealthBar;

const fs = require('fs');
const path = require('path');

console.log('='.repeat(70));
console.log('DEBUG UV - Какая текстура на какую грань попадает');
console.log('='.repeat(70));

// Параметры головы овцы
const width = 6, height = 6, depth = 6;
const texU = 0, texV = 0;
const texWidth = 64, texHeight = 32;

console.log('\nПараметры:');
console.log('  width =', width, ', height =', height, ', depth =', depth);
console.log('  texU =', texU, ', texV =', texV);
console.log('  texWidth =', texWidth, ', texHeight =', texHeight);

console.log('\n' + '-'.repeat(70));
console.log('СТАНДАРТНЫЙ createMinecraftBox (текущий код):');
console.log('-'.repeat(70));

function showRect(name, u, v, w, h) {
  const x1 = Math.floor(u);
  const y1 = Math.floor(v);
  const x2 = Math.floor(u + w);
  const y2 = Math.floor(v + h);

  console.log(`\n${name}:`);
  console.log(`  UV: rectUV(${u}, ${v}, ${w}, ${h})`);
  console.log(`  Пиксели: X=[${x1}-${x2}], Y=[${y1}-${y2}]`);
  console.log(`  Размер: ${w}×${h} пикселей`);
}

// Стандартный layout (как в createMinecraftBox)
console.log('\n1. СТАНДАРТНЫЙ LAYOUT (как в createMinecraftBox):');
console.log('   Формула: UV_FRONT = rectUV(texU + depth, texV + depth, width, height)');

const STD = {
  FRONT: { u: texU + depth, v: texV + depth, w: width, h: height },
  RIGHT: { u: texU, v: texV + depth, w: depth, h: height },
  LEFT: { u: texU + depth + width, v: texV + depth, w: depth, h: height },
  BACK: { u: texU + depth * 2 + width, v: texV + depth, w: width, h: height },
  TOP: { u: texU + depth, v: texV, w: width, h: depth },
  BOTTOM: { u: texU + depth + width, v: texV, w: width, h: depth }
};

for (const [face, data] of Object.entries(STD)) {
  showRect(face, data.u, data.v, data.w, data.h);
}

console.log('\n' + '-'.repeat(70));
console.log('АЛЬТЕРНАТИВНЫЙ ВАРИАНТ (для теста):');
console.log('-'.repeat(70));

const ALT = {
  FRONT: { u: texU, v: texV + depth, w: width, h: height },
  RIGHT: { u: texU + width, v: texV + depth, w: depth, h: height },
  LEFT: { u: texU + width + depth, v: texV + depth, w: depth, h: height },
  BACK: { u: texU + width + depth * 2, v: texV + depth, w: width, h: height },
  TOP: { u: texU + width, v: texV, w: depth, h: depth },
  BOTTOM: { u: texU + width + depth, v: texV, w: depth, h: depth }
};

for (const [face, data] of Object.entries(ALT)) {
  showRect(face, data.u, data.v, data.w, data.h);
}

console.log('\n' + '='.repeat(70));
console.log('ВИЗУАЛИЗАЦИЯ ТЕКСТУРЫ (64x32):');
console.log('='.repeat(70));

// Рисуем сетку текстуры
const grid = [];
for (let y = 0; y < 32; y++) {
  const row = [];
  for (let x = 0; x < 64; x++) {
    row.push('.');
  }
  grid.push(row);
}

// Функция для рисования прямоугольника на сетке
function drawRect(rect, letter) {
  const x1 = Math.floor(rect.u);
  const y1 = Math.floor(rect.v);
  const x2 = Math.floor(rect.u + rect.w);
  const y2 = Math.floor(rect.v + rect.h);

  for (let y = y1; y < y2; y++) {
    for (let x = x1; x < x2; x++) {
      if (y >= 0 && y < 32 && x >= 0 && x < 64) {
        grid[y][x] = letter;
      }
    }
  }
}

// Рисуем стандартный layout
console.log('\nСТАНДАРТНЫЙ LAYOUT (буквы = грани):');
drawRect(STD.FRONT, 'F');  // Face
drawRect(STD.RIGHT, 'R');  // Right
drawRect(STD.LEFT, 'L');   // Left
drawRect(STD.BACK, 'B');   // Back
drawRect(STD.TOP, 'T');    // Top
drawRect(STD.BOTTOM, 'BO'); // Bottom

console.log('\nЛегенда: F=Front(лицо), R=Right(право), L=Left(лево), B=Back(затылок), T=Top(верх), BO=Bottom(низ)');
console.log('Показываем Y=0-15 (верхняя часть текстуры):\n');

for (let y = 0; y < 16; y++) {
  const rowStr = grid[y].slice(0, 30).join(''); // Только первые 30 пикселей по X
  console.log(`Y=${y.toString().padStart(2, '0')}: ${rowStr}`);
}

console.log('\n' + '='.repeat(70));
console.log('АНАЛИЗ:');
console.log('='.repeat(70));
console.log(`
Если глаза видны на правильном месте (лицо спереди):
  → Используй СТАНДАРТНЫЙ layout

Если глаза "уехали" на бок:
  → Возможно, текстура использует другой порядок граней

Если текстура вообще не отображается правильно:
  → Проблема в другом месте (не в UV координатах)

ПРОВЕРКА:
1. Открой public/textures/entity/sheep.png в графическом редакторе
2. Посмотри, где именно находится лицо с глазами
3. Сравни с координатами выше

ГОЛОВЫ ОВЦЫ (обычно):
- Лицо с глазами: прямоугольник примерно 6x6 пикселей
- Находится в верхней части текстуры (Y от 0 до 12)
- Может быть на X=[0-6], [6-12], [12-18] или [18-24]
`);

console.log('\n✓ Анализ завершен!');

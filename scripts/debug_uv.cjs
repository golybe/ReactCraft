const fs = require('fs');
const path = require('path');

console.log('='.repeat(70));
console.log('DEBUG UV - Какая текстура на какую грань попадает');
console.log('='.repeat(70));

// Параметры головы овцы (VANILLA MINECRAFT!)
// Голова овцы: width=6, height=6, depth=8 (морда вытянута вперёд)
const width = 6, height = 6, depth = 8;
const texU = 0, texV = 0;
const texWidth = 64, texHeight = 32;

console.log('\nПараметры головы овцы (Vanilla Minecraft):');
console.log('  width =', width, ', height =', height, ', depth =', depth);
console.log('  (depth=8 > width=6 — морда вытянута вперёд!)');
console.log('  texU =', texU, ', texV =', texV);
console.log('  texWidth =', texWidth, ', texHeight =', texHeight);

console.log('\n' + '-'.repeat(70));
console.log('ПРАВИЛЬНЫЙ UV LAYOUT (для головы 6×6×8):');
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

// Стандартный Minecraft layout (как в createMinecraftBox)
// Формулы:
// TOP:    (texU + depth, texV, width, depth)
// BOTTOM: (texU + depth + width, texV, width, depth)
// RIGHT:  (texU, texV + depth, depth, height)
// FRONT:  (texU + depth, texV + depth, width, height)
// LEFT:   (texU + depth + width, texV + depth, depth, height)
// BACK:   (texU + depth*2 + width, texV + depth, width, height)

console.log('\nФормула: UV_FRONT = rectUV(texU + depth, texV + depth, width, height)');
console.log('Для depth=8: FRONT начинается с Y=8, а не Y=6!');

const STD = {
  TOP: { u: texU + depth, v: texV, w: width, h: depth },
  BOTTOM: { u: texU + depth + width, v: texV, w: width, h: depth },
  RIGHT: { u: texU, v: texV + depth, w: depth, h: height },
  FRONT: { u: texU + depth, v: texV + depth, w: width, h: height },
  LEFT: { u: texU + depth + width, v: texV + depth, w: depth, h: height },
  BACK: { u: texU + depth * 2 + width, v: texV + depth, w: width, h: height }
};

for (const [face, data] of Object.entries(STD)) {
  showRect(face, data.u, data.v, data.w, data.h);
}

console.log('\n' + '-'.repeat(70));
console.log('СРАВНЕНИЕ СТАРОГО (6×6×6) vs НОВОГО (6×6×8):');
console.log('-'.repeat(70));

console.log('\n                  БЫЛО (6×6×6)    СТАЛО (6×6×8)');
console.log('  TOP:           (6, 0, 6, 6)    (8, 0, 6, 8)');
console.log('  BOTTOM:        (12, 0, 6, 6)   (14, 0, 6, 8)');
console.log('  RIGHT:         (0, 6, 6, 6)    (0, 8, 8, 6)');
console.log('  FRONT (ЛИЦО):  (6, 6, 6, 6)    (8, 8, 6, 6) ← ключевое!');
console.log('  LEFT:          (12, 6, 6, 6)   (14, 8, 8, 6)');
console.log('  BACK:          (18, 6, 6, 6)   (22, 8, 6, 6)');

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

// Рисуем правильный layout (6×6×8)
console.log('\nПРАВИЛЬНЫЙ LAYOUT для 6×6×8 (буквы = грани):');
drawRect(STD.TOP, 'T');
drawRect(STD.BOTTOM, 'B');
drawRect(STD.RIGHT, 'R');
drawRect(STD.FRONT, 'F');  // Face - лицо с глазами!
drawRect(STD.LEFT, 'L');
drawRect(STD.BACK, 'K');   // bac(K)

console.log('\nЛегенда: F=Front(ЛИЦО), R=Right, L=Left, K=Back, T=Top, B=Bottom');
console.log('Показываем Y=0-15 (верхняя часть текстуры):\n');

for (let y = 0; y < 16; y++) {
  const rowStr = grid[y].slice(0, 32).join(''); // Первые 32 пикселя по X
  console.log(`Y=${y.toString().padStart(2, '0')}: ${rowStr}`);
}

console.log('\n' + '='.repeat(70));
console.log('РЕЗУЛЬТАТ:');
console.log('='.repeat(70));
console.log(`
✓ Голова овцы в Minecraft: 6×6×8 (width=6, height=6, depth=8)
✓ FRONT (лицо с глазами) находится на координатах (8, 8) размером 6×6
✓ Код исправлен: createMinecraftBox(6, 6, 8, 0, 0, ...)

Если текстура всё ещё отображается неправильно:
1. Убедитесь что текстура sheep.png имеет стандартный Minecraft layout
2. Проверьте что текстура 64×32 пикселя
3. Откройте анализатор: scripts/analyze_sheep_uv.html
`);

console.log('✓ Анализ завершен!');

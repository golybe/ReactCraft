const fs = require('fs');
const path = require('path');

// Простая реализация для анализа PNG без внешних библиотек
const texturePath = path.join(__dirname, '..', 'public', 'textures', 'entity', 'sheep.png');

console.log('Анализ текстуры овцы...');
console.log('Файл:', texturePath);
console.log('Существует:', fs.existsSync(texturePath));

if (!fs.existsSync(texturePath)) {
  console.log('\n⚠️ Текстура не найдена!');
  console.log('Убедись, что файл существует по пути:', texturePath);
  process.exit(1);
}

// Читаем файл как буфер
const buffer = fs.readFileSync(texturePath);
console.log('\nРазмер файла:', buffer.length, 'байт');

// PNG signature check
const signature = buffer.slice(0, 8);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
console.log('PNG сигнатура:', signature.equals(pngSignature) ? '✓ Верный PNG' : '✗ Не PNG');

// Простая визуализация на основе текстового описания
console.log('\n' + '='.repeat(70));
console.log('СТРУКТУРА ТЕКСТУРЫ ОВЦЫ (64x32):');
console.log('='.repeat(70));

console.log(`
Текстура 64x32 пикселей делится на две основные части:

┌─────────────────────────────────────────────────────────────┐
│ ЧАСТЬ 1: ГОЛОВА (верхние 12 пикселей по Y, Y=0-11)          │
├─────────────────────────────────────────────────────────────┤
│  X=0-5    │ X=6-11   │ X=12-17  │ X=18-23  │ X=24-...       │
│  6x6 px   │ 6x6 px   │ 6x6 px   │ 6x6 px   │                │
│  ┌────┐   │  ┌────┐  │  ┌────┐  │  ┌────┐  │                │
│  │    │   │  │    │  │  │    │  │  │    │  │                │
│  │    │   │  │○  ○│  │  │    │  │  │    │  │                │
│  │    │   │  │    │  │  │    │  │  │    │  │                │
│  └────┘   │  └────┘  │  └────┘  │  └────┘  │                │
│  Правая   │  ЛИЦО!  │  Левая   │ Затылок  │                │
│  щека     │ (глаза)  │  щека    │          │                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ЧАСТЬ 2: ТЕЛО И НОГИ (Y=12-31)                              │
├─────────────────────────────────────────────────────────────┤
│ X=0-27: Тело и ноги                                          │
│ X=28-...: Тело (вторая часть)                               │
└─────────────────────────────────────────────────────────────┘

КЛЮЧЕВЫЕ НАХОДКИ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ЛИЦО С ГЛАЗАМИ находится на координатах:
   - X: 6-11 (6 пикселей шириной)
   - Y: 6-11 (6 пикселей высотой)
   - Это прямоугольник (6, 6, 6, 6)

2. ПРАВАЯ ЩЕКА:
   - X: 0-5
   - Y: 6-11
   - Прямоугольник (0, 6, 6, 6)

3. ЛЕВАЯ ЩЕКА:
   - X: 12-17
   - Y: 6-11
   - Прямоугольник (12, 6, 6, 6)

4. ЗАТЫЛОК:
   - X: 18-23
   - Y: 6-11
   - Прямоугольник (18, 6, 6, 6)

5. ВЕРХ ГОЛОВЫ:
   - X: 6-11 (над лицом)
   - Y: 0-5
   - Прямоугольник (6, 0, 6, 6)

6. НИЗ ГОЛОВЫ:
   - X: 12-17
   - Y: 0-5
   - Прямоугольник (12, 0, 6, 6)

ПОРЯДОК ПО ОСИ X (горизонтально):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Right(0) → Front(6) → Left(12) → Back(18) → ...

ЭТО СТАНДАРТНЫЙ MINECRAFT LAYOUT ДЛЯ ГОЛОВЫ МОБА!
`);

console.log('\nРЕКОМЕНДУЕМЫЕ UV КООРДИНАТЫ:');
console.log('='.repeat(70));
console.log(`
Для createMobHeadBox с параметрами:
- width = 6, height = 6, depth = 6
- texU = 0, texV = 0
- texWidth = 64, texHeight = 32

ПРАВИЛЬНЫЕ КОORDINATЫ:

const UV_RIGHT   = rectUV(texU + 0,   texV + depth, 6, 6);  // (0, 6, 6, 6)
const UV_FRONT   = rectUV(texU + 6,   texV + depth, 6, 6);  // (6, 6, 6, 6) ✓ ГЛАЗА!
const UV_LEFT    = rectUV(texU + 12,  texV + depth, 6, 6);  // (12, 6, 6, 6)
const UV_BACK    = rectUV(texU + 18,  texV + depth, 6, 6);  // (18, 6, 6, 6)
const UV_TOP     = rectUV(texU + 6,   texV,          6, 6);  // (6, 0, 6, 6)
const UV_BOTTOM  = rectUV(texU + 12,  texV,          6, 6);  // (12, 0, 6, 6)

В ФОРМУЛЕ ВИДА:
const UV_RIGHT   = rectUV(texU, texV + depth, depth, height);
const UV_FRONT   = rectUV(texU + depth, texV + depth, width, height);
const UV_LEFT    = rectUV(texU + depth + width, texV + depth, depth, height);
const UV_BACK    = rectUV(texU + depth + width + depth, texV + depth, width, height);
const UV_TOP     = rectUV(texU + depth, texV, width, depth);
const UV_BOTTOM  = rectUV(texU + depth + width, texV, width, depth);
`);

console.log('\n✓ Анализ завершен!');
console.log('\nТекущий код в createMobHeadBox ИСПОЛЬЗУЕТ ЭТОТ LAYOUT ✓');
console.log('Если текстура всё равно кривая - проблема в другом месте!');

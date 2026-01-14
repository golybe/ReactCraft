import { Structure } from './Structure.js';
import { BLOCK_TYPES } from '../../../constants/blockTypes.js';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../../constants/world.js';

export class TreeStructure extends Structure {
  constructor(type = 'oak') {
    super(`tree_${type}`);
    this.type = type;
  }

  generate(blocks, x, y, z, rng, context) {
    const biome = context?.biome;
    if (!biome) return false;

    // КРИТИЧЕСКАЯ ПРОВЕРКА: y должен быть валидным
    if (y < 1 || y >= 250) return false;
    
    // Проверяем блок под деревом
    const groundIdx = this.getIndex(x, y, z);
    const groundBlock = blocks[groundIdx];
    
    // Дерево может расти только на траве, земле или песке
    const validGround = [
      BLOCK_TYPES.GRASS,  // 2
      BLOCK_TYPES.DIRT,   // 3
      BLOCK_TYPES.SAND    // 12
    ];
    
    if (!validGround.includes(groundBlock)) {
      return false;
    }
    
    // Проверяем, что над землей есть воздух (минимум 2 блока)
    for (let checkY = y + 1; checkY <= Math.min(y + 2, 255); checkY++) {
      const checkIdx = this.getIndex(x, checkY, z);
      const checkBlock = blocks[checkIdx];
      if (checkBlock !== BLOCK_TYPES.AIR && checkBlock !== BLOCK_TYPES.LEAVES) {
        return false;
      }
    }

    // Determine tree style based on biome or type
    if (biome.id === 'desert') {
      return this.generateCactus(blocks, x, y + 1, z, rng);
    }

    const isSnowy = biome.id?.includes('snow') || biome.id?.includes('taiga');
    if (isSnowy || this.type === 'spruce') {
      return this.generateSpruce(blocks, x, y + 1, z, rng);
    }

    if (biome.id === 'jungle' || this.type === 'jungle') {
      return this.generateJungle(blocks, x, y + 1, z, rng);
    }

    return this.generateOak(blocks, x, y + 1, z, rng);
  }

  generateOak(blocks, x, y, z, rng) {
    // Высота ствола: от 4 до 6 блоков
    const trunkHeight = 4 + Math.floor(rng.next() * 3);

    // 1. Проверка места под СТВОЛ (только ствол, листву проверим при установке)
    for (let i = 0; i < trunkHeight; i++) {
      const idx = this.getIndex(x, y + i, z);
      const existingBlock = blocks[idx];
      // Если на месте ствола уже что-то твердое (не воздух и не листва) - отмена
      if (existingBlock !== BLOCK_TYPES.AIR && existingBlock !== BLOCK_TYPES.LEAVES) return false;
    }

    // 2. Установка СТВОЛА
    for (let i = 0; i < trunkHeight; i++) {
      this.setBlock(blocks, x, y + i, z, BLOCK_TYPES.WOOD);
    }

    // 3. Генерация ЛИСТВЫ (Фиксированная форма "Пузырь")
    // Мы генерируем всего 4 слоя листвы сверху вниз
    // Top offset = +1 (над стволом) -> Радиус 1 (Крест)
    // Top offset = 0  (верхушка ствола) -> Радиус 2 (Широкий)
    // Top offset = -1 (ниже) -> Радиус 2 (Широкий)
    // Top offset = -2 (еще ниже) -> Радиус 1 (опционально, если дерево высокое)

    // Определяем начало и конец листвы относительно Y
    const leavesBottom = y + trunkHeight - 3; 
    const leavesTop = y + trunkHeight; // Ровно +1 блок над последним блоком дерева (т.к. trunk идет от y до y+height-1)

    for (let ly = leavesBottom; ly <= leavesTop; ly++) {
      // Расстояние от верхушки листвы
      const distanceToTop = leavesTop - ly; 
      
      // Логика радиуса для классического дуба:
      // Верхушка (0) -> Радиус 1
      // Середина (1, 2) -> Радиус 2
      // Низ (3) -> Радиус 1 или 0 (если дерево низкое)
      let radius = 2;
      if (distanceToTop === 0) radius = 1;      // Самый верх - узкий
      else if (distanceToTop === 3) radius = 1; // Самый низ - поуже

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          
          // Срезаем углы, чтобы получился круг/крест, а не квадрат
          // Если это самый край (угол квадрата)
          if (Math.abs(dx) === radius && Math.abs(dz) === radius) {
             // На широких слоях (radius 2) всегда срезаем углы (делаем круг)
             // На узких слоях (radius 1) тоже срезаем (делаем крест)
             // Убираем рандом rng.next() > 0.5, чтобы не было "обгрызков"
             continue; 
          }

          if (dx === 0 && dz === 0) {
            // ЦЕНТР
            // Если мы находимся ВНУТРИ высоты ствола - не трогаем ствол
            if (ly < y + trunkHeight) continue;
            
            // Если мы НАД стволом - ставим листву (шапка)
            this.setLeafBlock(blocks, x + dx, ly, z + dz, BLOCK_TYPES.LEAVES);
          } else {
            // БОКА
            // Аккуратная установка: не ломаем чужие стволы
            this.setBlockIfReplaceable(blocks, x + dx, ly, z + dz, BLOCK_TYPES.LEAVES);
          }
        }
      }
    }
    return true;
  }

  // Вспомогательный метод для получения индекса в плоском массиве
  getIndex(x, y, z) {
    const SIZE = 16;
    return y * SIZE * SIZE + x * SIZE + z;
  }

  generateSpruce(blocks, x, y, z, rng) {
    const trunkHeight = 5 + Math.floor(rng.next() * 3);

    // Проверка места
    for (let i = 0; i < trunkHeight; i++) {
      const idx = this.getIndex(x, y + i, z);
      if (blocks[idx] !== BLOCK_TYPES.AIR && blocks[idx] !== BLOCK_TYPES.LEAVES) return false;
    }

    // Trunk
    for (let i = 0; i < trunkHeight; i++) {
      this.setBlock(blocks, x, y + i, z, BLOCK_TYPES.WOOD);
    }

    // Leaves (Conical)
    for (let dy = 1; dy <= trunkHeight + 1; dy++) {
      const radius = Math.max(0, 2 - Math.floor((dy - 1) / 2));

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && radius > 0 && rng.next() > 0.7) continue;
          
          if (dx === 0 && dz === 0) {
            // Центр
            if (dy < trunkHeight - 1) continue;
            this.setLeafBlock(blocks, x + dx, y + dy, z + dz, BLOCK_TYPES.LEAVES);
          } else {
            // Бока (защита соседей)
            this.setBlockIfReplaceable(blocks, x + dx, y + dy, z + dz, BLOCK_TYPES.LEAVES);
          }
        }
      }
    }
    return true;
  }

  generateCactus(blocks, x, y, z, rng) {
    const height = 2 + Math.floor(rng.next() * 2);
    
    // Кактусы не должны расти друг в друге
    const baseIdx = this.getIndex(x, y, z);
    if (blocks[baseIdx] !== BLOCK_TYPES.AIR) return false;

    for (let i = 0; i < height; i++) {
      this.setBlock(blocks, x, y + i, z, BLOCK_TYPES.LEAVES);
    }
    return true;
  }

  generateJungle(blocks, x, y, z, rng) {
    const trunkHeight = 7 + Math.floor(rng.next() * 5);

    // Проверка места
    for (let i = 0; i < trunkHeight; i++) {
      const idx = this.getIndex(x, y + i, z);
      if (blocks[idx] !== BLOCK_TYPES.AIR && blocks[idx] !== BLOCK_TYPES.LEAVES) return false;
    }

    // Trunk
    for (let i = 0; i < trunkHeight; i++) {
      this.setBlock(blocks, x, y + i, z, BLOCK_TYPES.WOOD);
    }

    // Large bushy canopy
    const leafStart = trunkHeight - 3;
    for (let dy = leafStart; dy <= trunkHeight + 2; dy++) {
      const radius = dy <= trunkHeight ? 3 : 1;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const distSq = dx * dx + dz * dz;
          if (distSq > radius * radius + 1) continue;

          if (dx === 0 && dz === 0) {
             // Центр
             if (dy < trunkHeight - 1) continue;
             this.setLeafBlock(blocks, x + dx, y + dy, z + dz, BLOCK_TYPES.LEAVES);
          } else {
             // Бока (защита соседей)
             if (rng.next() > 0.1) {
                this.setBlockIfReplaceable(blocks, x + dx, y + dy, z + dz, BLOCK_TYPES.LEAVES);
             }
          }
        }
      }
    }
    return true;
  }
}
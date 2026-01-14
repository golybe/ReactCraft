/**
 * Команды чата
 *
 * Все игровые команды в одном месте для удобства поддержки.
 */
import { Command, CommandProcessor } from './CommandProcessor';
import { GAME_MODES, GAME_MODE_NAMES } from '../../constants/gameMode';
import { NoiseGenerators } from '../../utils/noise';
import { getBiomeId, BIOME_IDS, BIOMES } from '../../utils/biomes';

// === TELEPORT ===
class TeleportCommand extends Command {
  constructor() {
    super('tp', ['teleport'], 'Teleport to coordinates');
  }

  execute(args, context) {
    if (args.length !== 3) {
      return {
        success: false,
        message: 'Usage: /tp <x> <y> <z>',
        type: 'error'
      };
    }

    const x = parseFloat(args[0]);
    const y = parseFloat(args[1]);
    const z = parseFloat(args[2]);

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      return {
        success: false,
        message: 'Invalid coordinates',
        type: 'error'
      };
    }

    context.teleportTo(x, y, z);

    return {
      success: true,
      message: `Teleported to ${x}, ${y}, ${z}`,
      type: 'success'
    };
  }

  getUsage() {
    return '/tp <x> <y> <z>';
  }
}

// === NOCLIP ===
class NoclipCommand extends Command {
  constructor() {
    super('noclip', ['nc'], 'Toggle noclip mode');
  }

  execute(args, context) {
    const nextNoclip = !context.noclipMode;
    context.setNoclipMode(nextNoclip);

    return {
      success: true,
      message: `Noclip mode ${nextNoclip ? 'enabled' : 'disabled'}`,
      type: 'info'
    };
  }
}

// === FLY ===
class FlyCommand extends Command {
  constructor() {
    super('fly', [], 'Toggle flight capability');
  }

  execute(args, context) {
    const nextFly = !context.canFly;
    context.setCanFly(nextFly);

    return {
      success: true,
      message: `Flight capability ${nextFly ? 'enabled' : 'disabled'} (Double-tap SPACE to fly)`,
      type: 'info'
    };
  }
}

// === SPEED ===
class SpeedCommand extends Command {
  constructor() {
    super('speed', [], 'Set movement speed multiplier');
  }

  execute(args, context) {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /speed <value>',
        type: 'error'
      };
    }

    const speed = parseFloat(args[0]);

    if (isNaN(speed) || speed <= 0) {
      return {
        success: false,
        message: 'Speed must be a positive number',
        type: 'error'
      };
    }

    context.setSpeedMultiplier(speed);

    return {
      success: true,
      message: `Speed set to ${speed}x`,
      type: 'success'
    };
  }

  getUsage() {
    return '/speed <value>';
  }
}

// === SEED ===
class SeedCommand extends Command {
  constructor() {
    super('seed', [], 'Show world seed');
  }

  execute(args, context) {
    const seed = context.worldInfo?.seed || 'Unknown';

    return {
      success: true,
      message: `World Seed: ${seed}`,
      type: 'info'
    };
  }
}

// === POS ===
class PosCommand extends Command {
  constructor() {
    super('pos', ['position', 'coords'], 'Show current position');
  }

  execute(args, context) {
    const { x, y, z } = context.playerPos;

    return {
      success: true,
      message: `X: ${x.toFixed(1)}, Y: ${y.toFixed(1)}, Z: ${z.toFixed(1)}`,
      type: 'info'
    };
  }
}

// === GAMEMODE ===
class GameModeCommand extends Command {
  constructor() {
    super('gamemode', ['gm'], 'Change game mode');
  }

  execute(args, context) {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /gamemode <0|1|survival|creative>',
        type: 'error'
      };
    }

    const modeArg = args[0].toLowerCase();

    // Survival mode
    if (modeArg === '0' || modeArg === 'survival' || modeArg === 's') {
      context.setGameMode(GAME_MODES.SURVIVAL);
      context.setCanFly(false);
      context.setIsFlying(false);

      return {
        success: true,
        message: `Game mode changed to: ${GAME_MODE_NAMES[GAME_MODES.SURVIVAL]}`,
        type: 'success'
      };
    }

    // Creative mode
    if (modeArg === '1' || modeArg === 'creative' || modeArg === 'c') {
      context.setGameMode(GAME_MODES.CREATIVE);
      context.setCanFly(true);
      context.setIsFlying(true);

      return {
        success: true,
        message: `Game mode changed to: ${GAME_MODE_NAMES[GAME_MODES.CREATIVE]}`,
        type: 'success'
      };
    }

    return {
      success: false,
      message: 'Usage: /gamemode <0|1|survival|creative>',
      type: 'error'
    };
  }

  getUsage() {
    return '/gamemode <0|1|survival|creative>';
  }
}

// === HEALTH ===
class HealthCommand extends Command {
  constructor() {
    super('health', ['hp'], 'Show or set player health');
  }

  execute(args, context) {
    if (!context.player) {
      return {
        success: false,
        message: 'Player not found',
        type: 'error'
      };
    }

    // Если аргумент не указан - показать текущее здоровье
    if (args.length === 0) {
      return {
        success: true,
        message: `Health: ${context.player.health}/${context.player.maxHealth}`,
        type: 'info'
      };
    }

    // Установить здоровье
    const newHealth = parseFloat(args[0]);

    if (isNaN(newHealth) || newHealth < 0) {
      return {
        success: false,
        message: 'Health must be a non-negative number',
        type: 'error'
      };
    }

    const clampedHealth = Math.min(newHealth, context.player.maxHealth);
    context.player.health = clampedHealth;

    return {
      success: true,
      message: `Health set to ${clampedHealth}/${context.player.maxHealth}`,
      type: 'success'
    };
  }

  getUsage() {
    return '/health [value]';
  }
}

// === HEAL ===
class HealCommand extends Command {
  constructor() {
    super('heal', [], 'Heal player');
  }

  execute(args, context) {
    if (!context.player) {
      return {
        success: false,
        message: 'Player not found',
        type: 'error'
      };
    }

    const amount = args.length > 0 ? parseFloat(args[0]) : context.player.maxHealth;

    if (isNaN(amount) || amount <= 0) {
      return {
        success: false,
        message: 'Heal amount must be a positive number',
        type: 'error'
      };
    }

    const healed = context.player.heal(amount);

    return {
      success: true,
      message: `Healed ${healed} HP. Health: ${context.player.health}/${context.player.maxHealth}`,
      type: 'success'
    };
  }

  getUsage() {
    return '/heal [amount]';
  }
}

// === DAMAGE ===
class DamageCommand extends Command {
  constructor() {
    super('damage', ['dmg'], 'Damage player (for testing)');
  }

  execute(args, context) {
    if (!context.player) {
      return {
        success: false,
        message: 'Player not found',
        type: 'error'
      };
    }

    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /damage <amount>',
        type: 'error'
      };
    }

    const amount = parseFloat(args[0]);

    if (isNaN(amount) || amount <= 0) {
      return {
        success: false,
        message: 'Damage amount must be a positive number',
        type: 'error'
      };
    }

    context.player.damage(amount, 'command');

    return {
      success: true,
      message: `Dealt ${amount} damage. Health: ${context.player.health}/${context.player.maxHealth}`,
      type: 'success'
    };
  }

  getUsage() {
    return '/damage <amount>';
  }
}

// === LOCATE BIOME ===
class LocateBiomeCommand extends Command {
  constructor() {
    super('locate', ['find', 'locatebiome'], 'Locate nearest biome');
    
    // Build biome name lookup (lowercase -> biome id)
    this.biomeNameToId = {};
    for (const [key, id] of Object.entries(BIOME_IDS)) {
      // Add by key name (e.g., 'plains', 'deep_ocean')
      this.biomeNameToId[key.toLowerCase()] = id;
      // Add by display name (e.g., 'plains', 'deep ocean')
      const biome = BIOMES[id];
      if (biome && biome.name) {
        this.biomeNameToId[biome.name.toLowerCase()] = id;
        // Also add without spaces
        this.biomeNameToId[biome.name.toLowerCase().replace(/\s+/g, '')] = id;
        this.biomeNameToId[biome.name.toLowerCase().replace(/\s+/g, '_')] = id;
      }
    }
  }

  execute(args, context) {
    // Usage: /locate biome <biome_name>
    if (args.length < 2 || args[0].toLowerCase() !== 'biome') {
      return {
        success: false,
        message: 'Usage: /locate biome <biome_name>',
        type: 'error'
      };
    }

    // Get biome name from remaining args
    const biomeName = args.slice(1).join('_').toLowerCase();
    const targetBiomeId = this.biomeNameToId[biomeName];

    if (targetBiomeId === undefined) {
      // List available biomes
      const available = Object.keys(BIOME_IDS).map(k => k.toLowerCase()).join(', ');
      return {
        success: false,
        message: `Unknown biome: ${biomeName}. Available: ${available}`,
        type: 'error'
      };
    }

    // Get world seed
    const seed = context.worldInfo?.seed;
    if (!seed) {
      return {
        success: false,
        message: 'World seed not available',
        type: 'error'
      };
    }

    // Get player position
    const startX = Math.floor(context.playerPos.x);
    const startZ = Math.floor(context.playerPos.z);

    // Search for biome using spiral pattern
    const result = this.searchBiome(seed, startX, startZ, targetBiomeId);

    if (result) {
      const distance = Math.floor(Math.sqrt(
        (result.x - startX) ** 2 + (result.z - startZ) ** 2
      ));
      const biomeName = BIOMES[targetBiomeId]?.name || 'Unknown';
      return {
        success: true,
        message: `Found ${biomeName} at ${result.x}, ~, ${result.z} (${distance} blocks away)`,
        type: 'success'
      };
    } else {
      return {
        success: false,
        message: `Could not find ${BIOMES[targetBiomeId]?.name || biomeName} within search radius`,
        type: 'error'
      };
    }
  }

  /**
   * Search for biome using spiral pattern
   * Samples every 16 blocks (chunk size) for efficiency
   */
  searchBiome(seed, startX, startZ, targetBiomeId) {
    const noise = new NoiseGenerators(seed);
    const STEP = 16; // Sample every chunk
    const MAX_RADIUS = 10000; // Max search radius in blocks
    const MAX_STEPS = Math.floor(MAX_RADIUS / STEP);

    // Spiral search pattern
    let x = 0, z = 0;
    let dx = 0, dz = -1;
    const maxI = (2 * MAX_STEPS + 1) ** 2;

    for (let i = 0; i < maxI; i++) {
      // Check current position
      const worldX = startX + x * STEP;
      const worldZ = startZ + z * STEP;

      const params = noise.sampleTerrainParams(worldX, worldZ);
      const biomeId = getBiomeId(params.temperature, params.humidity, params.continentalness);

      if (biomeId === targetBiomeId) {
        return { x: worldX, z: worldZ };
      }

      // Spiral movement
      if (x === z || (x < 0 && x === -z) || (x > 0 && x === 1 - z)) {
        // Change direction
        const temp = dx;
        dx = -dz;
        dz = temp;
      }
      x += dx;
      z += dz;

      // Stop if we've gone too far
      if (Math.abs(x) > MAX_STEPS && Math.abs(z) > MAX_STEPS) {
        break;
      }
    }

    return null;
  }

  getUsage() {
    return '/locate biome <biome_name>';
  }
}

// === HELP ===
class HelpCommand extends Command {
  constructor(processor) {
    super('help', ['?', 'commands'], 'Show available commands');
    this.processor = processor;
  }

  execute(args, context) {
    const commands = this.processor.getCommandNames();

    return {
      success: true,
      message: `Commands: /${commands.join(', /')}`,
      type: 'info'
    };
  }
}

/**
 * Создать и настроить CommandProcessor со всеми командами
 * @returns {CommandProcessor}
 */
export function createCommandProcessor() {
  const processor = new CommandProcessor();

  // Регистрируем все команды
  processor.register(new TeleportCommand());
  processor.register(new NoclipCommand());
  processor.register(new FlyCommand());
  processor.register(new SpeedCommand());
  processor.register(new SeedCommand());
  processor.register(new PosCommand());
  processor.register(new GameModeCommand());
  processor.register(new HealthCommand());
  processor.register(new HealCommand());
  processor.register(new DamageCommand());
  processor.register(new LocateBiomeCommand());

  // Help должен быть последним, т.к. ему нужен processor
  processor.register(new HelpCommand(processor));

  return processor;
}

// Экспортируем классы для возможного расширения
export {
  TeleportCommand,
  NoclipCommand,
  FlyCommand,
  SpeedCommand,
  SeedCommand,
  PosCommand,
  GameModeCommand,
  HealthCommand,
  HealCommand,
  DamageCommand,
  LocateBiomeCommand,
  HelpCommand
};

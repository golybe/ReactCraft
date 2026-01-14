/**
 * CommandProcessor - система обработки команд чата
 *
 * Использование:
 *   const processor = new CommandProcessor();
 *   processor.execute('tp', ['10', '64', '10'], context);
 */

// Базовый класс команды
export class Command {
  constructor(name, aliases = [], description = '') {
    this.name = name;
    this.aliases = aliases;
    this.description = description;
  }

  /**
   * Выполнить команду
   * @param {string[]} args - аргументы команды
   * @param {CommandContext} context - контекст выполнения
   * @returns {CommandResult}
   */
  execute(args, context) {
    throw new Error(`Command ${this.name} must implement execute()`);
  }

  /**
   * Получить справку по использованию
   */
  getUsage() {
    return `/${this.name}`;
  }
}

/**
 * Результат выполнения команды
 * @typedef {Object} CommandResult
 * @property {boolean} success - успешно ли выполнена
 * @property {string} message - сообщение для пользователя
 * @property {'success'|'error'|'info'} type - тип сообщения
 */

/**
 * Контекст выполнения команды
 * @typedef {Object} CommandContext
 * @property {Object} playerPos - позиция игрока
 * @property {Object} worldInfo - информация о мире
 * @property {Function} teleportTo - функция телепортации
 * @property {Function} setGameMode - установка режима игры
 * @property {boolean} noclipMode - текущий режим noclip
 * @property {Function} setNoclipMode - установка noclip
 * @property {boolean} canFly - может ли летать
 * @property {Function} setCanFly - установка возможности полёта
 * @property {Function} setIsFlying - установка состояния полёта
 * @property {Function} setSpeedMultiplier - установка множителя скорости
 */

export class CommandProcessor {
  constructor() {
    this.commands = new Map();
    this.aliases = new Map();
  }

  /**
   * Зарегистрировать команду
   * @param {Command} command
   */
  register(command) {
    this.commands.set(command.name.toLowerCase(), command);

    // Регистрируем алиасы
    for (const alias of command.aliases) {
      this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
    }
  }

  /**
   * Получить команду по имени или алиасу
   * @param {string} name
   * @returns {Command|null}
   */
  get(name) {
    const lowerName = name.toLowerCase();

    // Проверяем прямое имя
    if (this.commands.has(lowerName)) {
      return this.commands.get(lowerName);
    }

    // Проверяем алиасы
    if (this.aliases.has(lowerName)) {
      const realName = this.aliases.get(lowerName);
      return this.commands.get(realName);
    }

    return null;
  }

  /**
   * Выполнить команду
   * @param {string} name - имя команды
   * @param {string[]} args - аргументы
   * @param {CommandContext} context - контекст
   * @returns {CommandResult}
   */
  execute(name, args, context) {
    const command = this.get(name);

    if (!command) {
      return {
        success: false,
        message: `Unknown command: ${name}`,
        type: 'error'
      };
    }

    try {
      return command.execute(args, context);
    } catch (error) {
      return {
        success: false,
        message: `Error executing command: ${error.message}`,
        type: 'error'
      };
    }
  }

  /**
   * Разобрать строку команды и выполнить
   * @param {string} input - строка вида "/command arg1 arg2"
   * @param {CommandContext} context
   * @returns {CommandResult|null} - null если это не команда
   */
  process(input, context) {
    if (!input.startsWith('/')) {
      return null;
    }

    const [cmd, ...args] = input.slice(1).split(' ');
    return this.execute(cmd, args, context);
  }

  /**
   * Получить все зарегистрированные команды
   * @returns {Command[]}
   */
  getAll() {
    return Array.from(this.commands.values());
  }

  /**
   * Получить список имён команд для справки
   * @returns {string[]}
   */
  getCommandNames() {
    return Array.from(this.commands.keys());
  }
}

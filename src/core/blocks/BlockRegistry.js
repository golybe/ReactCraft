/**
 * Реестр всех блоков в игре
 */
class Registry {
  constructor() {
    this.blocks = new Map(); // name -> Block
    this.blocksById = new Map(); // id -> Block
  }

  /**
   * Зарегистрировать новый блок
   * @param {Block} block 
   */
  register(block) {
    if (this.blocksById.has(block.id)) {
      console.warn(`Block with ID ${block.id} already registered! Overwriting.`);
    }
    this.blocks.set(block.name, block);
    this.blocksById.set(block.id, block);
    return block;
  }

  /**
   * Получить блок по имени
   * @param {string} name 
   * @returns {Block}
   */
  getByName(name) {
    return this.blocks.get(name);
  }

  /**
   * Получить блок по ID
   * @param {number} id 
   * @returns {Block}
   */
  get(id) {
    return this.blocksById.get(id);
  }

  /**
   * Получить все зарегистрированные блоки
   * @returns {Block[]}
   */
  getAll() {
    return Array.from(this.blocks.values());
  }
}

export const BlockRegistry = new Registry();

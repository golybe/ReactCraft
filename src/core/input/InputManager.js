/**
 * InputManager - централизованная обработка ввода
 * Мапит физические клавиши на логические действия игры
 */

export const INPUT_ACTIONS = {
  // UI Actions
  OPEN_CHAT: 'OPEN_CHAT',
  TOGGLE_INVENTORY: 'TOGGLE_INVENTORY',
  DROP_ITEM: 'DROP_ITEM',
  
  // Hotbar Actions
  SELECT_SLOT_1: 'SELECT_SLOT_1',
  SELECT_SLOT_2: 'SELECT_SLOT_2',
  SELECT_SLOT_3: 'SELECT_SLOT_3',
  SELECT_SLOT_4: 'SELECT_SLOT_4',
  SELECT_SLOT_5: 'SELECT_SLOT_5',
  SELECT_SLOT_6: 'SELECT_SLOT_6',
  SELECT_SLOT_7: 'SELECT_SLOT_7',
  SELECT_SLOT_8: 'SELECT_SLOT_8',
  SELECT_SLOT_9: 'SELECT_SLOT_9',
  HOTBAR_SCROLL_UP: 'HOTBAR_SCROLL_UP',
  HOTBAR_SCROLL_DOWN: 'HOTBAR_SCROLL_DOWN',
};

export class InputManager {
  constructor() {
    // Mapping клавиш на действия
    this.keyMap = {
      'KeyT': INPUT_ACTIONS.OPEN_CHAT,
      'KeyE': INPUT_ACTIONS.TOGGLE_INVENTORY,
      'KeyQ': INPUT_ACTIONS.DROP_ITEM,
      'Digit1': INPUT_ACTIONS.SELECT_SLOT_1,
      'Digit2': INPUT_ACTIONS.SELECT_SLOT_2,
      'Digit3': INPUT_ACTIONS.SELECT_SLOT_3,
      'Digit4': INPUT_ACTIONS.SELECT_SLOT_4,
      'Digit5': INPUT_ACTIONS.SELECT_SLOT_5,
      'Digit6': INPUT_ACTIONS.SELECT_SLOT_6,
      'Digit7': INPUT_ACTIONS.SELECT_SLOT_7,
      'Digit8': INPUT_ACTIONS.SELECT_SLOT_8,
      'Digit9': INPUT_ACTIONS.SELECT_SLOT_9,
    };
    
    // Callback'и для действий
    this.actionHandlers = new Map();
    
    // Состояние
    this.isEnabled = true;
    this.pointerLocked = false;
    this.uiState = {
      isChatOpen: false,
      isInventoryOpen: false,
      isPaused: false
    };
    
    // Bind методов
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
  }

  /**
   * Зарегистрировать обработчик действия
   */
  on(action, handler) {
    this.actionHandlers.set(action, handler);
  }

  /**
   * Удалить обработчик действия
   */
  off(action) {
    this.actionHandlers.delete(action);
  }

  /**
   * Вызвать действие
   */
  emit(action, data = {}) {
    if (!this.isEnabled) return;
    
    const handler = this.actionHandlers.get(action);
    if (handler) {
      handler(data);
    }
  }

  /**
   * Обработчик нажатия клавиши
   */
  handleKeyDown(event) {
    if (!this.isEnabled) return;

    const action = this.keyMap[event.code];
    
    if (action) {
      // Если чат или инвентарь открыт, не обрабатываем игровые клавиши
      // (позволяем браузеру обрабатывать ввод текста)
      if (this.uiState.isChatOpen || this.uiState.isInventoryOpen) {
        // Но разрешаем закрытие инвентаря через E
        if (action === INPUT_ACTIONS.TOGGLE_INVENTORY && this.uiState.isInventoryOpen) {
          event.preventDefault();
          this.emit(action, { event });
        }
        // Всё остальное пропускаем (для ввода текста в чате)
        return;
      }
      
      // Для некоторых действий нужны дополнительные условия
      if (action === INPUT_ACTIONS.DROP_ITEM) {
        // Выброс предмета работает только при захваченном курсоре
        if (!this.pointerLocked) return;
        event.preventDefault();
      } else if (action === INPUT_ACTIONS.OPEN_CHAT || action === INPUT_ACTIONS.TOGGLE_INVENTORY) {
        // Чат и инвентарь обрабатываются всегда (когда UI закрыт)
        event.preventDefault();
      } else {
        // Остальные действия (цифры) обрабатываются только при захваченном курсоре
        if (!this.pointerLocked) return;
        event.preventDefault();
      }
      
      this.emit(action, { event });
    }
  }

  /**
   * Обработчик колеса мыши
   */
  handleWheel(event) {
    if (!this.isEnabled || !this.pointerLocked) return;
    
    event.preventDefault();
    
    if (event.deltaY > 0) {
      this.emit(INPUT_ACTIONS.HOTBAR_SCROLL_DOWN, { event });
    } else {
      this.emit(INPUT_ACTIONS.HOTBAR_SCROLL_UP, { event });
    }
  }

  /**
   * Обновить состояние pointer lock
   */
  setPointerLocked(locked) {
    this.pointerLocked = locked;
  }

  /**
   * Обновить состояние UI
   */
  setUIState(state) {
    this.uiState = { ...this.uiState, ...state };
  }

  /**
   * Включить/выключить обработку ввода
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * Подключить обработчики к DOM
   */
  attach() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  /**
   * Отключить обработчики от DOM
   */
  detach() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('wheel', this.handleWheel);
  }

  /**
   * Очистка
   */
  destroy() {
    this.detach();
    this.actionHandlers.clear();
  }
}

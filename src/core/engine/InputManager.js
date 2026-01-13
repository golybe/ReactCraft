/**
 * InputManager - управление вводом (клавиатура и мышь)
 */
export class InputManager {
  constructor() {
    this.keys = new Set();
    this.mouseButtons = new Set();
    this.mouseDelta = { x: 0, y: 0 };
    this.isPointerLocked = false;
    
    // Callbacks
    this.onPointerLockChange = null;
    this.onPointerLockError = null;
    
    // Bind handlers
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handlePointerLockChange = this.handlePointerLockChange.bind(this);
    this.handlePointerLockError = this.handlePointerLockError.bind(this);
  }

  /**
   * Привязать обработчики к элементу
   */
  bind(element = window) {
    element.addEventListener('keydown', this.handleKeyDown);
    element.addEventListener('keyup', this.handleKeyUp);
    element.addEventListener('mousedown', this.handleMouseDown);
    element.addEventListener('mouseup', this.handleMouseUp);
    element.addEventListener('mousemove', this.handleMouseMove);
    element.addEventListener('wheel', this.handleWheel, { passive: false });
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('pointerlockerror', this.handlePointerLockError);
  }

  /**
   * Отвязать обработчики
   */
  unbind() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('wheel', this.handleWheel);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('pointerlockerror', this.handlePointerLockError);
  }

  handleKeyDown(e) {
    this.keys.add(e.code);
  }

  handleKeyUp(e) {
    this.keys.delete(e.code);
  }

  handleMouseDown(e) {
    this.mouseButtons.add(e.button);
  }

  handleMouseUp(e) {
    this.mouseButtons.delete(e.button);
  }

  handleMouseMove(e) {
    if (this.isPointerLocked) {
      this.mouseDelta.x += e.movementX || 0;
      this.mouseDelta.y += e.movementY || 0;
    }
  }

  handleWheel(e) {
    // Wheel events handled separately via getWheelDelta
  }

  handlePointerLockChange() {
    this.isPointerLocked = document.pointerLockElement === document.body;
    if (this.onPointerLockChange) {
      this.onPointerLockChange(this.isPointerLocked);
    }
  }

  handlePointerLockError() {
    if (this.onPointerLockError) {
      this.onPointerLockError();
    }
  }

  /**
   * Проверить, нажата ли клавиша
   */
  isKeyDown(key) {
    return this.keys.has(key);
  }

  /**
   * Проверить, нажата ли кнопка мыши
   */
  isMouseButtonDown(button) {
    return this.mouseButtons.has(button);
  }

  /**
   * Получить вектор движения (WASD)
   */
  getMovementVector() {
    const forward = this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp') ? 1 : 0;
    const backward = this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown') ? 1 : 0;
    const left = this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft') ? 1 : 0;
    const right = this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight') ? 1 : 0;
    const jump = this.isKeyDown('Space') ? 1 : 0;
    const shift = this.isKeyDown('ShiftLeft') || this.isKeyDown('ShiftRight') ? 1 : 0;

    return {
      forward: forward - backward,
      right: right - left,
      jump,
      shift
    };
  }

  /**
   * Получить дельту движения мыши и сбросить её
   */
  getMouseDelta() {
    const delta = { ...this.mouseDelta };
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    return delta;
  }

  /**
   * Запросить pointer lock
   */
  requestPointerLock() {
    document.body.requestPointerLock();
  }

  /**
   * Выйти из pointer lock
   */
  exitPointerLock() {
    document.exitPointerLock();
  }

  /**
   * Получить дельту колесика мыши (для переключения слотов)
   */
  getWheelDelta(event) {
    return event.deltaY;
  }
}

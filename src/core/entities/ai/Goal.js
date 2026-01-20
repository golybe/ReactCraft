/**
 * Goal - базовый класс цели AI (аналог Minecraft Goal)
 * 
 * Система целей работает так:
 * 1. GoalSelector содержит список целей с приоритетами
 * 2. Каждый тик проверяется canUse() для каждой цели
 * 3. Цель с наивысшим приоритетом (меньшее число) и canUse()=true запускается
 * 4. Активная цель выполняет tick() пока canContinueToUse()=true
 * 5. При остановке вызывается stop()
 */
export class Goal {
  constructor() {
    // Флаги типа цели (как в Minecraft GoalType)
    this.flags = new Set(); // 'MOVE', 'LOOK', 'JUMP', 'TARGET'
  }

  /**
   * Можно ли начать выполнение цели?
   * @returns {boolean}
   */
  canUse() {
    return false;
  }

  /**
   * Можно ли продолжать выполнение?
   * @returns {boolean}
   */
  canContinueToUse() {
    return this.canUse();
  }

  /**
   * Вызывается при старте цели
   */
  start() {}

  /**
   * Вызывается при остановке цели
   */
  stop() {}

  /**
   * Выполняется каждый тик пока цель активна
   * @param {number} deltaTime
   */
  tick(deltaTime) {}

  /**
   * Требует ли эта цель непрерывного выполнения?
   * Если true, цель не будет прервана целями с тем же приоритетом
   */
  requiresUpdateEveryTick() {
    return false;
  }
}

/**
 * GoalSelector - менеджер целей моба (аналог Minecraft GoalSelector)
 */
export class GoalSelector {
  constructor(mob) {
    this.mob = mob;
    this.availableGoals = []; // { priority, goal }
    this.activeGoals = new Set();
    this.lockedFlags = new Set();
  }

  /**
   * Добавить цель с приоритетом (меньше = важнее)
   */
  addGoal(priority, goal) {
    goal.mob = this.mob;
    this.availableGoals.push({ priority, goal });
    // Сортируем по приоритету
    this.availableGoals.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Удалить цель
   */
  removeGoal(goal) {
    this.availableGoals = this.availableGoals.filter(g => g.goal !== goal);
    this.activeGoals.delete(goal);
  }

  /**
   * Обновление целей (вызывается каждый тик)
   */
  tick(deltaTime) {
    // Проверяем какие цели можно запустить
    for (const { priority, goal } of this.availableGoals) {
      const isRunning = this.activeGoals.has(goal);

      if (isRunning) {
        // Проверяем можно ли продолжать
        if (!goal.canContinueToUse()) {
          goal.stop();
          this.activeGoals.delete(goal);
          this.unlockFlags(goal);
        }
      } else {
        // Проверяем можно ли запустить
        if (this.canUseGoal(goal) && goal.canUse()) {
          // Вытесняем менее приоритетные цели с конфликтующими флагами
          const newPriority = this.getPriority(goal);
          const goalsToStop = [];
          for (const activeGoal of this.activeGoals) {
            const activePriority = this.getPriority(activeGoal);
            // Если активная цель менее приоритетна и имеет конфликтующие флаги
            if (activePriority > newPriority) {
              for (const flag of goal.flags) {
                if (activeGoal.flags.has(flag)) {
                  goalsToStop.push(activeGoal);
                  break;
                }
              }
            }
          }
          // Останавливаем вытесненные цели
          for (const stopGoal of goalsToStop) {
            stopGoal.stop();
            this.activeGoals.delete(stopGoal);
            this.unlockFlags(stopGoal);
          }
          
          goal.start();
          this.activeGoals.add(goal);
          this.lockFlags(goal);
        }
      }
    }

    // Выполняем активные цели
    for (const goal of this.activeGoals) {
      goal.tick(deltaTime);
    }
  }

  /**
   * Проверяет, не заблокированы ли флаги цели другими активными целями
   */
  canUseGoal(goal) {
    for (const flag of goal.flags) {
      if (this.lockedFlags.has(flag)) {
        // Проверяем приоритет блокирующей цели
        for (const activeGoal of this.activeGoals) {
          if (activeGoal.flags.has(flag)) {
            const activePriority = this.getPriority(activeGoal);
            const newPriority = this.getPriority(goal);
            if (activePriority <= newPriority) {
              return false; // Более приоритетная цель блокирует
            }
          }
        }
      }
    }
    return true;
  }

  getPriority(goal) {
    const found = this.availableGoals.find(g => g.goal === goal);
    return found ? found.priority : Infinity;
  }

  lockFlags(goal) {
    for (const flag of goal.flags) {
      this.lockedFlags.add(flag);
    }
  }

  unlockFlags(goal) {
    for (const flag of goal.flags) {
      // Проверяем, не используется ли флаг другой активной целью
      let stillLocked = false;
      for (const activeGoal of this.activeGoals) {
        if (activeGoal !== goal && activeGoal.flags.has(flag)) {
          stillLocked = true;
          break;
        }
      }
      if (!stillLocked) {
        this.lockedFlags.delete(flag);
      }
    }
  }

  /**
   * Экстренная остановка всех целей
   */
  stopAll() {
    for (const goal of this.activeGoals) {
      goal.stop();
    }
    this.activeGoals.clear();
    this.lockedFlags.clear();
  }
}

// Утилита для профилирования
export const PerformanceMetrics = {
  frameTime: 0,
  lastFrameStart: 0,
  
  // Для расчета скользящего среднего
  frameHistory: [],
  MAX_HISTORY: 60,
  
  // Порог срабатывания (в процентах, например 50 = +50% к среднему времени кадра)
  DROP_THRESHOLD_PERCENT: 30,
  // Минимальное время кадра для срабатывания (чтобы не ловить шум на 1000 FPS)
  MIN_FRAME_TIME_MS: 16, // ~60 FPS

  // Таймеры текущего кадра
  timers: {
    physics: 0,
    lighting: 0,
    meshingPrep: 0,
    blocksCount: 0,
    chunkUpdate: 0,
  },

  customMetrics: {},

  startFrame() {
    this.lastFrameStart = performance.now();
    // Сброс таймеров
    for (const key in this.timers) {
      this.timers[key] = 0;
    }
    this.customMetrics = {};
  },

  endFrame() {
    const now = performance.now();
    this.frameTime = now - this.lastFrameStart;
    
    // 1. Считаем среднее
    let avgFrameTime = 0;
    if (this.frameHistory.length > 0) {
        avgFrameTime = this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length;
    }

    // 2. Обновляем историю
    this.frameHistory.push(this.frameTime);
    if (this.frameHistory.length > this.MAX_HISTORY) {
        this.frameHistory.shift();
    }

    // 3. Проверка на резкий скачок
    // Проверяем только если у нас накопилась история и кадр не супер-быстрый
    if (this.frameHistory.length >= 10 && this.frameTime > this.MIN_FRAME_TIME_MS) {
        const diff = this.frameTime - avgFrameTime;
        const percentage = (diff / avgFrameTime) * 100;

        if (percentage > this.DROP_THRESHOLD_PERCENT) {
            this.reportLag(avgFrameTime, Math.round(percentage));
        }
    }
  },

  // Обертка для замера функции
  measure(name, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    if (this.timers[name] !== undefined) {
      this.timers[name] += (end - start);
    }
    return result;
  },

  setMetric(name, value) {
      this.customMetrics[name] = value;
  },

  // Отправка отчета на сервер
  async reportLag(avgFrameTime, percentage) {
    const fps = Math.round(1000 / this.frameTime);
    
    // Формируем полезную нагрузку
    const payload = {
        fps,
        frameTime: this.frameTime,
        averageFrameTime: avgFrameTime,
        dropPercentage: percentage,
        timers: { ...this.timers, ...this.customMetrics }
    };

    try {
        await fetch('http://localhost:3001/api/log-performance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        // Если сервер недоступен, пишем в консоль браузера тихо
        console.warn('Failed to send perf report to server', e);
    }
  }
};

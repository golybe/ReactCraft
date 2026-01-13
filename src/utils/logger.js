// Система логирования
const isDev = import.meta.env?.DEV ?? true;

// Хранилище логов в памяти
const logs = [];
const MAX_LOGS = 1000;

export const log = (category, ...args) => {
  const message = `[${category}] ${args.map(a => 
    typeof a === 'object' ? JSON.stringify(a) : String(a)
  ).join(' ')}`;

  // Сохраняем в память
  const timestamp = new Date().toISOString();
  logs.push(`[${timestamp}] ${message}`);
  if (logs.length > MAX_LOGS) logs.shift();

  // Выводим в консоль (ТОЛЬКО ошибки или важные сообщения)
  if (isDev && (category === 'Error' || category === 'System')) {
    console.log(`[${category}]`, ...args);
  }

  // Отправляем на сервер (если доступен)
  // ОТКЛЮЧЕНО для производительности
  /* 
  if (isDev) {
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry: message })
    }).catch(e => {
        // Игнорируем ошибки отправки, чтобы не спамить
    });
  } 
  */
};

// Получить все логи
export const getLogs = () => logs.join('\n');

// Скачать логи
export const downloadLogs = (worldId = 'unknown') => {
  const element = document.createElement('a');
  const file = new Blob([getLogs()], {type: 'text/plain'});
  element.href = URL.createObjectURL(file);
  element.download = `minecraft-react-logs-${worldId}-${Date.now()}.txt`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

export default { log, getLogs, downloadLogs };

// Vite плагин для логирования в файлы
import fs from 'fs';
import path from 'path';

const logsDir = path.resolve('logs');
const sessionId = Date.now();
const logFile = path.join(logsDir, `session-${sessionId}.log`);

// Создаем папку для логов
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Создаем файл сессии
fs.writeFileSync(logFile, `=== Session started: ${new Date().toISOString()} ===\n`);

export function loggerPlugin() {
  return {
    name: 'vite-logger-plugin',
    configureServer(server) {
      server.middlewares.use('/api/log', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const timestamp = new Date().toISOString();
              const logEntry = `[${timestamp}] ${data.entry}\n`;

              // Записываем в файл
              fs.appendFileSync(logFile, logEntry);

              // Также выводим в консоль сервера
              console.log(`[CLIENT LOG] ${data.entry}`);

              res.statusCode = 200;
              res.end('OK');
            } catch (e) {
              console.error('Logger error:', e);
              res.statusCode = 500;
              res.end('Error');
            }
          });
        } else {
          res.statusCode = 404;
          res.end('Not found');
        }
      });
    }
  };
}

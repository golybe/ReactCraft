const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;
const SAVES_DIR = path.join(__dirname, 'saves');

// Настройка
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Лимит 50мб для больших миров

// Создаем папку saves если нет
if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR);
}

// 1. Получить список миров
app.get('/api/worlds', (req, res) => {
    try {
        if (!fs.existsSync(SAVES_DIR)) {
            return res.json([]);
        }
        
        const worlds = [];
        const files = fs.readdirSync(SAVES_DIR);
        
        for (const file of files) {
            const worldDir = path.join(SAVES_DIR, file);
            if (fs.statSync(worldDir).isDirectory()) {
                const metaPath = path.join(worldDir, 'level.json');
                if (fs.existsSync(metaPath)) {
                    try {
                        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                        // Добавляем ID папки, если его нет в метаданных
                        worlds.push({ ...meta, id: file });
                    } catch (err) {
                        console.error(`Error reading metadata for ${file}:`, err);
                    }
                }
            }
        }
        res.json(worlds);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// 2. Сохранить мир (метаданные + чанки)
app.post('/api/worlds/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { metadata, chunks } = req.body;
        
        const worldDir = path.join(SAVES_DIR, id);
        if (!fs.existsSync(worldDir)) {
            fs.mkdirSync(worldDir, { recursive: true });
        }
        
        // Сохраняем метаданные (level.json)
        // Обновляем id в метаданных чтобы совпадал с папкой
        const newMeta = { ...metadata, id };
        fs.writeFileSync(path.join(worldDir, 'level.json'), JSON.stringify(newMeta, null, 2));
        
        // Сохраняем чанки (chunks.json) - в будущем можно chunks.bin
        // Если чанки не переданы (обновляем только мету), не трогаем файл
        if (chunks) {
            fs.writeFileSync(path.join(worldDir, 'chunks.json'), JSON.stringify(chunks));
        }
        
        console.log(`World ${id} saved to disk.`);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// 3. Загрузить чанки мира
app.get('/api/worlds/:id/chunks', (req, res) => {
    try {
        const { id } = req.params;
        const chunksPath = path.join(SAVES_DIR, id, 'chunks.json');
        
        if (fs.existsSync(chunksPath)) {
            const data = fs.readFileSync(chunksPath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({});
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// 4. Удалить мир
app.delete('/api/worlds/:id', (req, res) => {
    try {
        const { id } = req.params;
        const worldDir = path.join(SAVES_DIR, id);
        
        if (fs.existsSync(worldDir)) {
            fs.rmSync(worldDir, { recursive: true, force: true });
        }
        
        console.log(`World ${id} deleted.`);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// 5. Удалить ВСЕ миры
app.delete('/api/worlds', (req, res) => {
    try {
        if (fs.existsSync(SAVES_DIR)) {
            // Удаляем содержимое папки
            const files = fs.readdirSync(SAVES_DIR);
            for (const file of files) {
                 const p = path.join(SAVES_DIR, file);
                 if (fs.statSync(p).isDirectory()) {
                    fs.rmSync(p, { recursive: true, force: true });
                 }
            }
        }
        console.log('All worlds deleted.');
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// 6. Логирование производительности
app.post('/api/log-performance', (req, res) => {
    const { fps, frameTime, averageFrameTime, dropPercentage, timers } = req.body;
    
    console.log('\x1b[33m%s\x1b[0m', `[LAG DETECTED] FPS: ${fps} | Time: ${frameTime.toFixed(2)}ms (Avg: ${averageFrameTime.toFixed(2)}ms, +${dropPercentage}%)`);
    if (timers) {
        console.table(timers);
    }
    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`Minecraft Save Server running at http://localhost:${PORT}`);
    console.log(`Saves directory: ${SAVES_DIR}`);
});

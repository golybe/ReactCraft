import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { loggerPlugin } from './vite-logger-plugin.js'

export default defineConfig({
  plugins: [react(), loggerPlugin()],
  worker: {
    format: 'es', // ES modules в воркерах
    plugins: () => []   // Функция, возвращающая плагины
  },
  build: {
    target: 'esnext', // Современный синтаксис для производительности
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'react-three': ['@react-three/fiber', '@react-three/drei']
        }
      }
    }
  },
  server: {
    open: true,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  optimizeDeps: {
    exclude: ['src/workers/chunkWorker.js']
  }
})

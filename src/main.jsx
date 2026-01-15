import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initBlocks } from './core/initBlocks';
import './index.css';

// Гарантируем инициализацию блоков перед рендером
initBlocks();


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

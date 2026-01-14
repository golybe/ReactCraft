import React, { useState, useEffect, useRef } from 'react';
import '../../styles/chat.css';

const MAX_HISTORY = 50; // Максимальное количество команд в истории

const Chat = ({ isOpen, onClose, onSendMessage, messages }) => {
  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  
  // История команд
  const [commandHistory, setCommandHistory] = useState(() => {
    // Загружаем историю из localStorage
    try {
      const saved = localStorage.getItem('chatCommandHistory');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState(''); // Временное хранение текущего ввода

  // Автофокус при открытии
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      // Сбрасываем индекс истории при открытии чата
      setHistoryIndex(-1);
      setTempInput('');
    }
  }, [isOpen]);

  // Скролл к последнему сообщению
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Сохранение истории в localStorage
  useEffect(() => {
    try {
      localStorage.setItem('chatCommandHistory', JSON.stringify(commandHistory));
    } catch (e) {
      console.warn('Failed to save command history:', e);
    }
  }, [commandHistory]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (inputValue.trim()) {
        // Добавляем команду в историю (только если это не дубликат последней команды)
        const trimmedValue = inputValue.trim();
        if (commandHistory[commandHistory.length - 1] !== trimmedValue) {
          setCommandHistory(prev => {
            const newHistory = [...prev, trimmedValue];
            // Ограничиваем размер истории
            return newHistory.slice(-MAX_HISTORY);
          });
        }
        
        onSendMessage(inputValue);
        setInputValue('');
        setHistoryIndex(-1);
        setTempInput('');
      }
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowUp') {
      // Навигация вверх по истории (к более старым командам)
      e.preventDefault();
      
      if (commandHistory.length === 0) return;
      
      // Сохраняем текущий ввод при первом нажатии стрелки вверх
      if (historyIndex === -1) {
        setTempInput(inputValue);
      }
      
      const newIndex = historyIndex === -1 
        ? commandHistory.length - 1 
        : Math.max(0, historyIndex - 1);
      
      setHistoryIndex(newIndex);
      setInputValue(commandHistory[newIndex]);
    } else if (e.key === 'ArrowDown') {
      // Навигация вниз по истории (к более новым командам)
      e.preventDefault();
      
      if (historyIndex === -1) return;
      
      if (historyIndex >= commandHistory.length - 1) {
        // Возвращаемся к текущему вводу
        setHistoryIndex(-1);
        setInputValue(tempInput);
      } else {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      }
    }
  };

  if (!isOpen && messages.length === 0) return null;

  return (
    <div className={`chat-container ${isOpen ? 'open' : ''}`}>
      {/* История сообщений */}
      <div className="chat-messages">
        {messages.map((msg, index) => {
          const msgOpacity = isOpen ? 1 : Math.max(0, 1 - (Date.now() - msg.timestamp) / 5000);
          const msgVisible = isOpen || (Date.now() - msg.timestamp) < 5000;
          
          return (
            <div 
              key={index} 
              className={`chat-message ${msg.type || 'default'}`}
              style={{
                opacity: msgOpacity,
                display: msgVisible ? 'block' : 'none'
              }}
            >
              {msg.text}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Поле ввода */}
      {isOpen && (
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            // Сбрасываем индекс истории при ручном редактировании
            if (historyIndex !== -1) {
              setHistoryIndex(-1);
              setTempInput(e.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          maxLength={100}
          className="chat-input"
          placeholder={
            historyIndex !== -1 
              ? `История [${historyIndex + 1}/${commandHistory.length}] - ↑/↓ для навигации` 
              : "Введите команду или сообщение... (↑ для истории)"
          }
        />
      )}
    </div>
  );
};

export default Chat;
import React, { useState, useEffect, useRef } from 'react';
import '../../styles/chat.css';

const Chat = ({ isOpen, onClose, onSendMessage, messages }) => {
  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  // Автофокус при открытии
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Скролл к последнему сообщению
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (inputValue.trim()) {
        onSendMessage(inputValue);
        setInputValue('');
      }
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
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
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={100}
          className="chat-input"
          placeholder="Введите команду или сообщение..."
        />
      )}
    </div>
  );
};

export default Chat;
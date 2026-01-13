import React, { useState, useEffect, useRef } from 'react';

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
    <div style={{
      position: 'fixed',
      bottom: '10px',
      left: '10px',
      zIndex: 2000,
      width: '500px',
      maxWidth: '90%',
      fontFamily: "'VT323', monospace",
      fontSize: '20px',
      pointerEvents: isOpen ? 'auto' : 'none', // Чтобы клики проходили сквозь закрытый чат
    }}>
      {/* История сообщений */}
      <div style={{
        backgroundColor: isOpen ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
        padding: '5px',
        borderRadius: '4px',
        marginBottom: '5px',
        maxHeight: '300px',
        overflowY: isOpen ? 'auto' : 'hidden',
        transition: 'background-color 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        // Скрываем скроллбар, но оставляем функционал
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {messages.map((msg, index) => (
            <div key={index} style={{
                color: msg.type === 'error' ? '#ff5555' : 
                       msg.type === 'info' ? '#ffff55' : 
                       msg.type === 'success' ? '#55ff55' : 'white',
                textShadow: '1px 1px 0 #000',
                opacity: isOpen ? 1 : Math.max(0, 1 - (Date.now() - msg.timestamp) / 5000), // Исчезают через 5 сек если чат закрыт
                transition: 'opacity 0.5s',
                display: (isOpen || (Date.now() - msg.timestamp) < 5000) ? 'block' : 'none'
            }}>
                {msg.text}
            </div>
        ))}
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
          style={{
            width: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: '1px solid #aaa',
            color: 'white',
            padding: '8px',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            outline: 'none',
            borderRadius: '2px'
          }}
          placeholder="Введите команду или сообщение..."
        />
      )}
    </div>
  );
};

export default Chat;
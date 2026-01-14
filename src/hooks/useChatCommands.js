import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createCommandProcessor } from '../core/commands/commands';

/**
 * Hook for managing chat messages and command processing
 */
export function useChatCommands({
  worldInfo,
  playerPos,
  setGameMode,
  noclipMode,
  setNoclipMode,
  canFly,
  setCanFly,
  setIsFlying,
  setSpeedMultiplier,
  teleportTo,
  player
}) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  const isChatOpenRef = useRef(isChatOpen);

  // Создаём CommandProcessor один раз
  const commandProcessor = useMemo(() => createCommandProcessor(), []);

  // Sync ref with state
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  const openChat = useCallback((isInventoryOpen, isPaused) => {
    if (!isChatOpen && !isInventoryOpen && !isPaused) {
      setIsChatOpen(true);
      isChatOpenRef.current = true;
      document.exitPointerLock();
    }
  }, [isChatOpen]);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    isChatOpenRef.current = false;
    document.body.requestPointerLock();
  }, []);

  const addMessage = useCallback((text, type = 'text') => {
    setChatMessages(prev => [...prev, { text, type, timestamp: Date.now() }]);
  }, []);

  const handleSendMessage = useCallback((text) => {
    // Добавляем сообщение в чат
    addMessage(text, 'text');

    // Если это команда - обрабатываем через CommandProcessor
    if (text.startsWith('/')) {
      // Создаём контекст для команды
      const context = {
        playerPos,
        worldInfo,
        teleportTo,
        setGameMode,
        noclipMode,
        setNoclipMode,
        canFly,
        setCanFly,
        setIsFlying,
        setSpeedMultiplier,
        player
      };

      // Выполняем команду
      const result = commandProcessor.process(text, context);

      if (result) {
        addMessage(result.message, result.type);
      }
    }
  }, [
    playerPos,
    worldInfo,
    teleportTo,
    setGameMode,
    noclipMode,
    setNoclipMode,
    canFly,
    setCanFly,
    setIsFlying,
    setSpeedMultiplier,
    player,
    addMessage,
    commandProcessor
  ]);

  return {
    isChatOpen,
    setIsChatOpen,
    isChatOpenRef,
    chatMessages,
    setChatMessages,
    openChat,
    closeChat,
    handleSendMessage,
    addMessage
  };
}

export default useChatCommands;

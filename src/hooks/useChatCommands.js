import { useState, useRef, useEffect, useCallback } from 'react';
import { GAME_MODES, GAME_MODE_NAMES } from '../constants/gameMode';

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
  setSpeedMultiplier,
  teleportTo
}) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  const isChatOpenRef = useRef(isChatOpen);

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
    addMessage(text, 'text');

    if (text.startsWith('/')) {
      const [cmd, ...args] = text.slice(1).split(' ');

      switch (cmd.toLowerCase()) {
        case 'tp':
          if (args.length === 3) {
            const x = parseFloat(args[0]);
            const y = parseFloat(args[1]);
            const z = parseFloat(args[2]);
            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
              teleportTo(x, y, z);
              addMessage(`Teleported to ${x}, ${y}, ${z}`, 'success');
            } else {
              addMessage('Invalid coordinates', 'error');
            }
          } else {
            addMessage('Usage: /tp <x> <y> <z>', 'error');
          }
          break;

        case 'noclip':
          const nextNoclip = !noclipMode;
          setNoclipMode(nextNoclip);
          addMessage(`Noclip mode ${nextNoclip ? 'enabled' : 'disabled'}`, 'info');
          break;

        case 'fly':
          const nextFly = !canFly;
          setCanFly(nextFly);
          addMessage(`Flight capability ${nextFly ? 'enabled' : 'disabled'} (Double-tap SPACE to fly)`, 'info');
          break;

        case 'speed':
          const speed = parseFloat(args[0]);
          if (!isNaN(speed) && speed > 0) {
            setSpeedMultiplier(speed);
            addMessage(`Speed set to ${speed}x`, 'success');
          } else {
            addMessage('Usage: /speed <value>', 'error');
          }
          break;

        case 'seed':
          addMessage(`World Seed: ${worldInfo?.seed || 'Unknown'}`, 'info');
          break;

        case 'pos':
          addMessage(
            `X: ${playerPos.x.toFixed(1)}, Y: ${playerPos.y.toFixed(1)}, Z: ${playerPos.z.toFixed(1)}`,
            'info'
          );
          break;

        case 'gm':
        case 'gamemode':
          const modeArg = args[0];
          if (modeArg === '0' || modeArg?.toLowerCase() === 'survival' || modeArg?.toLowerCase() === 's') {
            setGameMode(GAME_MODES.SURVIVAL);
            addMessage(`Режим игры изменен на: ${GAME_MODE_NAMES[GAME_MODES.SURVIVAL]}`, 'success');
          } else if (modeArg === '1' || modeArg?.toLowerCase() === 'creative' || modeArg?.toLowerCase() === 'c') {
            setGameMode(GAME_MODES.CREATIVE);
            addMessage(`Режим игры изменен на: ${GAME_MODE_NAMES[GAME_MODES.CREATIVE]}`, 'success');
          } else {
            addMessage('Usage: /gm <0|1|survival|creative>', 'error');
          }
          break;

        case 'help':
          addMessage('Commands: /tp, /noclip, /fly, /speed, /seed, /pos, /gm', 'info');
          break;

        default:
          addMessage(`Unknown command: ${cmd}`, 'error');
      }
    }
  }, [playerPos, worldInfo, teleportTo, setGameMode, noclipMode, setNoclipMode, canFly, setCanFly, setSpeedMultiplier, addMessage]);

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

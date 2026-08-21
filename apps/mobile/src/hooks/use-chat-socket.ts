import { useEffect, useRef } from 'react';
import { ChatMessage } from '../lib/api';
import { useAppSocket } from '../lib/app-socket';

export function useChatSocket(
  chatId: string | undefined,
  onMessage: (message: ChatMessage) => void,
  onRead?: (payload: { chatId: string; messageIds: string[] }) => void,
  onTyping?: (isTyping: boolean) => void,
) {
  const { socket } = useAppSocket();
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!socket || !chatId) return;

    const handleMessage = (payload: { chatId: string; message: ChatMessage }) => {
      if (payload.chatId === chatId) {
        onMessage(payload.message);
      }
    };

    const handleRead = (payload: { chatId: string; messageIds: string[] }) => {
      if (payload.chatId === chatId) {
        onRead?.(payload);
      }
    };

    const handleTyping = (payload: { chatId: string; isTyping?: boolean }) => {
      if (payload.chatId !== chatId) return;
      onTyping?.(payload.isTyping !== false);
      if (typingClearRef.current) {
        clearTimeout(typingClearRef.current);
      }
      if (payload.isTyping !== false) {
        typingClearRef.current = setTimeout(() => onTyping?.(false), 3000);
      }
    };

    socket.on('message.new', handleMessage);
    socket.on('message.read', handleRead);
    socket.on('chat.typing', handleTyping);

    return () => {
      socket.off('message.new', handleMessage);
      socket.off('message.read', handleRead);
      socket.off('chat.typing', handleTyping);
      if (typingClearRef.current) {
        clearTimeout(typingClearRef.current);
      }
    };
  }, [socket, chatId, onMessage, onRead, onTyping]);
}

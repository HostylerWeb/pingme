import { useEffect } from 'react';
import { ChatMessage } from '../lib/api';
import { useAppSocket } from '../lib/app-socket';

export function useChatSocket(
  chatId: string | undefined,
  onMessage: (message: ChatMessage) => void,
  onRead?: (payload: { chatId: string; messageIds: string[] }) => void,
) {
  const { socket } = useAppSocket();

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

    socket.on('message.new', handleMessage);
    socket.on('message.read', handleRead);

    return () => {
      socket.off('message.new', handleMessage);
      socket.off('message.read', handleRead);
    };
  }, [socket, chatId, onMessage, onRead]);
}

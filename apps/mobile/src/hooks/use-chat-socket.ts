import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../lib/auth-storage';
import { ChatMessage } from '../lib/api';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

function wsBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_WS_URL;
  if (explicit) {
    return explicit.replace(/\/ws\/?$/, '');
  }
  const httpBase = API_URL.replace(/\/v1\/?$/, '');
  if (httpBase.startsWith('https://')) {
    return httpBase.replace('https://', 'wss://');
  }
  return httpBase.replace('http://', 'ws://');
}

export function useChatSocket(
  chatId: string | undefined,
  onMessage: (message: ChatMessage) => void,
) {
  const socketRef = useRef<Socket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!chatId) return;

    let active = true;

    void (async () => {
      const token = await getAccessToken();
      if (!token || !active) return;

      const socket = io(`${wsBaseUrl()}/ws`, {
        auth: { token },
        transports: ['websocket'],
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('ping');
      });

      socket.on('message.new', (payload: { chatId: string; message: ChatMessage }) => {
        if (payload.chatId === chatId) {
          onMessageRef.current(payload.message);
        }
      });
    })();

    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [chatId]);
}

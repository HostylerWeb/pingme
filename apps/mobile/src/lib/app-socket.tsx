import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { ensureValidAccessToken } from './api';
import { getAccessToken } from './auth-storage';
import { isMatchPromptDismissed } from './match-prompt-dismiss';
import { useAuthStore } from '../stores/auth-store';
import { iconForNotificationType, showIncomingBanner } from '../stores/incoming-banner-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

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

function reconnectDelayMs(attempt: number) {
  const exponential = RECONNECT_BASE_MS * 2 ** Math.min(attempt, 5);
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(exponential + jitter, RECONNECT_MAX_MS);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldOpenMatchPrompt(pathname: string) {
  return (
    !pathname.startsWith('/match/') &&
    !pathname.startsWith('/chat/') &&
    !pathname.includes('icebreaker')
  );
}

type AppSocketContextValue = {
  socket: Socket | null;
  connected: boolean;
};

const AppSocketContext = createContext<AppSocketContextValue>({
  socket: null,
  connected: false,
});

export function useAppSocket() {
  return useContext(AppSocketContext);
}

export function AppSocketProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const pathnameRef = useRef(pathname);
  const reconnectingRef = useRef(false);
  const reconnectAttemptRef = useRef(0);

  pathnameRef.current = pathname;

  const disconnect = useCallback(() => {
    reconnectingRef.current = false;
    reconnectAttemptRef.current = 0;
    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocket(null);
    setConnected(false);
  }, []);

  const scheduleReconnect = useCallback(async () => {
    if (reconnectingRef.current || !socketRef.current) return;
    reconnectingRef.current = true;

    try {
      await sleep(reconnectDelayMs(reconnectAttemptRef.current));

      if (!socketRef.current) return;

      const valid = await ensureValidAccessToken();
      const token = valid ? await getAccessToken() : null;
      if (!token || !socketRef.current) {
        return;
      }

      socketRef.current.auth = { token };
      socketRef.current.connect();
    } finally {
      reconnectingRef.current = false;
      if (socketRef.current && !socketRef.current.connected) {
        reconnectAttemptRef.current += 1;
      }
    }
  }, []);

  const attachSocketListeners = useCallback(
    (nextSocket: Socket) => {
      nextSocket.on('connect', () => {
        setConnected(true);
        reconnectAttemptRef.current = 0;
        reconnectingRef.current = false;
        nextSocket.emit('ping');
      });

      nextSocket.on('disconnect', () => {
        setConnected(false);
      });

      nextSocket.on('connect_error', () => {
        setConnected(false);
        void scheduleReconnect();
      });

      nextSocket.on('message.new', (payload: { chatId: string; message?: { content?: string } }) => {
        void queryClient.invalidateQueries({ queryKey: ['chats'] });
        void queryClient.invalidateQueries({ queryKey: ['chat', payload.chatId] });
        void queryClient.invalidateQueries({ queryKey: ['chat-messages', payload.chatId] });

        const onChatScreen = pathnameRef.current.includes(`/chat/${payload.chatId}`);
        if (!onChatScreen) {
          const preview = payload.message?.content?.trim().slice(0, 100);
          showIncomingBanner({
            title: 'New message',
            body: preview || 'Open chat to read',
            icon: iconForNotificationType('chat.message'),
            payload: { type: 'chat.message', chatId: payload.chatId },
          });
        }
      });

      nextSocket.on('match.updated', (payload: { matchId: string; status: string; chatId?: string | null }) => {
        void queryClient.invalidateQueries({ queryKey: ['matches'] });
        void queryClient.invalidateQueries({ queryKey: ['match', payload.matchId] });
        void queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
        void queryClient.invalidateQueries({ queryKey: ['icebreaker-nearby'] });
        void queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
        if (
          payload.status === 'pending' &&
          !isMatchPromptDismissed(payload.matchId) &&
          shouldOpenMatchPrompt(pathnameRef.current)
        ) {
          router.push(`/match/${payload.matchId}`);
        }
      });

      nextSocket.on('presence.updated', () => {
        void queryClient.invalidateQueries({ queryKey: ['presence-status'] });
        void queryClient.invalidateQueries({ queryKey: ['nearby-users'] });
      });

      nextSocket.on('chat.closed', (payload: { chatId: string }) => {
        void queryClient.invalidateQueries({ queryKey: ['chats'] });
        void queryClient.invalidateQueries({ queryKey: ['chat', payload.chatId] });
        void queryClient.invalidateQueries({ queryKey: ['matches'] });
      });

      nextSocket.on('icebreaker.interest', (payload: { fromUserId: string; displayName: string }) => {
        void queryClient.invalidateQueries({ queryKey: ['icebreaker-nearby'] });
        void queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
        if (!pathnameRef.current.includes('icebreaker')) {
          showIncomingBanner({
            title: payload.displayName,
            body: 'Said yes in Break the ice',
            icon: iconForNotificationType('icebreaker.interest'),
            payload: { type: 'icebreaker.interest' },
          });
        }
      });
    },
    [queryClient, router, scheduleReconnect],
  );

  const connect = useCallback(async () => {
    const hasValidToken = await ensureValidAccessToken();
    if (!hasValidToken) {
      disconnect();
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      disconnect();
      return;
    }

    if (socketRef.current?.connected) {
      return;
    }

    if (socketRef.current) {
      socketRef.current.auth = { token };
      socketRef.current.connect();
      return;
    }

    const nextSocket = io(`${wsBaseUrl()}/ws`, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });

    attachSocketListeners(nextSocket);
    socketRef.current = nextSocket;
    setSocket(nextSocket);
  }, [attachSocketListeners, disconnect]);

  useEffect(() => {
    if (!user) {
      disconnect();
      return;
    }

    void connect();

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        void connect();
      } else if (state === 'background' || state === 'inactive') {
        disconnect();
      }
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => {
      subscription.remove();
      disconnect();
    };
  }, [user?.id, connect, disconnect]);

  const value = useMemo(
    () => ({ socket, connected }),
    [socket, connected],
  );

  return <AppSocketContext.Provider value={value}>{children}</AppSocketContext.Provider>;
}

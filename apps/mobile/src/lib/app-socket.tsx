import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './auth-storage';
import { isMatchPromptDismissed } from './match-prompt-dismiss';
import { useAuthStore } from '../stores/auth-store';
import { showToast } from '../stores/toast-store';

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
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  const disconnect = useCallback(() => {
    setSocket((current) => {
      current?.disconnect();
      return null;
    });
    setConnected(false);
  }, []);

  const connect = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      disconnect();
      return;
    }

    setSocket((current) => {
      if (current?.connected) {
        return current;
      }
      current?.disconnect();
      return null;
    });

    const nextSocket = io(`${wsBaseUrl()}/ws`, {
      auth: { token },
      transports: ['websocket'],
    });

    nextSocket.on('connect', () => {
      setConnected(true);
      nextSocket.emit('ping');
    });

    nextSocket.on('disconnect', () => {
      setConnected(false);
    });

    nextSocket.on('match.updated', (payload: { matchId: string; status: string; chatId?: string | null }) => {
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
      void queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
      void queryClient.invalidateQueries({ queryKey: ['icebreaker-nearby'] });
      if (payload.status === 'pending' && !isMatchPromptDismissed(payload.matchId)) {
        router.push(`/match/${payload.matchId}`);
      }
    });

    nextSocket.on('icebreaker.interest', (payload: { fromUserId: string; displayName: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['icebreaker-nearby'] });
      void queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
      showToast(`${payload.displayName} said yes in Break the ice`, 'info');
    });

    setSocket(nextSocket);
  }, [disconnect, queryClient, router]);

  useEffect(() => {
    if (!user) {
      disconnect();
      return;
    }

    void connect();

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        void connect();
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

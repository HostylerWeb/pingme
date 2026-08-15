import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppSocket } from '../lib/app-socket';

type SocketAwareIntervalMode = 'stop' | 'slow';

type UseSocketAwareRefetchIntervalOptions = {
  /** Poll interval when socket is disconnected and app is active */
  foreground: number;
  /** Poll interval when socket is connected (only used when mode is 'slow') */
  connected?: number;
  /** When true, polling stops while app is backgrounded/inactive */
  pauseInBackground?: boolean;
  /** stop = no poll when connected; slow = use `connected` interval when connected */
  mode?: SocketAwareIntervalMode;
  /** When true, socket connectivity does not affect the interval (background pause only) */
  ignoreSocket?: boolean;
};

function isAppActive(state: AppStateStatus) {
  return state === 'active';
}

/**
 * Returns a React Query `refetchInterval` value that respects WebSocket
 * connectivity and app foreground state.
 */
export function useSocketAwareRefetchInterval({
  foreground,
  connected: connectedInterval = foreground,
  pauseInBackground = true,
  mode = 'stop',
  ignoreSocket = false,
}: UseSocketAwareRefetchIntervalOptions): number | false {
  const { connected } = useAppSocket();
  const [appActive, setAppActive] = useState(() => isAppActive(AppState.currentState));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppActive(isAppActive(nextState));
    });
    return () => subscription.remove();
  }, []);

  if (pauseInBackground && !appActive) {
    return false;
  }

  if (!ignoreSocket && connected) {
    return mode === 'stop' ? false : connectedInterval;
  }

  return foreground;
}

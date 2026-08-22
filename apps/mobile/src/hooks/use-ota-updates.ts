import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export type OtaUpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'downloading' }
  | { status: 'ready'; onRestart: () => Promise<void> }
  | { status: 'error'; message: string };

function shouldCheckForUpdates(): boolean {
  if (__DEV__) return false;
  if (!Updates.isEnabled) return false;
  return true;
}

export function useOtaUpdates(): OtaUpdateState {
  const [state, setState] = useState<OtaUpdateState>({ status: 'idle' });
  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    if (!shouldCheckForUpdates() || checkingRef.current) return;
    checkingRef.current = true;
    setState({ status: 'checking' });

    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setState({ status: 'idle' });
        return;
      }

      setState({ status: 'downloading' });
      await Updates.fetchUpdateAsync();
      setState({
        status: 'ready',
        onRestart: async () => {
          await Updates.reloadAsync();
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update check failed';
      setState({ status: 'error', message });
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') {
        void check();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [check]);

  return state;
}

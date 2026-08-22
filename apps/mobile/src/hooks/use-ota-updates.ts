import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export type OtaUpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'downloading' }
  | { status: 'ready'; updateId?: string; onRestart: () => Promise<void> }
  | { status: 'error'; message: string };

const FOREGROUND_CHECK_INTERVAL_MS = 5 * 60 * 1000;

function shouldCheckForUpdates(): boolean {
  if (__DEV__) return false;
  if (!Updates.isEnabled) return false;
  return true;
}

export function useOtaUpdates(): OtaUpdateState {
  const {
    isUpdateAvailable,
    isUpdatePending,
    isChecking,
    isDownloading,
    checkError,
    downloadError,
    downloadedUpdate,
  } = Updates.useUpdates();

  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    if (!shouldCheckForUpdates() || checkingRef.current) return;
    checkingRef.current = true;
    try {
      await Updates.checkForUpdateAsync();
    } catch {
      // useUpdates surfaces errors via checkError
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

  useEffect(() => {
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        void check();
      }
    }, FOREGROUND_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [check]);

  useEffect(() => {
    if (!shouldCheckForUpdates()) return;
    if (isUpdateAvailable && !isUpdatePending && !isDownloading) {
      void Updates.fetchUpdateAsync();
    }
  }, [isUpdateAvailable, isUpdatePending, isDownloading]);

  if (!shouldCheckForUpdates()) {
    return { status: 'idle' };
  }

  const error = downloadError ?? checkError;
  if (error) {
    return { status: 'error', message: error.message };
  }

  if (isUpdatePending) {
    const updateId =
      downloadedUpdate?.type === 'new' ? downloadedUpdate.updateId : undefined;
    return {
      status: 'ready',
      updateId,
      onRestart: async () => {
        await Updates.reloadAsync();
      },
    };
  }

  if (isDownloading) {
    return { status: 'downloading' };
  }

  if (isChecking) {
    return { status: 'checking' };
  }

  return { status: 'idle' };
}

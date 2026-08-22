import { FOREGROUND_PING_INTERVAL_MS } from '@pingme/shared';
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { api } from '../lib/api';
import {
  startBackgroundLocation,
  stopBackgroundLocation,
  hasBackgroundLocationPermission,
} from '../lib/background-location';
import { throttledLocationPing } from '../lib/throttled-location-ping';
import { useAuthStore } from '../stores/auth-store';

async function pingCurrentLocation() {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return;

  try {
    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
    const position =
      lastKnown ??
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
        ...(Platform.OS === 'android' ? { mayUseNetworkProviders: true } : {}),
      }));

    await throttledLocationPing({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? undefined,
    });
  } catch {
    // Best-effort — location tabs may refresh with fresher GPS.
  }
}

/**
 * Marks the user available while logged in. Stays online in background until logout
 * or the OS kills the app (server TTL clears stale presence after pings stop).
 */
export function useAutoPresence(enabled: boolean) {
  const queryClient = useQueryClient();
  const livenessVerified = useAuthStore((s) => s.user?.livenessVerified);
  const goingOnlineRef = useRef(false);
  const wasEnabledRef = useRef(false);

  const goOnline = useCallback(async () => {
    if (!enabled || goingOnlineRef.current) return;

    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;

    goingOnlineRef.current = true;
    try {
      await api.setAvailable(true);
      await pingCurrentLocation();
      if (await hasBackgroundLocationPermission()) {
        await startBackgroundLocation();
      }
      void queryClient.invalidateQueries({ queryKey: ['presence-status'] });
      void queryClient.invalidateQueries({ queryKey: ['nearby-users'] });
    } catch {
      // Liveness gate or transient errors — retry on next foreground.
    } finally {
      goingOnlineRef.current = false;
    }
  }, [enabled, queryClient]);

  const goOffline = useCallback(async () => {
    try {
      await api.setAvailable(false);
    } catch {
      // Session may already be cleared.
    }
    try {
      await stopBackgroundLocation();
    } catch {
      // ignore
    }
    void queryClient.invalidateQueries({ queryKey: ['presence-status'] });
    void queryClient.invalidateQueries({ queryKey: ['nearby-users'] });
  }, [queryClient]);

  useEffect(() => {
    if (!enabled) {
      if (wasEnabledRef.current) {
        void goOffline();
      }
      wasEnabledRef.current = false;
      return;
    }

    wasEnabledRef.current = true;
    void goOnline();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void goOnline();
      }
    });

    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        void goOnline();
      }
    }, FOREGROUND_PING_INTERVAL_MS);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [enabled, livenessVerified, goOnline, goOffline]);
}

export async function goOfflinePresence() {
  try {
    await api.setAvailable(false);
  } catch {
    // ignore
  }
  try {
    await stopBackgroundLocation();
  } catch {
    // ignore
  }
}

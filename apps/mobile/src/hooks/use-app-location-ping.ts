import { FOREGROUND_PING_INTERVAL_MS } from '@pingme/shared';
import * as Location from 'expo-location';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { throttledLocationPing } from '../lib/throttled-location-ping';

/**
 * Keeps presence fresh on any tab while the app is open (not only Wall / Break the ice).
 */
export function useAppLocationPing(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const ping = async () => {
      if (cancelled || AppState.currentState !== 'active') {
        return;
      }

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      try {
        const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
        const position =
          lastKnown ??
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
            ...(Platform.OS === 'android' ? { mayUseNetworkProviders: true } : {}),
          }));

        if (!cancelled) {
          await throttledLocationPing({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy ?? undefined,
          });
        }
      } catch {
        // Best-effort — Wall/Icebreaker tabs may retry with fresher GPS.
      }
    };

    void ping();
    interval = setInterval(() => {
      void ping();
    }, FOREGROUND_PING_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void ping();
      }
    });

    return () => {
      cancelled = true;
      if (interval) {
        clearInterval(interval);
      }
      subscription.remove();
    };
  }, [enabled]);
}

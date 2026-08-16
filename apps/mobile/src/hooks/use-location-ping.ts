import { FOREGROUND_PING_INTERVAL_MS } from '@pingme/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { throttledLocationPing } from '../lib/throttled-location-ping';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

const COORDS_MAX_AGE_MS = 90_000;
const GPS_TIMEOUT_MS = 6_000;

function toCoordinates(position: Location.LocationObject): Coordinates {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? undefined,
  };
}

async function resolveCoordinates(options: {
  cached?: Coordinates | null;
  cachedAt?: number | null;
  preferCached?: boolean;
}): Promise<Coordinates> {
  const { cached, cachedAt, preferCached } = options;
  const cacheIsFresh =
    !!cached &&
    !!cachedAt &&
    Date.now() - cachedAt < COORDS_MAX_AGE_MS;

  if (preferCached && cacheIsFresh && cached) {
    return cached;
  }

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: COORDS_MAX_AGE_MS,
  });

  if (preferCached && lastKnown) {
    return toCoordinates(lastKnown);
  }

  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
        ...(Platform.OS === 'android' ? { mayUseNetworkProviders: true } : {}),
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Location timed out')), GPS_TIMEOUT_MS);
      }),
    ]);

    return toCoordinates(position);
  } catch {
    if (lastKnown) {
      return toCoordinates(lastKnown);
    }
    if (cached) {
      return cached;
    }
    throw new Error('Failed to get location');
  }
}

export function useLocationPing(enabled = true) {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coordsRef = useRef<Coordinates | null>(null);
  const lastPingAtRef = useRef<number | null>(null);

  const requestPermission = useCallback(async () => {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.status === 'granted') {
      setPermissionGranted(true);
      setError(null);
      return true;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setPermissionGranted(granted);
    if (!granted) {
      setError('Location permission is required to use PingMe nearby features.');
    }
    return granted;
  }, []);

  const ping = useCallback(async (options?: { preferCached?: boolean }) => {
    try {
      const next = await resolveCoordinates({
        cached: coordsRef.current,
        cachedAt: lastPingAtRef.current,
        preferCached: options?.preferCached ?? false,
      });
      coordsRef.current = next;
      lastPingAtRef.current = Date.now();
      setCoords(next);
      await throttledLocationPing(next);
      setError(null);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get location');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      const granted = status === 'granted';
      if (!mounted) return;

      setPermissionGranted(granted);
      if (!granted) {
        setError('Location permission is required to use PingMe nearby features.');
        return;
      }

      await ping({ preferCached: true });
      intervalRef.current = setInterval(() => {
        void ping({ preferCached: true });
      }, FOREGROUND_PING_INTERVAL_MS);
    })();

    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, ping]);

  return { coords, permissionGranted, error, requestPermission, ping };
}

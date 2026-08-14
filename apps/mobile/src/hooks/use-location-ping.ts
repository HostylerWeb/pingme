import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { api } from '../lib/api';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export function useLocationPing(enabled = true) {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const ping = useCallback(async () => {
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? undefined,
      };
      setCoords(next);
      await api.pingLocation(next);
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

      await ping();
      intervalRef.current = setInterval(ping, 60_000);
    })();

    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, ping]);

  return { coords, permissionGranted, error, requestPermission, ping };
}

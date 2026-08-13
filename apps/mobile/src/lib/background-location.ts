import { BACKGROUND_PING_INTERVAL_MS } from '@pingme/shared';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getAccessToken } from './auth-storage';

export const BACKGROUND_LOCATION_TASK = 'pingme-background-location';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;

  const locations = (data as { locations?: Location.LocationObject[] })?.locations;
  const location = locations?.[0];
  if (!location) return;

  const token = await getAccessToken();
  if (!token) return;

  try {
    await fetch(`${API_URL}/presence/ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? undefined,
      }),
    });
  } catch {
    // Background task should not throw
  }
});

export async function requestBackgroundPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return false;

  const background = await Location.requestBackgroundPermissionsAsync();
  return background.granted;
}

export async function startBackgroundLocation() {
  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (started) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: BACKGROUND_PING_INTERVAL_MS,
    distanceInterval: 50,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'PingMe',
      notificationBody: "You're available nearby",
      notificationColor: '#2563eb',
    },
  });
}

export async function stopBackgroundLocation() {
  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}

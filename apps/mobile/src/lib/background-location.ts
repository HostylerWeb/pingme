import { BACKGROUND_PING_INTERVAL_MS } from '@pingme/shared';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { ensureValidAccessToken } from './api';
import { getApiUrl } from './api-url';

export const BACKGROUND_LOCATION_TASK = 'pingme-background-location';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;

  const locations = (data as { locations?: Location.LocationObject[] })?.locations;
  const location = locations?.[0];
  if (!location) return;

  const hasValidToken = await ensureValidAccessToken();
  if (!hasValidToken) return;

  const { getAccessToken } = await import('./auth-storage');
  const token = await getAccessToken();
  if (!token) return;

  try {
    await fetch(`${getApiUrl()}/presence/ping`, {
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

export async function hasBackgroundLocationPermission() {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return false;
  }

  const background = await Location.getBackgroundPermissionsAsync();
  return background.status === 'granted';
}

/** Only prompts when background permission has never been decided. */
export async function requestBackgroundPermissions() {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return false;
  }

  const existing = await Location.getBackgroundPermissionsAsync();
  if (existing.status === 'granted') {
    return true;
  }
  if (existing.status === 'denied') {
    return false;
  }

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
      notificationBody: "You're online nearby",
      notificationColor: '#E05A42',
    },
  });
}

export async function stopBackgroundLocation() {
  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}

export async function isBackgroundLocationRunning() {
  return Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}

/** Keep the Android foreground notification in sync with server availability. */
export async function syncBackgroundLocationWithAvailability(isAvailable: boolean) {
  const started = await isBackgroundLocationRunning();

  if (!isAvailable) {
    if (started) await stopBackgroundLocation();
    return;
  }

  if (!started) {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status !== 'granted') return;

    const background = await Location.getBackgroundPermissionsAsync();
    if (background.status === 'granted') {
      await startBackgroundLocation();
    }
  }
}

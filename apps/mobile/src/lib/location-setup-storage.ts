import * as Location from 'expo-location';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'pingme-location' });

const LOCATION_SETUP_KEY = 'location_setup_complete';

export const locationSetupStorage = {
  isComplete(): boolean {
    return storage.getBoolean(LOCATION_SETUP_KEY) ?? false;
  },
  markComplete(): void {
    storage.set(LOCATION_SETUP_KEY, true);
  },
};

export async function hasForegroundLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
}

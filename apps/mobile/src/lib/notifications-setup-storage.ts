import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'pingme-notifications' });

const NOTIFICATIONS_SETUP_KEY = 'notifications_setup_complete';

export const notificationsSetupStorage = {
  isComplete(): boolean {
    return storage.getBoolean(NOTIFICATIONS_SETUP_KEY) ?? false;
  },
  markComplete(): void {
    storage.set(NOTIFICATIONS_SETUP_KEY, true);
  },
};

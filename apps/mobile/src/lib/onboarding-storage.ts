import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'pingme-onboarding' });

const ONBOARDING_KEY = 'onboarding_complete';

export const onboardingStorage = {
  isComplete(): boolean {
    return storage.getBoolean(ONBOARDING_KEY) ?? false;
  },
  markComplete(): void {
    storage.set(ONBOARDING_KEY, true);
  },
  reset(): void {
    storage.delete(ONBOARDING_KEY);
  },
};

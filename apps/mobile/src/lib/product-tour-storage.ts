import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'pingme-onboarding' });

const PRODUCT_TOUR_KEY = 'product_tour_complete';

export const productTourStorage = {
  isComplete(): boolean {
    return storage.getBoolean(PRODUCT_TOUR_KEY) ?? false;
  },
  markComplete(): void {
    storage.set(PRODUCT_TOUR_KEY, true);
  },
  reset(): void {
    storage.delete(PRODUCT_TOUR_KEY);
  },
};

import { MMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const storage = new MMKV({ id: 'pingme-app' });

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

interface AppState {
  isAvailable: boolean;
  setAvailable: (value: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isAvailable: false,
      setAvailable: (value) => set({ isAvailable: value }),
    }),
    {
      name: 'pingme-app-store',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

import { MMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const storage = new MMKV({ id: 'pingme-theme' });

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

interface ThemeState {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  toggleDarkMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      darkMode: false,
      setDarkMode: (value) => set({ darkMode: value }),
      toggleDarkMode: () => set({ darkMode: !get().darkMode }),
    }),
    {
      name: 'pingme-theme-store',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

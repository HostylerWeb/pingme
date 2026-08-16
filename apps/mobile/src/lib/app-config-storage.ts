import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'pingme-app-config' });
const KEY = 'app-config-cache';

export function readCachedAppConfig<T>(): T | null {
  const raw = storage.getString(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeCachedAppConfig(value: unknown) {
  storage.set(KEY, JSON.stringify(value));
}

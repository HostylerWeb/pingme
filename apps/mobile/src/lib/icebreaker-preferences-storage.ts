import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'pingme-icebreaker' });
const SHOW_PHOTO_KEY = 'show_photo';

export function getIcebreakerShowPhotoPreference(): boolean {
  return storage.getBoolean(SHOW_PHOTO_KEY) ?? true;
}

export function setIcebreakerShowPhotoPreference(showPhoto: boolean) {
  storage.set(SHOW_PHOTO_KEY, showPhoto);
}

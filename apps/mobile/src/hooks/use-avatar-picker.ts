import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { uploadAvatarFromUri } from '../lib/avatar-upload';
import { showToast } from '../stores/toast-store';

export function useAvatarPicker(onUploaded?: () => void | Promise<void>) {
  const [uploading, setUploading] = useState(false);
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);

  const pickFromSource = useCallback(
    async (source: 'library' | 'camera') => {
      const permission =
        source === 'library'
          ? await ImagePicker.requestMediaLibraryPermissionsAsync()
          : await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        showToast(
          source === 'library' ? 'Allow photo library access to choose a photo' : 'Allow camera access to take a photo',
          'error',
        );
        return;
      }

      const launcher =
        source === 'library' ? ImagePicker.launchImageLibraryAsync : ImagePicker.launchCameraAsync;

      const result = await launcher({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.65,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      setUploading(true);
      try {
        await uploadAvatarFromUri(result.assets[0].uri);
        await onUploaded?.();
        showToast('Profile photo updated', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not upload photo', 'error');
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  return {
    uploading,
    sourceSheetOpen,
    setSourceSheetOpen,
    pickFromSource,
  };
}

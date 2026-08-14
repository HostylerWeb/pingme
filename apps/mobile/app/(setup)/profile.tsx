import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, ApiError } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth-store';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [displayName, setDisplayName] = useState(user?.profile?.displayName ?? '');
  const [bio, setBio] = useState(user?.profile?.bio ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to choose an avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarUri) return;

    setUploading(true);
    try {
      const fileName = avatarUri.split('/').pop() ?? 'avatar.jpg';
      const presign = await api.presignAvatar({
        fileName,
        contentType: 'image/jpeg',
      });
      const uploadUrl = presign.data.uploadUrl;
      if (!uploadUrl) {
        return;
      }
      const response = await fetch(avatarUri);
      const blob = await response.blob();

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error('Avatar upload failed');
      }

      await api.confirmAvatar({ key: presign.data.key });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not upload avatar';
      Alert.alert('Avatar upload failed', message);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    try {
      if (avatarUri) {
        await uploadAvatar();
      }
      await api.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
      });
      await refreshMe();
      router.replace('/(tabs)/home');
    } catch (error) {
      if (error instanceof ApiError) {
        Alert.alert('Error', error.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your profile</Text>

      <Pressable style={styles.avatarButton} onPress={pickAvatar}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarPlaceholder}>Add photo</Text>
        )}
      </Pressable>

      <TextInput
        style={styles.input}
        placeholder="Display name"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={[styles.input, styles.bio]}
        placeholder="Bio (optional)"
        multiline
        value={bio}
        onChangeText={setBio}
      />
      <Pressable style={styles.button} onPress={save} disabled={uploading}>
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  avatarButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  avatarImage: { width: 96, height: 96 },
  avatarPlaceholder: { color: '#475569', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  bio: { minHeight: 100, textAlignVertical: 'top' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

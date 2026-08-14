import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth-store';
import { Button, Input, Screen } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

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
      router.replace('/(setup)/location');
    } catch (error) {
      if (error instanceof ApiError) {
        Alert.alert('Error', error.message);
      }
    }
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <LinearGradient colors={[colors.background, colors.surfaceContainerLow]} style={styles.gradient}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Your profile</Text>
            <Text style={styles.subtitle}>Help people nearby recognize you. Photo is optional.</Text>

            <Pressable style={styles.avatarButton} onPress={pickAvatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={28} color={colors.primary} />
                  <Text style={styles.avatarPlaceholder}>Add photo</Text>
                </>
              )}
            </Pressable>

            <View style={styles.card}>
              <Input label="Display name" placeholder="Jane Doe" value={displayName} onChangeText={setDisplayName} />
              <Input
                label="Bio"
                placeholder="A short intro (optional)"
                multiline
                value={bio}
                onChangeText={setBio}
                containerStyle={styles.bioInput}
              />
              <Button label="Continue" onPress={save} loading={uploading} disabled={!displayName.trim()} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: { flex: 1 },
  scroll: { padding: spacing.container, paddingTop: spacing.section },
  title: { ...typography.display, color: colors.onSurface, marginBottom: spacing.sm },
  subtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginBottom: spacing.xxl, lineHeight: 24 },
  avatarButton: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xxl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primaryFixedDim,
  },
  avatarImage: { width: 112, height: 112 },
  avatarPlaceholder: { ...typography.labelSm, color: colors.primary, marginTop: 4, textTransform: 'none', letterSpacing: 0 },
  card: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  bioInput: { marginBottom: spacing.lg },
});

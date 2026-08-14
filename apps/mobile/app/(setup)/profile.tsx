import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { genderLabel, type GenderValue } from '@pingme/shared';
import { api, ApiError } from '../../src/lib/api';
import { uploadAvatarFromUri } from '../../src/lib/avatar-upload';
import { useAuthStore } from '../../src/stores/auth-store';
import { showToast } from '../../src/stores/toast-store';
import { Button, Card, GenderPicker, GenderReadOnly, Input, Screen } from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const { colors } = useTheme();
  const [displayName, setDisplayName] = useState(user?.profile?.displayName ?? '');
  const [bio, setBio] = useState(user?.profile?.bio ?? '');
  const profileGender = user?.profile?.gender ?? null;
  const [gender, setGender] = useState<GenderValue | null>(profileGender);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const styles = useThemedStyles(({ colors }) => ({
    flex: { flex: 1 },
    scroll: { padding: spacing.container, paddingTop: spacing.section },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xl },
    logoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
    brand: { ...typography.overline, color: colors.inkTertiary, fontSize: 10 },
    title: { ...typography.display, color: colors.ink, marginBottom: spacing.sm },
    subtitle: { ...typography.bodyMd, color: colors.inkSecondary, marginBottom: spacing.xxl, lineHeight: 22 },
    avatarButton: {
      width: 112,
      height: 112,
      borderRadius: 56,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: spacing.xxl,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.accentMuted,
    },
    avatarImage: { width: 112, height: 112 },
    avatarPlaceholder: { ...typography.caption, color: colors.accent, marginTop: 4 },
    bioInput: { marginBottom: spacing.lg },
  }));

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Allow photo library access to choose an avatar', 'error');
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
    await uploadAvatarFromUri(avatarUri);
  };

  const save = async () => {
    setUploading(true);
    try {
      if (avatarUri) await uploadAvatar();
      await api.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        ...(!profileGender && gender ? { gender } : {}),
      });
      await refreshMe();
      router.replace('/(setup)/location');
    } catch (error) {
      if (error instanceof ApiError) showToast(error.message, 'error');
      else if (error instanceof Error) showToast(error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.logoDot} />
            <Text style={styles.brand}>PingMe</Text>
          </View>
          <Text style={styles.title}>Your profile</Text>
          <Text style={styles.subtitle}>Help people nearby recognize you. Photo is optional.</Text>

          <Pressable style={styles.avatarButton} onPress={pickAvatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={28} color={colors.accent} />
                <Text style={styles.avatarPlaceholder}>Add photo</Text>
              </>
            )}
          </Pressable>

          <Card variant="flat">
            <Input label="Display name" placeholder="Jane Doe" value={displayName} onChangeText={setDisplayName} />
            {profileGender ? (
              <GenderReadOnly label="Gender" value={genderLabel(profileGender)} />
            ) : (
              <>
                <GenderPicker value={gender} onChange={setGender} />
                <Text style={{ ...typography.caption, color: colors.inkTertiary, marginTop: -spacing.md, marginBottom: spacing.lg }}>
                  Gender cannot be changed after you continue.
                </Text>
              </>
            )}
            <Input
              label="Bio"
              placeholder="A short intro (optional)"
              multiline
              value={bio}
              onChangeText={setBio}
              containerStyle={styles.bioInput}
            />
            <Button
              label="Continue"
              onPress={save}
              loading={uploading}
              disabled={!displayName.trim() || (!profileGender && !gender)}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

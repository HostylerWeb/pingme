import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAuthStore } from '../stores/auth-store';
import { AppIcon } from './ui/app-icon';
import { radius, spacing, typography, useThemedStyles } from '../theme';

export function DeletionScheduledBanner() {
  const router = useRouter();
  const deletionScheduledAt = useAuthStore((s) => s.user?.deletionScheduledAt);

  const styles = useThemedStyles(({ colors }) => ({
    wrap: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.accentMuted,
      padding: spacing.md,
      marginBottom: spacing.lg,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    copy: { flex: 1 },
    title: { ...typography.bodySemiBold, color: colors.ink, marginBottom: 2 },
    body: { ...typography.caption, color: colors.inkSecondary, lineHeight: 18 },
    action: { ...typography.caption, color: colors.accent, marginTop: spacing.xs, fontWeight: '600' },
  }));

  if (!deletionScheduledAt) {
    return null;
  }

  const when = new Date(deletionScheduledAt).toLocaleString();

  return (
    <Pressable
      onPress={() => router.push('/delete-account')}
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
    >
      <AppIcon name="alert-circle" size={20} color={styles.title.color} />
      <View style={styles.copy}>
        <Text style={styles.title}>Account scheduled for deletion</Text>
        <Text style={styles.body}>Permanent deletion on {when}. Tap to review or cancel.</Text>
        <Text style={styles.action}>Manage deletion</Text>
      </View>
    </Pressable>
  );
}

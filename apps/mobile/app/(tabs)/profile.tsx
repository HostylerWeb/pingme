import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth-store';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
import { AvatarWithTheme } from '../../src/components/avatar-with-theme';
import { AppHeader, Button, Card, Screen } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { contentBottom } = useTabBarInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isPremium = user?.subscription?.isPremium ?? false;
  const avatarTheme =
    (user?.profile as { avatarConfig?: { theme?: string } } | null | undefined)?.avatarConfig?.theme ??
    null;
  const avatarUrl =
    (user?.profile as { avatarUrl?: string | null } | null | undefined)?.avatarUrl ?? null;
  const displayName = user?.profile?.displayName ?? 'User';
  const bio = user?.profile?.bio;

  const onLogout = async () => {
    await logout();
    Alert.alert('Logged out');
  };

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader title="Profile" showBrand={false} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]}>
        <View style={styles.hero}>
          <AvatarWithTheme
            avatarUrl={avatarUrl}
            themeId={avatarTheme}
            displayName={displayName}
            size={112}
            showPremiumBadge={isPremium}
          />
          <Text style={styles.name}>{displayName}</Text>
          {bio ? <Text style={styles.bio}>{bio}</Text> : null}

          <View style={styles.badges}>
            {user?.emailVerified ? (
              <View style={styles.badge}>
                <Ionicons name="mail" size={14} color={colors.primary} />
                <Text style={styles.badgeText}>Email verified</Text>
              </View>
            ) : null}
            {user?.livenessVerified ? (
              <View style={[styles.badge, styles.badgeVerified]}>
                <Ionicons name="shield-checkmark" size={14} color={colors.onSecondaryContainer} />
                <Text style={[styles.badgeText, styles.badgeTextVerified]}>Verified member</Text>
              </View>
            ) : null}
          </View>
        </View>

        {!isPremium ? (
          <Button
            label="Explore Premium"
            variant="premium"
            onPress={() => router.push('/premium')}
            style={styles.cta}
          />
        ) : null}

        {!user?.livenessVerified ? (
          <Button
            label="Complete liveness check"
            onPress={() => router.push('/(setup)/liveness')}
            style={styles.cta}
          />
        ) : null}

        <Card style={styles.infoCard}>
          <InfoRow label="Email" value={user?.email ?? '—'} />
          <InfoRow label="Phone" value={user?.phone ?? '—'} isLast />
        </Card>

        <Pressable style={styles.logout} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.container },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  name: { ...typography.headlineLg, color: colors.onSurface, marginTop: spacing.lg },
  bio: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    lineHeight: 24,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeVerified: { backgroundColor: colors.secondaryContainer },
  badgeText: { ...typography.labelSm, color: colors.primary, textTransform: 'none', letterSpacing: 0 },
  badgeTextVerified: { color: colors.onSecondaryContainer },
  cta: { marginBottom: spacing.md },
  infoCard: { paddingVertical: spacing.sm, marginTop: spacing.md },
  infoRow: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  infoLabel: { ...typography.labelSm, color: colors.outline, textTransform: 'uppercase', marginBottom: 4 },
  infoValue: { ...typography.bodyMd, color: colors.onSurface },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    padding: spacing.lg,
  },
  logoutText: { ...typography.bodySemiBold, color: colors.error, fontSize: 16 },
});

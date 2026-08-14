import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth-store';
import { AvatarWithTheme } from '../../src/components/avatar-with-theme';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isPremium = user?.subscription?.isPremium ?? false;
  const avatarTheme =
    (user?.profile as { avatarConfig?: { theme?: string } } | null | undefined)?.avatarConfig?.theme ??
    null;
  const avatarUrl =
    (user?.profile as { avatarUrl?: string | null } | null | undefined)?.avatarUrl ?? null;

  const onLogout = async () => {
    await logout();
    Alert.alert('Logged out');
  };

  return (
    <View style={styles.container}>
      <AvatarWithTheme
        avatarUrl={avatarUrl}
        themeId={avatarTheme}
        displayName={user?.profile?.displayName}
        size={96}
        showPremiumBadge={isPremium}
      />

      <Text style={styles.title}>Profile</Text>
      <Text style={styles.name}>{user?.profile?.displayName ?? 'User'}</Text>
      <Text style={styles.meta}>{user?.email}</Text>
      <Text style={styles.meta}>
        Email verified: {user?.emailVerified ? 'Yes' : 'No'}
      </Text>
      <Text style={styles.meta}>
        Liveness verified: {user?.livenessVerified ? 'Yes' : 'No'}
      </Text>

      {!isPremium ? (
        <Pressable style={styles.premiumButton} onPress={() => router.push('/premium')}>
          <Text style={styles.premiumButtonText}>Explore Premium</Text>
        </Pressable>
      ) : null}

      {!user?.livenessVerified ? (
        <Pressable style={styles.verifyButton} onPress={() => router.push('/(setup)/liveness')}>
          <Text style={styles.verifyButtonText}>Complete liveness check</Text>
        </Pressable>
      ) : (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Verified member</Text>
        </View>
      )}
      <Pressable style={styles.button} onPress={onLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  name: { fontSize: 18, fontWeight: '500', marginBottom: 4 },
  meta: { fontSize: 14, color: '#666', marginBottom: 4 },
  premiumButton: {
    marginTop: 16,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  premiumButtonText: { color: '#92400e', fontWeight: '600' },
  verifyButton: {
    marginTop: 16,
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  verifyButtonText: { color: '#fff', fontWeight: '600' },
  badge: {
    marginTop: 16,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeText: { color: '#166534', fontWeight: '600', fontSize: 13 },
  button: {
    marginTop: 24,
    backgroundColor: '#ef4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});

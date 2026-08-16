import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button, Screen } from '../src/components/ui';
import { useAuthStore } from '../src/stores/auth-store';
import { buildInviteWebUrl, getInviteWebBaseUrl } from '../src/lib/invite';
import { spacing, typography, useTheme, useThemedStyles } from '../src/theme';

export default function InviteScreen() {
  const router = useRouter();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const { colors } = useTheme();

  const styles = useThemedStyles(({ colors }) => ({
    wrap: {
      flex: 1,
      justifyContent: 'center',
      padding: spacing.container,
      gap: spacing.lg,
    },
    title: { ...typography.title, color: colors.ink, textAlign: 'center' },
    body: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    link: { ...typography.caption, color: colors.inkTertiary, textAlign: 'center' },
  }));

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    if (user) {
      router.replace('/(tabs)/home');
    }
  }, [isHydrated, router, user]);

  if (!isHydrated) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={colors.accent} />
      </Screen>
    );
  }

  if (user) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={colors.accent} />
      </Screen>
    );
  }

  const webUrl = typeof ref === 'string' && ref ? buildInviteWebUrl(ref) : getInviteWebBaseUrl();

  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>You&apos;re invited to PingMe</Text>
        <Text style={styles.body}>
          Meet people nearby on the Wall, break the ice in person, and chat when you both say yes.
        </Text>
        <Button
          label="Create account"
          onPress={() =>
            router.replace(
              typeof ref === 'string' && ref
                ? { pathname: '/(auth)/register', params: { ref } }
                : '/(auth)/register',
            )
          }
        />
        <Button
          label="I already have an account"
          variant="secondary"
          onPress={() =>
            router.replace(
              typeof ref === 'string' && ref
                ? { pathname: '/(auth)/login', params: { ref } }
                : '/(auth)/login',
            )
          }
        />
        <Text style={styles.link}>{webUrl}</Text>
      </View>
    </Screen>
  );
}

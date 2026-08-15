import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AppIcon } from '../src/components/ui/app-icon';
import { api } from '../src/lib/api';
import { useAuthStore } from '../src/stores/auth-store';
import { Button, LoadingView, Screen } from '../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../src/theme';

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 15;

function isFailureStatus(status?: string) {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return normalized === 'declined' || normalized === 'failed' || normalized === 'rejected';
}

export default function VerificationCompleteScreen() {
  const router = useRouter();
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const { colors } = useTheme();
  const { status } = useLocalSearchParams<{ status?: string; verificationSessionId?: string }>();
  const [message, setMessage] = useState('Finishing verification...');
  const [error, setError] = useState<string | null>(null);

  const styles = useThemedStyles(({ colors }) => ({
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.container,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: radius.xl,
      backgroundColor: colors.errorContainer,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    error: {
      ...typography.bodyLg,
      color: colors.error,
      textAlign: 'center',
      lineHeight: 26,
      marginBottom: spacing.xl,
      maxWidth: 300,
    },
  }));

  useEffect(() => {
    if (isFailureStatus(status)) {
      setError('Verification was not approved. Please try again.');
      setMessage('');
      return;
    }

    let cancelled = false;

    async function finish() {
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
        if (cancelled) return;

        try {
          const result = await api.getVerificationStatus();
          if (result.data.livenessVerified) {
            await refreshMe();
            router.replace('/(tabs)/home');
            return;
          }
          if (result.data.status === 'failed') {
            setError(result.data.rejectionReason ?? 'Verification failed. Please try again.');
            setMessage('');
            return;
          }
        } catch {
          // keep polling until webhook updates status
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      if (!cancelled) {
        setMessage('Still processing. Check your profile in a moment or try again.');
      }
    }

    void finish();

    return () => {
      cancelled = true;
    };
  }, [refreshMe, router, status]);

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {error ? (
          <>
            <View style={styles.iconWrap}>
              <AppIcon name="close-circle" size={48} color={colors.error} />
            </View>
            <Text style={styles.error}>{error}</Text>
            <Button label="Try again" onPress={() => router.replace('/(setup)/liveness')} />
          </>
        ) : (
          <LoadingView message={message} />
        )}
      </View>
    </Screen>
  );
}

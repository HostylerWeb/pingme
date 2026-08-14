import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../src/lib/api';
import { useAuthStore } from '../src/stores/auth-store';

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
  const { status } = useLocalSearchParams<{ status?: string; verificationSessionId?: string }>();
  const [message, setMessage] = useState('Finishing verification...');
  const [error, setError] = useState<string | null>(null);

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
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.button} onPress={() => router.replace('/(setup)/liveness')}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.message}>{message}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  message: {
    marginTop: 16,
    color: '#475569',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: '#dc2626',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

import { Camera } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../../src/components/ui/app-icon';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth-store';
import { Button } from '../../src/components/ui';
import { spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 15;

function isAllowedDiditNavigation(url: string): boolean {
  if (url.startsWith('pingme://verification-complete')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'didit.me' || host.endsWith('.didit.me');
  } catch {
    return false;
  }
}

async function ensureCameraPermission(): Promise<boolean> {
  const current = await Camera.getCameraPermissionsAsync();
  if (current.granted) return true;
  const requested = await Camera.requestCameraPermissionsAsync();
  return requested.granted;
}

export default function KycScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Starting ID verification...');
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(true);

  const styles = useThemedStyles(({ colors }) => ({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.container, paddingBottom: spacing.md },
    backBtn: { marginBottom: spacing.sm },
    title: { ...typography.headlineLg, color: colors.onSurface, marginBottom: spacing.sm },
    subtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, lineHeight: 22 },
    status: {
      paddingHorizontal: spacing.container,
      paddingBottom: spacing.sm,
      ...typography.bodyMd,
      color: colors.onSurfaceVariant,
    },
    error: {
      paddingHorizontal: spacing.container,
      paddingBottom: spacing.sm,
      ...typography.bodyMd,
      color: colors.error,
    },
    webview: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    actions: { padding: spacing.container, gap: spacing.sm },
  }));

  const startSession = useCallback(async () => {
    setIsStartingSession(true);
    setError(null);
    setStatusMessage('Checking camera permission...');

    const granted = await ensureCameraPermission();
    if (!granted) {
      setError('Camera permission is required for ID verification. Enable it in Settings.');
      setStatusMessage('');
      setCameraReady(false);
      setIsStartingSession(false);
      return;
    }

    setCameraReady(true);
    setStatusMessage('Starting ID verification...');

    try {
      const result = await api.startKycVerification();
      setVerificationUrl(result.data.verificationUrl);
      setStatusMessage('Complete your government ID and liveness check below.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start ID verification';
      setError(message);
      setStatusMessage('');
    } finally {
      setIsStartingSession(false);
    }
  }, []);

  useEffect(() => {
    void startSession();
  }, [startSession]);

  const pollStatus = useCallback(async () => {
    setPolling(true);
    setStatusMessage('Checking verification result...');

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await api.getVerificationStatus();
        if (result.data.idVerified) {
          await refreshMe();
          setStatusMessage('ID verified! You can host events.');
          router.back();
          return;
        }
        const idStatus = result.data.idVerification?.status ?? result.data.status;
        if (idStatus === 'failed') {
          setError(
            result.data.idVerification?.rejectionReason ??
              result.data.rejectionReason ??
              'ID verification failed. Please try again.',
          );
          setStatusMessage('');
          setVerificationUrl(null);
          setPolling(false);
          return;
        }
      } catch {
        // keep polling
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    setPolling(false);
    setStatusMessage('Still processing. Try again in a moment.');
  }, [refreshMe, router]);

  const onWebViewClose = useCallback(() => {
    void pollStatus();
  }, [pollStatus]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} disabled={polling} hitSlop={8} style={styles.backBtn}>
          <AppIcon name="back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Verify your ID</Text>
        <Text style={styles.subtitle}>
          {user?.livenessVerified
            ? 'Government ID check to host events. You already completed liveness.'
            : 'Government ID and liveness check to host events.'}
        </Text>
      </View>

      {statusMessage ? <Text style={styles.status}>{statusMessage}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {polling || isStartingSession ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : null}

      {verificationUrl && !polling && cameraReady ? (
        <WebView
          style={styles.webview}
          source={{ uri: verificationUrl }}
          mediaCapturePermissionGrantType="grant"
          allowsInlineMediaPlayback
          javaScriptEnabled
          domStorageEnabled
          onNavigationStateChange={(event) => {
            if (event.url.startsWith('pingme://verification-complete')) {
              onWebViewClose();
            }
          }}
          onShouldStartLoadWithRequest={(request) => {
            if (request.url.startsWith('pingme://verification-complete')) {
              onWebViewClose();
              return false;
            }
            return isAllowedDiditNavigation(request.url);
          }}
        />
      ) : null}

      {!verificationUrl && !polling && !isStartingSession ? (
        <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Button label="Try again" onPress={() => void startSession()} />
          {error ? (
            <Button label="Open Settings" variant="ghost" onPress={() => void Linking.openSettings()} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

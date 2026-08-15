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

async function ensureCameraPermission(): Promise<boolean> {
  const current = await Camera.getCameraPermissionsAsync();
  if (current.granted) return true;

  const requested = await Camera.requestCameraPermissionsAsync();
  return requested.granted;
}

export default function LivenessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Starting verification...');
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

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
    setError(null);
    setStatusMessage('Checking camera permission...');

    const granted = await ensureCameraPermission();
    if (!granted) {
      setError('Camera permission is required for liveness verification. Enable it in Settings.');
      setStatusMessage('');
      setCameraReady(false);
      return;
    }

    setCameraReady(true);
    setStatusMessage('Starting verification...');

    try {
      const result = await api.startVerification();
      setVerificationUrl(result.data.verificationUrl);
      setStatusMessage('Complete the liveness check in the window below.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start verification';
      setError(message);
      setStatusMessage('');
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
        if (result.data.livenessVerified) {
          await refreshMe();
          setStatusMessage('Verified! Returning to the app...');
          router.back();
          return;
        }
        if (result.data.status === 'failed') {
          setError(result.data.rejectionReason ?? 'Verification failed. Please try again.');
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
    setStatusMessage('Still processing. Pull to refresh or try again in a moment.');
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
        <Text style={styles.title}>Verify it&apos;s you</Text>
        <Text style={styles.subtitle}>
          Quick liveness check before you post, reply, or chat. Browsing the wall stays open.
        </Text>
      </View>

      {statusMessage ? <Text style={styles.status}>{statusMessage}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {polling ? (
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
            return true;
          }}
        />
      ) : null}

      {!verificationUrl && !polling ? (
        <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Button label="Try again" onPress={() => void startSession()} />
          {error ? (
            <>
              <Button label="Open Settings" variant="ghost" onPress={() => void Linking.openSettings()} />
              <Button
                label="Contact support"
                variant="ghost"
                onPress={() =>
                  void Linking.openURL('mailto:support@hostyler.com?subject=PingMe%20verification%20help')
                }
              />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

import { Camera } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth-store';

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
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Starting verification...');
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} disabled={polling}>
          <Text style={styles.back}>← Back</Text>
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
          <ActivityIndicator size="large" color="#2563eb" />
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
        <View style={styles.actions}>
          <Pressable style={styles.button} onPress={() => void startSession()}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
          {error ? (
            <>
              <Pressable style={styles.secondaryButton} onPress={() => void Linking.openSettings()}>
                <Text style={styles.secondaryButtonText}>Open Settings</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => void Linking.openURL('mailto:support@hostyler.com?subject=PingMe%20verification%20help')}
              >
                <Text style={styles.secondaryButtonText}>Contact support</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 8 },
  back: { color: '#2563eb', marginBottom: 8, fontWeight: '500' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  status: { paddingHorizontal: 16, paddingBottom: 8, color: '#475569', fontSize: 13 },
  error: { paddingHorizontal: 16, paddingBottom: 8, color: '#dc2626', fontSize: 13 },
  webview: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { padding: 16, gap: 12 },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#2563eb', fontWeight: '500' },
});

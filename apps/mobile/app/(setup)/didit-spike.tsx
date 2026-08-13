import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

const DIDIT_DEMO_URL = 'https://verify.didit.me/';

export default function DiditSpikeScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('Load the hosted Didit session in this WebView (Phase 0 spike).');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Didit WebView spike</Text>
      </View>
      <Text style={styles.status}>{status}</Text>
      <WebView
        style={styles.webview}
        source={{ uri: DIDIT_DEMO_URL }}
        onLoadEnd={() => setStatus('WebView loaded — confirm session flow before Phase 6 liveness.')}
        onError={() => setStatus('WebView failed to load. Check network or replace DIDIT_DEMO_URL.')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 8 },
  back: { color: '#2563eb', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  status: { paddingHorizontal: 16, paddingBottom: 8, color: '#64748b', fontSize: 13 },
  webview: { flex: 1 },
});

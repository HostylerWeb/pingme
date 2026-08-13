import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { locationSetupStorage } from '../../src/lib/location-setup-storage';

export default function LocationSetupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onEnable = async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is required to see nearby posts and people.');
        return;
      }
      locationSetupStorage.markComplete();
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request location permission');
    } finally {
      setLoading(false);
    }
  };

  const onSkip = () => {
    locationSetupStorage.markComplete();
    router.replace('/(tabs)/home');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📍</Text>
      <Text style={styles.title}>Enable location</Text>
      <Text style={styles.body}>
        PingMe uses your location to show posts and people within about 250 meters. We never share your
        exact coordinates — only fuzzy distance buckets.
      </Text>
      <Text style={styles.note}>
        Background location is only requested later when you turn Available ON.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={onEnable} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Allow location</Text>
        )}
      </Pressable>
      <Pressable onPress={onSkip}>
        <Text style={styles.skip}>Continue without location</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: '#475569', marginBottom: 12 },
  note: { fontSize: 14, lineHeight: 20, color: '#64748b', marginBottom: 24 },
  error: { color: '#b91c1c', marginBottom: 12 },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  skip: { textAlign: 'center', marginTop: 16, color: '#64748b' },
});

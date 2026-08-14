import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { locationSetupStorage } from '../../src/lib/location-setup-storage';
import { Button, Card, Screen } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';

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
    <Screen padded={false} edges={['top', 'bottom']}>
      <LinearGradient colors={[colors.background, colors.surfaceContainerLow]} style={styles.gradient}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="location" size={40} color={colors.primary} />
          </View>

          <Text style={styles.title}>Enable location</Text>
          <Text style={styles.body}>
            PingMe uses your location to show posts and people within about 250 meters. We never share
            your exact coordinates — only fuzzy distance buckets.
          </Text>

          <Card style={styles.noteCard}>
            <Ionicons name="information-circle-outline" size={18} color={colors.onSurfaceVariant} />
            <Text style={styles.note}>
              Background location is only requested later when you turn Available ON.
            </Text>
          </Card>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Allow location" onPress={onEnable} loading={loading} style={styles.cta} />
          <Button label="Continue without location" variant="ghost" onPress={onSkip} />
        </View>
      </LinearGradient>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.container,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xxl,
  },
  title: { ...typography.display, color: colors.onSurface, textAlign: 'center', marginBottom: spacing.lg },
  body: {
    ...typography.bodyLg,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: spacing.xl,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    backgroundColor: colors.surfaceContainerLow,
  },
  note: { ...typography.bodyMd, color: colors.onSurfaceVariant, flex: 1, lineHeight: 22 },
  error: { ...typography.bodyMd, color: colors.error, textAlign: 'center', marginBottom: spacing.lg },
  cta: { marginBottom: spacing.md },
});

import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { locationSetupStorage } from '../../src/lib/location-setup-storage';
import { Button, Card, Screen } from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

export default function LocationSetupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useThemedStyles(({ colors }) => ({
    content: { flex: 1, justifyContent: 'center', padding: spacing.container },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: radius.xl,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: spacing.xxl,
    },
    title: { ...typography.display, color: colors.ink, textAlign: 'center', marginBottom: spacing.lg },
    body: {
      ...typography.bodyLg,
      color: colors.inkSecondary,
      textAlign: 'center',
      lineHeight: 26,
      marginBottom: spacing.xl,
    },
    noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.xl },
    note: { ...typography.bodyMd, color: colors.inkSecondary, flex: 1, lineHeight: 22 },
    error: { ...typography.bodyMd, color: colors.error, textAlign: 'center', marginBottom: spacing.lg },
    cta: { marginBottom: spacing.md },
  }));

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
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="location" size={36} color={colors.accent} />
        </View>

        <Text style={styles.title}>Enable location</Text>
        <Text style={styles.body}>
          PingMe uses your location to show posts and people within about 250 meters. We never share your
          exact coordinates — only fuzzy distance buckets.
        </Text>

        <Card variant="muted" style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.inkSecondary} />
          <Text style={styles.note}>Background location is only requested when you turn Online ON.</Text>
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Allow location" onPress={onEnable} loading={loading} style={styles.cta} />
        <Button label="Continue without location" variant="outline" onPress={onSkip} />
      </View>
    </Screen>
  );
}

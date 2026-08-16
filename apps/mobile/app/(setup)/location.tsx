import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AppIcon } from '../../src/components/ui/app-icon';
import { useRequiredDistanceConfig } from '../../src/hooks/use-app-config';
import { locationSetupStorage } from '../../src/lib/location-setup-storage';
import { Button, Card, Screen } from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

export default function LocationSetupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const wallDefaultMeters = useRequiredDistanceConfig().wall.defaultMeters;
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
    step: {
      ...typography.overline,
      color: colors.accent,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
  }));

  const onEnable = async () => {
    setLoading(true);
    setError(null);
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted') {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }
      if (status !== 'granted') {
        setError('Choose "Allow only while using the app" so PingMe can show nearby posts and people.');
        return;
      }
      locationSetupStorage.markComplete();
      router.replace('/(setup)/notifications');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request location permission');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.step}>Step 1 of 2</Text>
        <View style={styles.iconWrap}>
          <AppIcon name="location" size={36} color={colors.accent} />
        </View>

        <Text style={styles.title}>Enable location</Text>
        <Text style={styles.body}>
          PingMe uses your location while you use the app to show posts and people within about {wallDefaultMeters} meters.
          We never share your exact coordinates — only fuzzy distance buckets.
        </Text>

        <Card variant="muted" style={styles.noteCard}>
          <AppIcon name="info" size={18} color={colors.inkSecondary} />
          <Text style={styles.note}>
            On the next screen, tap &quot;Allow only while using the app&quot;. &quot;Allow all
            the time&quot; is optional if you want to stay visible when PingMe is closed.
          </Text>
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Continue" onPress={onEnable} loading={loading} style={styles.cta} />
      </View>
    </Screen>
  );
}

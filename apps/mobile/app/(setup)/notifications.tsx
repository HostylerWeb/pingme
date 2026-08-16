import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AppIcon } from '../../src/components/ui/app-icon';
import * as Notifications from 'expo-notifications';
import { notificationsSetupStorage } from '../../src/lib/notifications-setup-storage';
import { registerForPushNotifications } from '../../src/lib/push-notifications';
import { Button, Card, Screen } from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

export default function NotificationsSetupScreen() {
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
    step: {
      ...typography.overline,
      color: colors.accent,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
  }));

  const finishSetup = () => {
    notificationsSetupStorage.markComplete();
    router.replace('/(setup)/tour');
  };

  const onEnable = async () => {
    setLoading(true);
    setError(null);
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          setError('Notifications help you know when someone replies, messages, or wants to connect.');
          return;
        }
      }
      await registerForPushNotifications({ skipPermissionRequest: true });
      finishSetup();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request notification permission');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.step}>Step 2 of 2</Text>
        <View style={styles.iconWrap}>
          <AppIcon name="notifications" size={36} color={colors.accent} />
        </View>

        <Text style={styles.title}>Stay in the loop</Text>
        <Text style={styles.body}>
          PingMe sends notifications when someone replies on the Wall, messages you in chat, turns
          on Break the ice nearby, or matches with you. You can change each alert in Settings.
        </Text>

        <Card variant="muted" style={styles.noteCard}>
          <AppIcon name="info" size={18} color={colors.inkSecondary} />
          <Text style={styles.note}>
            We never spam — only activity that matters to you within your area.
          </Text>
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Allow notifications" onPress={onEnable} loading={loading} style={styles.cta} />
      </View>
    </Screen>
  );
}

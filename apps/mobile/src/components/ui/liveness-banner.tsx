import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { radius, spacing, typography, useTheme } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { AppIcon } from './app-icon';

export function LivenessBanner() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => ({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.xl,
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.accentMuted,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textWrap: { flex: 1 },
    title: { ...typography.bodySemiBold, color: colors.ink, marginBottom: 2 },
    body: { ...typography.caption, color: colors.inkSecondary, lineHeight: 18 },
  }));

  return (
    <Pressable style={styles.banner} onPress={() => router.push('/(setup)/liveness')}>
      <View style={styles.iconWrap}>
        <AppIcon name="verified" size={18} color={colors.accent} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Verify to post and connect</Text>
        <Text style={styles.body}>A quick liveness check keeps PingMe safe for everyone nearby.</Text>
      </View>
      <AppIcon name="chevron-forward" size={18} color={colors.inkTertiary} />
    </Pressable>
  );
}

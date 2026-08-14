import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { radius, spacing, typography, useTheme } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => ({
    wrap: {
      alignItems: 'center',
      paddingVertical: spacing.section,
      paddingHorizontal: spacing.xxl,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: radius.xl,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.headlineMd,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    message: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 300,
    },
    action: {
      marginTop: spacing.lg,
      width: '100%',
      maxWidth: 280,
    },
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={26} color={colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

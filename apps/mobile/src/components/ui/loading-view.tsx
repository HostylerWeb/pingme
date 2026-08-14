import { ActivityIndicator, Text, View } from 'react-native';
import { spacing, typography, useTheme } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

export function LoadingView({ message }: { message?: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => ({
    wrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.container,
      gap: spacing.lg,
    },
    message: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      textAlign: 'center',
    },
  }));

  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.accent} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

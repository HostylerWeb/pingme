import { ActivityIndicator, Pressable } from 'react-native';
import { radius, useTheme, useThemedStyles } from '../../theme';
import { AppIcon } from './app-icon';

export function HeaderRefreshButton({
  onPress,
  loading = false,
  accessibilityLabel = 'Refresh',
}: {
  onPress: () => void;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => ({
    btn: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pressed: { opacity: 0.85 },
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.ink} />
      ) : (
        <AppIcon name="refresh" size={20} color={colors.ink} />
      )}
    </Pressable>
  );
}

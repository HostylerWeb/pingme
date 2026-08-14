import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '../../stores/toast-store';
import { radius, spacing, typography, useTheme } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const { colors, shadows } = useTheme();
  const { message, type, hide } = useToastStore();

  const styles = useThemedStyles(({ colors }) => ({
    wrap: {
      position: 'absolute',
      left: spacing.container,
      right: spacing.container,
      zIndex: 9999,
    },
    toast: {
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: {
      ...typography.bodyMd,
      textAlign: 'center',
    },
  }));

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, 4000);
    return () => clearTimeout(timer);
  }, [message, hide]);

  if (!message) return null;

  const bg =
    type === 'error'
      ? colors.errorContainer
      : type === 'success'
        ? colors.onlineSoft
        : colors.surfaceElevated;
  const textColor =
    type === 'error'
      ? colors.onErrorContainer
      : type === 'success'
        ? colors.onSecondaryContainer
        : colors.ink;

  return (
    <Pressable
      onPress={hide}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.wrap, { top: insets.top + 8 }, styles.toast, { backgroundColor: bg }, shadows.card]}
    >
      <Text style={[styles.text, { color: textColor }]}>{message}</Text>
    </Pressable>
  );
}

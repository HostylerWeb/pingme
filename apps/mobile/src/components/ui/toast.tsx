import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ToastType, useToastStore } from '../../stores/toast-store';
import { radius, spacing, typography, useTheme } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

function toastMeta(type: ToastType, colors: ReturnType<typeof useTheme>['colors']) {
  switch (type) {
    case 'error':
      return {
        icon: 'alert-circle' as const,
        background: colors.errorContainer,
        border: colors.error,
        iconColor: colors.error,
        textColor: colors.onErrorContainer,
      };
    case 'success':
      return {
        icon: 'checkmark-circle' as const,
        background: colors.onlineSoft,
        border: colors.online,
        iconColor: colors.online,
        textColor: colors.onSecondaryContainer,
      };
    default:
      return {
        icon: 'information-circle' as const,
        background: colors.surfaceElevated,
        border: colors.border,
        iconColor: colors.accent,
        textColor: colors.ink,
      };
  }
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const { colors, shadows } = useTheme();
  const { message, type, hide } = useToastStore();

  const styles = useThemedStyles(() => ({
    wrap: {
      position: 'absolute',
      left: spacing.container,
      right: spacing.container,
      zIndex: 9999,
    },
    toast: {
      borderRadius: radius.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    text: {
      ...typography.bodyMd,
      flex: 1,
      lineHeight: 22,
    },
  }));

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, 3500);
    return () => clearTimeout(timer);
  }, [message, hide]);

  if (!message) return null;

  const meta = toastMeta(type, colors);

  return (
    <Pressable
      onPress={hide}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.wrap, { top: insets.top + 8 }]}
    >
      <View
        style={[
          styles.toast,
          { backgroundColor: meta.background, borderColor: meta.border },
          shadows.card,
        ]}
      >
        <Ionicons name={meta.icon} size={22} color={meta.iconColor} />
        <Text style={[styles.text, { color: meta.textColor }]}>{message}</Text>
      </View>
    </Pressable>
  );
}

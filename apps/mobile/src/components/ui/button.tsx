import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, PressableProps, Text, ViewStyle } from 'react-native';
import { radius, spacing, typography } from '../../theme';
import { useTheme } from '../../theme/theme-context';
import { useThemedStyles } from '../../theme/use-themed-styles';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icebreaker' | 'premium' | 'outline';

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading,
  style,
  disabled,
  onPress,
  ...props
}: PressableProps & {
  label: string;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const styles = useThemedStyles(({ colors }) => ({
    base: {
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    pressed: {
      opacity: 0.92,
      transform: [{ scale: 0.98 }],
    },
    disabled: {
      opacity: 0.5,
    },
    label: {
      ...typography.bodySemiBold,
      fontSize: 16,
    },
    labelSm: {
      fontSize: 14,
    },
    primary: { backgroundColor: colors.accent },
    secondary: { backgroundColor: colors.online },
    ghost: { backgroundColor: colors.accentSoft },
    danger: { backgroundColor: colors.errorContainer },
    icebreaker: { backgroundColor: colors.icebreaker },
    premium: { backgroundColor: colors.premiumStart },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    textPrimary: { color: colors.onAccent },
    textSecondary: { color: colors.onOnline },
    textGhost: { color: colors.accent },
    textDanger: { color: colors.onErrorContainer },
    textIcebreaker: { color: colors.onAccent },
    textPremium: { color: colors.onPrimary },
    textOutline: { color: colors.ink },
    sm: { paddingVertical: 10, paddingHorizontal: spacing.lg, minHeight: 40 },
    md: { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xl, minHeight: 50 },
    lg: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xxl, minHeight: 56 },
  }));

  const variantStyle = {
    primary: styles.primary,
    secondary: styles.secondary,
    ghost: styles.ghost,
    danger: styles.danger,
    icebreaker: styles.icebreaker,
    premium: styles.premium,
    outline: styles.outline,
  }[variant];

  const textStyle = {
    primary: styles.textPrimary,
    secondary: styles.textSecondary,
    ghost: styles.textGhost,
    danger: styles.textDanger,
    icebreaker: styles.textIcebreaker,
    premium: styles.textPremium,
    outline: styles.textOutline,
  }[variant];

  const loaderColor = {
    primary: colors.onAccent,
    secondary: colors.onOnline,
    ghost: colors.accent,
    danger: colors.onErrorContainer,
    icebreaker: colors.onAccent,
    premium: colors.onPrimary,
    outline: colors.ink,
  }[variant];

  const sizeStyle = { sm: styles.sm, md: styles.md, lg: styles.lg }[size];

  const handlePress = async (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    if (isDisabled) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* noop */
    }
    onPress?.(e);
  };

  return (
    <Pressable
      disabled={isDisabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        sizeStyle,
        variantStyle,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={loaderColor} />
      ) : (
        <Text style={[styles.label, textStyle, size === 'sm' && styles.labelSm]}>{label}</Text>
      )}
    </Pressable>
  );
}

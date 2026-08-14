import { ActivityIndicator, Pressable, PressableProps, StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icebreaker' | 'premium';

export function Button({
  label,
  variant = 'primary',
  loading,
  style,
  disabled,
  ...props
}: PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;

  if (variant === 'icebreaker') {
    return (
      <Pressable disabled={isDisabled} style={[styles.base, style]} {...props}>
        <LinearGradient
          colors={[colors.icebreakerStart, colors.icebreakerEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradient, isDisabled && styles.disabled]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.icebreakerText}>{label}</Text>
          )}
        </LinearGradient>
      </Pressable>
    );
  }

  if (variant === 'premium') {
    return (
      <Pressable disabled={isDisabled} style={[styles.base, style]} {...props}>
        <LinearGradient
          colors={[colors.premiumStart, colors.premiumEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradient, isDisabled && styles.disabled]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>{label}</Text>
          )}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={isDisabled}
      style={[
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.primary : '#fff'} />
      ) : (
        <Text style={textStyles[variant]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  gradient: {
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  primaryText: {
    ...typography.bodySemiBold,
    color: colors.onPrimary,
    fontSize: 16,
  },
  icebreakerText: {
    ...typography.labelSm,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  ghost: { backgroundColor: colors.primaryFixed },
  danger: { backgroundColor: colors.errorContainer },
});

const textStyles = StyleSheet.create({
  primary: { ...typography.bodySemiBold, color: colors.onPrimary, fontSize: 16 },
  secondary: { ...typography.bodySemiBold, color: colors.onSecondary, fontSize: 16 },
  ghost: { ...typography.bodySemiBold, color: colors.primary, fontSize: 16 },
  danger: { ...typography.bodySemiBold, color: colors.onErrorContainer, fontSize: 16 },
});

import { ReactNode } from 'react';
import { Pressable, PressableProps, View, ViewStyle } from 'react-native';
import { radius, spacing } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

type Variant = 'elevated' | 'flat' | 'muted';

export function Card({
  children,
  style,
  variant = 'elevated',
  onPress,
}: {
  children: ReactNode;
  style?: ViewStyle;
  variant?: Variant;
  onPress?: PressableProps['onPress'];
}) {
  const styles = useThemedStyles(({ colors, shadows }) => ({
    card: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    pressed: { opacity: 0.96 },
    elevated: {
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    flat: { backgroundColor: colors.surface },
    muted: {
      backgroundColor: colors.surfaceMuted,
      borderColor: 'transparent',
    },
  }));

  const variantStyle = { elevated: styles.elevated, flat: styles.flat, muted: styles.muted }[variant];

  const content = (
    <View style={[styles.card, variantStyle, style]}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }

  return content;
}

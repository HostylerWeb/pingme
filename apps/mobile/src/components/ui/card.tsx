import { ReactNode } from 'react';
import { Pressable, PressableProps, StyleSheet, View } from 'react-native';
import { colors, radius, shadows, spacing } from '../../theme';

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: object;
  onPress?: PressableProps['onPress'];
}) {
  const content = (
    <View style={[styles.card, style]}>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.96,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadows, spacing, typography } from '../../theme';

export function AppHeader({
  title = 'PingMe',
  right,
  showBrand = true,
}: {
  title?: string;
  right?: ReactNode;
  showBrand?: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }, shadows.header]}>
      <View style={styles.row}>
        {showBrand ? (
          <View style={styles.brand}>
            <Ionicons name="cellular" size={22} color={colors.primary} />
            <Text style={styles.brandText}>{title}</Text>
          </View>
        ) : (
          <Text style={styles.brandText}>{title}</Text>
        )}
        {right}
      </View>
    </View>
  );
}

export function AvailableChip({
  isAvailable,
  onPress,
}: {
  isAvailable: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.chip, isAvailable ? styles.chipOn : styles.chipOff]}>
      {isAvailable ? <View style={styles.dot} /> : null}
      <Text style={[styles.chipText, isAvailable ? styles.chipTextOn : styles.chipTextOff]}>
        {isAvailable ? 'Available' : 'Offline'}
      </Text>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(248, 249, 255, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    paddingHorizontal: spacing.container,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandText: {
    ...typography.headlineLg,
    color: colors.primary,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipOn: {
    backgroundColor: colors.secondaryContainer,
    borderWidth: 1,
    borderColor: colors.secondaryFixed,
  },
  chipOff: {
    backgroundColor: colors.surfaceContainer,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.onSecondaryContainer,
  },
  chipText: {
    ...typography.labelSm,
    textTransform: 'uppercase',
  },
  chipTextOn: {
    color: colors.onSecondaryContainer,
  },
  chipTextOff: {
    color: colors.onSurfaceVariant,
  },
});

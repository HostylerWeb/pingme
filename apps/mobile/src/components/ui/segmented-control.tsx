import { Pressable, Text, View } from 'react-native';
import { radius, spacing, typography } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const styles = useThemedStyles(({ colors }) => ({
    wrap: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radius.lg,
      padding: 4,
      marginBottom: spacing.lg,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    itemActive: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: {
      ...typography.bodySemiBold,
      color: colors.inkSecondary,
      fontSize: 14,
    },
    textActive: { color: colors.accent },
  }));

  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.item, active && styles.itemActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

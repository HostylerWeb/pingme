import { Pressable, Text, View } from 'react-native';
import { radius, spacing, typography, useThemedStyles } from '../theme';

export const RADIUS_OPTIONS = [
  { meters: 150, label: '150m', hint: 'Close' },
  { meters: 250, label: '250m', hint: 'Default' },
  { meters: 350, label: '350m', hint: 'Wide' },
  { meters: 500, label: '500m', hint: 'Far' },
] as const;

export const RADIUS_RANGE_LABEL = '150–500m';

type NearbyRadiusPickerProps = {
  value: number;
  onChange: (meters: number) => void;
  disabled?: boolean;
};

export function NearbyRadiusPicker({ value, onChange, disabled }: NearbyRadiusPickerProps) {
  const styles = useThemedStyles(({ colors }) => ({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    option: {
      width: '48%',
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    optionActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    optionPressed: { opacity: 0.9 },
    label: { ...typography.bodySemiBold, color: colors.ink, fontSize: 18 },
    labelActive: { color: colors.accent },
    hint: { ...typography.caption, color: colors.inkTertiary, marginTop: 4 },
  }));

  return (
    <View style={styles.grid}>
      {RADIUS_OPTIONS.map((option) => {
        const active = value === option.meters;
        return (
          <Pressable
            key={option.meters}
            disabled={disabled}
            onPress={() => {
              if (value === option.meters) return;
              onChange(option.meters);
            }}
            style={({ pressed }) => [
              styles.option,
              active && styles.optionActive,
              pressed && styles.optionPressed,
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
            <Text style={styles.hint}>{option.hint}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

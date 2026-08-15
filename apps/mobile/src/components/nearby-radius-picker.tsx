import { wallRadiusRangeLabel } from '@pingme/shared';
import { Pressable, Text, View } from 'react-native';
import { radius, spacing, typography, useThemedStyles } from '../theme';

function optionHint(meters: number, defaultMeters: number, minMeters: number, maxMeters: number) {
  if (meters === defaultMeters) return 'Default';
  if (meters === minMeters) return 'Close';
  if (meters === maxMeters) return 'Far';
  return 'Wide';
}

type NearbyRadiusPickerProps = {
  value: number;
  onChange: (meters: number) => void;
  disabled?: boolean;
  optionsMeters: number[];
  defaultMeters: number;
  minMeters: number;
  maxMeters: number;
};

export function NearbyRadiusPicker({
  value,
  onChange,
  disabled,
  optionsMeters,
  defaultMeters,
  minMeters,
  maxMeters,
}: NearbyRadiusPickerProps) {
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
      {optionsMeters.map((meters) => {
        const active = value === meters;
        return (
          <Pressable
            key={meters}
            disabled={disabled}
            onPress={() => {
              if (value === meters) return;
              onChange(meters);
            }}
            style={({ pressed }) => [
              styles.option,
              active && styles.optionActive,
              pressed && styles.optionPressed,
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{`${meters}m`}</Text>
            <Text style={styles.hint}>
              {optionHint(meters, defaultMeters, minMeters, maxMeters)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function wallRadiusRangeLabelFromConfig(minMeters: number, maxMeters: number): string {
  return wallRadiusRangeLabel(minMeters, maxMeters);
}

import { GENDER_OPTIONS, type GenderValue } from '@pingme/shared';
import { Pressable, Text, View } from 'react-native';
import { radius, spacing, typography } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

export function GenderPicker({
  value,
  onChange,
  disabled = false,
  label = 'Gender',
}: {
  value: GenderValue | null;
  onChange: (value: GenderValue) => void;
  disabled?: boolean;
  label?: string;
}) {
  const styles = useThemedStyles(({ colors }) => ({
    wrap: { marginBottom: spacing.lg },
    label: {
      ...typography.labelSm,
      color: colors.inkSecondary,
      marginBottom: spacing.sm,
      textTransform: 'none',
      letterSpacing: 0,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: spacing.xs,
    },
    option: {
      flex: 1,
      minHeight: 40,
      paddingVertical: spacing.sm,
      paddingHorizontal: 4,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    optionDisabled: {
      opacity: 0.7,
    },
    optionLabel: {
      ...typography.labelSm,
      fontSize: 11,
      lineHeight: 14,
      color: colors.inkSecondary,
      textAlign: 'center',
    },
    optionLabelSelected: {
      color: colors.accent,
    },
    optionLabelDisabled: {
      color: colors.inkTertiary,
    },
  }));

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {GENDER_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[
                styles.option,
                selected && styles.optionSelected,
                disabled && styles.optionDisabled,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={option.label}
            >
              <Text
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[
                  styles.optionLabel,
                  selected && styles.optionLabelSelected,
                  disabled && styles.optionLabelDisabled,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function GenderReadOnly({ label, value }: { label?: string; value: string }) {
  const styles = useThemedStyles(({ colors }) => ({
    wrap: { marginBottom: spacing.lg },
    fieldLabel: {
      ...typography.labelSm,
      color: colors.inkSecondary,
      marginBottom: spacing.sm,
      textTransform: 'none',
      letterSpacing: 0,
    },
    valueBox: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md + 2,
    },
    value: {
      ...typography.bodyMd,
      color: colors.inkTertiary,
    },
    hint: {
      ...typography.caption,
      color: colors.inkTertiary,
      marginTop: spacing.sm,
    },
  }));

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.valueBox}>
        <Text style={styles.value}>{value}</Text>
      </View>
      <Text style={styles.hint}>Gender cannot be changed after it is set.</Text>
    </View>
  );
}

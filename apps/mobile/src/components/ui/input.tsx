import { Text, TextInput, TextInputProps, View } from 'react-native';
import { radius, spacing, typography, useTheme } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

export function Input({
  label,
  hint,
  containerStyle,
  ...props
}: TextInputProps & {
  label?: string;
  hint?: string;
  containerStyle?: object;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => ({
    wrap: { marginBottom: spacing.lg },
    label: {
      ...typography.labelSm,
      color: colors.inkSecondary,
      marginBottom: spacing.sm,
      textTransform: 'none',
      letterSpacing: 0,
    },
    input: {
      ...typography.bodyMd,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md + 2,
      color: colors.ink,
    },
    multiline: {
      minHeight: 120,
      textAlignVertical: 'top',
      paddingTop: spacing.lg,
    },
    hint: {
      ...typography.caption,
      color: colors.inkTertiary,
      marginTop: spacing.sm,
      textAlign: 'right',
    },
  }));

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.inkMuted}
        style={[styles.input, props.multiline && styles.multiline]}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

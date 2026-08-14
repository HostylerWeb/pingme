import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

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
  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.outline}
        style={[styles.input, props.multiline && styles.multiline]}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  input: {
    ...typography.bodyMd,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    color: colors.onSurface,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  hint: {
    ...typography.labelSm,
    color: colors.outline,
    marginTop: spacing.sm,
  },
});

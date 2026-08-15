import { useState } from 'react';
import { Pressable, Text, TextInput, TextInputProps, View } from 'react-native';
import { radius, spacing, typography, useTheme } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { AppIcon } from './app-icon';

export function PasswordInput({
  label,
  hint,
  containerStyle,
  value,
  onChangeText,
  ...props
}: Omit<TextInputProps, 'secureTextEntry'> & {
  label?: string;
  hint?: string;
  containerStyle?: object;
}) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  const styles = useThemedStyles(({ colors }) => ({
    wrap: { marginBottom: spacing.lg },
    label: {
      ...typography.labelSm,
      color: colors.inkSecondary,
      marginBottom: spacing.sm,
      textTransform: 'none',
      letterSpacing: 0,
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      paddingLeft: spacing.lg,
      paddingRight: spacing.sm,
    },
    input: {
      ...typography.bodyMd,
      flex: 1,
      paddingVertical: spacing.md + 2,
      color: colors.ink,
    },
    toggle: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
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
      <View style={styles.field}>
        <TextInput
          placeholderTextColor={colors.inkMuted}
          style={styles.input}
          secureTextEntry={!visible}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        <Pressable
          onPress={() => setVisible((current) => !current)}
          style={styles.toggle}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        >
          <AppIcon name={visible ? 'eye-off' : 'eye'} size={20} color={colors.inkTertiary} />
        </Pressable>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

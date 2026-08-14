import { Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { hapticLight } from './avatar';
import { BottomSheet } from './bottom-sheet';
import { spacing, typography } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

export type ActionSheetOption = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

export function ActionSheet({
  visible,
  title,
  subtitle,
  footer,
  options,
  onClose,
}: {
  visible: boolean;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  options: ActionSheetOption[];
  onClose: () => void;
}) {
  const styles = useThemedStyles(({ colors }) => ({
    list: {
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    footer: {
      ...typography.caption,
      color: colors.inkTertiary,
      lineHeight: 18,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.xs,
    },
    row: {
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.sm,
      borderRadius: 12,
    },
    rowPressed: { backgroundColor: colors.surfaceMuted },
    label: {
      ...typography.bodySemiBold,
      color: colors.ink,
      textAlign: 'center',
      fontSize: 16,
    },
    destructive: { color: colors.error },
    cancel: {
      paddingVertical: spacing.md + 2,
      marginTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    cancelLabel: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      textAlign: 'center',
    },
  }));

  return (
    <BottomSheet visible={visible} title={title} subtitle={subtitle} onClose={onClose}>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
      <View style={styles.list}>
        {options.map((option) => (
          <Pressable
            key={option.label}
            onPress={async () => {
              await hapticLight();
              onClose();
              option.onPress();
            }}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={[styles.label, option.destructive && styles.destructive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && styles.rowPressed]}>
        <Text style={styles.cancelLabel}>Cancel</Text>
      </Pressable>
    </BottomSheet>
  );
}

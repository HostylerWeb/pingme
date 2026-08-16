import { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useBottomInset } from '../../hooks/use-tab-bar-insets';
import { radius, spacing, typography } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

export function PickerSheet({
  visible,
  title,
  onClose,
  onDone,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onDone: () => void;
  children: ReactNode;
}) {
  const bottomInset = useBottomInset();
  const styles = useThemedStyles(({ colors }) => ({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl + 4,
      borderTopRightRadius: radius.xl + 4,
      paddingBottom: bottomInset + spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    title: {
      ...typography.bodySemiBold,
      color: colors.ink,
      fontSize: 16,
    },
    action: {
      ...typography.bodySemiBold,
      color: colors.accent,
      fontSize: 16,
      minWidth: 64,
    },
    actionMuted: {
      color: colors.inkSecondary,
    },
    body: {
      paddingTop: spacing.sm,
    },
  }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[styles.action, styles.actionMuted]}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onDone} hitSlop={8}>
              <Text style={[styles.action, { textAlign: 'right' }]}>Done</Text>
            </Pressable>
          </View>
          <View style={styles.body}>{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

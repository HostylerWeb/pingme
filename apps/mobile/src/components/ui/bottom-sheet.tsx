import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useBottomInset } from '../../hooks/use-tab-bar-insets';
import { radius, spacing, typography } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

export function BottomSheet({
  visible,
  title,
  subtitle,
  children,
  onClose,
}: {
  visible: boolean;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const safeBottom = useBottomInset();
  const styles = useThemedStyles(({ colors, shadows }) => ({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    dismissArea: { flex: 1 },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl + 4,
      borderTopRightRadius: radius.xl + 4,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      maxHeight: '90%',
      ...shadows.sheet,
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.outlineVariant,
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.headlineMd,
      color: colors.ink,
      marginBottom: spacing.xs,
    },
    subtitle: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      marginBottom: spacing.lg,
      lineHeight: 22,
    },
    scrollContent: {
      paddingBottom: spacing.xl + safeBottom,
    },
  }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

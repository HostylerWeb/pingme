import { AppIcon } from './app-icon';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { hapticSuccess } from './avatar';
import { Button } from './button';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../theme';

export type ConnectionCelebrationKind = 'mutual_yes' | 'connected';

export function ConnectionCelebrationModal({
  visible,
  kind,
  displayName,
  onPrimary,
  onClose,
}: {
  visible: boolean;
  kind: ConnectionCelebrationKind;
  displayName?: string;
  onPrimary: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const styles = useThemedStyles(({ colors }) => ({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.container,
    },
    card: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.surface,
      borderRadius: radius.xl + 4,
      padding: spacing.xxl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    title: {
      ...typography.display,
      fontSize: 26,
      lineHeight: 32,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    body: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: spacing.xxl,
    },
    actions: {
      width: '100%',
      gap: spacing.sm,
    },
    close: {
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
    },
    closeText: {
      ...typography.bodySemiBold,
      color: colors.inkTertiary,
    },
  }));

  useEffect(() => {
    if (!visible) {
      scale.setValue(0.85);
      opacity.setValue(0);
      return;
    }

    void hapticSuccess();
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, scale]);

  const title =
    kind === 'connected'
      ? "You're connected!"
      : 'You both said yes!';

  const body =
    kind === 'connected'
      ? displayName
        ? `You and ${displayName} can chat now.`
        : 'Your private chat is ready.'
      : displayName
        ? `You and ${displayName} both said yes.`
        : 'You both said yes.';

  const primaryLabel = kind === 'connected' ? 'Open chat' : 'Open chat';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <View style={styles.iconWrap}>
            <AppIcon
              name={kind === 'connected' ? 'chat-bubbles' : 'sparkles'}
              size={40}
              color={colors.accent}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            <Button label={primaryLabel} size="lg" onPress={onPrimary} />
            <Button label="Not now" variant="ghost" onPress={onClose} />
          </View>
        </Animated.View>
        <Pressable style={styles.close} onPress={onClose} hitSlop={12}>
          <Text style={styles.closeText}>Dismiss</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

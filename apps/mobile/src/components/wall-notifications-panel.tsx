import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type WallNotificationItem } from '../lib/api';
import { formatWallPostTime } from '../lib/format-post-time';
import { showToast } from '../stores/toast-store';
import { radius, spacing, typography, useTheme } from '../theme';
import { useThemedStyles } from '../theme/use-themed-styles';
import { AppIcon } from './ui/app-icon';
import { Button } from './ui/button';
import { EmptyState } from './ui/empty-state';

export function WallNotificationsPanel({
  visible,
  items,
  loading,
  onClose,
  onOpenItem,
}: {
  visible: boolean;
  items: WallNotificationItem[];
  loading: boolean;
  onClose: () => void;
  onOpenItem: (item: WallNotificationItem) => void;
}) {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items]);

  const styles = useThemedStyles(({ colors, shadows }) => ({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    dismissArea: { flex: 1, minHeight: insets.top + 56 },
    panel: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl + 4,
      borderTopRightRadius: radius.xl + 4,
      maxHeight: '78%',
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomWidth: 0,
      ...shadows.sheet,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    title: { ...typography.headlineMd, color: colors.ink },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
    },
    actionBtnPressed: { opacity: 0.85 },
    actionLabel: { ...typography.labelSm, color: colors.inkSecondary },
    scroll: { paddingHorizontal: spacing.lg },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    rowUnread: { backgroundColor: colors.accentSoft },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    rowBody: { flex: 1, gap: 2 },
    rowTitle: { ...typography.bodySemiBold, color: colors.ink, fontSize: 15 },
    rowMessage: { ...typography.bodyMd, color: colors.inkSecondary, lineHeight: 20 },
    rowMeta: { ...typography.caption, color: colors.inkTertiary },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
      marginTop: 6,
    },
    footerPad: { height: spacing.xl + insets.bottom },
  }));

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
    await queryClient.invalidateQueries({ queryKey: ['wall-notifications'] });
  };

  const markAllMutation = useMutation({
    mutationFn: () => api.markWallNotificationsRead(),
    onSuccess: async () => {
      await invalidate();
      showToast('All notifications marked read', 'success');
    },
    onError: () => showToast('Could not mark notifications read', 'error'),
  });

  const clearMutation = useMutation({
    mutationFn: () => api.clearWallNotifications(),
    onSuccess: async () => {
      await invalidate();
      showToast('Notifications cleared', 'success');
    },
    onError: () => showToast('Could not clear notifications', 'error'),
  });

  const busy = markAllMutation.isPending || clearMutation.isPending;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} accessibilityLabel="Close notifications" />
        <View style={styles.panel}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Notifications</Text>
              <Pressable
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <AppIcon name="close" size={18} color={colors.ink} />
              </Pressable>
            </View>
            {items.length > 0 ? (
              <View style={styles.actions}>
                <Pressable
                  disabled={busy || unreadCount === 0}
                  onPress={() => markAllMutation.mutate()}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
                >
                  <Text style={styles.actionLabel}>Mark all read</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={() => clearMutation.mutate()}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
                >
                  <Text style={styles.actionLabel}>Clear all</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {loading && items.length === 0 ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.xl }} />
          ) : items.length === 0 ? (
            <EmptyState
              icon="notifications"
              title="No notifications yet"
              message="Replies on your posts and threads you joined will appear here."
            />
          ) : (
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              {items.map((item) => {
                const unread = !item.readAt;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => onOpenItem(item)}
                    style={[styles.row, unread && styles.rowUnread]}
                  >
                    <View style={styles.iconWrap}>
                      <AppIcon name="wall" size={20} color={colors.accent} />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <Text style={styles.rowMessage} numberOfLines={2}>
                        <Text style={{ fontWeight: '600' }}>{item.actorDisplayName}</Text>: {item.replyPreview}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        On “{item.postPreview}” · {formatWallPostTime(item.createdAt)}
                      </Text>
                    </View>
                    {unread ? <View style={styles.unreadDot} /> : null}
                  </Pressable>
                );
              })}
              <View style={styles.footerPad} />
            </ScrollView>
          )}

          {items.length > 0 ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md + insets.bottom }}>
              <Button label="Close" variant="ghost" onPress={onClose} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

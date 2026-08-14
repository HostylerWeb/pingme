import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { api, ChatSummary } from '../../src/lib/api';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
import { AppHeader, Avatar, Button, DisplayNameWithFlair, EmptyState, ListSkeleton, Screen } from '../../src/components/ui';
import { spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ChatRow({ chat, onPress }: { chat: ChatSummary; onPress: () => void }) {
  const styles = useThemedStyles(({ colors }) => ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.lg,
    },
    rowPressed: { opacity: 0.85 },
    rowBody: { flex: 1 },
    rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    name: { ...typography.bodySemiBold, color: colors.ink, fontSize: 16 },
    nameUnread: { ...typography.bodySemiBold, color: colors.ink, fontSize: 16 },
    time: { ...typography.caption, color: colors.inkTertiary },
    preview: { ...typography.bodyMd, color: colors.inkSecondary, fontSize: 14 },
    previewUnread: { ...typography.bodySemiBold, color: colors.ink, fontSize: 14 },
    unreadBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      marginLeft: spacing.sm,
    },
    unreadBadgeText: { ...typography.labelSm, color: colors.onAccent, fontSize: 11 },
  }));

  const unreadCount = chat.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;
  const preview = chat.lastMessage
    ? `${chat.lastMessage.isYou ? 'You: ' : ''}${chat.lastMessage.content}`
    : 'Say hello';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Avatar
        name={chat.otherUser.displayName}
        size="md"
        uri={chat.otherUser.avatarUrl}
        themeId={chat.otherUser.isPremium ? chat.otherUser.avatarTheme : null}
      />
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <DisplayNameWithFlair
            name={chat.otherUser.displayName}
            isPremium={chat.otherUser.isPremium}
            isVerified={chat.otherUser.livenessVerified}
            style={hasUnread ? styles.nameUnread : styles.name}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {chat.lastMessage ? <Text style={styles.time}>{formatTime(chat.lastMessage.createdAt)}</Text> : null}
            {hasUnread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Text style={hasUnread ? styles.previewUnread : styles.preview} numberOfLines={1}>
          {preview}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ChatsScreen() {
  const router = useRouter();
  const { contentBottom } = useTabBarInsets();
  const { colors } = useTheme();

  const styles = useThemedStyles(({ colors }) => ({
    skeletonWrap: { paddingHorizontal: spacing.container },
    list: { paddingHorizontal: spacing.container },
    separator: { height: 1, backgroundColor: colors.divider },
  }));

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['chats'],
    queryFn: () => api.getChats(),
    refetchInterval: 15_000,
  });

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const chats = data?.data ?? [];

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader
        large
        title="Chats"
        showBrand={false}
        subtitle="Private chats after you and someone nearby both accept."
      />

      {isLoading ? (
        <View style={[styles.skeletonWrap, { paddingBottom: contentBottom }]}>
          <ListSkeleton count={5} variant="chat" />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
          contentContainerStyle={[styles.list, { paddingBottom: contentBottom }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="No chats yet"
              message="Connect with someone on the Wall or in Break the ice — when you both accept, your chat appears here."
              action={
                <Button
                  label="Browse Break the ice"
                  variant="secondary"
                  onPress={() => router.push('/(tabs)/icebreaker')}
                />
              }
            />
          }
          renderItem={({ item }) => (
            <ChatRow chat={item} onPress={() => router.push(`/chat/${item.id}`)} />
          )}
        />
      )}
    </Screen>
  );
}

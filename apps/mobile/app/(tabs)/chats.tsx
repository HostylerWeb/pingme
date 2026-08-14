import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { api, ChatSummary } from '../../src/lib/api';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
import { AppHeader, Avatar, EmptyState, ListSkeleton, Screen } from '../../src/components/ui';
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
    time: { ...typography.caption, color: colors.inkTertiary },
    preview: { ...typography.bodyMd, color: colors.inkSecondary, fontSize: 14 },
  }));

  const preview = chat.lastMessage
    ? `${chat.lastMessage.isYou ? 'You: ' : ''}${chat.lastMessage.content}`
    : 'Say hello';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Avatar name={chat.otherUser.displayName} size="md" />
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.name}>{chat.otherUser.displayName}</Text>
          {chat.lastMessage ? <Text style={styles.time}>{formatTime(chat.lastMessage.createdAt)}</Text> : null}
        </View>
        <Text style={styles.preview} numberOfLines={1}>
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
    refetchInterval: 30_000,
  });

  const chats = data?.data ?? [];

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader
        large
        title="Chats"
        showBrand={false}
        subtitle="Private conversations after you both accept a match."
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
              message="When you and someone nearby both accept a match, your conversation will show up here."
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

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api, ChatSummary } from '../../src/lib/api';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
import { AppHeader, Card, EmptyState, ListSkeleton, Screen } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ChatRow({ chat, onPress }: { chat: ChatSummary; onPress: () => void }) {
  const preview = chat.lastMessage
    ? `${chat.lastMessage.isYou ? 'You: ' : ''}${chat.lastMessage.content}`
    : 'Say hello';

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{chat.otherUser.displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowHeader}>
            <Text style={styles.name}>{chat.otherUser.displayName}</Text>
            {chat.lastMessage ? <Text style={styles.time}>{formatTime(chat.lastMessage.createdAt)}</Text> : null}
          </View>
          <Text style={styles.preview} numberOfLines={1}>
            {preview}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

export default function ChatsScreen() {
  const router = useRouter();
  const { contentBottom } = useTabBarInsets();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['chats'],
    queryFn: () => api.getChats(),
    refetchInterval: 30_000,
  });

  const chats = data?.data ?? [];

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader title="Chats" showBrand={false} />

      <View style={styles.header}>
        <Text style={styles.subtitle}>Private conversations after you both accept a match.</Text>
      </View>

      {isLoading ? (
        <View style={[styles.skeletonWrap, { paddingBottom: contentBottom }]}>
          <ListSkeleton count={5} variant="chat" />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={[styles.list, { paddingBottom: contentBottom }]}
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

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.container, paddingBottom: spacing.md },
  subtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  skeletonWrap: { paddingHorizontal: spacing.container },
  list: { paddingHorizontal: spacing.container, gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { ...typography.headlineMd, color: colors.primary, fontSize: 18 },
  rowBody: { flex: 1 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { ...typography.bodySemiBold, color: colors.onSurface, fontSize: 16 },
  time: { ...typography.labelSm, color: colors.outline, textTransform: 'none', letterSpacing: 0 },
  preview: { ...typography.bodyMd, color: colors.onSurfaceVariant, fontSize: 14 },
});

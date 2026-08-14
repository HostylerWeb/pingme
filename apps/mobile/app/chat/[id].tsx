import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ChatMessage, ApiError } from '../../src/lib/api';
import { useChatSocket } from '../../src/hooks/use-chat-socket';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';
import { colors, radius, spacing, typography } from '../../src/theme';

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <View style={[styles.bubble, message.isYou ? styles.bubbleYou : styles.bubbleThem]}>
      <Text style={[styles.bubbleText, message.isYou ? styles.bubbleTextYou : styles.bubbleTextThem]}>
        {message.content}
      </Text>
      <View style={styles.bubbleMeta}>
        <Text style={[styles.bubbleTime, message.isYou ? styles.bubbleTimeYou : styles.bubbleTimeThem]}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {message.isYou && message.read ? (
          <Text style={styles.readReceipt}>Read</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [draft, setDraft] = useState('');
  const { ensureVerified, handleLivenessError } = useLivenessGate();

  const { data: chatData, isLoading: chatLoading } = useQuery({
    queryKey: ['chat', id],
    queryFn: () => api.getChat(id!),
    enabled: !!id,
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-messages', id],
    queryFn: () => api.getChatMessages(id!),
    enabled: !!id,
    refetchInterval: 5_000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => api.sendMessage(id!, content),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['chat-messages', id] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onError: (error: Error) => {
      if (!handleLivenessError(error)) {
        alert(error.message);
      }
    },
  });

  const blockMutation = useMutation({
    mutationFn: (userId: string) => api.blockUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      router.back();
    },
    onError: (error: Error) => alert(error.message),
  });

  const reportMutation = useMutation({
    mutationFn: (payload: {
      reportedUserId: string;
      targetType: 'user';
      targetId: string;
      reason: 'harassment' | 'spam' | 'inappropriate' | 'underage' | 'other';
    }) => api.reportUser(payload),
    onSuccess: () => alert('Report submitted. Thank you.'),
    onError: (error: Error) => alert(error.message),
  });

  const chat = chatData?.data;
  const messages = messagesData?.data ?? [];

  const onRealtimeMessage = useCallback(
    (message: ChatMessage) => {
      queryClient.setQueryData<{ success: boolean; data: ChatMessage[] }>(
        ['chat-messages', id],
        (current) => {
          if (!current) return current;
          if (current.data.some((item) => item.id === message.id)) return current;
          return { ...current, data: [...current.data, message] };
        },
      );
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
    [id, queryClient],
  );

  const onRealtimeRead = useCallback(
    (payload: { chatId: string; messageIds: string[] }) => {
      queryClient.setQueryData<{ success: boolean; data: ChatMessage[] }>(
        ['chat-messages', id],
        (current) => {
          if (!current) return current;
          return {
            ...current,
            data: current.data.map((message) =>
              message.isYou &&
              (payload.messageIds.length === 0 || payload.messageIds.includes(message.id))
                ? { ...message, read: true, status: 'read' }
                : message,
            ),
          };
        },
      );
    },
    [id, queryClient],
  );

  useChatSocket(id, onRealtimeMessage, onRealtimeRead);

  useEffect(() => {
    if (!id || !messagesData?.data.length) return;
    const unreadIds = messagesData.data
      .filter((message) => !message.isYou && message.status !== 'read')
      .map((message) => message.id);
    if (unreadIds.length) {
      void api.markChatRead(id, unreadIds);
    }
  }, [id, messagesData]);

  const onBlock = () => {
    if (!chat) return;
    Alert.alert(
      'Block user',
      `Block ${chat.otherUser.displayName}? You won't be able to message each other.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => blockMutation.mutate(chat.otherUser.id),
        },
      ],
    );
  };

  const onReport = () => {
    if (!chat) return;

    const submitReport = (reason: 'harassment' | 'spam' | 'inappropriate' | 'underage' | 'other') => {
      reportMutation.mutate({
        reportedUserId: chat.otherUser.id,
        targetType: 'user',
        targetId: chat.otherUser.id,
        reason,
      });
    };

    Alert.alert('Report user', 'Why are you reporting this user?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Harassment', onPress: () => submitReport('harassment') },
      { text: 'Spam', onPress: () => submitReport('spam') },
      { text: 'Inappropriate', onPress: () => submitReport('inappropriate') },
      { text: 'Underage', onPress: () => submitReport('underage') },
      { text: 'Other', onPress: () => submitReport('other') },
    ]);
  };

  const onSend = () => {
    const content = draft.trim();
    if (!content || sendMutation.isPending) return;
    if (!ensureVerified()) return;
    sendMutation.mutate(content);
  };

  if (chatLoading || messagesLoading || !chat) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{chat.otherUser.displayName}</Text>
        <Pressable
          onPress={() =>
            Alert.alert('Chat options', undefined, [
              { text: 'Report', onPress: onReport },
              { text: 'Block', style: 'destructive', onPress: onBlock },
              { text: 'Cancel', style: 'cancel' },
            ])
          }
          hitSlop={8}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => <MessageBubble message={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
          </View>
        }
      />

      <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message..."
          placeholderTextColor={colors.outline}
          multiline
          maxLength={2000}
        />
        <Pressable
          style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
          onPress={onSend}
          disabled={!draft.trim() || sendMutation.isPending}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Ionicons name="send" size={18} color={colors.onPrimary} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.surfaceContainerLow },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.container,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceBright,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  backBtn: { width: 40 },
  headerTitle: { flex: 1, ...typography.headlineMd, fontSize: 17, textAlign: 'center', color: colors.onSurface },
  messages: { padding: spacing.lg, paddingBottom: spacing.sm, flexGrow: 1 },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
  },
  bubbleYou: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceBright,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  bubbleText: { ...typography.bodyMd },
  bubbleTextYou: { color: colors.onPrimary },
  bubbleTextThem: { color: colors.onSurface },
  bubbleTime: { fontSize: 11 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  bubbleTimeYou: { color: 'rgba(255,255,255,0.75)' },
  bubbleTimeThem: { color: colors.outline },
  readReceipt: { fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48 },
  emptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    backgroundColor: colors.surfaceBright,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.bodyMd,
    backgroundColor: colors.surfaceContainerLow,
    color: colors.onSurface,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
});

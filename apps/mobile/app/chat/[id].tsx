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
import { api, ChatMessage, ApiError } from '../../src/lib/api';
import { useChatSocket } from '../../src/hooks/use-chat-socket';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';

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
    Alert.alert('Report user', 'Why are you reporting this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Harassment',
        onPress: () =>
          reportMutation.mutate({
            reportedUserId: chat.otherUser.id,
            targetType: 'user',
            targetId: chat.otherUser.id,
            reason: 'harassment',
          }),
      },
      {
        text: 'Spam',
        onPress: () =>
          reportMutation.mutate({
            reportedUserId: chat.otherUser.id,
            targetType: 'user',
            targetId: chat.otherUser.id,
            reason: 'spam',
          }),
      },
      {
        text: 'Inappropriate',
        onPress: () =>
          reportMutation.mutate({
            reportedUserId: chat.otherUser.id,
            targetType: 'user',
            targetId: chat.otherUser.id,
            reason: 'inappropriate',
          }),
      },
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
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{chat.otherUser.displayName}</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={onReport} hitSlop={8}>
            <Text style={styles.headerAction}>Report</Text>
          </Pressable>
          <Pressable onPress={onBlock} hitSlop={8}>
            <Text style={[styles.headerAction, styles.headerDanger]}>Block</Text>
          </Pressable>
        </View>
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

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message..."
          multiline
          maxLength={2000}
        />
        <Pressable
          style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
          onPress={onSend}
          disabled={!draft.trim() || sendMutation.isPending}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  back: { color: '#2563eb', fontSize: 16, width: 48 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  headerActions: { flexDirection: 'row', gap: 8, width: 120, justifyContent: 'flex-end' },
  headerAction: { color: '#64748b', fontSize: 13 },
  headerDanger: { color: '#dc2626' },
  messages: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 8,
  },
  bubbleYou: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  bubbleTextYou: { color: '#fff' },
  bubbleTextThem: { color: '#0f172a' },
  bubbleTime: { fontSize: 11 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  bubbleTimeYou: { color: 'rgba(255,255,255,0.7)' },
  bubbleTimeThem: { color: '#94a3b8' },
  readReceipt: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48 },
  emptyText: { color: '#64748b', fontSize: 15 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f8fafc',
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

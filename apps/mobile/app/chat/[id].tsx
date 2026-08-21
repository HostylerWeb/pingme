import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { AppIcon } from '../../src/components/ui/app-icon';
import { api, ChatMessage } from '../../src/lib/api';
import { useAppSocket } from '../../src/lib/app-socket';
import { useChatSocket } from '../../src/hooks/use-chat-socket';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';
import { useBottomInset } from '../../src/hooks/use-tab-bar-insets';
import { useSocketAwareRefetchInterval } from '../../src/hooks/use-socket-aware-interval';
import { REPORT_SHEET_FOOTER, REPORT_SUBMITTED_MESSAGE } from '../../src/lib/report-copy';
import { showToast } from '../../src/stores/toast-store';
import {
  ActionSheet,
  AppHeader,
  Avatar,
  Button,
  DisplayNameWithFlair,
  EmptyState,
  hapticLight,
  LoadingView,
  Screen,
} from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

function MessageBubble({ message }: { message: ChatMessage }) {
  const isYou = message.isYou;

  const styles = useThemedStyles(({ colors }) => ({
    bubbleRow: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
    },
    bubbleRowYou: {
      justifyContent: 'flex-end',
    },
    bubble: {
      maxWidth: '82%',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md + 2,
      borderRadius: 22,
    },
    bubbleYou: {
      backgroundColor: colors.chatBubbleYou,
      borderBottomRightRadius: 6,
    },
    bubbleThem: {
      backgroundColor: colors.surfaceElevated,
      borderBottomLeftRadius: 6,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    bubbleText: { ...typography.bodyMd, lineHeight: 22 },
    bubbleTextYou: { color: colors.onAccent },
    bubbleTextThem: { color: colors.ink },
    bubbleMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    bubbleTime: { ...typography.labelSm, fontSize: 11, textTransform: 'none', letterSpacing: 0 },
    bubbleTimeYou: { color: colors.onAccent, opacity: 0.7 },
    bubbleTimeThem: { color: colors.inkMuted },
    readReceipt: {
      ...typography.labelSm,
      fontSize: 10,
      color: colors.onAccent,
      opacity: 0.85,
      textTransform: 'none',
      letterSpacing: 0,
    },
  }));

  return (
    <View style={[styles.bubbleRow, isYou && styles.bubbleRowYou]}>
      <View style={[styles.bubble, isYou ? styles.bubbleYou : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, isYou ? styles.bubbleTextYou : styles.bubbleTextThem]}>
          {message.content}
        </Text>
        <View style={styles.bubbleMeta}>
          <Text style={[styles.bubbleTime, isYou ? styles.bubbleTimeYou : styles.bubbleTimeThem]}>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isYou && message.read ? <Text style={styles.readReceipt}>Read</Text> : null}
        </View>
      </View>
    </View>
  );
}

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef(0);
  const { socket } = useAppSocket();
  const { ensureVerified, handleLivenessError, isVerified } = useLivenessGate();
  const bottomInset = useBottomInset();

  const styles = useThemedStyles(({ colors }) => ({
    container: { flex: 1, backgroundColor: colors.background },
    menuBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    threadHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.container,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    threadHint: {
      ...typography.caption,
      color: colors.inkTertiary,
      flex: 1,
    },
    messages: {
      paddingHorizontal: spacing.container,
      paddingVertical: spacing.lg,
      flexGrow: 1,
      gap: spacing.sm,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: spacing.container,
      paddingTop: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      ...typography.bodyMd,
      backgroundColor: colors.surfaceMuted,
      color: colors.ink,
    },
    sendButton: {
      backgroundColor: colors.accent,
      borderRadius: 22,
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: { opacity: 0.45 },
    verifyBanner: {
      paddingHorizontal: spacing.container,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      gap: spacing.sm,
    },
    verifyTitle: { ...typography.bodySemiBold, color: colors.ink },
    verifyBody: { ...typography.bodyMd, color: colors.inkSecondary },
    closedBanner: {
      paddingHorizontal: spacing.container,
      paddingVertical: spacing.md,
      backgroundColor: colors.surfaceMuted,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    closedText: { ...typography.bodyMd, color: colors.inkSecondary, textAlign: 'center' },
    typingRow: {
      paddingHorizontal: spacing.container,
      paddingBottom: spacing.xs,
    },
    typingText: { ...typography.caption, color: colors.inkTertiary, fontStyle: 'italic' },
  }));

  const { data: chatData, isLoading: chatLoading, isError: chatError } = useQuery({
    queryKey: ['chat', id],
    queryFn: () => api.getChat(id!),
    enabled: !!id,
  });

  const messagesRefetchInterval = useSocketAwareRefetchInterval({
    foreground: 5_000,
    mode: 'stop',
  });

  const { data: messagesData, isLoading: messagesLoading, isError: messagesError } = useQuery({
    queryKey: ['chat-messages', id],
    queryFn: () => api.getChatMessages(id!),
    enabled: !!id,
    refetchInterval: messagesRefetchInterval,
    refetchIntervalInBackground: false,
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
        showToast(error.message, 'error');
      }
    },
  });

  const blockMutation = useMutation({
    mutationFn: (userId: string) => api.blockUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      router.back();
    },
    onError: (error: Error) => showToast(error.message, 'error'),
  });

  const closeMutation = useMutation({
    mutationFn: () => api.closeChat(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['chat', id] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      showToast('Conversation ended', 'success');
      router.back();
    },
    onError: (error: Error) => showToast(error.message, 'error'),
  });

  const reportMutation = useMutation({
    mutationFn: (payload: {
      reportedUserId: string;
      targetType: 'user';
      targetId: string;
      reason: 'harassment' | 'spam' | 'inappropriate' | 'underage' | 'other';
    }) => api.reportUser(payload),
    onSuccess: () => showToast(REPORT_SUBMITTED_MESSAGE, 'success'),
    onError: (error: Error) => showToast(error.message, 'error'),
  });

  const chat = chatData?.data;
  const messages = messagesData?.data ?? [];
  const canSend = chat?.status === 'active' && isVerified;

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

  const onPeerTyping = useCallback((isTyping: boolean) => {
    setPeerTyping(isTyping);
  }, []);

  useChatSocket(id, onRealtimeMessage, onRealtimeRead, onPeerTyping);

  useEffect(() => {
    if (!socket || !id || !canSend) return;

    const emitTyping = (isTyping: boolean) => {
      socket.emit('chat.typing', { chatId: id, isTyping });
    };

    if (!draft.trim()) {
      emitTyping(false);
      return;
    }

    const now = Date.now();
    if (now - lastTypingEmitRef.current > 1200) {
      lastTypingEmitRef.current = now;
      emitTyping(true);
    }

    if (typingStopRef.current) {
      clearTimeout(typingStopRef.current);
    }
    typingStopRef.current = setTimeout(() => emitTyping(false), 2500);

    return () => {
      if (typingStopRef.current) {
        clearTimeout(typingStopRef.current);
      }
    };
  }, [socket, id, draft, canSend]);

  useEffect(() => {
    if (!id || !messagesData?.data.length) return;
    const unreadIds = messagesData.data
      .filter((message) => !message.isYou && message.status !== 'read')
      .map((message) => message.id);
    if (unreadIds.length) {
      void api
        .markChatRead(id, unreadIds)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: ['chats'] });
        })
        .catch(() => undefined);
    }
  }, [id, messagesData, queryClient]);

  const submitReport = (reason: 'harassment' | 'spam' | 'inappropriate' | 'underage' | 'other') => {
    if (!chat) return;
    reportMutation.mutate({
      reportedUserId: chat.otherUser.id,
      targetType: 'user',
      targetId: chat.otherUser.id,
      reason,
    });
  };

  const onSend = async () => {
    const content = draft.trim();
    if (!content || sendMutation.isPending) return;
    if (!ensureVerified()) return;
    await hapticLight();
    sendMutation.mutate(content);
  };

  if (chatLoading || messagesLoading) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if (chatError || messagesError || !chat) {
    return (
      <Screen>
        <AppHeader title="Chat" showBrand={false} onBack={() => router.back()} centerTitle />
        <EmptyState
          icon="chat-bubble"
          title="Chat unavailable"
          message="This conversation could not be loaded."
          action={<Button label="Go back" variant="ghost" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <AppHeader
          title={chat.otherUser.displayName}
          showBrand={false}
          onBack={() => router.back()}
          centerTitle
          right={
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} style={styles.menuBtn}>
              <AppIcon name="more-menu" size={20} color={colors.inkSecondary} />
            </Pressable>
          }
        />

        <View style={styles.threadHeader}>
          <Avatar
            name={chat.otherUser.displayName}
            uri={chat.otherUser.avatarUrl}
            size="sm"
            themeId={chat.otherUser.isPremium ? chat.otherUser.avatarTheme : null}
          />
          <View style={{ flex: 1 }}>
            <DisplayNameWithFlair
              name={chat.otherUser.displayName}
              gender={chat.otherUser.gender}
              isPremium={chat.otherUser.isPremium}
              isVerified={chat.otherUser.livenessVerified}
              reputationTier={chat.otherUser.reputationTier}
            />
            <Text style={styles.threadHint}>Private conversation</Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => <MessageBubble message={item} />}
          ListEmptyComponent={
            <EmptyState
              icon="chat-bubble"
              scene="chats"
              title="No messages yet"
              message={
                !isVerified
                  ? 'Complete face verification to send the first message.'
                  : 'Say hello — your conversation starts here.'
              }
              action={
                !isVerified ? (
                  <Button label="Verify now" onPress={() => router.push('/(setup)/liveness')} />
                ) : undefined
              }
            />
          }
        />

        {peerTyping ? (
          <View style={styles.typingRow}>
            <Text style={styles.typingText}>{chat.otherUser.displayName} is typing…</Text>
          </View>
        ) : null}

        {canSend ? (
          <View style={[styles.composer, { paddingBottom: bottomInset + spacing.md }]}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message..."
              placeholderTextColor={colors.inkMuted}
              multiline
              maxLength={2000}
            />
            <Pressable
              style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
              onPress={onSend}
              disabled={!draft.trim() || sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator color={colors.onAccent} size="small" />
              ) : (
                <AppIcon name="send" size={18} color={colors.onAccent} />
              )}
            </Pressable>
          </View>
        ) : chat.status !== 'active' ? (
          <View style={[styles.closedBanner, { paddingBottom: bottomInset + spacing.md }]}>
            <Text style={styles.closedText}>This conversation is closed.</Text>
          </View>
        ) : (
          <View style={[styles.verifyBanner, { paddingBottom: bottomInset + spacing.md }]}>
            <Text style={styles.verifyTitle}>Verify to send messages</Text>
            <Text style={styles.verifyBody}>
              Complete a quick face check so people know you are real before you chat.
            </Text>
            <Button label="Verify now" onPress={() => router.push('/(setup)/liveness')} />
          </View>
        )}
      </KeyboardAvoidingView>

      <ActionSheet
        visible={menuOpen}
        title="Chat options"
        onClose={() => setMenuOpen(false)}
        options={[
          {
            label: 'Report user',
            onPress: () => setTimeout(() => setReportOpen(true), 280),
          },
          {
            label: 'Block user',
            destructive: true,
            onPress: () => setTimeout(() => setBlockOpen(true), 280),
          },
          {
            label: 'End conversation',
            destructive: true,
            onPress: () => setTimeout(() => setDeleteOpen(true), 280),
          },
        ]}
      />

      <ActionSheet
        visible={reportOpen}
        title="Report user"
        subtitle="Why are you reporting this person?"
        footer={REPORT_SHEET_FOOTER}
        onClose={() => setReportOpen(false)}
        options={[
          { label: 'Harassment', onPress: () => submitReport('harassment') },
          { label: 'Spam', onPress: () => submitReport('spam') },
          { label: 'Inappropriate content', onPress: () => submitReport('inappropriate') },
          { label: 'Underage', onPress: () => submitReport('underage') },
          { label: 'Other', onPress: () => submitReport('other') },
        ]}
      />

      <ActionSheet
        visible={deleteOpen}
        title="End conversation?"
        subtitle="This closes the chat for both of you and ends the match. You can connect again through Icebreaker or Wall."
        onClose={() => setDeleteOpen(false)}
        options={[
          {
            label: 'End conversation',
            destructive: true,
            onPress: () => closeMutation.mutate(),
          },
        ]}
      />

      <ActionSheet
        visible={blockOpen}
        title="Block user?"
        subtitle={`${chat.otherUser.displayName} won't be able to message you, and you won't see each other.`}
        onClose={() => setBlockOpen(false)}
        options={[
          {
            label: 'Block',
            destructive: true,
            onPress: () => blockMutation.mutate(chat.otherUser.id),
          },
        ]}
      />

    </View>
  );
}

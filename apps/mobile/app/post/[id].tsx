import { distanceLabel } from '@pingme/shared';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../src/lib/api';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';
import { showToast } from '../../src/stores/toast-store';
import {
  AppHeader,
  Avatar,
  Button,
  DisplayNameWithFlair,
  Card,
  DistancePill,
  EmptyState,
  PostDetailSkeleton,
  SectionLabel,
} from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

function distanceTone(bucket: string): 'neutral' | 'near' | 'accent' {
  if (bucket === 'very_near') return 'near';
  if (bucket === '~200m' || bucket === '~300m') return 'accent';
  return 'neutral';
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [connectingReplyId, setConnectingReplyId] = useState<string | null>(null);
  const { ensureVerified, handleLivenessError } = useLivenessGate();

  const styles = useThemedStyles(({ colors }) => ({
    container: { flex: 1, backgroundColor: colors.background },
    list: {
      paddingHorizontal: spacing.container,
      paddingBottom: 100,
    },
    postCard: {
      marginTop: spacing.md,
      marginBottom: spacing.xl,
      padding: spacing.xl,
    },
    postHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    postMeta: { flex: 1, gap: 4 },
    author: {
      ...typography.headlineMd,
      color: colors.ink,
      fontSize: 17,
    },
    content: {
      ...typography.bodyLg,
      color: colors.ink,
      lineHeight: 28,
      letterSpacing: -0.1,
    },
    repliesHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    replyCount: {
      ...typography.caption,
      color: colors.inkTertiary,
    },
    replyThread: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    threadRail: {
      width: 16,
      alignItems: 'center',
      paddingTop: spacing.lg,
    },
    threadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accentMuted,
    },
    threadLine: {
      flex: 1,
      width: 1.5,
      backgroundColor: colors.divider,
      marginTop: spacing.xs,
      minHeight: 24,
    },
    replyCard: {
      flex: 1,
      padding: spacing.lg,
    },
    replyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    replyMeta: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    replyAuthor: {
      ...typography.bodySemiBold,
      color: colors.ink,
      flex: 1,
    },
    connectBtn: {
      minWidth: 88,
    },
    replyContent: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      lineHeight: 24,
      paddingLeft: 44,
    },
    composer: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.container,
      paddingTop: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    input: {
      flex: 1,
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
    sendDisabled: { opacity: 0.45 },
  }));

  const { data, isLoading, isError } = useQuery({
    queryKey: ['wall-post', id],
    queryFn: () => api.getWallPost(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteWallPost(id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['wall-posts'] });
      showToast('Post deleted', 'success');
      router.back();
    },
    onError: (error: Error) => showToast(error.message, 'error'),
  });

  const requestMatchMutation = useMutation({
    mutationFn: (replyId: string) =>
      api.requestMatch({ source: 'wall_reply', sourceReferenceId: replyId }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      router.push(`/match/${result.data.id}`);
    },
    onError: (error: Error) => {
      if (!handleLivenessError(error)) {
        showToast(error.message, 'error');
      }
    },
    onSettled: () => setConnectingReplyId(null),
  });

  const post = data?.data;

  const onReply = async () => {
    if (!id || !reply.trim()) return;
    if (!ensureVerified()) return;
    setSubmitting(true);
    try {
      await api.replyToPost(id, reply.trim());
      setReply('');
      await queryClient.invalidateQueries({ queryKey: ['wall-post', id] });
      await queryClient.invalidateQueries({ queryKey: ['wall-posts'] });
      showToast('Reply posted', 'success');
    } catch (error) {
      if (!handleLivenessError(error)) {
        const message = error instanceof ApiError ? error.message : 'Could not reply';
        showToast(message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onConnect = (replyId: string) => {
    if (!ensureVerified()) return;
    setConnectingReplyId(replyId);
    requestMatchMutation.mutate(replyId);
  };

  const onDeletePost = () => {
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(),
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <PostDetailSkeleton />
      </View>
    );
  }

  if (isError || !post) {
    return (
      <View style={styles.container}>
        <AppHeader title="Post" showBrand={false} onBack={() => router.back()} centerTitle />
        <EmptyState
          icon="document-text-outline"
          title="Post not found"
          message="This post may have been removed or is no longer nearby."
          action={<Button label="Go back" variant="ghost" onPress={() => router.back()} />}
        />
      </View>
    );
  }

  const authorName = post.author.isYou ? 'You' : post.author.displayName;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <AppHeader
        title="Post"
        showBrand={false}
        onBack={() => router.back()}
        centerTitle
        right={
          post.author.isYou ? (
            <Pressable
              onPress={onDeletePost}
              hitSlop={8}
              disabled={deleteMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Delete post"
            >
              {deleteMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Ionicons name="trash-outline" size={22} color={colors.error} />
              )}
            </Pressable>
          ) : undefined
        }
      />

      <FlatList
        data={post.replies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <Card style={styles.postCard} variant="elevated">
              <View style={styles.postHeader}>
                <Avatar
                  uri={post.author.avatarUrl}
                  name={authorName}
                  size="md"
                  themeId={post.author.isPremium ? post.author.avatarTheme : null}
                />
                <View style={styles.postMeta}>
                  <DisplayNameWithFlair name={authorName} isPremium={post.author.isPremium} />
                  <DistancePill label={distanceLabel(post.distanceBucket)} tone={distanceTone(post.distanceBucket)} />
                </View>
              </View>
              <Text style={styles.content}>{post.content}</Text>
            </Card>

            <View style={styles.repliesHeader}>
              <SectionLabel>Replies</SectionLabel>
              {post.replies.length > 0 ? (
                <Text style={styles.replyCount}>
                  {post.replies.length} {post.replies.length === 1 ? 'reply' : 'replies'}
                </Text>
              ) : null}
            </View>
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-outline"
            title="No replies yet"
            message="Be the first to respond to this post."
          />
        }
        renderItem={({ item, index }) => {
          const replyName = item.author.isYou ? 'You' : item.author.displayName;
          const isLast = index === post.replies.length - 1;

          return (
            <View style={styles.replyThread}>
              <View style={styles.threadRail}>
                <View style={styles.threadDot} />
                {!isLast ? <View style={styles.threadLine} /> : null}
              </View>
              <Card style={styles.replyCard} variant="flat">
                <View style={styles.replyHeader}>
                  <Avatar
                    uri={item.author.avatarUrl}
                    name={replyName}
                    size="sm"
                    themeId={item.author.isPremium ? item.author.avatarTheme : null}
                  />
                  <View style={styles.replyMeta}>
                    <DisplayNameWithFlair name={replyName} isPremium={item.author.isPremium} />
                    {!item.author.isYou ? (
                      <Button
                        label="Connect"
                        variant="outline"
                        size="sm"
                        onPress={() => onConnect(item.id)}
                        loading={connectingReplyId === item.id}
                        style={styles.connectBtn}
                      />
                    ) : null}
                  </View>
                </View>
                <Text style={styles.replyContent}>{item.content}</Text>
              </Card>
            </View>
          );
        }}
      />

      <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput
          style={styles.input}
          placeholder="Write a reply..."
          placeholderTextColor={colors.inkMuted}
          value={reply}
          onChangeText={setReply}
          maxLength={300}
        />
        <Pressable
          style={[styles.sendButton, (!reply.trim() || submitting) && styles.sendDisabled]}
          onPress={onReply}
          disabled={submitting || !reply.trim()}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onAccent} size="small" />
          ) : (
            <Ionicons name="send" size={18} color={colors.onAccent} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

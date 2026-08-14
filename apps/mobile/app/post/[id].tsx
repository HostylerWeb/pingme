import { distanceLabel } from '@pingme/shared';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../src/lib/api';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';
import { Button, Card, DistancePill, EmptyState, PostDetailSkeleton } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

function distanceTone(bucket: string): 'neutral' | 'near' | 'tertiary' {
  if (bucket === 'very_near') return 'near';
  if (bucket === '~200m' || bucket === '~300m') return 'tertiary';
  return 'neutral';
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [connectingReplyId, setConnectingReplyId] = useState<string | null>(null);
  const { ensureVerified, handleLivenessError } = useLivenessGate();

  const { data, isLoading } = useQuery({
    queryKey: ['wall-post', id],
    queryFn: () => api.getWallPost(id!),
    enabled: !!id,
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
        alert(error.message);
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
    } catch (error) {
      if (!handleLivenessError(error)) {
        const message = error instanceof ApiError ? error.message : 'Could not reply';
        alert(message);
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

  if (isLoading || !post) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <PostDetailSkeleton />
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
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.backBtn} />
      </View>

      <Card style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(post.author.isYou ? 'Y' : post.author.displayName).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.author}>{post.author.isYou ? 'You' : post.author.displayName}</Text>
            <DistancePill label={distanceLabel(post.distanceBucket)} tone={distanceTone(post.distanceBucket)} />
          </View>
        </View>
        <Text style={styles.content}>{post.content}</Text>
      </Card>

      <FlatList
        data={post.replies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.replies}
        ListHeaderComponent={<Text style={styles.repliesTitle}>Replies</Text>}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-outline"
            title="No replies yet"
            message="Be the first to respond to this post."
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.replyCard}>
            <View style={styles.replyHeader}>
              <Text style={styles.replyAuthor}>
                {item.author.isYou ? 'You' : item.author.displayName}
              </Text>
              {!item.author.isYou ? (
                <Pressable
                  style={styles.connectButton}
                  onPress={() => onConnect(item.id)}
                  disabled={connectingReplyId === item.id}
                >
                  {connectingReplyId === item.id ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <Text style={styles.connectText}>Connect</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.replyContent}>{item.content}</Text>
          </Card>
        )}
      />

      <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput
          style={styles.input}
          placeholder="Write a reply..."
          placeholderTextColor={colors.outline}
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
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
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
  postCard: { margin: spacing.container, marginBottom: spacing.md },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.headlineMd, color: colors.primary, fontSize: 18 },
  author: { ...typography.headlineMd, color: colors.onSurface, fontSize: 17, marginBottom: 4 },
  content: { ...typography.bodyLg, color: colors.onSurface, lineHeight: 26 },
  replies: { paddingHorizontal: spacing.container, paddingBottom: 100 },
  repliesTitle: { ...typography.headlineMd, color: colors.onSurface, marginBottom: spacing.md },
  replyCard: { marginBottom: spacing.md, padding: spacing.lg },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  replyAuthor: { ...typography.bodySemiBold, color: colors.onSurface, flex: 1 },
  connectButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 80,
    alignItems: 'center',
  },
  connectText: { ...typography.labelSm, color: colors.primary, textTransform: 'none', letterSpacing: 0 },
  replyContent: { ...typography.bodyMd, color: colors.onSurfaceVariant, lineHeight: 22 },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceBright,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  input: {
    flex: 1,
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
  sendDisabled: { opacity: 0.5 },
});

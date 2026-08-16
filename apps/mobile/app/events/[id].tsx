import { formatEventDateRange, distanceLabel } from '@pingme/shared';
import { AppIcon } from '../../src/components/ui/app-icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, EventComment, EventDetail } from '../../src/lib/api';
import { KeyboardComposerFooter } from '../../src/components/keyboard-composer-footer';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';
import { useScrollBottomPadding } from '../../src/hooks/use-tab-bar-insets';
import { REPORT_SHEET_FOOTER, REPORT_SUBMITTED_MESSAGE } from '../../src/lib/report-copy';
import { showToast } from '../../src/stores/toast-store';
import {
  ActionSheet,
  AppHeader,
  Avatar,
  Button,
  Card,
  DisplayNameWithFlair,
  DistancePill,
  EmptyState,
  Screen,
  SectionLabel,
} from '../../src/components/ui';
import { EventMapPreview } from '../../src/components/event-map';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

function RsvpPill({
  label,
  active,
  loading,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  loading?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => ({
    pill: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      borderWidth: active ? 2 : 1,
      borderColor: active ? colors.accent : colors.border,
      backgroundColor: active ? colors.accentSoft : colors.surface,
      opacity: disabled && !loading ? 0.5 : 1,
    },
    label: {
      ...typography.bodySemiBold,
      color: active ? colors.accent : colors.ink,
    },
  }));

  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={styles.pill}>
      {loading ? (
        <ActivityIndicator color={active ? colors.accent : colors.inkSecondary} size="small" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

function EventDetailsHeader({
  event,
  images,
  carouselWidth,
  carouselIndex,
  onCarouselIndex,
  pendingRsvp,
  messagePending,
  onRsvp,
  onMessageHost,
}: {
  event: EventDetail;
  images: EventDetail['images'];
  carouselWidth: number;
  carouselIndex: number;
  onCarouselIndex: (index: number) => void;
  pendingRsvp: 'going' | 'maybe' | null;
  messagePending: boolean;
  onRsvp: (status: 'going' | 'maybe') => void;
  onMessageHost: () => void;
}) {
  const styles = useThemedStyles(({ colors }) => ({
    hero: { height: 220, borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.lg },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.md },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.outlineVariant },
    dotActive: { backgroundColor: colors.accent },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    title: { ...typography.headlineLg, color: colors.ink, flex: 1 },
    meta: { ...typography.bodyMd, color: colors.inkSecondary, marginBottom: spacing.md },
    description: { ...typography.bodyLg, color: colors.ink, lineHeight: 26, marginBottom: spacing.lg },
    map: { height: 180, borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.lg },
    hostCard: { marginBottom: spacing.lg },
    hostRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    rsvpRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    counts: { ...typography.caption, color: colors.inkSecondary, marginBottom: spacing.lg },
    rsvpHint: { ...typography.caption, color: colors.inkTertiary, marginTop: -spacing.sm, marginBottom: spacing.lg },
  }));

  const viewerRsvp = event.viewerRsvp;

  return (
    <View>
      {images.length > 0 && carouselWidth > 0 ? (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={[styles.hero, { width: carouselWidth }]}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / carouselWidth);
              onCarouselIndex(index);
            }}
          >
            {images.map((img) => (
              <Image
                key={img.id}
                source={{ uri: img.url }}
                style={{ width: carouselWidth, height: 220 }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          {images.length > 1 ? (
            <View style={styles.dots}>
              {images.map((img, index) => (
                <View key={img.id} style={[styles.dot, index === carouselIndex && styles.dotActive]} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      <View style={styles.titleRow}>
        <Text style={styles.title}>{event.title}</Text>
        <DistancePill label={distanceLabel(event.distanceBucket)} />
      </View>
      <Text style={styles.meta}>{formatEventDateRange(event.startsAt, event.endsAt)}</Text>
      {event.placeName ? <Text style={styles.meta}>{event.placeName}</Text> : null}
      {event.address ? <Text style={styles.meta}>{event.address}</Text> : null}
      <Text style={styles.description}>{event.description}</Text>

      <View style={styles.map}>
        <EventMapPreview latitude={event.latitude} longitude={event.longitude} />
      </View>

      <Card style={styles.hostCard} variant="flat">
        <SectionLabel>Host</SectionLabel>
        <View style={styles.hostRow}>
          <Avatar uri={event.host.avatarUrl} name={event.host.displayName} size="md" />
          <DisplayNameWithFlair
            name={event.host.displayName}
            isPremium={event.host.isPremium}
            isVerified={event.host.livenessVerified}
          />
        </View>
        {event.allowMessages && !event.isHost ? (
          <Button
            label="Message host"
            variant="secondary"
            loading={messagePending}
            onPress={onMessageHost}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
      </Card>

      {!event.isHost && event.status === 'active' ? (
        <>
          <SectionLabel>RSVP</SectionLabel>
          <View style={styles.rsvpRow}>
            <RsvpPill
              label="Going"
              active={viewerRsvp === 'going'}
              loading={pendingRsvp === 'going'}
              onPress={() => onRsvp('going')}
              disabled={pendingRsvp !== null}
            />
            <RsvpPill
              label="Maybe"
              active={viewerRsvp === 'maybe'}
              loading={pendingRsvp === 'maybe'}
              onPress={() => onRsvp('maybe')}
              disabled={pendingRsvp !== null}
            />
          </View>
          {viewerRsvp ? (
            <Text style={styles.rsvpHint}>
              You marked {viewerRsvp === 'going' ? 'Going' : 'Maybe'} for this event.
            </Text>
          ) : null}
        </>
      ) : null}
      <Text style={styles.counts}>
        {event.goingCount} going · {event.maybeCount} maybe · {event.commentCount} comments
      </Text>
      <SectionLabel>Comments</SectionLabel>
    </View>
  );
}

function CommentRow({
  comment,
  replies,
  onReply,
  onDelete,
}: {
  comment: EventComment;
  replies: EventComment[];
  onReply: (comment: EventComment) => void;
  onDelete: (comment: EventComment) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(() => ({
    commentCard: { marginBottom: spacing.md, padding: spacing.lg },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    commentAuthor: { flex: 1 },
    commentTime: { ...typography.caption },
    commentBody: { ...typography.bodyMd, lineHeight: 22 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionLabel: { ...typography.caption },
    replyWrap: { marginLeft: spacing.xl, marginTop: spacing.sm },
    replyCard: { marginBottom: spacing.sm, padding: spacing.md },
  }));

  const renderComment = (item: EventComment, isReply = false) => (
    <Card key={item.id} style={isReply ? styles.replyCard : styles.commentCard} variant="flat">
      <View style={styles.commentHeader}>
        <Avatar
          uri={item.author.avatarUrl}
          name={item.author.displayName}
          size="sm"
          themeId={item.author.isPremium ? item.author.avatarTheme : null}
        />
        <View style={styles.commentAuthor}>
          <DisplayNameWithFlair
            name={item.author.isYou ? 'You' : item.author.displayName}
            gender={item.author.gender}
            isPremium={item.author.isPremium}
            isVerified={!item.author.isYou && item.author.livenessVerified}
          />
        </View>
        <Text style={[styles.commentTime, { color: colors.inkTertiary }]}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <Text style={[styles.commentBody, { color: colors.inkSecondary }]}>{item.content}</Text>
      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={() => onReply(item)}>
          <AppIcon name="chat-reply" size={14} color={colors.accent} />
          <Text style={[styles.actionLabel, { color: colors.accent }]}>Reply</Text>
        </Pressable>
        {item.author.isYou ? (
          <Pressable style={styles.actionBtn} onPress={() => onDelete(item)}>
            <AppIcon name="delete" size={14} color={colors.error} />
            <Text style={[styles.actionLabel, { color: colors.error }]}>Delete</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );

  return (
    <View>
      {renderComment(comment)}
      {replies.length > 0 ? (
        <View style={styles.replyWrap}>{replies.map((reply) => renderComment(reply, true))}</View>
      ) : null}
    </View>
  );
}

function groupEventComments(comments: EventComment[]) {
  const topLevel = comments.filter((comment) => !comment.parentId);
  const repliesByParent = new Map<string, EventComment[]>();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    const list = repliesByParent.get(comment.parentId) ?? [];
    list.push(comment);
    repliesByParent.set(comment.parentId, list);
  }
  return topLevel.map((comment) => ({
    comment,
    replies: repliesByParent.get(comment.id) ?? [],
  }));
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { ensureVerified, handleLivenessError } = useLivenessGate();
  const [comment, setComment] = useState('');
  const [replyTarget, setReplyTarget] = useState<EventComment | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventComment | null>(null);
  const [pendingRsvp, setPendingRsvp] = useState<'going' | 'maybe' | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const scrollBottomPadding = useScrollBottomPadding(96);
  const listRef = useRef<FlatList>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.getEvent(id!),
    enabled: Boolean(id),
  });

  const { data: commentsData } = useQuery({
    queryKey: ['event-comments', id],
    queryFn: () => api.getEventComments(id!),
    enabled: Boolean(id),
  });

  const event = data?.data;
  const comments = commentsData?.data ?? [];
  const threadedComments = useMemo(() => groupEventComments(comments), [comments]);

  const rsvpMutation = useMutation({
    mutationFn: (status: 'going' | 'maybe') => api.rsvpEvent(id!, status),
    onMutate: (status) => {
      setPendingRsvp(status);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event', id] });
      void queryClient.invalidateQueries({ queryKey: ['events-nearby'] });
      void queryClient.invalidateQueries({ queryKey: ['events-attending'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
    onSettled: () => setPendingRsvp(null),
  });

  const commentMutation = useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: string }) =>
      api.postEventComment(id!, content, parentId),
    onSuccess: async () => {
      setComment('');
      setReplyTarget(null);
      Keyboard.dismiss();
      await queryClient.invalidateQueries({ queryKey: ['event-comments', id] });
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.deleteEventComment(id!, commentId),
    onSuccess: async () => {
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['event-comments', id] });
      await queryClient.invalidateQueries({ queryKey: ['event', id] });
      showToast('Comment deleted', 'success');
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const messageHostMutation = useMutation({
    mutationFn: () => api.messageEventHost(id!),
    onSuccess: (result) => {
      router.push(`/chat/${result.data.chatId}`);
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const reportMutation = useMutation({
    mutationFn: (reason: 'harassment' | 'spam' | 'inappropriate' | 'underage' | 'other') =>
      api.reportUser({
        reportedUserId: event!.host.id,
        targetType: 'event',
        targetId: event!.id,
        reason,
      }),
    onSuccess: () => {
      setReportOpen(false);
      showToast(REPORT_SUBMITTED_MESSAGE, 'success');
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const styles = useThemedStyles(({ colors }) => ({
    content: { paddingHorizontal: spacing.container },
    commentsEmpty: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      marginBottom: spacing.lg,
      lineHeight: 22,
    },
    closedBanner: {
      paddingHorizontal: spacing.container,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    closedText: { ...typography.bodyMd, color: colors.inkSecondary, textAlign: 'center' },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingHorizontal: spacing.container,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    replyBanner: {
      paddingHorizontal: spacing.container,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    replyBannerText: { ...typography.caption, color: colors.inkSecondary, flex: 1 },
    input: {
      flex: 1,
      ...typography.bodyMd,
      color: colors.ink,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      maxHeight: 100,
    },
  }));

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={colors.accent} />
      </Screen>
    );
  }

  if (error || !event) {
    return (
      <Screen>
        <AppHeader title="Event" showBrand={false} onBack={() => router.back()} />
        <EmptyState icon="alert-circle" title="Event not found" message="It may have ended or been removed." />
      </Screen>
    );
  }

  const images = event.images.length > 0 ? event.images : [];

  const onRsvp = async (status: 'going' | 'maybe') => {
    try {
      await ensureVerified();
      rsvpMutation.mutate(status);
    } catch (err) {
      handleLivenessError(err);
    }
  };

  const onComment = async () => {
    if (!comment.trim()) return;
    try {
      await ensureVerified();
      commentMutation.mutate({
        content: comment.trim(),
        parentId: replyTarget?.id,
      });
    } catch (err) {
      handleLivenessError(err);
    }
  };

  const onMessageHost = async () => {
    try {
      await ensureVerified();
      messageHostMutation.mutate();
    } catch (err) {
      handleLivenessError(err);
    }
  };

  return (
    <Screen padded={false} edges={[]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <AppHeader
          title="Event"
          showBrand={false}
          onBack={() => router.back()}
          right={
            event.isHost ? (
              <Pressable onPress={() => router.push(`/events/${event.id}/edit`)}>
                <Text style={{ ...typography.bodySemiBold, color: colors.accent }}>Edit</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setReportOpen(true)}>
                <Text style={{ ...typography.bodySemiBold, color: colors.accent }}>Report</Text>
              </Pressable>
            )
          }
        />
        <FlatList
          ref={listRef}
          data={threadedComments}
          keyExtractor={(item) => item.comment.id}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]}
          onLayout={(e) => setCarouselWidth(e.nativeEvent.layout.width - spacing.container * 2)}
          ListHeaderComponent={
            <EventDetailsHeader
              event={event}
              images={images}
              carouselWidth={carouselWidth}
              carouselIndex={carouselIndex}
              onCarouselIndex={setCarouselIndex}
              pendingRsvp={pendingRsvp}
              messagePending={messageHostMutation.isPending}
              onRsvp={(status) => void onRsvp(status)}
              onMessageHost={() => void onMessageHost()}
            />
          }
          ListEmptyComponent={
            <Text style={styles.commentsEmpty}>No comments yet. Be the first to say something.</Text>
          }
          renderItem={({ item }) => (
            <CommentRow
              comment={item.comment}
              replies={item.replies}
              onReply={(target) => {
                setReplyTarget(target);
              }}
              onDelete={(target) => setDeleteTarget(target)}
            />
          )}
        />
        {event.status === 'active' ? (
          <>
            {replyTarget ? (
              <View style={styles.replyBanner}>
                <Text style={styles.replyBannerText}>
                  Replying to {replyTarget.author.isYou ? 'yourself' : replyTarget.author.displayName}
                </Text>
                <Pressable onPress={() => setReplyTarget(null)}>
                  <Text style={{ ...typography.caption, color: colors.accent }}>Cancel</Text>
                </Pressable>
              </View>
            ) : null}
            <KeyboardComposerFooter useTabBarInset={false} style={styles.composer}>
              <TextInput
                style={styles.input}
                placeholder={replyTarget ? 'Write a reply...' : 'Add a comment...'}
                placeholderTextColor={colors.inkTertiary}
                value={comment}
                onChangeText={setComment}
                multiline
              />
              <Button
                label="Post"
                size="sm"
                loading={commentMutation.isPending}
                onPress={() => void onComment()}
              />
            </KeyboardComposerFooter>
          </>
        ) : (
          <View style={[styles.closedBanner, { paddingBottom: scrollBottomPadding }]}>
            <Text style={styles.closedText}>Comments are closed for this event.</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      <ActionSheet
        visible={reportOpen}
        title="Report event"
        subtitle={REPORT_SHEET_FOOTER}
        onClose={() => setReportOpen(false)}
        options={[
          { label: 'Harassment', onPress: () => reportMutation.mutate('harassment') },
          { label: 'Spam', onPress: () => reportMutation.mutate('spam') },
          { label: 'Inappropriate', onPress: () => reportMutation.mutate('inappropriate') },
        ]}
      />

      <ActionSheet
        visible={deleteTarget !== null}
        title="Delete comment?"
        subtitle="This cannot be undone. Replies under this comment will also be removed."
        onClose={() => setDeleteTarget(null)}
        options={[
          {
            label: 'Delete comment',
            destructive: true,
            onPress: () => {
              if (deleteTarget) {
                deleteCommentMutation.mutate(deleteTarget.id);
              }
            },
          },
        ]}
      />
    </Screen>
  );
}

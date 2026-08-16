import { formatEventDateRange, distanceLabel } from '@pingme/shared';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';
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
import { KeyboardComposerFooter } from '../../src/components/keyboard-composer-footer';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

function RsvpPill({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useThemedStyles(({ colors }) => ({
    pill: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: active ? colors.accent : colors.border,
      backgroundColor: active ? colors.accentSoft : colors.surface,
      opacity: disabled ? 0.5 : 1,
    },
    label: {
      ...typography.bodySemiBold,
      color: active ? colors.accent : colors.ink,
    },
  }));

  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.pill}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { ensureVerified, handleLivenessError } = useLivenessGate();
  const [comment, setComment] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

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

  const rsvpMutation = useMutation({
    mutationFn: (status: 'going' | 'maybe') => api.rsvpEvent(id!, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event', id] });
      void queryClient.invalidateQueries({ queryKey: ['events-nearby'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => api.postEventComment(id!, content),
    onSuccess: () => {
      setComment('');
      void queryClient.invalidateQueries({ queryKey: ['event-comments', id] });
      void queryClient.invalidateQueries({ queryKey: ['event', id] });
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
    content: { paddingHorizontal: spacing.container, paddingBottom: spacing.section },
    hero: { height: 220, borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.lg },
    heroImage: { width: '100%', height: '100%' },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.md },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.outlineVariant },
    dotActive: { backgroundColor: colors.accent },
    title: { ...typography.headlineLg, color: colors.ink, marginBottom: spacing.sm },
    meta: { ...typography.bodyMd, color: colors.inkSecondary, marginBottom: spacing.md },
    description: { ...typography.bodyLg, color: colors.ink, lineHeight: 26, marginBottom: spacing.lg },
    map: { height: 180, borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.lg },
    hostCard: { marginBottom: spacing.lg },
    hostRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    hostName: { ...typography.bodySemiBold, color: colors.ink, flex: 1 },
    rsvpRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    counts: { ...typography.caption, color: colors.inkSecondary, marginBottom: spacing.lg },
    commentCard: { marginBottom: spacing.md, padding: spacing.lg },
    commentAuthor: { ...typography.bodySemiBold, color: colors.ink, marginBottom: spacing.xs },
    commentBody: { ...typography.bodyMd, color: colors.inkSecondary, lineHeight: 22 },
    composer: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.container,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
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
      commentMutation.mutate(comment.trim());
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
      <ScrollView contentContainerStyle={styles.content}>
        {images.length > 0 ? (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.hero}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
                setCarouselIndex(index);
              }}
            >
              {images.map((img) => (
                <Image key={img.id} source={{ uri: img.url }} style={{ width: 360, height: 220 }} resizeMode="cover" />
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

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <Text style={styles.title}>{event.title}</Text>
          <DistancePill label={distanceLabel(event.distanceBucket)} />
        </View>
        <Text style={styles.meta}>{formatEventDateRange(event.startsAt, event.endsAt)}</Text>
        {event.placeName ? <Text style={styles.meta}>{event.placeName}</Text> : null}
        {event.address ? <Text style={styles.meta}>{event.address}</Text> : null}
        <Text style={styles.description}>{event.description}</Text>

        <View style={styles.map}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={{
              latitude: event.latitude,
              longitude: event.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <Marker coordinate={{ latitude: event.latitude, longitude: event.longitude }} />
          </MapView>
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
              loading={messageHostMutation.isPending}
              onPress={() => void onMessageHost()}
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
                active={event.viewerRsvp === 'going'}
                onPress={() => void onRsvp('going')}
                disabled={rsvpMutation.isPending}
              />
              <RsvpPill
                label="Maybe"
                active={event.viewerRsvp === 'maybe'}
                onPress={() => void onRsvp('maybe')}
                disabled={rsvpMutation.isPending}
              />
            </View>
          </>
        ) : null}
        <Text style={styles.counts}>
          {event.goingCount} going · {event.maybeCount} maybe · {event.commentCount} comments
        </Text>

        <SectionLabel>Comments</SectionLabel>
        {comments.map((item) => (
          <Card key={item.id} style={styles.commentCard} variant="flat">
            <Text style={styles.commentAuthor}>{item.author.displayName}</Text>
            <Text style={styles.commentBody}>{item.content}</Text>
          </Card>
        ))}
      </ScrollView>

      <KeyboardComposerFooter>
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
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
        </View>
      </KeyboardComposerFooter>

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
    </Screen>
  );
}

import { distanceLabel, WALL_POST_MAX_AGE_HOURS } from '@pingme/shared';
import { AppIcon } from '../../src/components/ui/app-icon';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, WallNotificationItem, WallPost } from '../../src/lib/api';
import { useLocationPing } from '../../src/hooks/use-location-ping';
import { forceLocationPing } from '../../src/lib/throttled-location-ping';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';
import { useAuthStore } from '../../src/stores/auth-store';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
import { useRequiredDistanceConfig } from '../../src/hooks/use-app-config';
import { useNotificationSummary } from '../../src/hooks/use-notification-summary';
import { useWallNotifications } from '../../src/hooks/use-wall-notifications';
import { useSocketAwareRefetchInterval } from '../../src/hooks/use-socket-aware-interval';
import { DeletionScheduledBanner } from '../../src/components/deletion-scheduled-banner';
import { WallNotificationsPanel } from '../../src/components/wall-notifications-panel';
import { GenderSymbol } from '../../src/components/ui/gender-symbol';
import { NearbyRadiusPicker, wallRadiusRangeLabelFromConfig } from '../../src/components/nearby-radius-picker';
import { showToast } from '../../src/stores/toast-store';
import { formatWallPostTime } from '../../src/lib/format-post-time';
import {
  AppHeader,
  ActionSheet,
  AppSwitch,
  AvailableChip,
  Avatar,
  BottomSheet,
  Button,
  DistancePill,
  DisplayNameWithFlair,
  EmptyState,
  Input,
  LivenessBanner,
  ListSkeleton,
  Screen,
  SectionLabel,
} from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

function distanceTone(bucket: string): 'neutral' | 'near' | 'accent' {
  if (bucket === 'very_near') return 'near';
  if (bucket === '~200m' || bucket === '~300m') return 'accent';
  return 'neutral';
}

function PostRow({
  post,
  onPress,
  onLongPress,
}: {
  post: WallPost;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();

  const styles = useThemedStyles(({ colors }) => ({
    postCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    postPressed: { opacity: 0.92 },
    postTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
    postMeta: { flex: 1, gap: 6 },
    postTime: { ...typography.caption, color: colors.inkTertiary },
    postContent: {
      ...typography.bodyLg,
      color: colors.ink,
      lineHeight: 26,
      marginBottom: spacing.md,
    },
    postFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    replyCount: { ...typography.caption, color: colors.inkTertiary },
  }));

  const name = post.author.isYou ? 'You' : post.author.displayName;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.postCard, pressed && styles.postPressed]}
    >
      <View style={styles.postTop}>
        <Avatar
          uri={post.author.avatarUrl}
          name={post.author.displayName}
          size="sm"
          themeId={post.author.isPremium ? post.author.avatarTheme : null}
        />
        <View style={styles.postMeta}>
          <DisplayNameWithFlair
            name={name}
            gender={post.author.gender}
            isPremium={post.author.isPremium}
            isVerified={!post.author.isYou && post.author.livenessVerified}
            reputationTier={post.author.reputationTier}
          />
          <Text style={styles.postTime}>{formatWallPostTime(post.createdAt)}</Text>
          <DistancePill label={distanceLabel(post.distanceBucket)} tone={distanceTone(post.distanceBucket)} />
        </View>
      </View>
      <Text style={styles.postContent}>{post.content}</Text>
      <View style={styles.postFooter}>
        <AppIcon name="chat-reply" size={15} color={colors.inkTertiary} />
        <Text style={styles.replyCount}>
          {post.replyCount === 0 ? 'Reply' : `${post.replyCount} ${post.replyCount === 1 ? 'reply' : 'replies'}`}
        </Text>
      </View>
    </Pressable>
  );
}

function wallSubtitle(radiusMeters: number) {
  return `Within ~${radiusMeters}m · last ${WALL_POST_MAX_AGE_HOURS}h`;
}

export default function WallScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { contentBottom } = useTabBarInsets();
  const { colors } = useTheme();
  const [screenFocused, setScreenFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );
  const { coords, error: locationError, permissionGranted, requestPermission, ping } = useLocationPing(screenFocused);
  const [modalOpen, setModalOpen] = useState(false);
  const [radiusSheetOpen, setRadiusSheetOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [showPhoto, setShowPhoto] = useState(false);
  const [posting, setPosting] = useState(false);
  const [deletePostTarget, setDeletePostTarget] = useState<WallPost | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { ensureVerified, handleLivenessError, isVerified } = useLivenessGate();
  const user = useAuthStore((s) => s.user);

  const openPostModal = () => {
    if (!ensureVerified()) return;
    setShowPhoto(Boolean(user?.profile?.avatarUrl));
    setModalOpen(true);
  };

  const styles = useThemedStyles(({ colors, shadows }) => ({
    center: { flex: 1, justifyContent: 'center' },
    skeletonWrap: { paddingHorizontal: spacing.container },
    headerBlock: { paddingBottom: spacing.md },
    nearbySection: { marginBottom: spacing.lg },
    nearbyScroll: { gap: spacing.lg, paddingRight: spacing.container },
    nearbyPerson: { alignItems: 'center', width: 64, gap: 6 },
    nearbyName: {
      ...typography.caption,
      color: colors.inkSecondary,
      textAlign: 'center',
      maxWidth: 64,
    },
    list: { paddingHorizontal: spacing.container, gap: spacing.md },
    separator: { height: spacing.md },
    fab: {
      position: 'absolute',
      right: spacing.container,
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.fab,
    },
    sheetBtn: { marginBottom: spacing.md },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      marginBottom: spacing.lg,
      paddingVertical: spacing.sm,
    },
    toggleLabel: { ...typography.bodyMd, color: colors.ink },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerIconBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerIconBtnPressed: { opacity: 0.85 },
    bellBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    bellBadgeText: { ...typography.labelSm, color: colors.onAccent, fontSize: 10 },
  }));

  const { wallUnread } = useNotificationSummary();
  const {
    data: notificationsData,
    isLoading: notificationsLoading,
  } = useWallNotifications(screenFocused);

  const markNotificationsReadMutation = useMutation({
    mutationFn: (postId: string) => api.markWallNotificationsRead(postId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
      await queryClient.invalidateQueries({ queryKey: ['wall-notifications'] });
    },
  });

  const openWallNotification = (item: WallNotificationItem) => {
    setNotificationsOpen(false);
    markNotificationsReadMutation.mutate(item.postId);
    router.push(`/post/${item.postId}`);
  };

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    error: wallError,
  } = useInfiniteQuery({
    queryKey: ['wall-posts'],
    queryFn: async ({ pageParam }) => {
      const page = pageParam ?? 1;
      if (page === 1 && coords) {
        try {
          await forceLocationPing(coords);
        } catch {
          // Wall may still work if a prior ping synced location to the server.
        }
      }
      try {
        return await api.getWallPosts(page, 20);
      } catch (error) {
        if (error instanceof ApiError && error.status === 400 && coords) {
          await forceLocationPing(coords);
          return await api.getWallPosts(page, 20);
        }
        throw error;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.hasMore === false) return undefined;
      if ((lastPage.data?.length ?? 0) < (lastPage.meta.limit ?? 20)) return undefined;
      return (lastPage.meta.page ?? 1) + 1;
    },
    enabled: !!coords,
  });

  const posts = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );
  const wallLoadErrorMessage = useMemo(() => {
    if (!wallError) return null;
    if (wallError instanceof ApiError) {
      if (wallError.message.toLowerCase().includes('location')) {
        return 'Your location is not synced yet. Tap Try again — if it keeps failing, open Settings and ensure location is allowed for PingMe.';
      }
      return wallError.message;
    }
    return 'Could not load posts';
  }, [wallError]);
  const presenceRefetchInterval = useSocketAwareRefetchInterval({
    foreground: 60_000,
    connected: 5 * 60_000,
    mode: 'slow',
  });
  const nearbyUsersRefetchInterval = useSocketAwareRefetchInterval({
    foreground: 60_000,
    connected: 5 * 60_000,
    mode: 'slow',
  });

  const { data: presenceData } = useQuery({
    queryKey: ['presence-status'],
    queryFn: () => api.getPresenceStatus(),
    refetchInterval: presenceRefetchInterval,
    refetchIntervalInBackground: false,
  });

  const serverAvailable = presenceData?.data.isAvailable ?? false;

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        if (coords) {
          try {
            await forceLocationPing(coords);
          } catch {
            // Surface via wall query error state.
          }
        }
        await queryClient.invalidateQueries({ queryKey: ['presence-status'] });
        await queryClient.invalidateQueries({ queryKey: ['nearby-users'] });
        await queryClient.invalidateQueries({ queryKey: ['wall-posts'] });
      })();
    }, [coords, queryClient]),
  );

  const { data: nearbyUsersData } = useQuery({
    queryKey: ['nearby-users'],
    queryFn: () => api.getNearbyUsers(),
    enabled: !!coords,
    refetchInterval: nearbyUsersRefetchInterval,
    refetchIntervalInBackground: false,
  });

  const { data: settingsData } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => api.getSettings(),
  });

  const distanceConfig = useRequiredDistanceConfig();
  const wallDistance = distanceConfig.wall;
  const wallDefaultMeters = wallDistance.defaultMeters;
  const wallRangeLabel = wallRadiusRangeLabelFromConfig(
    wallDistance.minMeters,
    wallDistance.maxMeters,
  );
  const icebreakerRadiusMeters = distanceConfig.icebreaker.radiusMeters;

  const radiusMutation = useMutation({
    mutationFn: (radiusMeters: number) => api.updateSettings({ radiusMeters }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      queryClient.invalidateQueries({ queryKey: ['wall-posts'] });
      queryClient.invalidateQueries({ queryKey: ['nearby-users'] });
      showToast('Nearby radius updated', 'success');
      setRadiusSheetOpen(false);
    },
    onError: () => {
      showToast('Could not update radius', 'error');
    },
  });

  const nearbyUsers = nearbyUsersData?.data.users ?? [];
  const radiusMeters =
    settingsData?.data.radiusMeters ?? nearbyUsersData?.data.radiusMeters ?? wallDefaultMeters;

  const onCreatePost = useCallback(async () => {
    if (!coords || !draft.trim()) return;
    if (!ensureVerified()) return;
    setPosting(true);
    try {
      await api.createWallPost({
        content: draft.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        showPhoto,
      });
      setDraft('');
      setShowPhoto(false);
      setModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['wall-posts'] });
      showToast('Posted to the nearby wall', 'success');
    } catch (error) {
      if (!handleLivenessError(error)) {
        showToast(error instanceof ApiError ? error.message : 'Could not post', 'error');
      }
    } finally {
      setPosting(false);
    }
  }, [coords, draft, showPhoto, queryClient, handleLivenessError, ensureVerified]);

  const onDeletePost = (post: WallPost) => {
    setDeletePostTarget(post);
  };

  const confirmDeletePost = async () => {
    if (!deletePostTarget) return;
    try {
      await api.deleteWallPost(deletePostTarget.id);
      await queryClient.invalidateQueries({ queryKey: ['wall-posts'] });
      showToast('Post deleted', 'success');
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Could not delete post', 'error');
    } finally {
      setDeletePostTarget(null);
    }
  };

  if (locationError && !coords) {
    const permissionDenied = permissionGranted === false;
    return (
      <Screen padded={false}>
        <AppHeader
          large
          title="Wall"
          showBrand={false}
          subtitle={wallSubtitle(radiusMeters)}
        />
        <View style={styles.center}>
          <EmptyState
            icon={permissionDenied ? 'location' : 'navigate'}
            scene="location"
            title={permissionDenied ? 'Location needed' : 'Location unavailable'}
            message={
              permissionDenied
                ? `PingMe needs your location to show posts and people within about ${radiusMeters} meters.`
                : locationError
            }
            action={
              <Button
                label={permissionDenied ? 'Enable location' : 'Try again'}
                onPress={permissionDenied ? requestPermission : () => void ping({ preferCached: true })}
              />
            }
          />
        </View>
      </Screen>
    );
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      {!isVerified ? <LivenessBanner /> : null}
      <DeletionScheduledBanner />

      {nearbyUsers.length > 0 ? (
        <View style={styles.nearbySection}>
          <SectionLabel>{`${nearbyUsers.length} online nearby`}</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyScroll}>
            {nearbyUsers.map((person) => (
              <View key={person.userId} style={styles.nearbyPerson}>
                <Avatar
                  uri={person.avatarUrl}
                  name={person.displayName}
                  size="lg"
                  themeId={person.isPremium ? person.avatarTheme : null}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: 64, justifyContent: 'center' }}>
                  <GenderSymbol gender={person.gender} size={11} />
                  <Text style={styles.nearbyName} numberOfLines={1}>
                    {person.displayName}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader
        large
        title="Wall"
        showBrand={false}
        subtitle={wallSubtitle(radiusMeters)}
        right={
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setNotificationsOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Wall notifications"
              style={({ pressed }) => [styles.headerIconBtn, pressed && styles.headerIconBtnPressed]}
            >
              <AppIcon name="notifications" size={20} color={colors.ink} />
              {wallUnread > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{wallUnread > 9 ? '9+' : wallUnread}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => setRadiusSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Nearby radius, ${radiusMeters} meters`}
              style={({ pressed }) => [styles.headerIconBtn, pressed && styles.headerIconBtnPressed]}
            >
              <AppIcon name="settings" size={20} color={colors.ink} />
            </Pressable>
            <AvailableChip isAvailable={serverAvailable} />
          </View>
        }
      />

      {isLoading ? (
        <View style={[styles.skeletonWrap, { paddingBottom: contentBottom }]}>
          {listHeader}
          <ListSkeleton count={4} variant="post" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          refreshControl={<RefreshControl refreshing={isRefetching && !isFetchingNextPage} onRefresh={() => void refetch()} tintColor={colors.accent} />}
          contentContainerStyle={[styles.list, { paddingBottom: contentBottom + 72 }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: spacing.lg }}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="megaphone"
              scene="wall"
              title={isError ? 'Couldn’t load posts' : 'No posts yet'}
              message={
                isError
                  ? wallLoadErrorMessage ?? 'Check your connection and pull to try again.'
                  : `Be the first to say something to people within about ${radiusMeters} meters. Posts older than ${WALL_POST_MAX_AGE_HOURS} hours leave the feed.`
              }
              action={
                <Button
                  label={isError ? 'Try again' : 'Write a post'}
                  onPress={isError ? () => void refetch() : openPostModal}
                />
              }
            />
          }
          renderItem={({ item }) => (
            <PostRow
              post={item}
              onPress={() => router.push(`/post/${item.id}`)}
              onLongPress={item.author.isYou ? () => onDeletePost(item) : undefined}
            />
          )}
        />
      )}

      <Pressable
        style={[styles.fab, { bottom: contentBottom }]}
        onPress={openPostModal}
      >
        <AppIcon name="add" size={28} color={colors.onAccent} />
      </Pressable>

      <BottomSheet
        visible={radiusSheetOpen}
        title="Nearby radius"
        subtitle={
          radiusMeters === wallDefaultMeters
            ? `How far you see the Wall and who can spot you nearby (${wallRangeLabel}). Saved to your account.`
            : `Your radius is ${radiusMeters}m (app default is ${wallDefaultMeters}m). Saved to your account — reinstalling won't change it.`
        }
        onClose={() => setRadiusSheetOpen(false)}
      >
        <NearbyRadiusPicker
          value={radiusMeters}
          disabled={radiusMutation.isPending}
          optionsMeters={wallDistance.pickerOptionsMeters}
          defaultMeters={wallDistance.defaultMeters}
          minMeters={wallDistance.minMeters}
          maxMeters={wallDistance.maxMeters}
          onChange={(meters) => radiusMutation.mutate(meters)}
        />
        {radiusMeters !== wallDefaultMeters ? (
          <Button
            label={`Use default (${wallDefaultMeters}m)`}
            variant="ghost"
            onPress={() => radiusMutation.mutate(wallDefaultMeters)}
            loading={radiusMutation.isPending}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
      </BottomSheet>

      <WallNotificationsPanel
        visible={notificationsOpen}
        loading={notificationsLoading}
        items={notificationsData?.data.items ?? []}
        onClose={() => setNotificationsOpen(false)}
        onOpenItem={openWallNotification}
      />

      <BottomSheet visible={modalOpen} title="Post to the wall" subtitle="Only people nearby will see this." onClose={() => setModalOpen(false)}>
        <Input
          placeholder="Anyone else here?"
          multiline
          maxLength={500}
          value={draft}
          onChangeText={setDraft}
          hint={`${draft.length}/500`}
        />
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Show my photo</Text>
          <AppSwitch variant="accent" value={showPhoto} onValueChange={setShowPhoto} />
        </View>
        <Button label="Post" onPress={onCreatePost} loading={posting} disabled={!draft.trim()} />
      </BottomSheet>

      <ActionSheet
        visible={deletePostTarget !== null}
        title="Delete post?"
        subtitle="This cannot be undone."
        onClose={() => setDeletePostTarget(null)}
        options={[
          {
            label: 'Delete post',
            destructive: true,
            onPress: () => void confirmDeletePost(),
          },
        ]}
      />
    </Screen>
  );
}

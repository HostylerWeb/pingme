import { distanceLabel, WALL_POST_MAX_AGE_HOURS } from '@pingme/shared';
import { AppIcon } from '../../src/components/ui/app-icon';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Alert,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, WallPost } from '../../src/lib/api';
import {
  requestBackgroundPermissions,
  stopBackgroundLocation,
  syncBackgroundLocationWithAvailability,
} from '../../src/lib/background-location';
import { useLocationPing } from '../../src/hooks/use-location-ping';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
import { useRequiredDistanceConfig } from '../../src/hooks/use-app-config';
import { useSocketAwareRefetchInterval } from '../../src/hooks/use-socket-aware-interval';
import { NearbyRadiusPicker, wallRadiusRangeLabelFromConfig } from '../../src/components/nearby-radius-picker';
import { showToast } from '../../src/stores/toast-store';
import {
  AppHeader,
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
    postRow: { paddingVertical: spacing.xs },
    postPressed: { opacity: 0.85 },
    postTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
    postMeta: { flex: 1, gap: 4 },
    authorName: { ...typography.bodySemiBold, color: colors.ink },
    postContent: {
      ...typography.bodyLg,
      color: colors.ink,
      lineHeight: 26,
      marginBottom: spacing.md,
      paddingLeft: 52,
    },
    postFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 52,
    },
    replyCount: { ...typography.caption, color: colors.inkTertiary },
  }));

  const name = post.author.isYou ? 'You' : post.author.displayName;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.postRow, pressed && styles.postPressed]}
    >
      <View style={styles.postTop}>
        <Avatar
          uri={post.author.avatarUrl}
          name={name}
          size="sm"
          themeId={post.author.isPremium ? post.author.avatarTheme : null}
        />
        <View style={styles.postMeta}>
          <DisplayNameWithFlair
            name={name}
            isPremium={post.author.isPremium}
            isVerified={!post.author.isYou && post.author.livenessVerified}
          />
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
  return `A local feed within ~${radiusMeters}m from the last ${WALL_POST_MAX_AGE_HOURS} hours. Post, read replies, and chat after you connect.`;
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [showPhoto, setShowPhoto] = useState(false);
  const [posting, setPosting] = useState(false);
  const [availableOn, setAvailableOn] = useState(false);
  const { ensureVerified, handleLivenessError, isVerified } = useLivenessGate();

  const styles = useThemedStyles(({ colors, shadows }) => ({
    center: { flex: 1, justifyContent: 'center' },
    skeletonWrap: { paddingHorizontal: spacing.container },
    headerBlock: { paddingBottom: spacing.md },
    presenceBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presenceCopy: { flex: 1 },
    presenceTitle: { ...typography.bodySemiBold, color: colors.ink, fontSize: 16 },
    presenceHint: { ...typography.caption, color: colors.inkSecondary, marginTop: 2 },
    nearbySection: { marginBottom: spacing.lg },
    nearbyScroll: { gap: spacing.lg, paddingRight: spacing.container },
    nearbyPerson: { alignItems: 'center', width: 64, gap: 6 },
    nearbyName: {
      ...typography.caption,
      color: colors.inkSecondary,
      textAlign: 'center',
      maxWidth: 64,
    },
    list: { paddingHorizontal: spacing.container },
    separator: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
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
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
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
  }));

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['wall-posts'],
    queryFn: ({ pageParam }) => api.getWallPosts(pageParam, 20),
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
  const presenceRefetchInterval = useSocketAwareRefetchInterval({
    foreground: 60_000,
    ignoreSocket: true,
  });
  const nearbyUsersRefetchInterval = useSocketAwareRefetchInterval({
    foreground: 30_000,
    ignoreSocket: true,
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
      void queryClient.invalidateQueries({ queryKey: ['presence-status'] });
    }, [queryClient]),
  );

  useEffect(() => {
    if (presenceData?.data == null) return;
    const isAvailable = presenceData.data.isAvailable;
    setAvailableOn(isAvailable);
    void syncBackgroundLocationWithAvailability(isAvailable);
  }, [presenceData?.data]);

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

  const availabilityMutation = useMutation({
    mutationFn: async (isAvailable: boolean) => {
      if (isAvailable) {
        const foregroundGranted = await requestPermission();
        if (!foregroundGranted) {
          throw new Error('Location permission is required to go visible on the Wall.');
        }
        if (!coords) {
          const location = await ping({ preferCached: true });
          if (!location) {
            throw new Error('Could not get your location. Try again in a moment.');
          }
        }
        const backgroundGranted = await requestBackgroundPermissions();
        if (!backgroundGranted) {
          showToast(
            'Visible with foreground location only. Allow Always/background location for updates when the app is closed.',
            'info',
          );
        }
      } else {
        void stopBackgroundLocation();
      }
      return api.setAvailable(isAvailable);
    },
    onMutate: (isAvailable) => setAvailableOn(isAvailable),
    onSuccess: (_data, isAvailable) => {
      void syncBackgroundLocationWithAvailability(isAvailable);
      queryClient.invalidateQueries({ queryKey: ['presence-status'] });
      queryClient.invalidateQueries({ queryKey: ['nearby-users'] });
      setConfirmOpen(false);
      showToast(
        isAvailable ? "You're visible on the Wall" : "You're hidden on the Wall",
        isAvailable ? 'success' : 'info',
      );
    },
    onError: (error: Error) => {
      setAvailableOn(serverAvailable);
      if (!handleLivenessError(error)) {
        showToast(error.message, 'error');
      }
      setConfirmOpen(false);
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

  const handleAvailabilityToggle = (on: boolean) => {
    if (on) {
      if (!ensureVerified()) return;
      setConfirmOpen(true);
      return;
    }
    setAvailableOn(false);
    availabilityMutation.mutate(false);
  };

  const onDeletePost = (post: WallPost) => {
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteWallPost(post.id);
            await queryClient.invalidateQueries({ queryKey: ['wall-posts'] });
            showToast('Post deleted', 'success');
          } catch (error) {
            showToast(error instanceof ApiError ? error.message : 'Could not delete post', 'error');
          }
        },
      },
    ]);
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
      <View style={styles.presenceBar}>
        <View style={styles.presenceCopy}>
          <Text style={styles.presenceTitle}>{availableOn ? 'Visible on Wall' : 'Hidden on Wall'}</Text>
          <Text style={styles.presenceHint}>
            {availableOn
              ? `Others within ${radiusMeters}m can see you're around on the Wall`
              : 'Turn on to show up in the nearby list on the Wall — separate from Break the ice'}
          </Text>
        </View>
        <AppSwitch
          variant="online"
          value={availableOn}
          onValueChange={handleAvailabilityToggle}
          disabled={availabilityMutation.isPending}
        />
      </View>

      {!isVerified ? <LivenessBanner /> : null}

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
                <Text style={styles.nearbyName} numberOfLines={1}>
                  {person.displayName}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <SectionLabel>Nearby wall</SectionLabel>
      <Text style={styles.presenceHint}>
        Showing posts from the last {WALL_POST_MAX_AGE_HOURS} hours. Scroll for more.
      </Text>
    </View>
  );

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader
        title="Wall"
        showBrand={false}
        subtitle={wallSubtitle(radiusMeters)}
        right={
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setRadiusSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Nearby radius, ${radiusMeters} meters`}
              style={({ pressed }) => [styles.headerIconBtn, pressed && styles.headerIconBtnPressed]}
            >
              <AppIcon name="settings" size={20} color={colors.ink} />
            </Pressable>
            <AvailableChip isAvailable={availableOn} />
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
              title="No posts yet"
              message={`Be the first to say something to people within about ${radiusMeters} meters. Posts older than ${WALL_POST_MAX_AGE_HOURS} hours leave the feed.`}
              action={
                <Button
                  label="Write a post"
                  onPress={() => {
                    if (!ensureVerified()) return;
                    setModalOpen(true);
                  }}
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
        onPress={() => {
          if (!ensureVerified()) return;
          setModalOpen(true);
        }}
      >
        <AppIcon name="add" size={28} color={colors.onAccent} />
      </Pressable>

      <BottomSheet
        visible={confirmOpen}
        title="Visible on Wall?"
        subtitle={`People within ~${radiusMeters}m can see you're on the Wall while you use PingMe. "Allow only while using the app" is enough — no extra permission needed.`}
        onClose={() => setConfirmOpen(false)}
      >
        <Button
          label="Turn on"
          onPress={() => availabilityMutation.mutate(true)}
          loading={availabilityMutation.isPending}
          style={styles.sheetBtn}
        />
        <Button label="Not now" variant="ghost" onPress={() => setConfirmOpen(false)} />
      </BottomSheet>

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
    </Screen>
  );
}

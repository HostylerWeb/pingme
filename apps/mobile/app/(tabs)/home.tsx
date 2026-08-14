import { distanceLabel } from '@pingme/shared';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Alert,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, WallPost } from '../../src/lib/api';
import {
  stopBackgroundLocation,
  syncBackgroundLocationWithAvailability,
} from '../../src/lib/background-location';
import { useLocationPing } from '../../src/hooks/use-location-ping';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
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
          <DisplayNameWithFlair name={name} isPremium={post.author.isPremium} />
          <DistancePill label={distanceLabel(post.distanceBucket)} tone={distanceTone(post.distanceBucket)} />
        </View>
      </View>
      <Text style={styles.postContent}>{post.content}</Text>
      <View style={styles.postFooter}>
        <Ionicons name="chatbubble-outline" size={15} color={colors.inkTertiary} />
        <Text style={styles.replyCount}>
          {post.replyCount === 0 ? 'Reply' : `${post.replyCount} ${post.replyCount === 1 ? 'reply' : 'replies'}`}
        </Text>
      </View>
    </Pressable>
  );
}

const WALL_SUBTITLE =
  'A local feed within ~250m. Post, read replies, and chat after you connect.';

export default function WallScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { contentBottom } = useTabBarInsets();
  const { colors } = useTheme();
  const { coords, error: locationError, permissionGranted, requestPermission, ping } = useLocationPing(true);
  const [modalOpen, setModalOpen] = useState(false);
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
      backgroundColor: colors.surface,
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
  }));

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['wall-posts'],
    queryFn: () => api.getWallPosts(),
    enabled: !!coords,
  });

  const { data: presenceData } = useQuery({
    queryKey: ['presence-status'],
    queryFn: () => api.getPresenceStatus(),
    refetchInterval: 60_000,
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
    refetchInterval: 30_000,
  });

  const availabilityMutation = useMutation({
    mutationFn: async (isAvailable: boolean) => {
      if (isAvailable) {
        const foregroundGranted = await requestPermission();
        if (!foregroundGranted) {
          throw new Error('Location permission is required to go visible on the Wall.');
        }
        await ping();
      } else {
        await stopBackgroundLocation();
      }
      return api.setAvailable(isAvailable);
    },
    onMutate: (isAvailable) => setAvailableOn(isAvailable),
    onSuccess: async (_data, isAvailable) => {
      await syncBackgroundLocationWithAvailability(isAvailable);
      queryClient.invalidateQueries({ queryKey: ['presence-status'] });
      queryClient.invalidateQueries({ queryKey: ['nearby-users'] });
      setConfirmOpen(false);
    },
    onError: (error: Error) => {
      setAvailableOn(serverAvailable);
      showToast(error.message, 'error');
      setConfirmOpen(false);
    },
  });

  const nearbyUsers = nearbyUsersData?.data.users ?? [];
  const radiusMeters = nearbyUsersData?.data.radiusMeters ?? 250;

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
          subtitle={WALL_SUBTITLE}
        />
        <View style={styles.center}>
          <EmptyState
            icon={permissionDenied ? 'location-outline' : 'navigate-outline'}
            title={permissionDenied ? 'Location needed' : 'Location unavailable'}
            message={
              permissionDenied
                ? 'PingMe needs your location to show posts and people within about 250 meters.'
                : locationError
            }
            action={
              <Button
                label={permissionDenied ? 'Enable location' : 'Try again'}
                onPress={permissionDenied ? requestPermission : ping}
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
    </View>
  );

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader
        title="Wall"
        showBrand={false}
        subtitle={WALL_SUBTITLE}
        right={<AvailableChip isAvailable={availableOn} />}
      />

      {isLoading ? (
        <View style={[styles.skeletonWrap, { paddingBottom: contentBottom }]}>
          {listHeader}
          <ListSkeleton count={4} variant="post" />
        </View>
      ) : (
        <FlatList
          data={data?.data ?? []}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
          contentContainerStyle={[styles.list, { paddingBottom: contentBottom + 72 }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState
              icon="megaphone-outline"
              title="No posts yet"
              message="Be the first to say something to people within about 250 meters."
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
        <Ionicons name="add" size={28} color={colors.onAccent} />
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

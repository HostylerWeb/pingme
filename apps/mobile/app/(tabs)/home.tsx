import { distanceLabel } from '@pingme/shared';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, WallPost } from '../../src/lib/api';
import {
  requestBackgroundPermissions,
  startBackgroundLocation,
  stopBackgroundLocation,
} from '../../src/lib/background-location';
import { useLocationPing } from '../../src/hooks/use-location-ping';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
import {
  AppHeader,
  AvailableChip,
  BottomSheet,
  Button,
  Card,
  DistancePill,
  EmptyState,
  Input,
  LivenessBanner,
  ListSkeleton,
  Screen,
} from '../../src/components/ui';
import { colors, radius, shadows, spacing, typography } from '../../src/theme';

function distanceTone(bucket: string): 'neutral' | 'near' | 'tertiary' {
  if (bucket === 'very_near') return 'near';
  if (bucket === '~200m' || bucket === '~300m') return 'tertiary';
  return 'neutral';
}

function PostCard({ post, onPress }: { post: WallPost; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(post.author.isYou ? 'Y' : post.author.displayName).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.authorName}>
              {post.author.isYou ? 'You' : post.author.displayName}
            </Text>
            <DistancePill label={distanceLabel(post.distanceBucket)} tone={distanceTone(post.distanceBucket)} />
          </View>
        </View>
      </View>
      <Text style={styles.postContent}>{post.content}</Text>
      <View style={styles.postFooter}>
        <View style={styles.replyRow}>
          <Ionicons name="chatbubble-outline" size={16} color={colors.onSurfaceVariant} />
          <Text style={styles.replyCount}>
            {post.replyCount === 0 ? 'Reply' : `${post.replyCount} ${post.replyCount === 1 ? 'reply' : 'replies'}`}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export default function WallScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { contentBottom } = useTabBarInsets();
  const { coords, error: locationError, permissionGranted, requestPermission, ping } = useLocationPing(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [availableOn, setAvailableOn] = useState(false);
  const { ensureVerified, handleLivenessError, isVerified } = useLivenessGate();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['wall-posts'],
    queryFn: () => api.getWallPosts(),
    enabled: !!coords,
  });

  const { data: presenceData } = useQuery({
    queryKey: ['presence-status'],
    queryFn: () => api.getPresenceStatus(),
    enabled: !!coords,
    refetchInterval: 60_000,
  });

  const serverAvailable = presenceData?.data.isAvailable ?? false;

  useEffect(() => {
    setAvailableOn(serverAvailable);
  }, [serverAvailable]);

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
          throw new Error('Location permission is required to go online.');
        }
        const backgroundGranted = await requestBackgroundPermissions();
        if (!backgroundGranted) {
          console.warn('Background location denied — foreground-only mode');
        } else {
          await startBackgroundLocation();
        }
      } else {
        await stopBackgroundLocation();
      }
      return api.setAvailable(isAvailable);
    },
    onMutate: (isAvailable) => {
      setAvailableOn(isAvailable);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presence-status'] });
      queryClient.invalidateQueries({ queryKey: ['nearby-count'] });
      queryClient.invalidateQueries({ queryKey: ['nearby-users'] });
      setConfirmOpen(false);
    },
    onError: (error: Error) => {
      setAvailableOn(serverAvailable);
      alert(error.message);
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
      });
      setDraft('');
      setModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['wall-posts'] });
    } catch (error) {
      if (!handleLivenessError(error)) {
        const message = error instanceof ApiError ? error.message : 'Could not post';
        alert(message);
      }
    } finally {
      setPosting(false);
    }
  }, [coords, draft, queryClient, handleLivenessError, ensureVerified]);

  const handleAvailabilityToggle = (on: boolean) => {
    if (on) {
      setConfirmOpen(true);
      return;
    }
    setAvailableOn(false);
    availabilityMutation.mutate(false);
  };

  if (locationError && !coords) {
    const permissionDenied = permissionGranted === false;
    return (
      <Screen padded={false}>
        <AppHeader />
        <View style={styles.center}>
          <EmptyState
            icon={permissionDenied ? 'location-outline' : 'navigate-outline'}
            title={permissionDenied ? 'Location permission needed' : 'Location unavailable'}
            message={
              permissionDenied
                ? 'PingMe needs your location to show nearby posts and people within about 250 meters.'
                : locationError
            }
          />
          {permissionDenied ? (
            <Button label="Enable location" onPress={requestPermission} style={styles.actionBtn} />
          ) : null}
          <Button label="Try again" variant="ghost" onPress={ping} style={styles.actionBtn} />
        </View>
      </Screen>
    );
  }

  const listHeader = (
    <View>
      <Card style={styles.onlineCard}>
        <View style={styles.onlineRow}>
          <View style={styles.onlineText}>
            <Text style={styles.onlineTitle}>{availableOn ? "You're online" : "You're offline"}</Text>
            <Text style={styles.onlineHint}>
              {availableOn
                ? `Visible to people within ${radiusMeters}m on the wall.`
                : 'Turn on to appear in the nearby list.'}
            </Text>
          </View>
          <Switch
            value={availableOn}
            onValueChange={handleAvailabilityToggle}
            trackColor={{ false: colors.outlineVariant, true: colors.secondaryContainer }}
            thumbColor={availableOn ? colors.secondary : colors.surfaceBright}
            disabled={availabilityMutation.isPending}
          />
        </View>
      </Card>

      {!isVerified ? <LivenessBanner /> : null}

      <View style={styles.nearbySection}>
        <Text style={styles.nearbyHeading}>
          {nearbyUsers.length} {nearbyUsers.length === 1 ? 'person' : 'people'} online nearby
        </Text>
        {nearbyUsers.length === 0 ? (
          <Text style={styles.nearbyEmpty}>No one is online within {radiusMeters}m right now.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyScroll}>
            {nearbyUsers.map((person) => (
              <View key={person.userId} style={styles.nearbyPerson}>
                <View style={styles.nearbyAvatar}>
                  {person.avatarUrl ? (
                    <Image source={{ uri: person.avatarUrl }} style={styles.nearbyAvatarImage} />
                  ) : (
                    <Text style={styles.nearbyAvatarText}>
                      {person.displayName.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.nearbyName} numberOfLines={1}>
                  {person.displayName}
                </Text>
                <DistancePill
                  label={distanceLabel(person.distanceBucket)}
                  tone={distanceTone(person.distanceBucket)}
                />
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <Text style={styles.wallHeading}>Nearby wall</Text>
    </View>
  );

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader
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
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={[styles.list, { paddingBottom: contentBottom }]}
          ListEmptyComponent={
            <EmptyState
              icon="megaphone-outline"
              title="No posts nearby yet"
              message="Be the first to say something to people within about 250 meters."
            />
          }
          renderItem={({ item }) => (
            <PostCard post={item} onPress={() => router.push(`/post/${item.id}`)} />
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
        <Ionicons name="create-outline" size={26} color={colors.onPrimary} />
      </Pressable>

      <BottomSheet visible={confirmOpen} title="Go online?" onClose={() => setConfirmOpen(false)}>
        <Text style={styles.sheetBody}>
          People within ~{radiusMeters}m can see you&apos;re online. PingMe may use background location
          while you&apos;re online. You can turn it off anytime.
        </Text>
        <Button
          label="Turn on"
          variant="secondary"
          onPress={() => availabilityMutation.mutate(true)}
          loading={availabilityMutation.isPending}
          style={styles.sheetButton}
        />
        <Button label="Cancel" variant="ghost" onPress={() => setConfirmOpen(false)} />
      </BottomSheet>

      <BottomSheet visible={modalOpen} title="Post to nearby wall" onClose={() => setModalOpen(false)}>
        <Input
          placeholder="Anyone else here?"
          multiline
          maxLength={500}
          value={draft}
          onChangeText={setDraft}
          hint={`${draft.length}/500`}
        />
        <Button label="Post" onPress={onCreatePost} loading={posting} disabled={!draft.trim()} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: spacing.container },
  actionBtn: { width: '100%', marginTop: spacing.md },
  skeletonWrap: { paddingHorizontal: spacing.container, paddingBottom: 140 },
  onlineCard: { marginBottom: spacing.md },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  onlineText: { flex: 1 },
  onlineTitle: { ...typography.headlineMd, color: colors.onSurface, marginBottom: 4 },
  onlineHint: { ...typography.bodyMd, color: colors.onSurfaceVariant, lineHeight: 20 },
  nearbySection: { marginBottom: spacing.lg },
  nearbyHeading: { ...typography.headlineMd, color: colors.onSurface, marginBottom: spacing.sm },
  nearbyEmpty: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginBottom: spacing.md },
  nearbyScroll: { gap: spacing.md, paddingBottom: spacing.sm },
  nearbyPerson: {
    width: 88,
    alignItems: 'center',
    gap: 4,
  },
  nearbyAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nearbyAvatarImage: { width: 56, height: 56 },
  nearbyAvatarText: { ...typography.headlineMd, color: colors.primary, fontSize: 20 },
  nearbyName: {
    ...typography.labelSm,
    color: colors.onSurface,
    textTransform: 'none',
    letterSpacing: 0,
    maxWidth: 88,
    textAlign: 'center',
  },
  wallHeading: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  list: { paddingHorizontal: spacing.container, gap: spacing.lg },
  postCard: { marginBottom: spacing.lg },
  postHeader: { marginBottom: spacing.md },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.headlineMd, color: colors.primary, fontSize: 18 },
  authorName: { ...typography.headlineMd, color: colors.onSurface, marginBottom: 4, fontSize: 17 },
  postContent: { ...typography.bodyMd, color: colors.onSurfaceVariant, lineHeight: 24 },
  postFooter: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyCount: { ...typography.labelSm, color: colors.onSurfaceVariant, textTransform: 'none', letterSpacing: 0 },
  fab: {
    position: 'absolute',
    right: spacing.container,
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.fab,
  },
  sheetBody: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  sheetButton: { marginBottom: spacing.md },
});

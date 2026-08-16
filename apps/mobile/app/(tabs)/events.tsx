import { formatEventListDate, formatEventsDiscoveryRadius, distanceLabel } from '@pingme/shared';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api, EventSummary } from '../../src/lib/api';
import { useLocationPing } from '../../src/hooks/use-location-ping';
import { useRequiredDistanceConfig } from '../../src/hooks/use-app-config';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
import { useAuthStore } from '../../src/stores/auth-store';
import {
  AppHeader,
  Avatar,
  Button,
  DistancePill,
  EmptyState,
  ListSkeleton,
  Screen,
} from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

function EventRow({ event, onPress }: { event: EventSummary; onPress: () => void }) {
  const styles = useThemedStyles(({ colors }) => ({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    pressed: { opacity: 0.92 },
    cover: { width: '100%', height: 140, backgroundColor: colors.surfaceMuted },
    body: { padding: spacing.lg, gap: spacing.sm },
    title: { ...typography.headlineMd, color: colors.ink, fontSize: 18 },
    meta: { ...typography.bodyMd, color: colors.inkSecondary },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    hostRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
    hostName: { ...typography.bodyMd, color: colors.ink, flex: 1 },
    rsvp: { ...typography.caption, color: colors.inkSecondary },
  }));

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {event.coverUrl ? (
        <Image source={{ uri: event.coverUrl }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={styles.cover} />
      )}
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>
          <DistancePill label={distanceLabel(event.distanceBucket)} />
        </View>
        <Text style={styles.meta}>{formatEventListDate(event.startsAt)}</Text>
        {event.placeName ? <Text style={styles.meta}>{event.placeName}</Text> : null}
        <View style={styles.hostRow}>
          <Avatar uri={event.host.avatarUrl} name={event.host.displayName} size="sm" />
          <Text style={styles.hostName}>{event.host.displayName}</Text>
        </View>
        <Text style={styles.rsvp}>
          {event.goingCount} going{event.maybeCount > 0 ? ` · ${event.maybeCount} maybe` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

export default function EventsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { contentBottom } = useTabBarInsets();
  const distanceConfig = useRequiredDistanceConfig();
  const discoveryLabel = formatEventsDiscoveryRadius(
    distanceConfig.events.discoveryRadiusMeters,
  );
  const { colors } = useTheme();
  const { permissionGranted, requestPermission } = useLocationPing();
  const hasLocation = permissionGranted === true;

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: ['events-nearby'],
    queryFn: ({ pageParam }) => api.getNearbyEvents(pageParam, 20),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? lastPage.meta.page + 1 : undefined,
    enabled: hasLocation,
  });

  const events = data?.pages.flatMap((page) => page.data) ?? [];

  const onCreate = useCallback(() => {
    if (!user?.idVerified) {
      router.push('/(setup)/kyc');
      return;
    }
    router.push('/events/create');
  }, [router, user?.idVerified]);

  const styles = useThemedStyles(({ colors }) => ({
    content: {
      paddingHorizontal: spacing.container,
      paddingBottom: contentBottom + 72,
    },
    subtitle: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      marginBottom: spacing.lg,
      lineHeight: 22,
    },
    fab: {
      position: 'absolute',
      right: spacing.container,
      bottom: contentBottom + spacing.lg,
    },
  }));

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader title="Events" showBrand={false} large subtitle={`Within ${discoveryLabel}`} />
      {!hasLocation ? (
        <EmptyState
          icon="location"
          title="Location needed"
          message="Enable location to discover events near you."
          action={<Button label="Enable location" onPress={() => void requestPermission()} />}
        />
      ) : isLoading ? (
        <ListSkeleton count={4} />
      ) : error ? (
        <EmptyState
          icon="alert-circle"
          title="Could not load events"
          message="Pull to refresh or check your connection."
          action={<Button label="Try again" onPress={() => void refetch()} />}
        />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
          ListEmptyComponent={
            <EmptyState
              icon="calendar"
              title="No events nearby yet"
              message="Be the first to host a meetup in your area."
              action={<Button label="Create event" onPress={onCreate} />}
            />
          }
          renderItem={({ item }) => (
            <EventRow event={item} onPress={() => router.push(`/events/${item.id}`)} />
          )}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
            ) : null
          }
        />
      )}
      {hasLocation ? (
        <View style={styles.fab}>
          <Button label="Create" onPress={onCreate} />
        </View>
      ) : null}
    </Screen>
  );
}

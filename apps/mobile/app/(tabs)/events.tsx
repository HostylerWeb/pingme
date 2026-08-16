import {
  distanceLabel,
  formatEventListDate,
  formatEventsDiscoveryRadius,
} from '@pingme/shared';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, EventMineSummary, EventSummary } from '../../src/lib/api';
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
  SegmentedControl,
} from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

type EventsTab = 'all' | 'mine';

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

function MyEventRow({ event, onPress }: { event: EventMineSummary; onPress: () => void }) {
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
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    rsvp: { ...typography.caption, color: colors.inkSecondary },
    badge: {
      ...typography.caption,
      color: colors.online,
      backgroundColor: colors.onlineSoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
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
          <Text style={[styles.title, { flex: 1 }]} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.badge}>Hosting</Text>
        </View>
        <Text style={styles.meta}>{formatEventListDate(event.startsAt)}</Text>
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
  const [tab, setTab] = useState<EventsTab>('all');

  const { data: myEventsData, refetch: refetchMine, isRefetching: isRefetchingMine } = useQuery({
    queryKey: ['my-events'],
    queryFn: () => api.getMyEvents(),
    enabled: Boolean(user),
  });

  const myActiveEvents = useMemo(
    () => (myEventsData?.data ?? []).filter((event) => event.status === 'active'),
    [myEventsData?.data],
  );
  const showTabs = myActiveEvents.length > 0;

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
    enabled: hasLocation && tab === 'all',
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
    tabs: {
      paddingHorizontal: spacing.container,
      marginBottom: spacing.md,
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

  const listHeader = showTabs ? (
    <View style={styles.tabs}>
      <SegmentedControl
        options={[
          { label: 'All events', value: 'all' as const },
          { label: 'My events', value: 'mine' as const },
        ]}
        value={tab}
        onChange={setTab}
      />
    </View>
  ) : null;

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader
        title="Events"
        showBrand={false}
        large
        subtitle={tab === 'all' ? `Within ${discoveryLabel}` : 'Events you are hosting'}
      />
      {tab === 'mine' && showTabs ? (
        <FlatList
          data={myActiveEvents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl refreshing={isRefetchingMine} onRefresh={() => void refetchMine()} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar"
              title="No active events"
              message="Create an event to start hosting."
              action={<Button label="Create event" onPress={onCreate} />}
            />
          }
          renderItem={({ item }) => (
            <MyEventRow
              event={item}
              onPress={() => router.push(`/events/${item.id}/edit`)}
            />
          )}
        />
      ) : !hasLocation ? (
        <>
          {listHeader}
          <EmptyState
            icon="location"
            title="Location needed"
            message="Enable location to discover events near you."
            action={<Button label="Enable location" onPress={() => void requestPermission()} />}
          />
        </>
      ) : isLoading ? (
        <>
          {listHeader}
          <ListSkeleton count={4} />
        </>
      ) : error ? (
        <>
          {listHeader}
          <EmptyState
            icon="alert-circle"
            title="Could not load events"
            message="Pull to refresh or check your connection."
            action={<Button label="Try again" onPress={() => void refetch()} />}
          />
        </>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={listHeader}
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
      {hasLocation || (tab === 'mine' && showTabs) ? (
        <View style={styles.fab}>
          <Button label="Create" onPress={onCreate} />
        </View>
      ) : null}
    </Screen>
  );
}

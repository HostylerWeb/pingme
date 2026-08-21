import {
  distanceLabel,
  formatEventListDate,
  formatEventsDiscoveryRadius,
} from '@pingme/shared';
import { useRouter, useFocusEffect } from 'expo-router';
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
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  EventAttendingSummary,
  EventMineSummary,
  EventSummary,
} from '../../src/lib/api';
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

type EventsTab = 'nearby' | 'attending' | 'hosting';
type HostingStatus = 'active' | 'cancelled';
type AttendingFilter = 'all' | 'going' | 'maybe';
type AttendingLifecycle = 'upcoming' | 'past';

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
          <Text style={[styles.title, { flex: 1 }]} numberOfLines={2}>
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

function AttendingEventRow({
  event,
  onPress,
}: {
  event: EventAttendingSummary;
  onPress: () => void;
}) {
  const isGoing = event.viewerRsvp === 'going';
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
    badge: {
      ...typography.caption,
      color: isGoing ? colors.online : colors.inkSecondary,
      backgroundColor: isGoing ? colors.onlineSoft : colors.surfaceMuted,
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
          <Text style={styles.badge}>{isGoing ? 'Going' : 'Maybe'}</Text>
        </View>
        <Text style={styles.meta}>{formatEventListDate(event.startsAt)}</Text>
        {event.placeName ? <Text style={styles.meta}>{event.placeName}</Text> : null}
        <View style={styles.hostRow}>
          <Avatar uri={event.host.avatarUrl} name={event.host.displayName} size="sm" />
          <Text style={styles.hostName}>{event.host.displayName}</Text>
          <DistancePill label={distanceLabel(event.distanceBucket)} />
        </View>
        <Text style={styles.rsvp}>
          {event.goingCount} going{event.maybeCount > 0 ? ` · ${event.maybeCount} maybe` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

function HostingEventRow({
  event,
  onPress,
}: {
  event: EventMineSummary;
  onPress: () => void;
}) {
  const isCancelled = event.status === 'cancelled';
  const styles = useThemedStyles(({ colors }) => ({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: 'hidden',
      marginBottom: spacing.md,
      opacity: isCancelled ? 0.72 : 1,
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
      color: isCancelled ? colors.inkSecondary : colors.online,
      backgroundColor: isCancelled ? colors.surfaceMuted : colors.onlineSoft,
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
          <Text style={styles.badge}>{isCancelled ? 'Cancelled' : 'Hosting'}</Text>
        </View>
        <Text style={styles.meta}>{formatEventListDate(event.startsAt)}</Text>
        {!isCancelled ? (
          <Text style={styles.rsvp}>
            {event.goingCount} going{event.maybeCount > 0 ? ` · ${event.maybeCount} maybe` : ''}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function EventsTabBar({
  tab,
  onTabChange,
  attendingFilter,
  onAttendingFilterChange,
  attendingLifecycle,
  onAttendingLifecycleChange,
  hostingStatus,
  onHostingStatusChange,
  showHostingFilter,
}: {
  tab: EventsTab;
  onTabChange: (tab: EventsTab) => void;
  attendingFilter: AttendingFilter;
  onAttendingFilterChange: (filter: AttendingFilter) => void;
  attendingLifecycle: AttendingLifecycle;
  onAttendingLifecycleChange: (lifecycle: AttendingLifecycle) => void;
  hostingStatus: HostingStatus;
  onHostingStatusChange: (status: HostingStatus) => void;
  showHostingFilter: boolean;
}) {
  const styles = useThemedStyles(() => ({
    tabs: {
      paddingHorizontal: spacing.container,
      marginBottom: spacing.md,
    },
    statusFilter: {
      marginTop: spacing.sm,
    },
  }));

  return (
    <View style={styles.tabs}>
      <SegmentedControl
        options={[
          { label: 'Nearby', value: 'nearby' as const },
          { label: 'Attending', value: 'attending' as const },
          { label: 'Hosting', value: 'hosting' as const },
        ]}
        value={tab}
        onChange={onTabChange}
      />
      {tab === 'attending' ? (
        <>
          <View style={styles.statusFilter}>
            <SegmentedControl
              options={[
                { label: 'Upcoming', value: 'upcoming' as const },
                { label: 'Past', value: 'past' as const },
              ]}
              value={attendingLifecycle}
              onChange={onAttendingLifecycleChange}
            />
          </View>
          <View style={styles.statusFilter}>
            <SegmentedControl
              options={[
                { label: 'All', value: 'all' as const },
                { label: 'Going', value: 'going' as const },
                { label: 'Maybe', value: 'maybe' as const },
              ]}
              value={attendingFilter}
              onChange={onAttendingFilterChange}
            />
          </View>
        </>
      ) : null}
      {tab === 'hosting' && showHostingFilter ? (
        <View style={styles.statusFilter}>
          <SegmentedControl
            options={[
              { label: 'Active', value: 'active' as const },
              { label: 'Cancelled', value: 'cancelled' as const },
            ]}
            value={hostingStatus}
            onChange={onHostingStatusChange}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function EventsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { contentBottom } = useTabBarInsets();
  const distanceConfig = useRequiredDistanceConfig();
  const discoveryLabel = formatEventsDiscoveryRadius(
    distanceConfig.events.discoveryRadiusMeters,
  );
  const { colors } = useTheme();
  const { permissionGranted, requestPermission } = useLocationPing();
  const hasLocation = permissionGranted === true;
  const [tab, setTab] = useState<EventsTab>('nearby');
  const [hostingStatus, setHostingStatus] = useState<HostingStatus>('active');
  const [attendingFilter, setAttendingFilter] = useState<AttendingFilter>('all');
  const [attendingLifecycle, setAttendingLifecycle] = useState<AttendingLifecycle>('upcoming');

  const onTabChange = useCallback((next: EventsTab) => {
    setTab(next);
    if (next === 'hosting') {
      setHostingStatus('active');
    }
    if (next === 'attending') {
      setAttendingFilter('all');
      setAttendingLifecycle('upcoming');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['events-nearby'] });
      void queryClient.invalidateQueries({ queryKey: ['events-attending'] });
      void queryClient.invalidateQueries({ queryKey: ['my-events'] });
    }, [queryClient]),
  );

  const { data: myEventsData, refetch: refetchMine, isRefetching: isRefetchingMine } = useQuery({
    queryKey: ['my-events'],
    queryFn: () => api.getMyEvents(),
    enabled: Boolean(user),
  });

  const myEvents = useMemo(() => {
    return (myEventsData?.data ?? []).filter(
      (event) => event.status === 'active' || event.status === 'cancelled',
    );
  }, [myEventsData?.data]);

  const filteredHostingEvents = useMemo(() => {
    return myEvents
      .filter((event) => event.status === hostingStatus)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [hostingStatus, myEvents]);

  const {
    data: attendingData,
    isLoading: isAttendingLoading,
    isRefetching: isAttendingRefetching,
    refetch: refetchAttending,
    fetchNextPage: fetchNextAttendingPage,
    hasNextPage: hasNextAttendingPage,
    isFetchingNextPage: isFetchingNextAttendingPage,
    error: attendingError,
  } = useInfiniteQuery({
    queryKey: ['events-attending', attendingLifecycle],
    queryFn: ({ pageParam }) => api.getAttendingEvents(pageParam, 20, attendingLifecycle),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? lastPage.meta.page + 1 : undefined,
    enabled: Boolean(user) && tab === 'attending',
    staleTime: 30_000,
  });

  const attendingEvents = useMemo(() => {
    const items = attendingData?.pages.flatMap((page) => page.data) ?? [];
    if (attendingFilter === 'all') {
      return items;
    }
    return items.filter((event) => event.viewerRsvp === attendingFilter);
  }, [attendingData?.pages, attendingFilter]);

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
    enabled: hasLocation && tab === 'nearby',
    staleTime: 30_000,
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
    fab: {
      position: 'absolute',
      right: spacing.container,
      bottom: contentBottom + spacing.lg,
    },
    footer: {
      marginVertical: spacing.lg,
    },
  }));

  const headerSubtitle =
    tab === 'nearby'
      ? `Within ${discoveryLabel}`
      : tab === 'attending'
        ? attendingLifecycle === 'past'
          ? 'Events you attended'
          : 'Events you plan to attend'
        : 'Events you are hosting';

  const listHeader = user ? (
    <EventsTabBar
      tab={tab}
      onTabChange={onTabChange}
      attendingFilter={attendingFilter}
      onAttendingFilterChange={setAttendingFilter}
      attendingLifecycle={attendingLifecycle}
      onAttendingLifecycleChange={setAttendingLifecycle}
      hostingStatus={hostingStatus}
      onHostingStatusChange={setHostingStatus}
      showHostingFilter={myEvents.length > 0}
    />
  ) : null;

  const showFab = tab === 'hosting' || tab === 'nearby' ? hasLocation || tab === 'hosting' : true;

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader title="Events" showBrand={false} large subtitle={headerSubtitle} />

      {tab === 'attending' ? (
        isAttendingLoading ? (
          <>
            {listHeader}
            <ListSkeleton count={4} />
          </>
        ) : attendingError ? (
          <>
            {listHeader}
            <EmptyState
              icon="alert-circle"
              title="Could not load your events"
              message="Pull to refresh or check your connection."
              action={<Button label="Try again" onPress={() => void refetchAttending()} />}
            />
          </>
        ) : (
          <FlatList
            data={attendingEvents}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.content}
            ListHeaderComponent={listHeader}
            refreshControl={
              <RefreshControl
                refreshing={isAttendingRefetching}
                onRefresh={() => void refetchAttending()}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="calendar"
                title={
                  attendingLifecycle === 'past'
                    ? attendingFilter === 'all'
                      ? 'No past events'
                      : attendingFilter === 'going'
                        ? 'Nothing you marked Going'
                        : 'Nothing you marked Maybe'
                    : attendingFilter === 'all'
                      ? 'No upcoming events'
                      : attendingFilter === 'going'
                        ? 'Nothing marked Going'
                        : 'Nothing marked Maybe'
                }
                message={
                  attendingLifecycle === 'past'
                    ? 'Events you attended will show up here after they end.'
                    : 'Tap Going or Maybe on an event to add it here.'
                }
                action={
                  attendingLifecycle === 'past' ? undefined : (
                    <Button label="Browse nearby" onPress={() => setTab('nearby')} />
                  )
                }
              />
            }
            renderItem={({ item }) => (
              <AttendingEventRow
                event={item}
                onPress={() => router.push(`/events/${item.id}`)}
              />
            )}
            onEndReached={() => {
              if (hasNextAttendingPage && !isFetchingNextAttendingPage) {
                void fetchNextAttendingPage();
              }
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              isFetchingNextAttendingPage ? (
                <ActivityIndicator color={colors.accent} style={styles.footer} />
              ) : null
            }
          />
        )
      ) : tab === 'hosting' ? (
        <FlatList
          data={filteredHostingEvents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl refreshing={isRefetchingMine} onRefresh={() => void refetchMine()} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar"
              title={hostingStatus === 'active' ? 'No active events' : 'No cancelled events'}
              message={
                hostingStatus === 'active'
                  ? 'Create an event to start hosting.'
                  : 'Cancelled events will appear here.'
              }
              action={
                hostingStatus === 'active' ? (
                  <Button label="Create event" onPress={onCreate} />
                ) : undefined
              }
            />
          }
          renderItem={({ item }) => (
            <HostingEventRow
              event={item}
              onPress={() =>
                router.push(
                  item.status === 'cancelled' ? `/events/${item.id}` : `/events/${item.id}/edit`,
                )
              }
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
              <ActivityIndicator color={colors.accent} style={styles.footer} />
            ) : null
          }
        />
      )}

      {showFab ? (
        <View style={styles.fab}>
          <Button label="Create" onPress={onCreate} />
        </View>
      ) : null}
    </Screen>
  );
}

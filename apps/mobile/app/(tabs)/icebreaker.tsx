import { formatDurationMinutes, icebreakerRadiusLabel } from '@pingme/shared';
import { AppIcon } from '../../src/components/ui/app-icon';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { api, ApiError, IcebreakerNearbyUser, MatchSummary } from '../../src/lib/api';
import { useRequiredDistanceConfig } from '../../src/hooks/use-app-config';
import { useLocationPing } from '../../src/hooks/use-location-ping';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
import { useToastStore, showToast } from '../../src/stores/toast-store';
import {
  AppHeader,
  AppSwitch,
  Avatar,
  BottomSheet,
  Button,
  Card,
  ConnectionCelebrationModal,
  DistancePill,
  DisplayNameWithFlair,
  EmptyState,
  hapticLight,
  hapticSuccess,
  Input,
  LivenessBanner,
  LoadingView,
  Screen,
  SectionLabel,
} from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

function distanceTone(bucket: string): 'neutral' | 'near' | 'accent' {
  if (bucket === 'very_near') return 'near';
  if (bucket === '~200m' || bucket === '~300m') return 'accent';
  return 'neutral';
}

function HighlightBadge({ label }: { label: string }) {
  const { colors } = useTheme();

  const styles = useThemedStyles(({ colors }) => ({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 5,
      borderRadius: radius.full,
      marginBottom: spacing.md,
    },
    badgeText: {
      ...typography.labelSm,
      color: colors.accent,
      textTransform: 'none',
      letterSpacing: 0,
    },
  }));

  return (
    <View style={styles.badge}>
      <AppIcon name="sparkles" size={12} color={colors.accent} />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function ResponsePill({
  label,
  filled,
  onPress,
  disabled,
  successHaptic,
}: {
  label: string;
  filled: boolean;
  onPress: () => void;
  disabled?: boolean;
  successHaptic?: boolean;
}) {
  const styles = useThemedStyles(({ colors }) => ({
    pill: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 42,
    },
    pillFilled: {
      backgroundColor: colors.accent,
    },
    pillOutline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    pillPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.98 }],
    },
    pillDisabled: {
      opacity: 0.5,
    },
    pillLabel: {
      ...typography.bodySemiBold,
      fontSize: 15,
    },
    pillLabelFilled: {
      color: colors.onAccent,
    },
    pillLabelOutline: {
      color: colors.inkSecondary,
    },
  }));

  return (
    <Pressable
      onPress={async () => {
        if (disabled) return;
        if (successHaptic) {
          await hapticSuccess();
        } else {
          await hapticLight();
        }
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        filled ? styles.pillFilled : styles.pillOutline,
        pressed && !disabled && styles.pillPressed,
        disabled && styles.pillDisabled,
      ]}
    >
      <Text style={[styles.pillLabel, filled ? styles.pillLabelFilled : styles.pillLabelOutline]}>
        {label}
      </Text>
    </Pressable>
  );
}

const ICEBREAKER_SUBTITLE =
  'People open to meeting nearby. Say yes — if they say yes too, you can connect.';

function ActiveNowBadge() {
  const styles = useThemedStyles(({ colors }) => ({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.online,
    },
    label: {
      ...typography.caption,
      color: colors.online,
      letterSpacing: 0,
    },
  }));

  return (
    <View style={styles.badge}>
      <View style={styles.dot} />
      <Text style={styles.label}>Active now</Text>
    </View>
  );
}

function PendingConnectionCard({
  connection,
  loading,
  onAccept,
  onDecline,
}: {
  connection: MatchSummary;
  loading: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { colors } = useTheme();
  const other = connection.otherUser;
  const name = other.displayName ?? other.label;
  const sourceLabel = connection.source === 'wall_reply' ? 'From the Wall' : 'Break the ice';

  const styles = useThemedStyles(({ colors }) => ({
    card: {
      borderColor: colors.accentMuted,
      backgroundColor: colors.accentSoft,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    meta: { flex: 1, gap: 4 },
    source: {
      ...typography.caption,
      color: colors.inkTertiary,
      letterSpacing: 0,
    },
    waitingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.sm,
    },
    waitingText: {
      ...typography.caption,
      color: colors.inkTertiary,
      letterSpacing: 0,
    },
    responseRow: { flexDirection: 'row', gap: spacing.sm },
  }));

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Avatar
          uri={other.avatarUrl}
          name={name}
          size="md"
          themeId={other.isPremium ? other.avatarTheme : null}
        />
        <View style={styles.meta}>
          <DisplayNameWithFlair name={name} isPremium={other.isPremium} isVerified={other.livenessVerified} />
          <Text style={styles.source}>{sourceLabel}</Text>
          {other.activeNow ? <ActiveNowBadge /> : null}
        </View>
      </View>
      {connection.myAccepted ? (
        <View style={styles.waitingRow}>
          <AppIcon name="hourglass" size={14} color={colors.inkTertiary} />
          <Text style={styles.waitingText}>Accepted — waiting for them</Text>
        </View>
      ) : (
        <View style={styles.responseRow}>
          <ResponsePill label="Not now" filled={false} onPress={onDecline} disabled={loading} />
          <ResponsePill label="Accept" filled onPress={onAccept} disabled={loading} successHaptic />
        </View>
      )}
    </Card>
  );
}

function IcebreakerRow({
  person,
  onYes,
  onNo,
  onAccept,
  onDecline,
  loading,
}: {
  person: IcebreakerNearbyUser;
  onYes: () => void;
  onNo: () => void;
  onAccept: () => void;
  onDecline: () => void;
  loading: boolean;
}) {
  const { colors } = useTheme();
  const distanceConfig = useRequiredDistanceConfig();
  const icebreakerRadiusText = icebreakerRadiusLabel(distanceConfig.icebreaker.radiusMeters);
  const interestExpiryLabel = formatDurationMinutes(distanceConfig.icebreaker.interestExpiryMinutes);
  const featured = person.highlight !== null;
  const waiting = person.myResponse === 'yes' && person.highlight !== 'mutual_match';

  const styles = useThemedStyles(({ colors }) => ({
    personCard: { marginBottom: 0 },
    personCardFeatured: {
      borderColor: colors.accentMuted,
      backgroundColor: colors.accentSoft,
    },
    personHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    personMeta: { flex: 1, gap: 4 },
    personName: { ...typography.bodySemiBold, color: colors.ink, fontSize: 16 },
    personIntro: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      fontStyle: 'italic',
      marginBottom: spacing.md,
      lineHeight: 22,
      paddingLeft: 2,
    },
    waitingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.sm,
    },
    waitingText: {
      ...typography.caption,
      color: colors.inkTertiary,
      letterSpacing: 0,
    },
    responseRow: { flexDirection: 'row', gap: spacing.sm },
  }));

  return (
    <Card
      style={{
        ...styles.personCard,
        ...(featured ? styles.personCardFeatured : undefined),
      }}
    >
      {person.highlight === 'mutual_match' ? (
        <HighlightBadge label="You both said yes" />
      ) : person.highlight === 'interested_in_you' ? (
        <HighlightBadge label="Interested in you" />
      ) : null}

      <View style={styles.personHeader}>
        <Avatar
          uri={person.avatarUrl}
          name={person.displayName}
          size="md"
          themeId={person.isPremium ? person.avatarTheme : null}
        />
        <View style={styles.personMeta}>
          <DisplayNameWithFlair name={person.displayName} isPremium={person.isPremium} isVerified={person.livenessVerified} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            <DistancePill
              label={icebreakerRadiusText}
              tone={distanceTone(person.distanceBucket)}
            />
            {person.activeNow ? <ActiveNowBadge /> : null}
          </View>
        </View>
      </View>

      {person.introMessage ? (
        <Text style={styles.personIntro}>&ldquo;{person.introMessage}&rdquo;</Text>
      ) : null}

      {person.highlight === 'mutual_match' && person.matchId ? (
        <View style={styles.responseRow}>
          <ResponsePill label="Not now" filled={false} onPress={onDecline} disabled={loading} />
          <ResponsePill
            label="Accept"
            filled
            onPress={onAccept}
            disabled={loading}
            successHaptic
          />
        </View>
      ) : waiting ? (
        <View style={styles.waitingRow}>
          <AppIcon name="hourglass" size={14} color={colors.inkTertiary} />
          <Text style={styles.waitingText}>Waiting for their response — up to {interestExpiryLabel}</Text>
        </View>
      ) : (
        <View style={styles.responseRow}>
          <ResponsePill label="No" filled={false} onPress={onNo} disabled={loading} />
          <ResponsePill label="Yes" filled onPress={onYes} disabled={loading} />
        </View>
      )}
    </Card>
  );
}

export default function IcebreakerScreen() {
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
  const { coords, permissionGranted } = useLocationPing(screenFocused);
  const { ensureVerified, handleLivenessError, isVerified } = useLivenessGate();
  const [icebreakerSetupOpen, setIcebreakerSetupOpen] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const [introMessage, setIntroMessage] = useState('');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [optimisticIcebreakerOn, setOptimisticIcebreakerOn] = useState<boolean | null>(null);
  const distanceConfig = useRequiredDistanceConfig();
  const icebreakerRadiusText = icebreakerRadiusLabel(distanceConfig.icebreaker.radiusMeters);
  const icebreakerRadiusTextLower = icebreakerRadiusText.toLowerCase();
  const [celebration, setCelebration] = useState<{
    kind: 'mutual_yes' | 'connected';
    matchId?: string;
    chatId?: string;
    displayName?: string;
  } | null>(null);

  const styles = useThemedStyles(({ colors }) => ({
    denied: { flex: 1, justifyContent: 'center', padding: spacing.container },
    scroll: {
      paddingHorizontal: spacing.container,
      gap: spacing.lg,
    },
    unansweredCard: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    unansweredRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    unansweredText: {
      ...typography.caption,
      color: colors.inkSecondary,
      flex: 1,
      lineHeight: 18,
    },
    dismissPressed: { opacity: 0.6 },
    toggleBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toggleCopy: { flex: 1 },
    toggleTitle: { ...typography.bodySemiBold, color: colors.ink, fontSize: 16 },
    toggleHint: { ...typography.caption, color: colors.inkSecondary, marginTop: 2 },
    browseSection: { gap: spacing.sm },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    nearbyLoader: { marginVertical: spacing.lg },
    nearbyList: { gap: spacing.md },
    pendingSection: { gap: spacing.md },
    sheetBody: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      marginBottom: spacing.xl,
      lineHeight: 24,
    },
    sheetButton: { marginBottom: spacing.md },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    toggleLabel: { ...typography.bodyMd, color: colors.ink },
  }));

  const { data: icebreakerData } = useQuery({
    queryKey: ['icebreaker-status'],
    queryFn: () => api.getIcebreakerStatus(),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchInterval: (query) => {
      const serverActive = query.state.data?.data?.session?.status === 'active';
      const on = optimisticIcebreakerOn ?? serverActive;
      return on ? 5_000 : 30_000;
    },
    refetchIntervalInBackground: false,
  });

  const session = icebreakerData?.data?.session ?? null;
  const unanswered = icebreakerData?.data?.unanswered ?? [];
  const serverIcebreakerActive = session?.status === 'active';
  const icebreakerOn = optimisticIcebreakerOn ?? serverIcebreakerActive;

  const { data: matchesData } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.getMatches(),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const pendingConnections = (matchesData?.data ?? []).filter((m) => m.status === 'pending');
  const pendingUserIds = new Set(
    pendingConnections.map((m) => m.otherUser.id).filter((id): id is string => !!id),
  );

  const hasPendingMatch = pendingConnections.some((m) => m.source === 'icebreaker');

  const canBrowse = icebreakerOn || hasPendingMatch;

  const {
    data: nearbyData,
    isLoading: nearbyInitialLoad,
    isFetching: nearbyRefreshing,
  } = useQuery({
    queryKey: ['icebreaker-nearby'],
    queryFn: () => api.getIcebreakerNearby(),
    enabled: !!coords && canBrowse,
    placeholderData: keepPreviousData,
    staleTime: 5_000,
    refetchInterval: canBrowse ? 5_000 : false,
    refetchIntervalInBackground: false,
  });

  const people = nearbyData?.data ?? [];
  const nearbyPeople = people.filter(
    (person) => !(person.highlight === 'mutual_match' && pendingUserIds.has(person.userId)),
  );
  const featuredCount = nearbyPeople.filter((p) => p.highlight !== null).length;

  const icebreakerMutation = useMutation({
    mutationFn: async (action: 'start' | 'cancel') => {
      if (action === 'start') {
        return api.startIcebreaker({
          showPhoto,
          introMessage: introMessage.trim() || undefined,
        });
      }
      return api.cancelIcebreaker();
    },
    onMutate: async (action) => {
      setOptimisticIcebreakerOn(action === 'start');
    },
    onSuccess: (result, action) => {
      queryClient.setQueryData(
        ['icebreaker-status'],
        (current: Awaited<ReturnType<typeof api.getIcebreakerStatus>> | undefined) => {
          const unansweredNotices = current?.data?.unanswered ?? [];
          if (action === 'start') {
            const startResult = result as Awaited<ReturnType<typeof api.startIcebreaker>>;
            if (!startResult.data) {
              return current;
            }
            return {
              success: true,
              data: {
                session: {
                  id: startResult.data.id,
                  status: startResult.data.status,
                  expiresAt: startResult.data.expiresAt,
                  showPhoto: startResult.data.showPhoto,
                  introMessage: startResult.data.introMessage,
                },
                unanswered: unansweredNotices,
              },
            };
          }
          return {
            success: true,
            data: {
              session: null,
              unanswered: unansweredNotices,
            },
          };
        },
      );
      setOptimisticIcebreakerOn(null);
      void queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
      void queryClient.invalidateQueries({ queryKey: ['icebreaker-nearby'] });
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
      setIcebreakerSetupOpen(false);
      if (action === 'start') {
        showToast("You're open to meeting people nearby", 'success');
      } else {
        showToast("You're hidden from Break the ice", 'info');
      }
    },
    onError: (error: ApiError) => {
      setOptimisticIcebreakerOn(null);
      if (!handleLivenessError(error)) {
        showToast(error.message, 'error');
      }
    },
  });

  const handleToggle = (on: boolean) => {
    if (on) {
      if (!ensureVerified()) return;
      setIcebreakerSetupOpen(true);
      return;
    }
    useToastStore.getState().hide();
    icebreakerMutation.mutate('cancel');
  };

  const interestMutation = useMutation({
    mutationFn: (payload: { targetUserId: string; interested: boolean }) =>
      api.setIcebreakerInterest(payload),
    onMutate: ({ targetUserId }) => setRespondingTo(targetUserId),
    onSettled: () => setRespondingTo(null),
    onSuccess: (result, { targetUserId }) => {
      queryClient.invalidateQueries({ queryKey: ['icebreaker-nearby'] });
      queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      if (result.data?.matched && result.data.matchId) {
        const nearby = queryClient.getQueryData<{ data: IcebreakerNearbyUser[] }>(['icebreaker-nearby']);
        const person = nearby?.data?.find((item) => item.userId === targetUserId);
        setCelebration({
          kind: 'mutual_yes',
          matchId: result.data.matchId,
          displayName: person?.displayName,
        });
      }
    },
    onError: (error: ApiError) => {
      if (!handleLivenessError(error)) {
        showToast(error.message, 'error');
      }
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (matchId: string) => api.acceptMatch(matchId),
    onMutate: (matchId) => setRespondingTo(matchId),
    onSettled: () => setRespondingTo(null),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['icebreaker-nearby'] });
      if (result.data.status === 'active' && result.data.chatId) {
        setCelebration({
          kind: 'connected',
          chatId: result.data.chatId,
          displayName: result.data.otherUser.displayName ?? result.data.otherUser.label,
        });
      }
    },
    onError: (error: ApiError) => {
      if (!handleLivenessError(error)) {
        showToast(error.message, 'error');
      }
    },
  });

  const declineMutation = useMutation({
    mutationFn: (matchId: string) => api.declineMatch(matchId),
    onMutate: (matchId) => setRespondingTo(matchId),
    onSettled: () => setRespondingTo(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['icebreaker-nearby'] });
      queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
    },
    onError: (error: ApiError) => {
      if (!handleLivenessError(error)) {
        showToast(error.message, 'error');
      }
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (interestIds: string[]) =>
      api.acknowledgeIcebreakerUnanswered({ interestIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
    },
  });

  if (permissionGranted === null) {
    return (
      <Screen padded={false}>
        <AppHeader
          title="Break the ice"
          showBrand={false}
          subtitle={ICEBREAKER_SUBTITLE}
        />
        <LoadingView />
      </Screen>
    );
  }

  if (permissionGranted === false) {
    return (
      <Screen padded={false} edges={[]}>
        <AppHeader
          title="Break the ice"
          showBrand={false}
          subtitle={ICEBREAKER_SUBTITLE}
        />
        <View style={[styles.denied, { paddingBottom: contentBottom }]}>
          <EmptyState
            icon="location"
            title="Location permission needed"
            message="Turn on location to browse people nearby in Break the ice mode."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader
        title="Break the ice"
        showBrand={false}
        subtitle={ICEBREAKER_SUBTITLE}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: contentBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {!isVerified ? <LivenessBanner /> : null}

        {unanswered.map((notice) => (
          <Card key={notice.interestId} variant="muted" style={styles.unansweredCard}>
            <View style={styles.unansweredRow}>
              <AppIcon name="clock" size={18} color={colors.inkTertiary} />
              <Text style={styles.unansweredText}>
                {notice.displayName} didn&apos;t respond in time. Your request was removed.
              </Text>
              <Pressable
                onPress={() => acknowledgeMutation.mutate([notice.interestId])}
                disabled={acknowledgeMutation.isPending}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.dismissPressed}
              >
                <AppIcon name="close" size={18} color={colors.inkTertiary} />
              </Pressable>
            </View>
          </Card>
        ))}

        <View style={styles.toggleBar}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Break the ice</Text>
            <Text style={styles.toggleHint}>
              {icebreakerOn
                ? `Others within ${distanceConfig.icebreaker.radiusMeters}m can see you're open to connecting`
                : `Turn on to browse people ${icebreakerRadiusTextLower} who are open to connecting.`}
            </Text>
          </View>
          <AppSwitch
            variant="online"
            value={icebreakerOn}
            onValueChange={handleToggle}
            disabled={icebreakerMutation.isPending}
          />
        </View>

        {pendingConnections.length > 0 ? (
          <View style={styles.pendingSection}>
            <SectionLabel>Connection requests</SectionLabel>
            {pendingConnections.map((connection) => (
              <PendingConnectionCard
                key={connection.id}
                connection={connection}
                loading={respondingTo === connection.id}
                onAccept={() => {
                  if (!ensureVerified()) return;
                  acceptMutation.mutate(connection.id);
                }}
                onDecline={() => declineMutation.mutate(connection.id)}
              />
            ))}
          </View>
        ) : null}

        {canBrowse ? (
          <View style={styles.browseSection}>
            <View style={styles.sectionHeader}>
              <SectionLabel>
                {featuredCount > 0
                  ? `${featuredCount} ${featuredCount === 1 ? 'person' : 'people'} to review`
                  : 'Nearby now'}
              </SectionLabel>
              {nearbyRefreshing && !nearbyInitialLoad ? (
                <ActivityIndicator size="small" color={colors.inkTertiary} />
              ) : null}
            </View>
            {nearbyInitialLoad ? (
              <ActivityIndicator color={colors.accent} style={styles.nearbyLoader} />
            ) : nearbyPeople.length === 0 ? (
              <EmptyState
                icon="people"
                title={icebreakerOn ? 'No one else yet' : 'Turn on Break the ice'}
                message={
                  icebreakerOn
                    ? `Keep it on — someone ${icebreakerRadiusTextLower} may appear soon.`
                    : 'Switch Break the ice on to browse people nearby who also want to connect.'
                }
                action={
                  !icebreakerOn ? (
                    <Button
                      label="Turn on Break the ice"
                      variant="icebreaker"
                      onPress={() => {
                        if (!ensureVerified()) return;
                        setIcebreakerSetupOpen(true);
                      }}
                    />
                  ) : undefined
                }
              />
            ) : (
              <View style={styles.nearbyList}>
                {nearbyPeople.map((person) => (
                  <IcebreakerRow
                    key={person.userId}
                    person={person}
                    loading={
                      respondingTo === person.userId ||
                      (!!person.matchId && respondingTo === person.matchId)
                    }
                    onYes={() => {
                      if (!ensureVerified()) return;
                      interestMutation.mutate({ targetUserId: person.userId, interested: true });
                    }}
                    onNo={() =>
                      interestMutation.mutate({ targetUserId: person.userId, interested: false })
                    }
                    onAccept={() => {
                      if (!person.matchId) return;
                      if (!ensureVerified()) return;
                      acceptMutation.mutate(person.matchId);
                    }}
                    onDecline={() => {
                      if (!person.matchId) return;
                      declineMutation.mutate(person.matchId);
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <BottomSheet
        visible={icebreakerSetupOpen}
        title="Break the ice"
        onClose={() => setIcebreakerSetupOpen(false)}
      >
        <Text style={styles.sheetBody}>
          You&apos;ll appear to others {icebreakerRadiusTextLower} who also have Break the
          ice on. Add an optional intro — your photo stays hidden unless you choose to show it.
        </Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Show my photo</Text>
          <AppSwitch variant="accent" value={showPhoto} onValueChange={setShowPhoto} />
        </View>
        <Input
          label="Intro (optional)"
          placeholder="Coffee? Study buddy?"
          maxLength={100}
          value={introMessage}
          onChangeText={setIntroMessage}
          hint={`${introMessage.length}/100`}
        />
        <Button
          label="Turn on"
          variant="icebreaker"
          onPress={() => icebreakerMutation.mutate('start')}
          loading={icebreakerMutation.isPending}
          style={styles.sheetButton}
        />
        <Button label="Cancel" variant="ghost" onPress={() => setIcebreakerSetupOpen(false)} />
      </BottomSheet>

      <ConnectionCelebrationModal
        visible={celebration !== null}
        kind={celebration?.kind ?? 'mutual_yes'}
        displayName={celebration?.displayName}
        onPrimary={() => {
          if (celebration?.kind === 'connected' && celebration.chatId) {
            router.push(`/chat/${celebration.chatId}`);
          } else if (celebration?.matchId) {
            router.push(`/match/${celebration.matchId}`);
          }
          setCelebration(null);
        }}
        onClose={() => setCelebration(null)}
      />
    </Screen>
  );
}

import { icebreakerRadiusLabel } from '@pingme/shared';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { api, ApiError, IcebreakerNearbyUser } from '../../src/lib/api';
import { useLocationPing } from '../../src/hooks/use-location-ping';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
import {
  AppHeader,
  BottomSheet,
  Button,
  Card,
  DistancePill,
  EmptyState,
  Input,
  LivenessBanner,
  Screen,
} from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';

function HighlightBadge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Ionicons name="sparkles" size={12} color={colors.icebreakerStart} />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
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
  const featured = person.highlight !== null;
  const waiting = person.myResponse === 'yes' && person.highlight !== 'mutual_match';

  return (
    <Card style={[styles.personCard, featured && styles.personCardFeatured]}>
      {person.highlight === 'mutual_match' ? (
        <HighlightBadge label="You both said yes" />
      ) : person.highlight === 'interested_in_you' ? (
        <HighlightBadge label="Interested in you" />
      ) : null}

      <View style={styles.personHeader}>
        <View style={styles.personAvatar}>
          {person.avatarUrl ? (
            <Image source={{ uri: person.avatarUrl }} style={styles.personAvatarImage} />
          ) : (
            <Text style={styles.personAvatarText}>{person.displayName.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.personMeta}>
          <Text style={styles.personName}>{person.displayName}</Text>
          <DistancePill label={icebreakerRadiusLabel()} tone="near" />
        </View>
      </View>

      {person.introMessage ? (
        <Text style={styles.personIntro}>&ldquo;{person.introMessage}&rdquo;</Text>
      ) : null}

      {person.highlight === 'mutual_match' && person.matchId ? (
        <View style={styles.responseRow}>
          <Pressable style={[styles.responseBtn, styles.noBtn]} onPress={onDecline} disabled={loading}>
            <Text style={styles.noBtnText}>Not now</Text>
          </Pressable>
          <Pressable style={[styles.responseBtn, styles.yesBtn]} onPress={onAccept} disabled={loading}>
            <Text style={styles.yesBtnText}>Accept</Text>
          </Pressable>
        </View>
      ) : waiting ? (
        <Text style={styles.waitingText}>Waiting for their response…</Text>
      ) : (
        <View style={styles.responseRow}>
          <Pressable style={[styles.responseBtn, styles.noBtn]} onPress={onNo} disabled={loading}>
            <Text style={styles.noBtnText}>No</Text>
          </Pressable>
          <Pressable style={[styles.responseBtn, styles.yesBtn]} onPress={onYes} disabled={loading}>
            <Text style={styles.yesBtnText}>Yes</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

export default function IcebreakerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { contentBottom } = useTabBarInsets();
  const { coords } = useLocationPing(true);
  const { ensureVerified, handleLivenessError, isVerified } = useLivenessGate();
  const [icebreakerSetupOpen, setIcebreakerSetupOpen] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const [introMessage, setIntroMessage] = useState('');
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [icebreakerOn, setIcebreakerOn] = useState(false);

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then(({ status }) => {
      setLocationGranted(status === 'granted');
    });
  }, []);

  const { data: icebreakerData, isLoading } = useQuery({
    queryKey: ['icebreaker-status'],
    queryFn: () => api.getIcebreakerStatus(),
    enabled: !!coords,
    refetchInterval: 15_000,
  });

  const serverIcebreakerActive = icebreakerData?.data?.status === 'active';

  useEffect(() => {
    setIcebreakerOn(serverIcebreakerActive);
  }, [serverIcebreakerActive]);

  const { data: matchesData } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.getMatches(),
    enabled: !!coords,
    refetchInterval: 15_000,
  });

  const hasPendingMatch = (matchesData?.data ?? []).some(
    (m) => m.status === 'pending' && m.source === 'icebreaker',
  );

  const canBrowse = icebreakerOn || hasPendingMatch;

  const { data: nearbyData, isLoading: nearbyLoading } = useQuery({
    queryKey: ['icebreaker-nearby'],
    queryFn: () => api.getIcebreakerNearby(),
    enabled: !!coords && canBrowse,
    refetchInterval: 15_000,
  });

  const people = nearbyData?.data ?? [];
  const featuredCount = people.filter((p) => p.highlight !== null).length;

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
      setIcebreakerOn(action === 'start');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
      queryClient.invalidateQueries({ queryKey: ['icebreaker-nearby'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      setIcebreakerSetupOpen(false);
    },
    onError: (error: ApiError) => {
      setIcebreakerOn(serverIcebreakerActive);
      if (!handleLivenessError(error)) {
        alert(error.message);
      }
    },
  });

  const interestMutation = useMutation({
    mutationFn: (payload: { targetUserId: string; interested: boolean }) =>
      api.setIcebreakerInterest(payload),
    onMutate: ({ targetUserId }) => setRespondingTo(targetUserId),
    onSettled: () => setRespondingTo(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icebreaker-nearby'] });
      queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
    onError: (error: ApiError) => {
      if (!handleLivenessError(error)) {
        alert(error.message);
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
        router.push(`/chat/${result.data.chatId}`);
      }
    },
    onError: (error: ApiError) => {
      if (!handleLivenessError(error)) {
        alert(error.message);
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
        alert(error.message);
      }
    },
  });

  const handleToggle = (on: boolean) => {
    if (on) {
      if (!ensureVerified()) return;
      setIcebreakerSetupOpen(true);
      return;
    }
    setIcebreakerOn(false);
    icebreakerMutation.mutate('cancel');
  };

  if (isLoading || locationGranted === null) {
    return (
      <Screen padded={false}>
        <AppHeader title="Break the ice" showBrand={false} />
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      </Screen>
    );
  }

  if (locationGranted === false) {
    return (
      <Screen padded={false} edges={[]}>
        <AppHeader title="Break the ice" showBrand={false} />
        <View style={[styles.denied, { paddingBottom: contentBottom }]}>
          <EmptyState
            icon="location-outline"
            title="Location permission needed"
            message="Turn on location to browse people nearby in Break the ice mode."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader title="Break the ice" showBrand={false} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: contentBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {!isVerified ? <LivenessBanner /> : null}

        <Card style={styles.card}>
          <View style={styles.icebreakerHeader}>
            <View style={styles.icebreakerTitleRow}>
              <Ionicons name="flash" size={22} color={colors.icebreakerStart} />
              <View style={styles.icebreakerTitleBlock}>
                <Text style={styles.icebreakerTitle}>Break the ice</Text>
                <Text style={styles.icebreakerSubtitle}>
                  {icebreakerOn ? 'You are visible nearby' : 'You are hidden'}
                </Text>
              </View>
            </View>
            <Switch
              value={icebreakerOn}
              onValueChange={handleToggle}
              trackColor={{ false: colors.outlineVariant, true: colors.icebreakerStart }}
              thumbColor="#fff"
              disabled={icebreakerMutation.isPending}
            />
          </View>
          <Text style={styles.hint}>
            {icebreakerOn
              ? `People with Break the ice ON ${icebreakerRadiusLabel().toLowerCase()} show up below. Tap Yes to connect.`
              : 'Turn on to appear in the list. Interested people are shown first.'}
          </Text>
        </Card>

        {canBrowse ? (
          <View style={styles.browseSection}>
            <Text style={styles.sectionTitle}>
              {featuredCount > 0
                ? `${featuredCount} ${featuredCount === 1 ? 'person' : 'people'} to review`
                : 'Nearby now'}
            </Text>
            {nearbyLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.nearbyLoader} />
            ) : people.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="people-outline" size={32} color={colors.onSurfaceVariant} />
                <Text style={styles.emptyTitle}>No one else yet</Text>
                <Text style={styles.emptyHint}>
                  Keep Break the ice on — someone {icebreakerRadiusLabel().toLowerCase()} may appear
                  soon.
                </Text>
              </Card>
            ) : (
              <View style={styles.nearbyList}>
                {people.map((person) => (
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
          You&apos;ll appear to others {icebreakerRadiusLabel().toLowerCase()} who also have Break the
          ice on. Add an optional intro — your photo stays hidden unless you choose to show it.
        </Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Show my photo</Text>
          <Switch
            value={showPhoto}
            onValueChange={setShowPhoto}
            trackColor={{ false: colors.outlineVariant, true: colors.icebreakerStart }}
            thumbColor="#fff"
          />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.section },
  denied: { flex: 1, justifyContent: 'center', padding: spacing.container },
  scroll: {
    paddingHorizontal: spacing.container,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  card: { alignItems: 'stretch' },
  hint: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    lineHeight: 22,
  },
  icebreakerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  icebreakerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  icebreakerTitleBlock: { flex: 1 },
  icebreakerTitle: { ...typography.headlineMd, color: colors.onSurface },
  icebreakerSubtitle: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'none',
    letterSpacing: 0,
    marginTop: 2,
  },
  browseSection: { gap: spacing.md },
  sectionTitle: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(255, 122, 69, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: spacing.sm,
  },
  badgeText: {
    ...typography.labelSm,
    color: colors.icebreakerStart,
    textTransform: 'none',
    letterSpacing: 0,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: { ...typography.headlineMd, color: colors.onSurface, marginTop: spacing.sm },
  emptyHint: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  nearbyLoader: { marginVertical: spacing.lg },
  nearbyList: { gap: spacing.md },
  personCard: { marginBottom: 0 },
  personCardFeatured: {
    borderColor: colors.icebreakerStart,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 122, 69, 0.04)',
  },
  personHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  personAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  personAvatarImage: { width: 48, height: 48 },
  personAvatarText: { ...typography.headlineMd, color: colors.primary, fontSize: 18 },
  personMeta: { flex: 1, gap: 4 },
  personName: { ...typography.headlineMd, color: colors.onSurface, fontSize: 17 },
  personIntro: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  waitingText: {
    ...typography.labelSm,
    color: colors.secondary,
    textTransform: 'none',
    letterSpacing: 0,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  responseRow: { flexDirection: 'row', gap: spacing.md },
  responseBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  noBtn: { backgroundColor: colors.surfaceContainerLow },
  yesBtn: { backgroundColor: colors.icebreakerStart },
  noBtnText: { ...typography.bodySemiBold, color: colors.onSurfaceVariant },
  yesBtnText: { ...typography.bodySemiBold, color: '#fff' },
  sheetBody: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
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
  toggleLabel: { ...typography.bodyMd, color: colors.onSurface },
});

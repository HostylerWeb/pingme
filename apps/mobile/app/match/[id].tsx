import { icebreakerRadiusLabel } from '@pingme/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/lib/api';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';
import { clearDismissedMatchPrompt, dismissMatchPrompt } from '../../src/lib/match-prompt-dismiss';
import { Button, Card, EmptyState, Screen } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { ensureVerified, handleLivenessError } = useLivenessGate();

  const { data, isLoading } = useQuery({
    queryKey: ['match', id],
    queryFn: () => api.getMatch(id!),
    enabled: !!id,
    refetchInterval: 15_000,
  });

  const goHome = () => {
    if (id) dismissMatchPrompt(id);
    router.replace('/(tabs)/home');
  };

  const acceptMutation = useMutation({
    mutationFn: () => api.acceptMatch(id!),
    onSuccess: (result) => {
      if (id) clearDismissedMatchPrompt(id);
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
      if (result.data.status === 'active' && result.data.chatId) {
        router.replace(`/chat/${result.data.chatId}`);
      } else if (result.data.status === 'active') {
        router.replace('/(tabs)/chats');
      }
    },
    onError: (error: Error) => {
      if (!handleLivenessError(error)) {
        alert(error.message);
      }
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => api.declineMatch(id!),
    onSuccess: () => {
      if (id) clearDismissedMatchPrompt(id);
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      goHome();
    },
    onError: (error: Error) => {
      if (!handleLivenessError(error)) {
        alert(error.message);
      }
    },
  });

  const match = data?.data;

  if (isLoading || !match) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (match.status === 'active') {
    return (
      <Screen style={styles.centered} edges={['top', 'bottom']}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>You&apos;re connected!</Text>
        <Text style={styles.body}>Start chatting with your match.</Text>
        <Button
          label="Open chat"
          variant="secondary"
          onPress={() =>
            match.chatId ? router.replace(`/chat/${match.chatId}`) : router.replace('/(tabs)/chats')
          }
          style={styles.cta}
        />
      </Screen>
    );
  }

  if (match.status === 'declined') {
    return (
      <Screen style={styles.centered} edges={['top', 'bottom']}>
        <EmptyState
          icon="close-circle-outline"
          title="Match declined"
          message="This connection request was declined. You can keep browsing the wall or try Break the ice again."
        />
        <Button label="Back to wall" onPress={() => router.replace('/(tabs)/home')} style={styles.cta} />
      </Screen>
    );
  }

  if (match.status === 'expired') {
    return (
      <Screen style={styles.centered} edges={['top', 'bottom']}>
        <EmptyState
          icon="time-outline"
          title="Match expired"
          message="This request timed out before both people accepted. Try Break the ice again when you're ready."
        />
        <Button label="Back to wall" onPress={() => router.replace('/(tabs)/home')} style={styles.cta} />
      </Screen>
    );
  }

  if (match.status !== 'pending') {
    return (
      <Screen style={styles.centered} edges={['top', 'bottom']}>
        <EmptyState
          icon="alert-circle-outline"
          title="Match unavailable"
          message="This match is no longer available."
        />
        <Button label="Go back" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={[]}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={goHome} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Match request</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.page}>
        <Card style={styles.card}>
          <Text style={styles.title}>Someone nearby wants to connect!</Text>

          <View style={styles.connection}>
            <View style={styles.anonAvatar}>
              <Ionicons name="person" size={32} color={colors.onSurfaceVariant} />
            </View>
            <View style={styles.line} />
            <View style={styles.youAvatar}>
              <Ionicons name="person" size={32} color={colors.primary} />
            </View>
          </View>

          <View style={styles.distancePill}>
            <Text style={styles.distanceText}>{icebreakerRadiusLabel()}</Text>
          </View>

          <Text style={styles.body}>
            If you accept, a private chat will open. This stays anonymous until you both agree.
          </Text>

          <Button
            label={match.youAccepted ? 'Accepted — waiting for them' : 'Accept'}
            variant="secondary"
            onPress={() => {
              if (!ensureVerified()) return;
              acceptMutation.mutate();
            }}
            loading={acceptMutation.isPending}
            disabled={match.youAccepted}
            style={styles.cta}
          />
          <Button
            label="Decline"
            variant="ghost"
            onPress={() => declineMutation.mutate()}
            loading={declineMutation.isPending}
          />
          <Button label="Not now" variant="ghost" onPress={goHome} />
        </Card>

        <View style={styles.trust}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.outline} />
          <Text style={styles.trustText}>Privacy: your profile is only visible to matches.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.container,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceBright,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  backBtn: { width: 40 },
  topTitle: { flex: 1, ...typography.headlineMd, fontSize: 17, textAlign: 'center', color: colors.onSurface },
  page: { flex: 1, justifyContent: 'center', padding: spacing.container, paddingBottom: spacing.section },
  centered: { justifyContent: 'center', alignItems: 'center' },
  card: { alignItems: 'center' },
  emoji: { fontSize: 48, marginBottom: spacing.lg, textAlign: 'center' },
  title: { ...typography.headlineLg, color: colors.onSurface, textAlign: 'center', marginBottom: spacing.xl },
  body: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 24, marginBottom: spacing.lg },
  connection: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  anonAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.secondaryContainer,
  },
  line: { width: 48, height: 2, backgroundColor: colors.primaryFixedDim, marginHorizontal: spacing.md },
  youAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distancePill: {
    backgroundColor: 'rgba(100, 249, 188, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: spacing.lg,
  },
  distanceText: { ...typography.distance, color: colors.onSecondaryContainer },
  cta: { width: '100%', marginBottom: spacing.md, marginTop: spacing.sm },
  trust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xl },
  trustText: { ...typography.labelSm, color: colors.outline, textTransform: 'none', letterSpacing: 0 },
});

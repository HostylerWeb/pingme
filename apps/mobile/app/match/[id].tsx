import { icebreakerRadiusLabel } from '@pingme/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';
import { clearDismissedMatchPrompt, dismissMatchPrompt } from '../../src/lib/match-prompt-dismiss';
import { showToast } from '../../src/stores/toast-store';
import { AppHeader, Avatar, Button, DistancePill, EmptyState, LoadingView, Screen } from '../../src/components/ui';
import { spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { ensureVerified, handleLivenessError } = useLivenessGate();

  const styles = useThemedStyles(({ colors }) => ({
    page: {
      flex: 1,
      paddingHorizontal: spacing.container,
      justifyContent: 'space-between',
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.container,
    },
    hero: {
      alignItems: 'center',
      paddingTop: spacing.xxl,
    },
    overline: {
      ...typography.overline,
      color: colors.inkTertiary,
      marginBottom: spacing.sm,
    },
    heroTitle: {
      ...typography.display,
      fontSize: 28,
      lineHeight: 34,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: spacing.xxl,
    },
    heroBody: {
      ...typography.bodyLg,
      color: colors.inkSecondary,
      textAlign: 'center',
      lineHeight: 26,
      maxWidth: 300,
      marginBottom: spacing.xl,
    },
    connection: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      marginBottom: spacing.xl,
      gap: spacing.md,
    },
    avatarWrap: {
      alignItems: 'center',
      gap: spacing.sm,
    },
    avatarLabel: {
      ...typography.labelSm,
      color: colors.inkTertiary,
      textTransform: 'none',
      letterSpacing: 0,
    },
    connector: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 28,
      gap: 4,
    },
    connectorLine: {
      width: 20,
      height: 1.5,
      backgroundColor: colors.accentMuted,
    },
    connectorDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copyBlock: {
      paddingVertical: spacing.lg,
    },
    body: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    actions: {
      gap: spacing.sm,
    },
    cta: {
      width: '100%',
    },
    trust: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: spacing.xl,
    },
    trustText: {
      ...typography.caption,
      color: colors.inkTertiary,
    },
    successIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
  }));

  const { data, isLoading, isError } = useQuery({
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
        showToast(error.message, 'error');
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
        showToast(error.message, 'error');
      }
    },
  });

  const match = data?.data;

  if (isLoading) {
    return (
      <Screen>
        <LoadingView message="Loading connection…" />
      </Screen>
    );
  }

  if (isError || !match) {
    return (
      <Screen padded={false} edges={[]}>
        <AppHeader title="Connection" showBrand={false} onBack={() => router.back()} centerTitle />
        <View style={styles.centered}>
          <EmptyState
            icon="heart-dislike-outline"
            title="Connection not found"
            message="This request may have expired or been removed."
            action={<Button label="Go back" variant="ghost" onPress={() => router.back()} />}
          />
        </View>
      </Screen>
    );
  }

  if (match.status === 'active') {
    return (
      <Screen padded={false} edges={[]}>
        <AppHeader title="Connected" showBrand={false} onBack={goHome} centerTitle />
        <View style={styles.centered}>
          <View style={styles.successIcon}>
            <Ionicons name="heart" size={32} color={colors.accent} />
          </View>
          <Text style={styles.heroTitle}>You&apos;re connected!</Text>
          <Text style={styles.heroBody}>Your private chat is ready. Say hello when you&apos;re ready.</Text>
          <Button
            label="Open chat"
            variant="primary"
            size="lg"
            onPress={() =>
              match.chatId ? router.replace(`/chat/${match.chatId}`) : router.replace('/(tabs)/chats')
            }
            style={styles.cta}
          />
        </View>
      </Screen>
    );
  }

  if (match.status === 'declined') {
    return (
      <Screen padded={false} edges={[]}>
        <AppHeader title="Connection" showBrand={false} onBack={() => router.replace('/(tabs)/home')} centerTitle />
        <View style={styles.centered}>
          <EmptyState
            icon="close-circle-outline"
            title="Connection declined"
            message="This connection request was declined. You can keep browsing the wall or try Break the ice again."
            action={
              <Button label="Back to wall" variant="outline" onPress={() => router.replace('/(tabs)/home')} />
            }
          />
        </View>
      </Screen>
    );
  }

  if (match.status === 'expired') {
    return (
      <Screen padded={false} edges={[]}>
        <AppHeader title="Connection" showBrand={false} onBack={() => router.replace('/(tabs)/home')} centerTitle />
        <View style={styles.centered}>
          <EmptyState
            icon="time-outline"
            title="Request expired"
            message="This request timed out before both people accepted. Try Break the ice again when you're ready."
            action={
              <Button label="Back to wall" variant="outline" onPress={() => router.replace('/(tabs)/home')} />
            }
          />
        </View>
      </Screen>
    );
  }

  if (match.status !== 'pending') {
    return (
      <Screen padded={false} edges={[]}>
        <AppHeader title="Connection" showBrand={false} onBack={() => router.back()} centerTitle />
        <View style={styles.centered}>
          <EmptyState
            icon="alert-circle-outline"
            title="Connection unavailable"
            message="This connection request is no longer available."
            action={<Button label="Go back" variant="ghost" onPress={() => router.back()} />}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader title="Connection request" showBrand={false} onBack={goHome} centerTitle />

      <View style={[styles.page, { paddingBottom: spacing.section + insets.bottom }]}>
        <View style={styles.hero}>
          <Text style={styles.overline}>Someone nearby</Text>
          <Text style={styles.heroTitle}>wants to connect</Text>

          <View style={styles.connection}>
            <View style={styles.avatarWrap}>
              <Avatar name="?" size="xl" />
              <Text style={styles.avatarLabel}>Them</Text>
            </View>

            <View style={styles.connector}>
              <View style={styles.connectorLine} />
              <View style={styles.connectorDot}>
                <Ionicons name="link" size={14} color={colors.accent} />
              </View>
              <View style={styles.connectorLine} />
            </View>

            <View style={styles.avatarWrap}>
              <Avatar name="You" size="xl" />
              <Text style={styles.avatarLabel}>You</Text>
            </View>
          </View>

          <DistancePill label={icebreakerRadiusLabel()} tone="near" />
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.body}>
            If you both accept, a private chat opens. You stay anonymous until you choose to share more.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label={match.youAccepted ? 'Accepted — waiting for them' : 'Accept connection'}
            variant="primary"
            size="lg"
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
            variant="outline"
            onPress={() => declineMutation.mutate()}
            loading={declineMutation.isPending}
          />
          <Button label="Not now" variant="ghost" onPress={goHome} />
        </View>

        <View style={styles.trust}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.inkTertiary} />
          <Text style={styles.trustText}>Your profile is only visible to people you&apos;re connected with.</Text>
        </View>
      </View>
    </Screen>
  );
}

import { useMutation, useQuery } from '@tanstack/react-query';
import { ACCOUNT_DELETION_GRACE_DAYS } from '@pingme/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, api } from '../src/lib/api';
import { useAuthStore } from '../src/stores/auth-store';
import { showToast } from '../src/stores/toast-store';
import { AppHeader, Button, Input, PasswordInput, Screen } from '../src/components/ui';
import { radius, spacing, typography, useThemedStyles } from '../src/theme';

const DELETE_CONFIRMATION = 'DELETE';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const logout = useAuthStore((s) => s.logout);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.getSubscription(),
  });

  const { data: meData, refetch: refetchMe } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.me(),
  });

  const isPremium = subscriptionData?.data?.isPremium ?? false;
  const cancelAtPeriodEnd = subscriptionData?.data?.cancelAtPeriodEnd ?? false;
  const deletionScheduledAt = meData?.data?.deletionScheduledAt ?? null;

  const styles = useThemedStyles(({ colors }) => ({
    content: { paddingHorizontal: spacing.container, paddingBottom: insets.bottom + spacing.xxl },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    title: { ...typography.title, color: colors.ink, marginBottom: spacing.xs },
    body: { ...typography.bodyMd, color: colors.inkSecondary, lineHeight: 22 },
    bullet: { ...typography.bodyMd, color: colors.inkSecondary, lineHeight: 22 },
    warning: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.destructiveBorder,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    warningText: { ...typography.bodyMd, color: colors.destructive, lineHeight: 22 },
    scheduled: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.accentMuted,
    },
    scheduledText: { ...typography.bodyMd, color: colors.ink, lineHeight: 22 },
    field: { marginBottom: spacing.md },
  }));

  const scheduleMutation = useMutation({
    mutationFn: () =>
      api.scheduleAccountDeletion({
        password,
        confirmation: DELETE_CONFIRMATION,
      }),
    onSuccess: async (result) => {
      await logout();
      showToast(
        `Account scheduled for deletion in ${result.data.graceDays} days`,
        'success',
      );
      router.replace('/(auth)/login');
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'Could not schedule deletion';
      showToast(message, 'error');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelAccountDeletion({ password }),
    onSuccess: async () => {
      setPassword('');
      await refreshMe();
      await refetchMe();
      showToast('Account deletion cancelled', 'success');
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'Could not cancel deletion';
      showToast(message, 'error');
    },
  });

  const premiumBlocksDelete = isPremium && !cancelAtPeriodEnd;

  const canSubmitDelete =
    password.trim().length > 0 &&
    confirmation.trim() === DELETE_CONFIRMATION &&
    !premiumBlocksDelete &&
    !scheduleMutation.isPending;

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader
        title="Delete account"
        showBrand={false}
        subtitle="Review what happens before you continue."
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {deletionScheduledAt ? (
          <View style={styles.scheduled}>
            <Text style={styles.scheduledText}>
              Your account is scheduled for permanent deletion on{' '}
              {new Date(deletionScheduledAt).toLocaleString()}. You can cancel below before that date.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.title}>What will be removed</Text>
          <Text style={styles.bullet}>• Your profile, login, and push devices</Text>
          <Text style={styles.bullet}>• Wall posts and replies</Text>
          <Text style={styles.bullet}>• Visibility on the Wall and Break the ice</Text>
          <Text style={styles.body}>
            After you confirm, your account enters a {ACCOUNT_DELETION_GRACE_DAYS}-day grace period.
            You can log back in and cancel before the deletion date.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>What we may keep</Text>
          <Text style={styles.bullet}>• Safety reports and moderation records (anonymized where possible)</Text>
          <Text style={styles.bullet}>• Security and audit logs for abuse prevention</Text>
          <Text style={styles.bullet}>• Billing records if you had a subscription</Text>
        </View>

        {premiumBlocksDelete ? (
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              Cancel your Premium subscription in the Play Store or App Store before deleting your account.
            </Text>
            <Button
              label="Manage subscription"
              variant="outline"
              onPress={() => void Linking.openSettings()}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : null}

        <View style={styles.field}>
          <PasswordInput
            label="Confirm your password"
            placeholder="Your current password"
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {deletionScheduledAt ? (
          <Button
            label={cancelMutation.isPending ? 'Cancelling…' : 'Cancel scheduled deletion'}
            onPress={() => cancelMutation.mutate()}
            loading={cancelMutation.isPending}
            disabled={!password.trim()}
          />
        ) : (
          <>
            <View style={styles.field}>
              <Input
                label={`Type ${DELETE_CONFIRMATION} to confirm`}
                placeholder={DELETE_CONFIRMATION}
                value={confirmation}
                onChangeText={setConfirmation}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <Button
              label={scheduleMutation.isPending ? 'Scheduling…' : 'Schedule account deletion'}
              variant="danger"
              onPress={() => scheduleMutation.mutate()}
              loading={scheduleMutation.isPending}
              disabled={!canSubmitDelete}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PREMIUM_AVATAR_THEMES } from '@pingme/shared';
import { api, SubscriptionInfo } from '../src/lib/api';
import { useAuthStore } from '../src/stores/auth-store';
import { AppHeader, Screen } from '../src/components/ui';
import { colors, radius, spacing, typography } from '../src/theme';

export default function PremiumScreen() {
  const queryClient = useQueryClient();
  const refreshMe = useAuthStore((s) => s.refreshMe);

  const { data: subscriptionData, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.getSubscription(),
  });

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => api.getSubscriptionPlans(),
  });

  const { data: settingsData } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => api.getSettings(),
  });

  const themeMutation = useMutation({
    mutationFn: (avatarTheme: 'aurora' | 'sunset' | 'midnight' | 'forest') =>
      api.updateProfile({ avatarTheme }),
    onSuccess: async () => {
      await refreshMe();
      Alert.alert('Theme updated');
    },
    onError: (error: Error) => Alert.alert('Could not update theme', error.message),
  });

  const settingsMutation = useMutation({
    mutationFn: (showReadReceipts: boolean) => api.updateSettings({ showReadReceipts }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-settings'] }),
    onError: (error: Error) => Alert.alert('Could not update setting', error.message),
  });

  const checkoutMutation = useMutation({
    mutationFn: () => api.startSubscriptionCheckout(),
    onError: (error: Error) => Alert.alert('Payments coming soon', error.message),
  });

  if (subLoading || plansLoading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  const subscription: SubscriptionInfo | undefined = subscriptionData?.data;
  const plans = plansData?.data;
  const isPremium = subscription?.isPremium ?? false;
  const settings = settingsData?.data;

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader title="Premium" showBrand={false} />
      <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Go Premium</Text>
      <Text style={styles.subtitle}>
        Wall and chat stay free. Premium adds flair and optional read receipts.
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Your plan</Text>
        <Text style={styles.statusValue}>{isPremium ? 'Premium' : 'Free'}</Text>
        {subscription?.currentPeriodEnd ? (
          <Text style={styles.statusMeta}>
            Active until {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </Text>
        ) : null}
      </View>

      {plans?.plans.map((plan: { id: string; name: string; priceLabel: string; features: string[] }) => (
        <View key={plan.id} style={styles.planCard}>
          <View style={styles.planHeader}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>{plan.priceLabel}</Text>
          </View>
          {plan.features.map((feature: string) => (
            <Text key={feature} style={styles.planFeature}>
              • {feature}
            </Text>
          ))}
        </View>
      ))}

      {!isPremium ? (
        <>
          <Pressable
            style={[styles.primaryButton, !plans?.paymentsEnabled && styles.primaryButtonDisabled]}
            disabled={!plans?.paymentsEnabled || checkoutMutation.isPending}
            onPress={() => checkoutMutation.mutate()}
          >
            <Text style={styles.primaryButtonText}>
              {plans?.paymentsEnabled ? 'Subscribe to Premium' : 'Payments coming soon'}
            </Text>
          </Pressable>

          <View style={styles.premiumSection}>
            <Text style={styles.sectionTitle}>Avatar themes</Text>
            <Text style={styles.sectionHint}>Premium unlocks gradient rings on your profile and wall posts.</Text>
            <View style={styles.themeGrid}>
              {PREMIUM_AVATAR_THEMES.map((theme) => (
                <Pressable
                  key={theme.id}
                  style={styles.themeOption}
                  onPress={() =>
                    Alert.alert(
                      'Premium feature',
                      'Subscribe to Premium to unlock avatar theme rings and read receipts.',
                    )
                  }
                >
                  <View style={styles.lockedSwatchWrap}>
                    <LinearGradient
                      colors={[...theme.colors] as [string, string, ...string[]]}
                      style={[styles.themeSwatch, styles.themeSwatchLocked]}
                    />
                    <View style={styles.lockBadge}>
                      <Ionicons name="lock-closed" size={14} color={colors.onPrimary} />
                    </View>
                  </View>
                  <Text style={styles.themeLabel}>{theme.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      ) : (
        <View style={styles.premiumSection}>
          <Text style={styles.sectionTitle}>Avatar theme</Text>
          <Text style={styles.sectionHint}>Pick a gradient ring for your profile.</Text>
          <View style={styles.themeGrid}>
            {PREMIUM_AVATAR_THEMES.map((theme) => (
              <Pressable
                key={theme.id}
                style={styles.themeOption}
                disabled={themeMutation.isPending}
                onPress={() => themeMutation.mutate(theme.id as 'aurora' | 'sunset' | 'midnight' | 'forest')}
              >
                <LinearGradient
                  colors={[...theme.colors] as [string, string, ...string[]]}
                  style={styles.themeSwatch}
                />
                <Text style={styles.themeLabel}>{theme.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Read receipts</Text>
              <Text style={styles.settingHint}>Let others see when you read their messages</Text>
            </View>
            <Switch
              value={settings?.showReadReceipts ?? false}
              onValueChange={(value) => settingsMutation.mutate(value)}
              disabled={settingsMutation.isPending}
            />
          </View>
        </View>
      )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.container, paddingBottom: 40 },
  title: { ...typography.display, color: colors.onSurface, marginBottom: spacing.sm },
  subtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginBottom: spacing.xxl, lineHeight: 24 },
  statusCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statusLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, textTransform: 'none', letterSpacing: 0 },
  statusValue: { ...typography.headlineLg, color: colors.onSurface, marginTop: 4 },
  statusMeta: { ...typography.bodyMd, color: colors.outline, fontSize: 13, marginTop: 4 },
  planCard: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceBright,
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  planName: { ...typography.headlineMd, fontSize: 18 },
  planPrice: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  planFeature: { ...typography.bodyMd, color: colors.onSurfaceVariant, fontSize: 14, marginTop: 4 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryButtonDisabled: { backgroundColor: colors.outline },
  primaryButtonText: { ...typography.bodySemiBold, color: colors.onPrimary },
  premiumSection: { marginTop: spacing.sm },
  sectionTitle: { ...typography.headlineMd, marginBottom: 4 },
  sectionHint: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginBottom: spacing.lg, fontSize: 14 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xxl },
  themeOption: { alignItems: 'center', width: 72 },
  themeSwatch: { width: 56, height: 56, borderRadius: 28, marginBottom: 6 },
  themeSwatchLocked: { opacity: 0.55 },
  lockedSwatchWrap: { position: 'relative', marginBottom: 6 },
  lockBadge: {
    position: 'absolute',
    right: -2,
    bottom: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, textTransform: 'none', letterSpacing: 0 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  settingText: { flex: 1, paddingRight: spacing.md },
  settingLabel: { ...typography.bodySemiBold, fontSize: 16 },
  settingHint: { ...typography.bodyMd, color: colors.outline, fontSize: 13, marginTop: 2 },
});

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PREMIUM_AVATAR_THEMES } from '@pingme/shared';
import { api, SubscriptionInfo } from '../src/lib/api';
import { useAuthStore } from '../src/stores/auth-store';
import { showToast } from '../src/stores/toast-store';
import { AppHeader, AppSwitch, Button, Card, Screen, SectionLabel } from '../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../src/theme';

export default function PremiumScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const user = useAuthStore((s) => s.user);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const currentAvatarTheme =
    (user?.profile as { avatarConfig?: { theme?: string } } | null | undefined)?.avatarConfig?.theme ?? null;

  const styles = useThemedStyles(({ colors }) => ({
    content: { padding: spacing.container, paddingBottom: insets.bottom + 40 },
    hero: {
      alignItems: 'center',
      marginBottom: spacing.xxl,
    },
    heroBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.premiumSurface,
      borderWidth: 1,
      borderColor: colors.premiumSurfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.display,
      fontSize: 28,
      lineHeight: 34,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 320,
    },
    statusCard: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    statusCardPremium: {
      backgroundColor: colors.premiumSurface,
      borderColor: colors.premiumSurfaceBorder,
    },
    statusLabel: {
      ...typography.overline,
      color: colors.inkTertiary,
      fontSize: 10,
    },
    statusValue: {
      ...typography.headlineLg,
      color: colors.ink,
      marginTop: 4,
    },
    statusValuePremium: {
      color: colors.premiumOnSurface,
    },
    statusMeta: {
      ...typography.caption,
      color: colors.premiumOnSurfaceMuted,
      marginTop: 4,
    },
    planCard: {
      marginBottom: spacing.md,
      padding: spacing.lg,
      borderColor: colors.premiumSurfaceBorder,
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: spacing.md,
    },
    planName: {
      ...typography.headlineMd,
      color: colors.ink,
      fontSize: 18,
    },
    planPrice: {
      ...typography.bodySemiBold,
      color: colors.premiumOnSurface,
      fontSize: 16,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    planFeature: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      fontSize: 14,
      flex: 1,
      lineHeight: 20,
    },
    subscribeBtn: {
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
    },
    premiumSection: { marginTop: spacing.sm },
    sectionHint: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      marginBottom: spacing.lg,
      fontSize: 14,
      lineHeight: 20,
    },
    themeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginBottom: spacing.xxl,
    },
    themeOption: { alignItems: 'center', width: 72 },
    themeSwatch: {
      width: 56,
      height: 56,
      borderRadius: 28,
      marginBottom: 6,
    },
    themeSwatchLocked: { opacity: 0.5 },
    lockedSwatchWrap: { position: 'relative', marginBottom: 6 },
    lockBadge: {
      position: 'absolute',
      right: -2,
      bottom: 2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.premiumSurface,
      borderWidth: 1,
      borderColor: colors.premiumSurfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeLabel: {
      ...typography.labelSm,
      color: colors.inkSecondary,
      textTransform: 'none',
      letterSpacing: 0,
      textAlign: 'center',
    },
    themeSwatchSelected: {
      borderWidth: 3,
      borderColor: colors.premiumStart,
    },
    themeCheck: {
      position: 'absolute',
      right: 0,
      bottom: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.premiumStart,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.premiumSurfaceBorder,
    },
    settingText: { flex: 1, paddingRight: spacing.md },
    settingLabel: {
      ...typography.bodySemiBold,
      fontSize: 16,
      color: colors.ink,
    },
    settingHint: {
      ...typography.caption,
      color: colors.inkTertiary,
      marginTop: 2,
    },
  }));

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
      showToast('Theme updated', 'success');
    },
    onError: (error: Error) => showToast(error.message, 'error'),
  });

  const settingsMutation = useMutation({
    mutationFn: (showReadReceipts: boolean) => api.updateSettings({ showReadReceipts }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-settings'] }),
    onError: (error: Error) => showToast(error.message, 'error'),
  });

  const checkoutMutation = useMutation({
    mutationFn: () => api.startSubscriptionCheckout(),
    onError: (error: Error) => showToast(error.message, 'error'),
  });

  if (subLoading || plansLoading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={colors.premiumStart} />
      </Screen>
    );
  }

  const subscription: SubscriptionInfo | undefined = subscriptionData?.data;
  const plans = plansData?.data;
  const isPremium = subscription?.isPremium ?? false;
  const settings = settingsData?.data;

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader title="Premium" showBrand={false} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Ionicons name="diamond-outline" size={20} color={colors.premiumOnSurface} />
          </View>
          <Text style={styles.title}>{isPremium ? 'Premium membership' : 'Go Premium'}</Text>
          <Text style={styles.subtitle}>
            {isPremium
              ? 'You have access to all Premium perks below.'
              : 'Wall and chat stay free. Premium adds flair and optional read receipts.'}
          </Text>
        </View>

        <View style={[styles.statusCard, isPremium && styles.statusCardPremium]}>
          <Text style={styles.statusLabel}>Your plan</Text>
          <Text style={[styles.statusValue, isPremium && styles.statusValuePremium]}>
            {isPremium ? 'Premium member' : 'Free'}
          </Text>
          {subscription?.currentPeriodEnd ? (
            <Text style={styles.statusMeta}>
              Active until {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </Text>
          ) : null}
        </View>

        {!isPremium ? (
          <>
            {plans?.plans.map((plan: { id: string; name: string; priceLabel: string; features: string[] }) => (
              <Card key={plan.id} style={styles.planCard} variant="flat">
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planPrice}>{plan.priceLabel}</Text>
                </View>
                {plan.features.map((feature: string) => (
                  <View key={feature} style={styles.featureRow}>
                    <Ionicons name="checkmark" size={16} color={colors.premiumStart} />
                    <Text style={styles.planFeature}>{feature}</Text>
                  </View>
                ))}
              </Card>
            ))}

            <Button
              label={plans?.paymentsEnabled ? 'Subscribe to Premium' : 'Payments coming soon'}
              variant="premium"
              size="lg"
              disabled={!plans?.paymentsEnabled}
              loading={checkoutMutation.isPending}
              onPress={() => checkoutMutation.mutate()}
              style={styles.subscribeBtn}
            />

            <View style={styles.premiumSection}>
              <SectionLabel>Avatar themes</SectionLabel>
              <Text style={styles.sectionHint}>Premium unlocks gradient rings on your profile and wall posts.</Text>
              <View style={styles.themeGrid}>
                {PREMIUM_AVATAR_THEMES.map((theme) => (
                  <Pressable
                    key={theme.id}
                    style={styles.themeOption}
                    onPress={() =>
                      showToast('Subscribe to Premium to unlock avatar themes and read receipts.', 'info')
                    }
                  >
                    <View style={styles.lockedSwatchWrap}>
                      <LinearGradient
                        colors={[...theme.colors] as [string, string, ...string[]]}
                        style={[styles.themeSwatch, styles.themeSwatchLocked]}
                      />
                      <View style={styles.lockBadge}>
                        <Ionicons name="lock-closed" size={12} color={colors.premiumOnSurface} />
                      </View>
                    </View>
                    <Text style={styles.themeLabel}>{theme.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.premiumSection}>
              <SectionLabel>Your benefits</SectionLabel>
              <Card style={styles.planCard} variant="flat">
                {[
                  'Animated gradient avatar rings',
                  'Premium star next to your name',
                  'Optional read receipts in chat',
                ].map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.premiumStart} />
                    <Text style={styles.planFeature}>{feature}</Text>
                  </View>
                ))}
              </Card>
            </View>

            <View style={styles.premiumSection}>
              <SectionLabel>Avatar theme</SectionLabel>
              <Text style={styles.sectionHint}>Pick a gradient ring for your profile.</Text>
              <View style={styles.themeGrid}>
                {PREMIUM_AVATAR_THEMES.map((theme) => {
                  const isSelected = currentAvatarTheme === theme.id;
                  return (
                    <Pressable
                      key={theme.id}
                      style={styles.themeOption}
                      disabled={themeMutation.isPending}
                      onPress={() => themeMutation.mutate(theme.id as 'aurora' | 'sunset' | 'midnight' | 'forest')}
                    >
                      <View>
                        <LinearGradient
                          colors={[...theme.colors] as [string, string, ...string[]]}
                          style={[styles.themeSwatch, isSelected && styles.themeSwatchSelected]}
                        />
                        {isSelected ? (
                          <View style={styles.themeCheck}>
                            <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.themeLabel}>{theme.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Read receipts</Text>
                <Text style={styles.settingHint}>Let others see when you read their messages</Text>
              </View>
              <AppSwitch
                variant="premium"
                value={settings?.showReadReceipts ?? false}
                onValueChange={(value) => settingsMutation.mutate(value)}
                disabled={settingsMutation.isPending}
              />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

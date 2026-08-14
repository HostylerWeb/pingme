import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { PREMIUM_AVATAR_THEMES } from '@pingme/shared';
import { api, SubscriptionInfo } from '../src/lib/api';
import { useAuthStore } from '../src/stores/auth-store';

export default function PremiumScreen() {
  const router = useRouter();
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const subscription: SubscriptionInfo | undefined = subscriptionData?.data;
  const plans = plansData?.data;
  const isPremium = subscription?.isPremium ?? false;
  const settings = settingsData?.data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>PingMe Premium</Text>
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
        <Pressable
          style={[styles.primaryButton, !plans?.paymentsEnabled && styles.primaryButtonDisabled]}
          disabled={!plans?.paymentsEnabled || checkoutMutation.isPending}
          onPress={() => checkoutMutation.mutate()}
        >
          <Text style={styles.primaryButtonText}>
            {plans?.paymentsEnabled ? 'Subscribe to Premium' : 'Payments coming soon'}
          </Text>
        </Pressable>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { marginBottom: 12 },
  backText: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#64748b', marginBottom: 24, lineHeight: 22 },
  statusCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusLabel: { fontSize: 13, color: '#64748b' },
  statusValue: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  statusMeta: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  planCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  planName: { fontSize: 18, fontWeight: '600' },
  planPrice: { fontSize: 16, color: '#64748b' },
  planFeature: { fontSize: 14, color: '#475569', marginTop: 4 },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: { backgroundColor: '#94a3b8' },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  premiumSection: { marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  sectionHint: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  themeOption: { alignItems: 'center', width: 72 },
  themeSwatch: { width: 56, height: 56, borderRadius: 28, marginBottom: 6 },
  themeLabel: { fontSize: 12, color: '#475569' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  settingText: { flex: 1, paddingRight: 12 },
  settingLabel: { fontSize: 16, fontWeight: '500' },
  settingHint: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
});

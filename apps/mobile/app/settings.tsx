import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../src/lib/api';
import { useRequiredDistanceConfig } from '../src/hooks/use-app-config';
import { showToast } from '../src/stores/toast-store';
import { useThemeStore } from '../src/stores/theme-store';
import { DeletionScheduledBanner } from '../src/components/deletion-scheduled-banner';
import { AppHeader, AppSwitch, Button, EmptyState, LoadingView, Screen, SectionLabel } from '../src/components/ui';
import { PremiumCta } from '../src/components/premium-cta';
import { AppIcon } from '../src/components/ui/app-icon';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../src/theme';

type NotificationKey =
  | 'allowPushReplies'
  | 'allowPushChat'
  | 'allowPushIcebreakerNearby'
  | 'allowPushIcebreaker'
  | 'allowPushEventsNearby';

const NOTIFICATION_OPTIONS: Array<{
  key: NotificationKey;
  label: string;
  hint: string;
  variant?: 'accent' | 'online' | 'premium' | 'icebreaker';
}> = [
  {
    key: 'allowPushReplies',
    label: 'Wall replies',
    hint: 'When someone replies to your post',
  },
  {
    key: 'allowPushChat',
    label: 'Chat messages',
    hint: 'When a connection sends you a message',
  },
  {
    key: 'allowPushIcebreakerNearby',
    label: 'Nearby Break the ice',
    hint: 'When someone nearby turns Break the ice on — even if you have not',
    variant: 'icebreaker',
  },
  {
    key: 'allowPushEventsNearby',
    label: 'Nearby events',
    hint: 'When someone hosts a new event within discovery range',
  },
  {
    key: 'allowPushIcebreaker',
    label: 'Break the ice matches',
    hint: 'When someone says yes to you or you match nearby',
    variant: 'icebreaker',
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const distanceConfig = useRequiredDistanceConfig();
  const icebreakerRadiusMeters = distanceConfig.icebreaker.radiusMeters;
  const darkMode = useThemeStore((s) => s.darkMode);
  const setDarkMode = useThemeStore((s) => s.setDarkMode);
  const [osNotificationsGranted, setOsNotificationsGranted] = useState<boolean | null>(null);

  const refreshOsPermission = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setOsNotificationsGranted(status === 'granted');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshOsPermission();
    }, [refreshOsPermission]),
  );

  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.getSubscription(),
  });

  const styles = useThemedStyles(({ colors }) => ({
    content: { paddingHorizontal: spacing.container },
    permissionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    permissionCardPressed: { opacity: 0.9 },
    permissionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    permissionCopy: { flex: 1 },
    permissionTitle: { ...typography.bodySemiBold, color: colors.ink, fontSize: 16 },
    permissionHint: {
      ...typography.caption,
      color: colors.inkSecondary,
      marginTop: 2,
      lineHeight: 18,
    },
    sectionHint: {
      ...typography.caption,
      color: colors.inkSecondary,
      marginBottom: spacing.md,
      marginTop: -spacing.xs,
    },
    group: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.xxl,
    },
    dangerHint: {
      ...typography.caption,
      color: colors.inkSecondary,
      marginBottom: spacing.md,
      marginTop: -spacing.xs,
      lineHeight: 18,
    },
    deleteButton: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.destructiveBorder,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      marginBottom: spacing.xxl,
    },
    deleteButtonPressed: { opacity: 0.85 },
    deleteButtonLabel: {
      ...typography.bodySemiBold,
      color: colors.destructive,
      fontSize: 16,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: 56,
      gap: spacing.md,
    },
    linkRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    linkLabel: { ...typography.bodySemiBold, color: colors.ink, fontSize: 16, flex: 1 },
  }));

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => api.getSettings(),
  });

  const isPremium = subscriptionData?.data?.isPremium ?? false;

  const mutation = useMutation({
    mutationFn: (payload: {
      allowPushReplies?: boolean;
      allowPushChat?: boolean;
      allowPushIcebreaker?: boolean;
      allowPushIcebreakerNearby?: boolean;
      allowPushEventsNearby?: boolean;
    }) => api.updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
    },
    onError: () => {
      showToast('Could not update settings', 'error');
    },
  });

  const settings = data?.data;

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader
        title="Settings"
        showBrand={false}
        subtitle="Notifications, appearance, and account options."
        onBack={() => router.back()}
      />

      {isLoading ? (
        <LoadingView />
      ) : isError || !settings ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="cloud-offline"
            title="Couldn't load settings"
            message="Check your connection and try again."
            action={
              <Button
                label={isRefetching ? 'Retrying…' : 'Try again'}
                onPress={() => refetch()}
                loading={isRefetching}
              />
            }
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
          <DeletionScheduledBanner />

          <View style={{ marginBottom: spacing.lg }}>
            <PremiumCta isPremium={isPremium} onPress={() => router.push('/premium')} />
          </View>

          <SectionLabel>Appearance</SectionLabel>
          <Text style={styles.sectionHint}>Customize how PingMe looks on your device.</Text>

          <View style={styles.group}>
            <SettingRow
              label="Dark mode"
              hint="Use dark appearance across the app"
              value={darkMode}
              onChange={setDarkMode}
              variant="accent"
              isLast
            />
          </View>

          <SectionLabel>Push notifications</SectionLabel>
          {osNotificationsGranted === false ? (
            <Pressable
              onPress={() => void Linking.openSettings()}
              style={({ pressed }) => [styles.permissionCard, pressed && styles.permissionCardPressed]}
            >
              <View style={styles.permissionIcon}>
                <AppIcon name="notifications" size={20} color={colors.inkTertiary} />
              </View>
              <View style={styles.permissionCopy}>
                <Text style={styles.permissionTitle}>Notifications are off</Text>
                <Text style={styles.permissionHint}>
                  Turn them on in system settings to get replies, chats, and Break the ice alerts.
                </Text>
              </View>
              <AppIcon name="chevron-forward" size={18} color={colors.inkTertiary} />
            </Pressable>
          ) : (
            <Text style={styles.sectionHint}>Choose which alerts PingMe can send.</Text>
          )}

          <View style={styles.group}>
            {NOTIFICATION_OPTIONS.map((option, index) => (
              <SettingRow
                key={option.key}
                label={option.label}
                hint={
                  option.key === 'allowPushIcebreakerNearby'
                    ? `When someone within ${icebreakerRadiusMeters}m turns Break the ice on — even if you have not`
                    : option.hint
                }
                value={settings[option.key] ?? true}
                disabled={mutation.isPending}
                onChange={(value) => mutation.mutate({ [option.key]: value })}
                variant={option.variant ?? 'online'}
                isLast={index === NOTIFICATION_OPTIONS.length - 1}
              />
            ))}
          </View>

          <SectionLabel>Legal</SectionLabel>
          <Text style={styles.sectionHint}>Policies for how PingMe handles your data and account.</Text>
          <View style={styles.group}>
            <Pressable
              onPress={() => router.push('/legal?doc=privacy')}
              style={({ pressed }) => [styles.linkRow, styles.linkRowBorder, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.linkLabel}>Privacy policy</Text>
              <AppIcon name="chevron-forward" size={18} color={colors.inkTertiary} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/legal?doc=terms')}
              style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.linkLabel}>Terms of service</Text>
              <AppIcon name="chevron-forward" size={18} color={colors.inkTertiary} />
            </Pressable>
          </View>

          <SectionLabel>Account</SectionLabel>
          <Text style={styles.dangerHint}>
            Deleting your account starts a grace period before permanent removal. You can cancel during that time.
          </Text>
          <Pressable
            onPress={() => router.push('/delete-account')}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
          >
            <Text style={styles.deleteButtonLabel}>Delete account</Text>
          </Pressable>
        </ScrollView>
      )}
    </Screen>
  );
}

function SettingRow({
  label,
  hint,
  value,
  onChange,
  disabled,
  isLast,
  variant = 'online',
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
  variant?: 'accent' | 'online' | 'premium' | 'icebreaker';
}) {
  const styles = useThemedStyles(({ colors }) => ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: 64,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    rowText: { flex: 1, paddingRight: spacing.md },
    rowLabel: { ...typography.bodySemiBold, color: colors.ink, fontSize: 16 },
    rowHint: { ...typography.caption, color: colors.inkTertiary, marginTop: 2 },
  }));

  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <AppSwitch
        variant={variant}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      />
    </View>
  );
}

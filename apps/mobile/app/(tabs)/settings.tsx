import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../../src/lib/api';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
import { showToast } from '../../src/stores/toast-store';
import { useThemeStore } from '../../src/stores/theme-store';
import { AppHeader, AppSwitch, Button, EmptyState, LoadingView, Screen, SectionLabel } from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { contentBottom } = useTabBarInsets();
  const { colors } = useTheme();
  const darkMode = useThemeStore((s) => s.darkMode);
  const setDarkMode = useThemeStore((s) => s.setDarkMode);

  const styles = useThemedStyles(({ colors }) => ({
    content: { paddingHorizontal: spacing.container },
    premiumRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.premiumSurface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.xxl,
      borderWidth: 1,
      borderColor: colors.premiumSurfaceBorder,
      gap: spacing.md,
    },
    premiumRowPressed: { opacity: 0.9 },
    premiumIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.premiumSurfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    premiumText: { flex: 1 },
    premiumTitle: { ...typography.bodySemiBold, color: colors.premiumOnSurface, fontSize: 16 },
    premiumHint: { ...typography.caption, color: colors.premiumOnSurfaceMuted, marginTop: 2 },
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
  }));

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => api.getSettings(),
  });

  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.getSubscription(),
  });

  const mutation = useMutation({
    mutationFn: (payload: {
      allowPushReplies?: boolean;
      allowPushChat?: boolean;
      allowPushIcebreaker?: boolean;
    }) => api.updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
    },
    onError: () => {
      showToast('Could not update settings', 'error');
    },
  });

  const settings = data?.data;
  const isPremium = subscriptionData?.data?.isPremium ?? false;

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader
        large
        title="Settings"
        showBrand={false}
        subtitle="Notifications, privacy, appearance, and account options."
      />

      {isLoading ? (
        <LoadingView />
      ) : isError || !settings ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
          icon="cloud-offline-outline"
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
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]}>
          <Pressable
            onPress={() => router.push('/premium')}
            style={({ pressed }) => [styles.premiumRow, pressed && styles.premiumRowPressed]}
          >
            <View style={styles.premiumIcon}>
              <Ionicons name="star" size={20} color={colors.premiumStart} />
            </View>
            <View style={styles.premiumText}>
              <Text style={styles.premiumTitle}>Premium</Text>
              <Text style={styles.premiumHint}>
                {isPremium ? 'Manage themes and read receipts' : 'Avatar themes and read receipts'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.inkTertiary} />
          </Pressable>

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

          <SectionLabel>Notifications</SectionLabel>
          <Text style={styles.sectionHint}>Choose which notifications you receive.</Text>

          <View style={styles.group}>
            <SettingRow
              label="Wall replies"
              hint="When someone replies to your post"
              value={settings.allowPushReplies}
              onChange={(value) => mutation.mutate({ allowPushReplies: value })}
              disabled={mutation.isPending}
            />
            <SettingRow
              label="Chat messages"
              hint="New messages in active chats"
              value={settings.allowPushChat}
              onChange={(value) => mutation.mutate({ allowPushChat: value })}
              disabled={mutation.isPending}
            />
            <SettingRow
              label="Break the ice"
              hint="Matches and connection requests"
              value={settings.allowPushIcebreaker}
              onChange={(value) => mutation.mutate({ allowPushIcebreaker: value })}
              disabled={mutation.isPending}
              isLast
            />
          </View>
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
  variant?: 'accent' | 'online' | 'premium';
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../src/lib/api';
import { showToast } from '../src/stores/toast-store';
import { useThemeStore } from '../src/stores/theme-store';
import { AppHeader, AppSwitch, Button, EmptyState, LoadingView, Screen, SectionLabel } from '../src/components/ui';
import { AppIcon } from '../src/components/ui/app-icon';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../src/theme';

type NotificationKey = 'allowPushReplies' | 'allowPushChat' | 'allowPushIcebreaker';

const NOTIFICATION_OPTIONS: Array<{
  key: NotificationKey;
  label: string;
  hint: string;
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
    key: 'allowPushIcebreaker',
    label: 'Break the ice',
    hint: 'When someone wants to connect nearby',
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const darkMode = useThemeStore((s) => s.darkMode);
  const setDarkMode = useThemeStore((s) => s.setDarkMode);

  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.getSubscription(),
  });

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
    premiumRowMember: {
      backgroundColor: colors.onlineSoft,
      borderColor: colors.online,
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
    premiumTitleMember: { color: colors.online },
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

  const isPremium = subscriptionData?.data?.isPremium ?? false;

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
          <Pressable
            onPress={() => router.push('/premium')}
            style={({ pressed }) => [
              styles.premiumRow,
              isPremium && styles.premiumRowMember,
              pressed && styles.premiumRowPressed,
            ]}
          >
            <View style={[styles.premiumIcon, isPremium && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.online }]}>
              <AppIcon name="premium-star" size={20} color={isPremium ? colors.online : colors.premiumStart} />
            </View>
            <View style={styles.premiumText}>
              <Text style={[styles.premiumTitle, isPremium && styles.premiumTitleMember]}>
                {isPremium ? "You're a Premium member" : 'Premium'}
              </Text>
              <Text style={styles.premiumHint}>
                {isPremium
                  ? 'Pick your profile ring, read receipts, and more'
                  : 'Avatar themes and read receipts'}
              </Text>
            </View>
            <AppIcon name="chevron-forward" size={18} color={colors.inkTertiary} />
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

          <SectionLabel>Push notifications</SectionLabel>
          <Text style={styles.sectionHint}>Choose which alerts PingMe can send.</Text>

          <View style={styles.group}>
            {NOTIFICATION_OPTIONS.map((option, index) => (
              <SettingRow
                key={option.key}
                label={option.label}
                hint={option.hint}
                value={settings[option.key]}
                disabled={mutation.isPending}
                onChange={(value) => mutation.mutate({ [option.key]: value })}
                isLast={index === NOTIFICATION_OPTIONS.length - 1}
              />
            ))}
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

import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../src/lib/api';
import { showToast } from '../src/stores/toast-store';
import { useThemeStore } from '../src/stores/theme-store';
import { AppHeader, AppSwitch, Button, EmptyState, LoadingView, Screen, SectionLabel } from '../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../src/theme';

type NotificationKey = 'allowPushReplies' | 'allowPushChat' | 'allowPushIcebreaker';

const NOTIFICATION_OPTIONS: Array<{
  key: NotificationKey;
  label: string;
  hint: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: 'accent' | 'online' | 'icebreaker';
}> = [
  {
    key: 'allowPushReplies',
    label: 'Wall replies',
    hint: 'Someone replied to your post',
    detail: 'Get notified when a nearby person responds on the Wall.',
    icon: 'chatbubble-ellipses',
    tint: 'accent',
  },
  {
    key: 'allowPushChat',
    label: 'Chat messages',
    hint: 'New messages in your chats',
    detail: 'Alerts when someone you\'re connected with sends you a message.',
    icon: 'chatbubbles',
    tint: 'online',
  },
  {
    key: 'allowPushIcebreaker',
    label: 'Break the ice',
    hint: 'Connection requests',
    detail: 'Know when someone says yes or wants to connect nearby.',
    icon: 'flash',
    tint: 'icebreaker',
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
    notificationsIntro: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'flex-start',
    },
    notificationsIntroIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationsIntroTitle: {
      ...typography.bodySemiBold,
      color: colors.ink,
      fontSize: 15,
      marginBottom: 4,
    },
    notificationsIntroBody: {
      ...typography.caption,
      color: colors.inkSecondary,
      lineHeight: 18,
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
              <Ionicons name="star" size={20} color={isPremium ? colors.online : colors.premiumStart} />
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

          <SectionLabel>Push notifications</SectionLabel>

          <View style={styles.notificationsIntro}>
            <View style={styles.notificationsIntroIcon}>
              <Ionicons name="notifications" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.notificationsIntroTitle}>Stay in the loop</Text>
              <Text style={styles.notificationsIntroBody}>
                Choose which alerts PingMe can send. You can change these anytime.
              </Text>
            </View>
          </View>

          {NOTIFICATION_OPTIONS.map((option) => (
            <NotificationPreferenceCard
              key={option.key}
              label={option.label}
              hint={option.hint}
              detail={option.detail}
              icon={option.icon}
              tint={option.tint}
              value={settings[option.key]}
              disabled={mutation.isPending}
              onChange={(value) => mutation.mutate({ [option.key]: value })}
            />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

function NotificationPreferenceCard({
  label,
  hint,
  detail,
  icon,
  tint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: 'accent' | 'online' | 'icebreaker';
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => ({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    cardEnabled: {
      borderColor: colors.online,
    },
    accentBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1, paddingRight: spacing.sm },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: 4,
    },
    label: { ...typography.bodySemiBold, color: colors.ink, fontSize: 16, flex: 1 },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.full,
    },
    statusOn: {
      backgroundColor: colors.onlineSoft,
    },
    statusOff: {
      backgroundColor: colors.surfaceMuted,
    },
    statusText: {
      ...typography.labelSm,
      textTransform: 'none',
      letterSpacing: 0,
    },
    statusTextOn: { color: colors.online },
    statusTextOff: { color: colors.inkTertiary },
    hint: { ...typography.caption, color: colors.inkSecondary, marginBottom: 4 },
    detail: { ...typography.caption, color: colors.inkTertiary, lineHeight: 18, marginBottom: spacing.md },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    switchLabel: { ...typography.bodyMd, color: colors.inkSecondary },
  }));

  const accentColor =
    tint === 'online'
      ? colors.online
      : tint === 'icebreaker'
        ? colors.icebreaker
        : colors.accent;
  const iconBg =
    tint === 'online'
      ? colors.onlineSoft
      : tint === 'icebreaker'
        ? `${colors.icebreaker}18`
        : colors.accentSoft;
  const switchVariant = tint === 'icebreaker' ? 'online' : tint;

  return (
    <View style={[styles.card, value && styles.cardEnabled]}>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={24} color={accentColor} />
        </View>
        <View style={styles.copy}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.statusPill, value ? styles.statusOn : styles.statusOff]}>
              <Text style={[styles.statusText, value ? styles.statusTextOn : styles.statusTextOff]}>
                {value ? 'On' : 'Off'}
              </Text>
            </View>
          </View>
          <Text style={styles.hint}>{hint}</Text>
          <Text style={styles.detail}>{detail}</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Push alerts</Text>
            <AppSwitch variant={switchVariant} value={value} onValueChange={onChange} disabled={disabled} />
          </View>
        </View>
      </View>
    </View>
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

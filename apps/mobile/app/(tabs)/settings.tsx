import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { api } from '../../src/lib/api';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
import { AppHeader, Card, Screen } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { contentBottom } = useTabBarInsets();

  const { data, isLoading } = useQuery({
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
  });

  const settings = data?.data;
  const isPremium = subscriptionData?.data?.isPremium ?? false;

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader title="Settings" showBrand={false} />

      {isLoading || !settings ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <View style={[styles.content, { paddingBottom: contentBottom }]}>
          <Pressable onPress={() => router.push('/premium')}>
            <Card style={styles.premiumCard}>
              <View style={styles.premiumIcon}>
                <Ionicons name="star" size={22} color={colors.premiumStart} />
              </View>
              <View style={styles.premiumText}>
                <Text style={styles.premiumTitle}>Premium</Text>
                <Text style={styles.premiumHint}>
                  {isPremium ? 'Manage themes and read receipts' : 'Avatar themes and read receipts'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceVariant} />
            </Card>
          </Pressable>

          <Text style={styles.sectionTitle}>Notifications</Text>
          <Text style={styles.sectionHint}>Choose which notifications you receive.</Text>

          <Card style={styles.settingsCard}>
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
          </Card>
        </View>
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
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.outlineVariant, true: colors.secondaryContainer }}
        thumbColor={value ? colors.secondary : colors.surfaceBright}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.section },
  content: { padding: spacing.container },
  premiumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxl,
    backgroundColor: colors.premiumSurface,
    borderColor: colors.premiumSurfaceBorder,
  },
  premiumIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.premiumSurfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  premiumText: { flex: 1 },
  premiumTitle: { ...typography.headlineMd, color: colors.premiumOnSurface, fontSize: 17 },
  premiumHint: { ...typography.bodyMd, color: colors.premiumOnSurfaceMuted, fontSize: 13, marginTop: 2 },
  sectionTitle: { ...typography.headlineMd, color: colors.onSurface, marginBottom: spacing.sm },
  sectionHint: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginBottom: spacing.lg },
  settingsCard: { paddingVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  rowText: { flex: 1, paddingRight: spacing.md },
  rowLabel: { ...typography.bodySemiBold, color: colors.onSurface, fontSize: 16 },
  rowHint: { ...typography.bodyMd, color: colors.outline, fontSize: 13, marginTop: 2 },
});

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { api } from '../../src/lib/api';

const isDev = __DEV__;

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

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
      quietMode?: boolean;
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

  if (isLoading || !settings) {
    return (
      <View style={styles.container}>
        <Text>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <Pressable style={styles.premiumLink} onPress={() => router.push('/premium')}>
        <View>
          <Text style={styles.premiumTitle}>Premium</Text>
          <Text style={styles.premiumHint}>
            {isPremium ? 'Manage themes and read receipts' : 'Avatar themes & more — coming soon'}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Notifications</Text>
      <Text style={styles.sectionHint}>Choose which notifications you receive.</Text>

      <SettingRow
        label="Quiet mode"
        hint="Suppress non-essential notifications"
        value={settings.quietMode}
        onChange={(value) => mutation.mutate({ quietMode: value })}
        disabled={mutation.isPending}
      />
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
      />

      {isDev && (
        <View style={styles.devSection}>
          <Text style={styles.devTitle}>Developer</Text>
          <Pressable onPress={() => router.push('/(setup)/didit-spike')}>
            <Text style={styles.devLink}>Didit WebView spike (Phase 0)</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function SettingRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 56, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  premiumLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  premiumTitle: { fontSize: 17, fontWeight: '700', color: '#92400e' },
  premiumHint: { fontSize: 13, color: '#b45309', marginTop: 2 },
  chevron: { fontSize: 24, color: '#b45309' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  sectionHint: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rowText: { flex: 1, paddingRight: 12 },
  rowLabel: { fontSize: 16, fontWeight: '500' },
  rowHint: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  devSection: { marginTop: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  devTitle: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  devLink: { color: '#2563eb', fontSize: 15, paddingVertical: 8 },
});

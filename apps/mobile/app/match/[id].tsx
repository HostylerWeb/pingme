import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/lib/api';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ensureVerified, handleLivenessError } = useLivenessGate();

  const { data, isLoading } = useQuery({
    queryKey: ['match', id],
    queryFn: () => api.getMatch(id!),
    enabled: !!id,
    refetchInterval: 15_000,
  });

  const acceptMutation = useMutation({
    mutationFn: () => api.acceptMatch(id!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
      if (result.data.status === 'active' && result.data.chatId) {
        router.replace(`/chat/${result.data.chatId}`);
      } else if (result.data.status === 'active') {
        router.replace('/(tabs)/chats');
      }
    },
    onError: (error: Error) => {
      if (!handleLivenessError(error)) {
        alert(error.message);
      }
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => api.declineMatch(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      router.back();
    },
    onError: (error: Error) => {
      if (!handleLivenessError(error)) {
        alert(error.message);
      }
    },
  });

  const match = data?.data;

  if (isLoading || !match) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (match.status === 'active') {
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>You&apos;re connected!</Text>
        <Text style={styles.body}>Start chatting with your match.</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            match.chatId ? router.replace(`/chat/${match.chatId}`) : router.replace('/(tabs)/chats')
          }
        >
          <Text style={styles.primaryText}>Open chat</Text>
        </Pressable>
      </View>
    );
  }

  if (match.status !== 'pending') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Match ended</Text>
        <Text style={styles.body}>This match is no longer available.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>👀</Text>
      <Text style={styles.title}>Someone nearby wants to connect too</Text>
      <Text style={styles.body}>
        This is anonymous until you both accept. They&apos;re within ~50m and also tapped Break
        the ice.
      </Text>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>You</Text>
        <Text style={styles.statusValue}>{match.youAccepted ? 'Accepted' : 'Waiting'}</Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Them</Text>
        <Text style={styles.statusValue}>{match.theyAccepted ? 'Accepted' : 'Waiting'}</Text>
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={() => {
          if (!ensureVerified()) return;
          acceptMutation.mutate();
        }}
        disabled={acceptMutation.isPending || match.youAccepted}
      >
        {acceptMutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{match.youAccepted ? 'Accepted' : 'Accept'}</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => declineMutation.mutate()}
        disabled={declineMutation.isPending}
      >
        <Text style={styles.secondaryText}>Decline</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, padding: 24, paddingTop: 32, backgroundColor: '#fff' },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: '#475569', marginBottom: 24 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statusLabel: { fontSize: 15, color: '#64748b' },
  statusValue: { fontSize: 15, fontWeight: '600' },
  primaryButton: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryButton: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  secondaryText: { color: '#64748b', fontSize: 16 },
  link: { color: '#2563eb', fontSize: 16, marginTop: 16 },
});

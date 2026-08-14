import { distanceLabel } from '@pingme/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api, ApiError, WallPost } from '../../src/lib/api';
import { useLocationPing } from '../../src/hooks/use-location-ping';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';

function PostCard({ post, onPress }: { post: WallPost; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.author}>
          {post.author.isYou ? 'You' : post.author.displayName}
        </Text>
        <Text style={styles.distance}>{distanceLabel(post.distanceBucket)}</Text>
      </View>
      <Text style={styles.content}>{post.content}</Text>
      <Text style={styles.meta}>{post.replyCount} replies</Text>
    </Pressable>
  );
}

export default function WallScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { coords, error: locationError, requestPermission, ping } = useLocationPing(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [icebreakerModalOpen, setIcebreakerModalOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const { ensureVerified, handleLivenessError } = useLivenessGate();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['wall-posts'],
    queryFn: () => api.getWallPosts(),
    enabled: !!coords,
  });

  const { data: nearbyData } = useQuery({
    queryKey: ['nearby-count'],
    queryFn: () => api.getNearbyCount(),
    enabled: !!coords,
    refetchInterval: 60_000,
  });

  const { data: presenceData } = useQuery({
    queryKey: ['presence-status'],
    queryFn: () => api.getPresenceStatus(),
    enabled: !!coords,
    refetchInterval: 60_000,
  });

  const { data: icebreakerData } = useQuery({
    queryKey: ['icebreaker-status'],
    queryFn: () => api.getIcebreakerStatus(),
    enabled: !!coords,
    refetchInterval: 15_000,
  });

  const { data: matchesData } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.getMatches(),
    enabled: !!coords,
    refetchInterval: 15_000,
  });

  const icebreakerMutation = useMutation({
    mutationFn: async (action: 'start' | 'cancel') => {
      if (action === 'start') return api.startIcebreaker();
      return api.cancelIcebreaker();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      setIcebreakerModalOpen(false);
    },
    onError: (error: ApiError) => {
      if (!handleLivenessError(error)) {
        alert(error.message);
      }
    },
  });

  const pendingMatch = matchesData?.data.find((m) => m.status === 'pending');
  const icebreakerActive = icebreakerData?.data?.status === 'active';
  const icebreakerMatched = icebreakerData?.data?.status === 'matched';
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!icebreakerActive && !icebreakerMatched) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [icebreakerActive, icebreakerMatched, pulseAnim]);

  useEffect(() => {
    if (!icebreakerMatched) return;
    const matchId = icebreakerData?.data?.matchedSessionId;
    if (matchId) {
      router.push(`/match/${matchId}`);
      return;
    }
    if (pendingMatch) {
      router.push(`/match/${pendingMatch.id}`);
    }
  }, [icebreakerMatched, icebreakerData?.data?.matchedSessionId, pendingMatch, router]);

  const onCreatePost = useCallback(async () => {
    if (!coords || !draft.trim()) return;
    setPosting(true);
    try {
      await api.createWallPost({
        content: draft.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      });
      setDraft('');
      setModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['wall-posts'] });
    } catch (error) {
      if (!handleLivenessError(error)) {
        const message = error instanceof ApiError ? error.message : 'Could not post';
        alert(message);
      }
    } finally {
      setPosting(false);
    }
  }, [coords, draft, queryClient, handleLivenessError]);

  if (locationError && !coords) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{locationError}</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Enable location</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={ping}>
          <Text style={styles.secondaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nearby wall</Text>
        <Text style={styles.headerMeta}>
          {nearbyData?.data.count ?? 0} people available nearby
        </Text>
      </View>

      {presenceData?.data.isAvailable && (
        <View style={styles.availableBanner}>
          <Text style={styles.availableBannerText}>You&apos;re available nearby</Text>
        </View>
      )}

      <View style={styles.icebreakerCard}>
        <Text style={styles.icebreakerTitle}>Break the ice</Text>
        {pendingMatch ? (
          <>
            <Text style={styles.icebreakerHint}>Someone nearby wants to connect!</Text>
            <Pressable
              style={styles.icebreakerButton}
              onPress={() => router.push(`/match/${pendingMatch.id}`)}
            >
              <Text style={styles.icebreakerButtonText}>View match</Text>
            </Pressable>
          </>
        ) : icebreakerMatched ? (
          <>
            <Text style={styles.icebreakerHint}>Match found — opening...</Text>
            <View style={styles.pulseRow}>
              <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.icebreakerHint}>Waiting for match details...</Text>
            </View>
          </>
        ) : icebreakerActive ? (
          <>
            <View style={styles.pulseRow}>
              <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.icebreakerHint}>Waiting for someone nearby...</Text>
            </View>
            <Pressable
              style={styles.icebreakerCancel}
              onPress={() => icebreakerMutation.mutate('cancel')}
              disabled={icebreakerMutation.isPending}
            >
              <Text style={styles.icebreakerCancelText}>Cancel</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.icebreakerHint}>
              Anonymous, mutual, within ~50m, lasts 10 minutes.
            </Text>
            <Pressable
              style={styles.icebreakerButton}
              onPress={() => {
                if (!ensureVerified()) return;
                setIcebreakerModalOpen(true);
              }}
            >
              <Text style={styles.icebreakerButtonText}>Break the ice</Text>
            </Pressable>
          </>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data?.data ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No posts nearby yet. Be the first to say hi.</Text>
          }
          renderItem={({ item }) => (
            <PostCard post={item} onPress={() => router.push(`/post/${item.id}`)} />
          )}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => {
          if (!ensureVerified()) return;
          setModalOpen(true);
        }}
      >
        <Text style={styles.fabText}>+ Post</Text>
      </Pressable>

      <Modal visible={icebreakerModalOpen} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Break the ice?</Text>
            <Text style={styles.icebreakerExplainer}>
              PingMe will look for someone within ~50m who also tapped Break the ice. It&apos;s
              anonymous until you both accept. Session lasts 10 minutes.
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setIcebreakerModalOpen(false)}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.button}
                onPress={() => icebreakerMutation.mutate('start')}
                disabled={icebreakerMutation.isPending}
              >
                {icebreakerMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Start</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Post to nearby wall</Text>
            <TextInput
              style={styles.input}
              placeholder="Anyone else here?"
              multiline
              maxLength={500}
              value={draft}
              onChangeText={setDraft}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setModalOpen(false)}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={onCreatePost} disabled={posting}>
                {posting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Post</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { padding: 16, paddingTop: 56, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  headerMeta: { color: '#64748b', marginTop: 4 },
  availableBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  availableBannerText: { color: '#166534', fontWeight: '600', textAlign: 'center' },
  icebreakerCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  icebreakerTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6, color: '#1e3a8a' },
  icebreakerHint: { fontSize: 14, color: '#475569', marginBottom: 12, lineHeight: 20 },
  icebreakerExplainer: { fontSize: 15, lineHeight: 22, color: '#475569', marginBottom: 16 },
  icebreakerButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  icebreakerButtonText: { color: '#fff', fontWeight: '600' },
  icebreakerCancel: { alignItems: 'center', paddingVertical: 8 },
  icebreakerCancelText: { color: '#64748b', fontWeight: '500' },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  author: { fontWeight: '600', fontSize: 15 },
  distance: { color: '#64748b', fontSize: 13 },
  content: { fontSize: 16, lineHeight: 22, color: '#0f172a' },
  meta: { marginTop: 10, color: '#94a3b8', fontSize: 13 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
  },
  fabText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 280,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  cancel: { color: '#64748b', fontSize: 16 },
  button: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { marginTop: 12 },
  secondaryButtonText: { color: '#2563eb' },
  error: { textAlign: 'center', color: '#b91c1c', marginBottom: 16 },
});

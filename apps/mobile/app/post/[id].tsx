import { distanceLabel } from '@pingme/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../src/lib/api';
import { useLivenessGate } from '../../src/hooks/use-liveness-gate';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [connectingReplyId, setConnectingReplyId] = useState<string | null>(null);
  const { ensureVerified, handleLivenessError } = useLivenessGate();

  const { data, isLoading } = useQuery({
    queryKey: ['wall-post', id],
    queryFn: () => api.getWallPost(id!),
    enabled: !!id,
  });

  const requestMatchMutation = useMutation({
    mutationFn: (replyId: string) =>
      api.requestMatch({ source: 'wall_reply', sourceReferenceId: replyId }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      router.push(`/match/${result.data.id}`);
    },
    onError: (error: Error) => {
      if (!handleLivenessError(error)) {
        alert(error.message);
      }
    },
    onSettled: () => setConnectingReplyId(null),
  });

  const post = data?.data;

  const onReply = async () => {
    if (!id || !reply.trim()) return;
    if (!ensureVerified()) return;
    setSubmitting(true);
    try {
      await api.replyToPost(id, reply.trim());
      setReply('');
      await queryClient.invalidateQueries({ queryKey: ['wall-post', id] });
      await queryClient.invalidateQueries({ queryKey: ['wall-posts'] });
    } catch (error) {
      if (!handleLivenessError(error)) {
        const message = error instanceof ApiError ? error.message : 'Could not reply';
        alert(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onConnect = (replyId: string) => {
    if (!ensureVerified()) return;
    setConnectingReplyId(replyId);
    requestMatchMutation.mutate(replyId);
  };

  if (isLoading || !post) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.postCard}>
        <Text style={styles.author}>{post.author.isYou ? 'You' : post.author.displayName}</Text>
        <Text style={styles.distance}>{distanceLabel(post.distanceBucket)}</Text>
        <Text style={styles.content}>{post.content}</Text>
      </View>

      <FlatList
        data={post.replies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.replies}
        ListHeaderComponent={<Text style={styles.repliesTitle}>Replies</Text>}
        ListEmptyComponent={<Text style={styles.empty}>No replies yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.replyCard}>
            <View style={styles.replyHeader}>
              <Text style={styles.replyAuthor}>
                {item.author.isYou ? 'You' : item.author.displayName}
              </Text>
              {!item.author.isYou ? (
                <Pressable
                  style={styles.connectButton}
                  onPress={() => onConnect(item.id)}
                  disabled={connectingReplyId === item.id}
                >
                  {connectingReplyId === item.id ? (
                    <ActivityIndicator color="#2563eb" size="small" />
                  ) : (
                    <Text style={styles.connectText}>Connect</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.replyContent}>{item.content}</Text>
          </View>
        )}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Write a reply..."
          value={reply}
          onChangeText={setReply}
          maxLength={300}
        />
        <Pressable style={styles.sendButton} onPress={onReply} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  postCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  author: { fontWeight: '700', fontSize: 16 },
  distance: { color: '#64748b', marginTop: 4, marginBottom: 12 },
  content: { fontSize: 17, lineHeight: 24 },
  replies: { paddingHorizontal: 16, paddingBottom: 100 },
  repliesTitle: { fontWeight: '600', marginBottom: 12, color: '#334155' },
  replyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  replyAuthor: { fontWeight: '600', flex: 1 },
  connectButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
    minWidth: 72,
    alignItems: 'center',
  },
  connectText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  replyContent: { color: '#0f172a', lineHeight: 20 },
  empty: { color: '#94a3b8' },
  composer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontWeight: '600' },
});

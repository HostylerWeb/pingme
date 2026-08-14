import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme';

function SkeletonBox({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.box, style, { opacity }]} />;
}

export function PostCardSkeleton() {
  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <SkeletonBox style={styles.avatar} />
        <View style={styles.postMeta}>
          <SkeletonBox style={styles.nameLine} />
          <SkeletonBox style={styles.pillLine} />
        </View>
      </View>
      <SkeletonBox style={styles.contentLine} />
      <SkeletonBox style={styles.contentLineShort} />
      <SkeletonBox style={styles.footerLine} />
    </View>
  );
}

export function ChatRowSkeleton() {
  return (
    <View style={styles.chatRow}>
      <SkeletonBox style={styles.chatAvatar} />
      <View style={styles.chatBody}>
        <SkeletonBox style={styles.chatTitle} />
        <SkeletonBox style={styles.chatPreview} />
      </View>
    </View>
  );
}

export function PostDetailSkeleton() {
  return (
    <View style={styles.detail}>
      <PostCardSkeleton />
      <SkeletonBox style={styles.sectionTitle} />
      <View style={styles.replyCard}>
        <SkeletonBox style={styles.replyAuthor} />
        <SkeletonBox style={styles.replyContent} />
      </View>
      <View style={styles.replyCard}>
        <SkeletonBox style={styles.replyAuthor} />
        <SkeletonBox style={styles.replyContent} />
      </View>
    </View>
  );
}

export function ListSkeleton({ count = 3, variant = 'post' }: { count?: number; variant?: 'post' | 'chat' }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) =>
        variant === 'chat' ? <ChatRowSkeleton key={index} /> : <PostCardSkeleton key={index} />,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
  },
  list: { gap: spacing.lg },
  postCard: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  postHeader: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  postMeta: { flex: 1, gap: spacing.sm },
  nameLine: { width: 120, height: 16, borderRadius: radius.sm },
  pillLine: { width: 88, height: 22, borderRadius: radius.full },
  contentLine: { height: 14, marginBottom: spacing.sm },
  contentLineShort: { width: '72%', height: 14, marginBottom: spacing.lg },
  footerLine: { width: 72, height: 12 },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
  },
  chatAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: spacing.md },
  chatBody: { flex: 1, gap: spacing.sm },
  chatTitle: { width: '45%', height: 14 },
  chatPreview: { width: '80%', height: 12 },
  detail: { padding: spacing.container, gap: spacing.lg },
  sectionTitle: { width: 80, height: 18, marginTop: spacing.sm },
  replyCard: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
  },
  replyAuthor: { width: 100, height: 14 },
  replyContent: { width: '90%', height: 12 },
});

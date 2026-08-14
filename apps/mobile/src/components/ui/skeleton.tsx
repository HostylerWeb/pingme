import { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle } from 'react-native';
import { radius, spacing } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

function SkeletonBox({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  const styles = useThemedStyles(({ colors }) => ({
    box: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
    },
  }));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.box, style, { opacity }]} />;
}

export function PostCardSkeleton() {
  const styles = useThemedStyles(({ colors }) => ({
    postRow: { paddingVertical: spacing.sm },
    postTop: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    postMeta: { flex: 1, gap: spacing.sm },
    nameLine: { width: 100, height: 14, borderRadius: radius.sm },
    pillLine: { width: 72, height: 18, borderRadius: radius.full },
    contentLine: { height: 14, marginBottom: spacing.sm, marginLeft: 52 },
    contentLineShort: { width: '65%', height: 14, marginLeft: 52 },
  }));

  return (
    <View style={styles.postRow}>
      <View style={styles.postTop}>
        <SkeletonBox style={styles.avatar} />
        <View style={styles.postMeta}>
          <SkeletonBox style={styles.nameLine} />
          <SkeletonBox style={styles.pillLine} />
        </View>
      </View>
      <SkeletonBox style={styles.contentLine} />
      <SkeletonBox style={styles.contentLineShort} />
    </View>
  );
}

export function ChatRowSkeleton() {
  const styles = useThemedStyles(({ colors }) => ({
    chatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    chatAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: spacing.md },
    chatBody: { flex: 1, gap: spacing.sm },
    chatTitle: { width: '40%', height: 14 },
    chatPreview: { width: '75%', height: 12 },
  }));

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
  const styles = useThemedStyles(() => ({
    detail: { padding: spacing.container, gap: spacing.lg },
    sectionTitle: { width: 72, height: 12, borderRadius: radius.sm },
    replyRow: { flexDirection: 'row', gap: spacing.md },
    replyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
    replyBody: { flex: 1, gap: spacing.sm },
    replyAuthor: { width: 96, height: 12 },
    replyContent: { width: '88%', height: 12 },
  }));

  return (
    <View style={styles.detail}>
      <PostCardSkeleton />
      <SkeletonBox style={styles.sectionTitle} />
      <View style={styles.replyRow}>
        <SkeletonBox style={styles.replyDot} />
        <View style={styles.replyBody}>
          <SkeletonBox style={styles.replyAuthor} />
          <SkeletonBox style={styles.replyContent} />
        </View>
      </View>
      <View style={styles.replyRow}>
        <SkeletonBox style={styles.replyDot} />
        <View style={styles.replyBody}>
          <SkeletonBox style={styles.replyAuthor} />
          <SkeletonBox style={styles.replyContent} />
        </View>
      </View>
    </View>
  );
}

export function ListSkeleton({ count = 3, variant = 'post' }: { count?: number; variant?: 'post' | 'chat' }) {
  const styles = useThemedStyles(() => ({
    list: { gap: spacing.lg },
  }));

  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, index) =>
        variant === 'chat' ? <ChatRowSkeleton key={index} /> : <PostCardSkeleton key={index} />,
      )}
    </View>
  );
}

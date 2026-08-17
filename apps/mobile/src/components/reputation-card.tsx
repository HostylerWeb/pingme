import { getReputationTierLabel, type ReputationTierId } from '@pingme/shared';
import { Text, View } from 'react-native';
import { radius, spacing, typography, useThemedStyles } from '../../theme';

type ReputationCardProps = {
  score: number;
  tier: ReputationTierId;
  tierLabel: string;
  pointsToNextTier: number | null;
  nextTierLabel: string | null;
  scoreMax: number;
};

export function ReputationCard({
  score,
  tier,
  tierLabel,
  pointsToNextTier,
  nextTierLabel,
  scoreMax,
}: ReputationCardProps) {
  const styles = useThemedStyles(({ colors }) => ({
    card: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    title: {
      ...typography.caption,
      color: colors.inkTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    tierRow: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    tier: {
      ...typography.titleSm,
      color: colors.ink,
    },
    score: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
    },
    track: {
      marginTop: spacing.md,
      height: 8,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: radius.full,
      backgroundColor: colors.accent,
    },
    hint: {
      marginTop: spacing.sm,
      ...typography.caption,
      color: colors.inkTertiary,
    },
  }));

  const progress = scoreMax > 0 ? Math.min(1, score / scoreMax) : 0;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Reputation</Text>
      <View style={styles.tierRow}>
        <Text style={styles.tier}>{tierLabel}</Text>
        <Text style={styles.score}>
          {score} / {scoreMax}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.hint}>
        {pointsToNextTier != null && nextTierLabel
          ? `${pointsToNextTier} points to ${nextTierLabel}`
          : tier === 'master'
            ? 'Top tier — keep participating to stay active'
            : `Tier: ${getReputationTierLabel(tier)}`}
      </Text>
    </View>
  );
}

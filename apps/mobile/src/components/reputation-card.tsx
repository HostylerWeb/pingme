import { getReputationTierLabel, type ReputationTierId } from '@pingme/shared';
import { Text, View } from 'react-native';
import { radius, spacing, typography, useThemedStyles } from '../theme';

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
    wrap: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    label: {
      ...typography.caption,
      color: colors.inkTertiary,
      fontSize: 12,
    },
    tier: {
      ...typography.bodySemiBold,
      color: colors.ink,
      fontSize: 13,
    },
    hint: {
      ...typography.caption,
      color: colors.inkSecondary,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 4,
    },
    track: {
      height: 4,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
      marginTop: 8,
    },
    fill: {
      height: '100%',
      borderRadius: radius.full,
      backgroundColor: colors.accent,
    },
  }));

  const progress = scoreMax > 0 ? Math.min(1, score / scoreMax) : 0;
  const hint =
    pointsToNextTier != null && nextTierLabel
      ? `${pointsToNextTier} more ${pointsToNextTier === 1 ? 'point' : 'points'} to reach ${nextTierLabel}`
      : tier === 'master'
        ? 'Highest reputation level'
        : getReputationTierLabel(tier);

  return (
    <View
      style={styles.wrap}
      accessibilityLabel={`Reputation level ${tierLabel}. ${hint}`}
    >
      <View style={styles.meta}>
        <Text style={styles.label}>Reputation</Text>
        <Text style={styles.tier}>{tierLabel}</Text>
      </View>
      <Text style={styles.hint}>{hint}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

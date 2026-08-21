import {
  REPUTATION_EXPLAINER_DAILY_CAP,
  REPUTATION_EXPLAINER_EARN,
  REPUTATION_EXPLAINER_INTRO,
  REPUTATION_EXPLAINER_TIERS,
  REPUTATION_SCORE_MAX,
} from '@pingme/shared';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { AppHeader, Card, Screen } from '../src/components/ui';
import { spacing, typography, useThemedStyles } from '../src/theme';

export default function ReputationExplainerScreen() {
  const router = useRouter();
  const styles = useThemedStyles(({ colors }) => ({
    content: {
      padding: spacing.container,
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    intro: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      lineHeight: 22,
    },
    sectionTitle: {
      ...typography.labelSm,
      color: colors.inkTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLabel: { ...typography.bodyMd, color: colors.ink, flex: 1 },
    rowNote: { ...typography.caption, color: colors.inkTertiary, marginTop: 2 },
    rowPoints: { ...typography.bodySemiBold, color: colors.accent },
    tierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    tierBadge: {
      ...typography.bodySemiBold,
      color: colors.ink,
    },
    tierScore: {
      ...typography.caption,
      color: colors.inkSecondary,
    },
    cap: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      lineHeight: 22,
    },
    maxScore: {
      ...typography.caption,
      color: colors.inkTertiary,
      textAlign: 'center',
    },
  }));

  return (
    <Screen padded={false}>
      <AppHeader
        title="How reputation works"
        showBrand={false}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>{REPUTATION_EXPLAINER_INTRO}</Text>

        <View>
          <Text style={styles.sectionTitle}>Earn points</Text>
          <Card>
            {REPUTATION_EXPLAINER_EARN.map((item, index) => (
              <View
                key={item.label}
                style={[styles.row, index === REPUTATION_EXPLAINER_EARN.length - 1 && styles.rowLast]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {item.note ? <Text style={styles.rowNote}>{item.note}</Text> : null}
                </View>
                <Text style={styles.rowPoints}>{item.points}</Text>
              </View>
            ))}
          </Card>
          <Text style={[styles.cap, { marginTop: spacing.sm }]}>{REPUTATION_EXPLAINER_DAILY_CAP}</Text>
        </View>

        <View>
          <Text style={styles.sectionTitle}>Tiers</Text>
          <Card>
            {REPUTATION_EXPLAINER_TIERS.map((tier, index) => (
              <View
                key={tier.tier}
                style={[
                  styles.tierRow,
                  index === REPUTATION_EXPLAINER_TIERS.length - 1 && styles.rowLast,
                ]}
              >
                <Text style={styles.tierBadge}>{tier.label}</Text>
                <Text style={styles.tierScore}>
                  {tier.minScore === 0 ? '0+' : `${tier.minScore}+`} pts
                </Text>
              </View>
            ))}
          </Card>
        </View>

        <Text style={styles.maxScore}>Maximum score: {REPUTATION_SCORE_MAX} points</Text>
      </ScrollView>
    </Screen>
  );
}

import { getProfileCompleteness, type ProfileCompletenessField } from '@pingme/shared';
import { Pressable, Text, View } from 'react-native';
import { AppIcon } from './ui/app-icon';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../theme';

export function ProfileCompletenessCard({
  avatarUrl,
  bio,
  gender,
  livenessVerified,
  emailVerified,
  phoneVerified,
  onAction,
}: {
  avatarUrl?: string | null;
  bio?: string | null;
  gender?: string | null;
  livenessVerified?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  onAction: (field: ProfileCompletenessField) => void;
}) {
  const { colors } = useTheme();
  const result = getProfileCompleteness({
    avatarUrl,
    bio,
    gender,
    livenessVerified,
    emailVerified,
    phoneVerified,
  });

  const styles = useThemedStyles(({ colors }) => ({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    title: { ...typography.bodySemiBold, color: colors.ink, fontSize: 16 },
    percent: { ...typography.bodySemiBold, color: colors.accent },
    hint: { ...typography.caption, color: colors.inkSecondary, lineHeight: 18 },
    track: {
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    rowPressed: { opacity: 0.85 },
    rowLabel: { ...typography.bodyMd, color: colors.ink, flex: 1, fontSize: 14 },
    rowLabelDone: { color: colors.inkTertiary },
    completeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.onlineSoft,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.online,
    },
    completeText: { ...typography.bodyMd, color: colors.online, flex: 1 },
  }));

  if (result.isComplete) {
    return (
      <View style={styles.completeBanner}>
        <AppIcon name="check-circle" size={20} color={colors.online} />
        <Text style={styles.completeText}>Profile complete — you&apos;re ready to connect nearby.</Text>
      </View>
    );
  }

  const incompleteItems = result.items.filter((item) => !item.complete);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.percent}>{result.percent}%</Text>
      </View>
      <Text style={styles.hint}>
        {result.nextItem
          ? `Next: ${result.nextItem.label.toLowerCase()}`
          : 'Finish these steps so people nearby recognize you.'}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${result.percent}%` }]} />
      </View>
      {incompleteItems.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onAction(item.id)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <AppIcon name="chevron-forward" size={16} color={styles.rowLabel.color} />
          <Text style={styles.rowLabel}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

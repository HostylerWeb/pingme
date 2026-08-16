import { Text, View } from 'react-native';
import { AppIcon } from './ui/app-icon';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../theme';

type ProfileStatusBadgesProps = {
  isPremium?: boolean;
  livenessVerified?: boolean;
  idVerified?: boolean;
};

type Segment = {
  key: string;
  label: string;
  a11y: string;
};

/**
 * Compact trust row for the profile hero.
 * Face = liveness (real person). ID = government ID (required to host events).
 * Email/phone verification is shown in Account below — not repeated here.
 */
export function ProfileStatusBadges({
  isPremium,
  livenessVerified,
  idVerified,
}: ProfileStatusBadgesProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => ({
    wrap: {
      marginTop: spacing.md,
      maxWidth: '100%',
      alignSelf: 'center',
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.onlineSoft,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
    },
    segment: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    divider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: colors.onlineSoft,
    },
    label: {
      ...typography.caption,
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0,
      color: colors.online,
    },
  }));

  const segments: Segment[] = [];

  if (isPremium) {
    segments.push({
      key: 'premium',
      label: 'Premium',
      a11y: 'Premium member',
    });
  }
  if (livenessVerified) {
    segments.push({
      key: 'face',
      label: 'Face',
      a11y: 'Face verified — liveness check passed',
    });
  }
  if (idVerified) {
    segments.push({
      key: 'id',
      label: 'ID',
      a11y: 'Government ID verified — can host events',
    });
  }

  if (segments.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap} accessibilityRole="text">
      <View style={styles.pill}>
        {segments.map((segment, index) => (
          <View key={segment.key} style={{ flexDirection: 'row', alignItems: 'center' }}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.segment} accessibilityLabel={segment.a11y}>
              <AppIcon name="verified" size={11} color={colors.online} />
              <Text style={styles.label}>{segment.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

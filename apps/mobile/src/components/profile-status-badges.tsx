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
 * Compact trust chips for the profile hero.
 * Face = liveness. ID = government ID (required to host events).
 */
export function ProfileStatusBadges({
  isPremium,
  livenessVerified,
  idVerified,
}: ProfileStatusBadgesProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => ({
    wrap: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceMuted,
    },
    label: {
      ...typography.caption,
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0,
      color: colors.inkSecondary,
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
      {segments.map((segment) => (
        <View key={segment.key} style={styles.chip} accessibilityLabel={segment.a11y}>
          <AppIcon
            name={segment.key === 'premium' ? 'premium-star' : 'verified'}
            size={11}
            color={segment.key === 'premium' ? colors.premiumStart : colors.online}
          />
          <Text style={styles.label}>{segment.label}</Text>
        </View>
      ))}
    </View>
  );
}

import { genderLabel, genderSymbol, getReputationTierLabel, type GenderValue, type ReputationTierId } from '@pingme/shared';
import { Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { radius, typography, useTheme, useThemedStyles } from '../../theme';
import { AppIcon } from './app-icon';

export function DisplayNameWithFlair({
  name,
  gender,
  isPremium = false,
  isVerified = false,
  reputationTier,
  style,
  numberOfLines,
}: {
  name: string;
  gender?: GenderValue | string | null;
  isPremium?: boolean;
  isVerified?: boolean;
  reputationTier?: ReputationTierId | null;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  const symbol = genderSymbol(gender);
  const showTier = reputationTier && reputationTier !== 'new';
  const styles = useThemedStyles(({ colors }) => ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 5,
      minWidth: 0,
    } as ViewStyle,
    gender: {
      ...typography.bodySemiBold,
      color: colors.inkSecondary,
      fontSize: 14,
      lineHeight: 18,
    },
    name: {
      ...typography.bodySemiBold,
      color: colors.ink,
      flexShrink: 1,
    },
    tier: {
      ...typography.labelSm,
      color: colors.inkSecondary,
      fontSize: 10,
      lineHeight: 12,
      letterSpacing: 0.2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
    },
  }));

  return (
    <View style={styles.row}>
      {symbol ? (
        <Text
          style={styles.gender}
          accessibilityLabel={genderLabel(gender)}
          accessibilityRole="text"
        >
          {symbol}
        </Text>
      ) : null}
      <Text style={[styles.name, style]} numberOfLines={numberOfLines ?? 1}>
        {name}
      </Text>
      {isVerified ? (
        <AppIcon name="verified" size={13} color={colors.online} accessibilityLabel="Identity verified" />
      ) : null}
      {isPremium ? (
        <AppIcon name="premium-star" size={13} color={colors.premiumStart} accessibilityLabel="Premium member" />
      ) : null}
      {showTier ? (
        <Text style={styles.tier} accessibilityLabel={`Reputation ${getReputationTierLabel(reputationTier)}`}>
          {getReputationTierLabel(reputationTier)}
        </Text>
      ) : null}
    </View>
  );
}

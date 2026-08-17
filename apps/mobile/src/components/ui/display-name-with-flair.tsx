import { genderLabel, genderSymbol, getReputationTierLabel, type GenderValue, type ReputationTierId } from '@pingme/shared';
import { Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { typography, useTheme, useThemedStyles } from '../../theme';
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
  const styles = useThemedStyles(() => ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
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
      ...typography.caption,
      color: colors.accent,
      fontSize: 10,
      lineHeight: 12,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.accentSoft,
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
      <Text style={[styles.name, style]} numberOfLines={numberOfLines}>
        {name}
      </Text>
      {isVerified ? (
        <AppIcon name="verified" size={13} color={colors.online} accessibilityLabel="Identity verified" />
      ) : null}
      {isPremium ? (
        <AppIcon name="premium-star" size={13} color={colors.premiumStart} accessibilityLabel="Premium member" />
      ) : null}
      {reputationTier && reputationTier !== 'new' ? (
        <Text style={styles.tier} accessibilityLabel={`Reputation tier ${getReputationTierLabel(reputationTier)}`}>
          {getReputationTierLabel(reputationTier)}
        </Text>
      ) : null}
    </View>
  );
}

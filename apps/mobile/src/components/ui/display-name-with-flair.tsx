import { Ionicons } from '@expo/vector-icons';
import { Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { typography, useTheme, useThemedStyles } from '../../theme';

export function DisplayNameWithFlair({
  name,
  isPremium = false,
  isVerified = false,
  style,
  numberOfLines,
}: {
  name: string;
  isPremium?: boolean;
  isVerified?: boolean;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(() => ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minWidth: 0,
    } as ViewStyle,
    name: {
      ...typography.bodySemiBold,
      color: colors.ink,
      flexShrink: 1,
    },
  }));

  return (
    <View style={styles.row}>
      <Text style={[styles.name, style]} numberOfLines={numberOfLines}>
        {name}
      </Text>
      {isVerified ? (
        <Ionicons
          name="shield-checkmark"
          size={13}
          color={colors.online}
          accessibilityLabel="Identity verified"
        />
      ) : null}
      {isPremium ? (
        <Ionicons name="star" size={13} color={colors.premiumStart} accessibilityLabel="Premium member" />
      ) : null}
    </View>
  );
}

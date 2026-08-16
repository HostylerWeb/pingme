import { genderLabel, genderSymbol, type GenderValue } from '@pingme/shared';
import { Text } from 'react-native';
import { typography, useTheme } from '../../theme';

export function GenderSymbol({
  gender,
  size = 14,
  color,
}: {
  gender?: GenderValue | string | null;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const symbol = genderSymbol(gender);
  if (!symbol) return null;

  return (
    <Text
      accessibilityLabel={genderLabel(gender)}
      style={{
        fontSize: size,
        lineHeight: size + 2,
        color: color ?? colors.inkSecondary,
        marginRight: 2,
      }}
    >
      {symbol}
    </Text>
  );
}

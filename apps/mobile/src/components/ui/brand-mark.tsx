import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { typography, useTheme } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

type BrandSize = 'sm' | 'md' | 'lg';

const GLYPH = { sm: 22, md: 28, lg: 36 } as const;

export function PingGlyph({ size = 28, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityRole="image" accessibilityLabel="PingMe">
      <Circle cx="16" cy="16" r="13" fill="none" stroke={color} strokeWidth="1.6" opacity={0.28} />
      <Circle cx="16" cy="16" r="8.5" fill="none" stroke={color} strokeWidth="1.8" opacity={0.55} />
      <Circle cx="16" cy="16" r="3.6" fill={color} />
    </Svg>
  );
}

export function BrandMark({
  size = 'md',
  showWordmark = true,
}: {
  size?: BrandSize;
  showWordmark?: boolean;
}) {
  const { colors } = useTheme();
  const glyphSize = GLYPH[size];
  const styles = useThemedStyles(({ colors }) => ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: size === 'sm' ? 8 : 10,
    },
    wordmarkSm: {
      ...typography.overline,
      color: colors.inkSecondary,
      fontFamily: typography.headlineLg.fontFamily,
      fontSize: 13,
      letterSpacing: 0.4,
      textTransform: 'none' as const,
    },
    wordmarkMd: {
      fontFamily: typography.display.fontFamily,
      fontSize: size === 'lg' ? 28 : 22,
      lineHeight: size === 'lg' ? 32 : 26,
      letterSpacing: -0.6,
      color: colors.ink,
    },
  }));

  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="PingMe">
      <PingGlyph size={glyphSize} color={colors.accent} />
      {showWordmark ? (
        <Text style={size === 'sm' ? styles.wordmarkSm : styles.wordmarkMd}>PingMe</Text>
      ) : null}
    </View>
  );
}

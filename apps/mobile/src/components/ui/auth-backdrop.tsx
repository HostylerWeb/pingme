import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../theme';

export function AuthBackdrop() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const cx = width * 0.92;
  const cy = height * 0.08;
  const cx2 = width * 0.08;
  const cy2 = height * 0.92;
  const stroke = colors.accent;
  const ringOpacity = isDark ? 0.18 : 0.12;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="authGlowTop" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity={isDark ? 0.22 : 0.16} />
            <Stop offset="70%" stopColor={colors.accent} stopOpacity={isDark ? 0.06 : 0.04} />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="authGlowBottom" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity={isDark ? 0.14 : 0.1} />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Circle cx={cx} cy={cy} r={width * 0.72} fill="url(#authGlowTop)" />
        <Circle cx={cx2} cy={cy2} r={width * 0.5} fill="url(#authGlowBottom)" />

        <Circle cx={cx} cy={cy} r={88} fill="none" stroke={stroke} strokeWidth={1.2} opacity={ringOpacity} />
        <Circle cx={cx} cy={cy} r={168} fill="none" stroke={stroke} strokeWidth={1.1} opacity={ringOpacity * 0.85} />
        <Circle cx={cx} cy={cy} r={260} fill="none" stroke={stroke} strokeWidth={1} opacity={ringOpacity * 0.7} />
        <Circle cx={cx} cy={cy} r={360} fill="none" stroke={stroke} strokeWidth={0.9} opacity={ringOpacity * 0.5} />

        <Circle cx={cx2} cy={cy2} r={72} fill="none" stroke={stroke} strokeWidth={1} opacity={ringOpacity * 0.7} />
        <Circle cx={cx2} cy={cy2} r={140} fill="none" stroke={stroke} strokeWidth={0.9} opacity={ringOpacity * 0.5} />
        <Circle cx={cx2} cy={cy2} r={220} fill="none" stroke={stroke} strokeWidth={0.8} opacity={ringOpacity * 0.35} />
      </Svg>
    </View>
  );
}

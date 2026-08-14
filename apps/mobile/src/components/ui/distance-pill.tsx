import { Text, View } from 'react-native';
import { radius, typography } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

type Tone = 'neutral' | 'near' | 'accent';

export function DistancePill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const styles = useThemedStyles(({ colors }) => ({
    pill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
      alignSelf: 'flex-start',
    },
    text: { ...typography.distance },
    neutral: { backgroundColor: colors.surfaceMuted },
    near: { backgroundColor: colors.accentSoft },
    accent: { backgroundColor: colors.onlineSoft },
    textNeutral: { color: colors.inkSecondary },
    textNear: { color: colors.accent },
    textAccent: { color: colors.online },
  }));

  const toneStyle = { neutral: styles.neutral, near: styles.near, accent: styles.accent }[tone];
  const textStyle = { neutral: styles.textNeutral, near: styles.textNear, accent: styles.textAccent }[tone];

  return (
    <View style={[styles.pill, toneStyle]}>
      <Text style={[styles.text, textStyle]}>{label}</Text>
    </View>
  );
}

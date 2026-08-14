import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, typography } from '../../theme';

type Tone = 'neutral' | 'near' | 'tertiary';

export function DistancePill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.pill, toneStyles[tone]]}>
      <Text style={[styles.text, textStyles[tone]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  text: {
    ...typography.distance,
  },
});

const toneStyles = StyleSheet.create({
  neutral: { backgroundColor: colors.surfaceContainerHigh },
  near: { backgroundColor: 'rgba(70, 72, 212, 0.1)' },
  tertiary: { backgroundColor: 'rgba(153, 65, 0, 0.1)' },
});

const textStyles = StyleSheet.create({
  neutral: { color: colors.onSurfaceVariant },
  near: { color: colors.primaryContainer },
  tertiary: { color: colors.tertiary },
});

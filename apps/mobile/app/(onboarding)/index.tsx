import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { onboardingStorage } from '../../src/lib/onboarding-storage';
import { Button, Screen } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

const SLIDES = [
  {
    icon: 'people' as const,
    title: 'Meet people nearby',
    body: 'Connect with others within 250m. Real people, real proximity — cafés, parks, and everyday moments.',
  },
  {
    icon: 'shield-checkmark' as const,
    title: 'Privacy first',
    body: 'We never show your exact location. Others only see distance buckets like "Very near" or "~200m away".',
  },
  {
    icon: 'location' as const,
    title: 'You stay in control',
    body: 'Foreground location powers the wall. Background location is only used when you turn Available ON.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const finish = () => {
    onboardingStorage.markComplete();
    router.replace('/(auth)/login');
  };

  const onNext = () => {
    if (!isLast) {
      setStep((value) => value + 1);
      return;
    }
    finish();
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <LinearGradient colors={[colors.background, colors.surfaceContainerLow]} style={styles.gradient}>
        <View style={styles.topRow}>
          <Text style={styles.brand}>PingMe</Text>
          {!isLast ? (
            <Pressable onPress={finish}>
              <Text style={styles.skipTop}>Skip</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Ionicons name={slide.icon} size={40} color={colors.primary} />
          </View>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((_, index) => (
              <View key={index} style={[styles.dot, index === step && styles.dotActive]} />
            ))}
          </View>
          <Button label={isLast ? 'Get started' : 'Next'} onPress={onNext} />
        </View>
      </LinearGradient>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, padding: spacing.container },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  brand: { ...typography.headlineLg, color: colors.primary },
  skipTop: { ...typography.bodySemiBold, color: colors.primary },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.md },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  title: { ...typography.display, color: colors.onSurface, textAlign: 'center', marginBottom: spacing.lg },
  body: { ...typography.bodyLg, color: colors.onSurfaceVariant, textAlign: 'center', lineHeight: 28 },
  footer: { paddingBottom: spacing.xl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.outlineVariant },
  dotActive: { width: 28, backgroundColor: colors.primary },
});

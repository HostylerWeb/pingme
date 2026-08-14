import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onboardingStorage } from '../../src/lib/onboarding-storage';
import { Button, Screen } from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

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
    body: 'Choose "Allow only while using the app" for location. Background access is only requested when you turn Visible on Wall on.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const styles = useThemedStyles(({ colors }) => ({
    container: { flex: 1, padding: spacing.container },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.md,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    logoDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    brandText: {
      ...typography.overline,
      color: colors.inkTertiary,
      fontSize: 10,
    },
    skipTop: { ...typography.bodySemiBold, color: colors.accent },
    hero: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.sm },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: radius.full,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xxl,
    },
    title: { ...typography.display, color: colors.ink, marginBottom: spacing.lg },
    body: { ...typography.bodyLg, color: colors.inkSecondary },
    footer: { paddingBottom: spacing.xl },
    dots: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
    dot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.outlineVariant },
    dotActive: { width: 24, backgroundColor: colors.accent },
  }));

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
      <View style={styles.container}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <View style={styles.logoDot} />
            <Text style={styles.brandText}>PingMe</Text>
          </View>
          {!isLast ? (
            <Pressable onPress={finish}>
              <Text style={styles.skipTop}>Skip</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Ionicons name={slide.icon} size={36} color={colors.accent} />
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
      </View>
    </Screen>
  );
}

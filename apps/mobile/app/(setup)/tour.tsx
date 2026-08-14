import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { productTourStorage } from '../../src/lib/product-tour-storage';
import { Button, Screen } from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

const SLIDES = [
  {
    icon: 'layers' as const,
    title: 'Wall — local feed',
    body: 'Read and post short notes to people within ~250m. Reply to someone’s post to start a conversation.',
  },
  {
    icon: 'radio' as const,
    title: 'Break the ice — meet people',
    body: 'Browse who’s open to connecting nearby. Tap Yes on someone — if they say Yes too, you match.',
  },
  {
    icon: 'chatbubble-ellipses' as const,
    title: 'Chats — private talks',
    body: 'After you both accept a match, your private chat opens here. Wall and Break the ice stay separate.',
  },
];

export default function ProductTourScreen() {
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
    stepLabel: {
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
    body: { ...typography.bodyLg, color: colors.inkSecondary, lineHeight: 26 },
    footer: { paddingBottom: spacing.xl },
    dots: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
    dot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.outlineVariant },
    dotActive: { width: 24, backgroundColor: colors.accent },
  }));

  const finish = () => {
    productTourStorage.markComplete();
    router.replace('/(tabs)/home');
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
          <Text style={styles.stepLabel}>How PingMe works · {step + 1}/{SLIDES.length}</Text>
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
          <Button label={isLast ? 'Start exploring' : 'Next'} onPress={onNext} />
        </View>
      </View>
    </Screen>
  );
}

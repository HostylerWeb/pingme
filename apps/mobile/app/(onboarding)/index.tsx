import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { onboardingStorage } from '../../src/lib/onboarding-storage';

const SLIDES = [
  {
    title: 'Meet people nearby',
    body: 'PingMe connects you with people within about 250 meters — cafés, parks, events, and everyday moments.',
  },
  {
    title: 'Privacy first',
    body: 'We never show your exact location. Others only see distance buckets like "nearby" or "~200m".',
  },
  {
    title: 'Location powers the experience',
    body: 'Foreground location is required for the wall. Background location is only used when you turn Available ON.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const onNext = () => {
    if (!isLast) {
      setStep((value) => value + 1);
      return;
    }
    onboardingStorage.markComplete();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {SLIDES.map((_, index) => (
          <View key={index} style={[styles.dot, index === step && styles.dotActive]} />
        ))}
      </View>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.body}>{slide.body}</Text>
      <Pressable style={styles.button} onPress={onNext}>
        <Text style={styles.buttonText}>{isLast ? 'Get started' : 'Next'}</Text>
      </Pressable>
      {!isLast && (
        <Pressable onPress={() => { onboardingStorage.markComplete(); router.replace('/(auth)/login'); }}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#f8fafc' },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#cbd5e1' },
  dotActive: { backgroundColor: '#2563eb', width: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16, color: '#0f172a' },
  body: { fontSize: 17, lineHeight: 26, color: '#475569', marginBottom: 40 },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  skip: { textAlign: 'center', marginTop: 16, color: '#64748b', fontSize: 15 },
});

import { Redirect } from 'expo-router';
import { onboardingStorage } from '../src/lib/onboarding-storage';
import { useAuthStore } from '../src/stores/auth-store';

export default function Index() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  if (!isHydrated) return null;

  if (!onboardingStorage.isComplete()) {
    return <Redirect href="/(onboarding)" />;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user.email && !user.emailVerified) {
    return <Redirect href="/(setup)/verify" />;
  }

  return <Redirect href="/(tabs)/home" />;
}

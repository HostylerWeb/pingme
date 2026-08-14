import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/lib/background-location';
import { AppSocketProvider } from '../src/lib/app-socket';
import { hasForegroundLocationPermission, locationSetupStorage } from '../src/lib/location-setup-storage';
import { onboardingStorage } from '../src/lib/onboarding-storage';
import { productTourStorage } from '../src/lib/product-tour-storage';
import { addNotificationResponseListener, addNotificationReceivedListener, registerForPushNotifications } from '../src/lib/push-notifications';
import { initSentry } from '../src/lib/sentry';
import { useAuthStore } from '../src/stores/auth-store';
import { useAppFonts } from '../src/hooks/use-app-fonts';
import { ToastHost } from '../src/components/ui';
import { ThemeProvider, useTheme } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
initSentry();

const queryClient = new QueryClient();

function BootstrapLoading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [locationReady, setLocationReady] = useState<boolean | null>(null);
  const [productTourComplete, setProductTourComplete] = useState<boolean | null>(null);
  const lastTargetRef = useRef<string | null>(null);
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    hydrate();
    setOnboardingComplete(onboardingStorage.isComplete());
    setProductTourComplete(productTourStorage.isComplete());
  }, [hydrate]);

  useEffect(() => {
    if (!user) {
      setLocationReady(null);
      return;
    }
    let mounted = true;
    void (async () => {
      const granted = await hasForegroundLocationPermission();
      if (mounted) {
        setLocationReady(locationSetupStorage.isComplete() || granted);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    void registerForPushNotifications();
  }, [user?.id]);

  useEffect(() => {
    const subscription = addNotificationResponseListener((payload) => {
      if (payload.postId) {
        router.push(`/post/${payload.postId}`);
      } else if (payload.chatId) {
        router.push(`/chat/${payload.chatId}`);
      } else if (payload.matchId) {
        router.push(`/match/${payload.matchId}`);
      } else if (payload.type === 'icebreaker.interest') {
        router.push('/(tabs)/icebreaker');
      }
    });
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    const subscription = addNotificationReceivedListener((payload) => {
      if (payload.type === 'icebreaker.interest') {
        queryClient.invalidateQueries({ queryKey: ['icebreaker-nearby'] });
        queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
      }
      if (payload.type === 'chat.message') {
        queryClient.invalidateQueries({ queryKey: ['chats'] });
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isHydrated || onboardingComplete === null) return;
    if (pathname.startsWith('/verification-complete')) return;

    let target: string | null = null;

    if (!onboardingComplete) {
      target = '/(onboarding)';
    } else if (!user) {
      target = '/(auth)/login';
    } else if ((user.email && !user.emailVerified) || (user.phone && !user.phoneVerified)) {
      target = '/(setup)/verify';
    } else if (locationReady === null || productTourComplete === null) {
      return;
    } else if (!locationReady) {
      target = '/(setup)/location';
    } else if (!productTourComplete && !pathname.startsWith('/(setup)/tour')) {
      target = '/(setup)/tour';
    } else if (pathname.startsWith('/(auth)') || pathname.startsWith('/(onboarding)') || pathname.startsWith('/(setup)')) {
      target = '/(tabs)/home';
    }

    if (!target || pathname === target || pathname.startsWith(`${target}/`)) {
      lastTargetRef.current = null;
      return;
    }

    if (lastTargetRef.current === target) return;
    lastTargetRef.current = target;
    router.replace(target as Href);
  }, [user, isHydrated, pathname, router, onboardingComplete, locationReady, productTourComplete]);

  useEffect(() => {
    if (isHydrated && onboardingComplete !== null) {
      initialLoadDoneRef.current = true;
      void SplashScreen.hideAsync();
    }
  }, [isHydrated, onboardingComplete]);

  if ((!isHydrated || onboardingComplete === null) && !initialLoadDoneRef.current) {
    return <BootstrapLoading />;
  }

  return <>{children}</>;
}

function RootLayoutContent() {
  const { isDark } = useTheme();
  const { loaded: fontsLoaded } = useAppFonts();

  if (!fontsLoaded) {
    return <BootstrapLoading />;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AppSocketProvider>
          <AuthGate>
            <ToastHost />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(setup)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="match/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="premium" options={{ headerShown: false }} />
              <Stack.Screen name="verification-complete" options={{ headerShown: false }} />
            </Stack>
          </AuthGate>
        </AppSocketProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/lib/background-location';
import { AppSocketProvider } from '../src/lib/app-socket';
import { locationSetupStorage } from '../src/lib/location-setup-storage';
import { notificationsSetupStorage } from '../src/lib/notifications-setup-storage';
import { onboardingStorage } from '../src/lib/onboarding-storage';
import { productTourStorage } from '../src/lib/product-tour-storage';
import {
  addNotificationResponseListener,
  addNotificationReceivedListener,
  getInitialNotificationPayload,
  navigateFromNotification,
  registerForPushNotifications,
  shouldSuppressIncomingBanner,
  type NotificationNavigationPayload,
} from '../src/lib/push-notifications';
import { registerAuthFailureHandler } from '../src/lib/auth-session';
import { api } from '../src/lib/api';
import { queryClient } from '../src/lib/query-client';
import { initSentry } from '../src/lib/sentry';
import { useAuthStore } from '../src/stores/auth-store';
import { iconForNotificationType, showIncomingBanner } from '../src/stores/incoming-banner-store';
import { setIcebreakerNearbyPrompt } from '../src/stores/icebreaker-nearby-prompt-store';
import { useAppConfig } from '../src/hooks/use-app-config';
import { useAppFonts } from '../src/hooks/use-app-fonts';
import { Button, IncomingBannerHost, ToastHost } from '../src/components/ui';
import { AppErrorBoundary } from '../src/components/app-error-boundary';
import { AppLocationPingBridge } from '../src/components/app-location-ping-bridge';
import { AccountReviewBanner } from '../src/components/account-review-banner';
import { OfflineBanner } from '../src/components/offline-banner';
import { ThemeProvider, spacing, typography, useTheme, useThemedStyles } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
initSentry();

function BootstrapLoading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

function ConfigBootstrap({ children }: { children: React.ReactNode }) {
  const { data: appConfig, isPending, refetch, isFetching } = useAppConfig();
  const styles = useThemedStyles(({ colors }) => ({
    wrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      padding: spacing.container,
      gap: spacing.lg,
    },
    title: { ...typography.title, color: colors.ink, textAlign: 'center' },
    body: { ...typography.bodyMd, color: colors.inkSecondary, textAlign: 'center' },
  }));

  if (!appConfig) {
    if (isPending) {
      return <BootstrapLoading />;
    }

    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Could not load app settings</Text>
        <Text style={styles.body}>Check your connection and try again.</Text>
        <Button label="Retry" onPress={() => void refetch()} loading={isFetching} />
      </View>
    );
  }

  return <>{children}</>;
}

function AccountReviewGate() {
  const user = useAuthStore((s) => s.user);
  if (!user?.requiresAdminReview) {
    return null;
  }
  return <AccountReviewBanner />;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [locationReady, setLocationReady] = useState<boolean | null>(null);
  const [notificationsReady, setNotificationsReady] = useState<boolean | null>(null);
  const [productTourComplete, setProductTourComplete] = useState<boolean | null>(null);
  const lastTargetRef = useRef<string | null>(null);
  const initialLoadDoneRef = useRef(false);
  const pendingNotificationRef = useRef<NotificationNavigationPayload | null>(null);

  const refreshSetupProgress = () => {
    setOnboardingComplete(onboardingStorage.isComplete());
    setLocationReady(locationSetupStorage.isComplete());
    setNotificationsReady(notificationsSetupStorage.isComplete());
    setProductTourComplete(productTourStorage.isComplete());
  };

  useEffect(() => {
    registerAuthFailureHandler(() => {
      useAuthStore.setState({ user: null });
      queryClient.clear();
    });
    hydrate();
    refreshSetupProgress();
    void getInitialNotificationPayload().then((payload) => {
      if (payload) {
        pendingNotificationRef.current = payload;
      }
    });
  }, [hydrate]);

  useEffect(() => {
    refreshSetupProgress();
  }, [pathname]);

  useEffect(() => {
    if (!user?.id || !notificationsSetupStorage.isComplete()) return;
    void registerForPushNotifications({ skipPermissionRequest: true });
    void queryClient.prefetchQuery({
      queryKey: ['notification-summary'],
      queryFn: () => api.getNotificationSummary(),
    });
    void queryClient.prefetchQuery({
      queryKey: ['wall-notifications'],
      queryFn: () => api.getWallNotifications(),
    });
  }, [user?.id]);

  useEffect(() => {
    const subscription = addNotificationResponseListener((payload) => {
      navigateFromNotification(router, payload);
    });
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    const subscription = addNotificationReceivedListener((payload) => {
      if (
        payload.type === 'icebreaker.interest' ||
        payload.type === 'icebreaker.nearby'
      ) {
        if (payload.type === 'icebreaker.nearby') {
          setIcebreakerNearbyPrompt(payload.nearbyCount ?? 1);
        }
        queryClient.invalidateQueries({ queryKey: ['icebreaker-nearby'] });
        queryClient.invalidateQueries({ queryKey: ['icebreaker-status'] });
      }
      if (payload.type === 'chat.message') {
        queryClient.invalidateQueries({ queryKey: ['chats'] });
      }
      if (
        payload.type === 'wall.reply.on_post' ||
        payload.type === 'wall.reply.on_thread'
      ) {
        queryClient.invalidateQueries({ queryKey: ['wall-posts'] });
        queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
        void queryClient.refetchQueries({ queryKey: ['wall-notifications'] });
        if (payload.postId) {
          queryClient.invalidateQueries({ queryKey: ['wall-post', payload.postId] });
        }
      }
      if (payload.type === 'event.comment.reply' && payload.eventId) {
        queryClient.invalidateQueries({ queryKey: ['event', payload.eventId] });
        queryClient.invalidateQueries({ queryKey: ['event-comments', payload.eventId] });
      }
      if (payload.type === 'event.rsvp.withdrawal' && payload.eventId) {
        queryClient.invalidateQueries({ queryKey: ['event', payload.eventId] });
      }
      if (!shouldSuppressIncomingBanner(pathname, payload)) {
        showIncomingBanner({
          title: payload.title?.trim() || 'PingMe',
          body: payload.body?.trim() || 'You have a new notification',
          icon: iconForNotificationType(payload.type),
          payload,
        });
      }
    });
    return () => subscription.remove();
  }, [pathname]);

  useEffect(() => {
    if (!isHydrated || onboardingComplete === null) return;
    if (pathname.startsWith('/verification-complete')) return;

    let target: string | null = null;
    const onAuthScreen =
      pathname === '/login' ||
      pathname === '/register' ||
      pathname === '/forgot-password' ||
      pathname === '/reset-password' ||
      pathname.startsWith('/(auth)');
    const onLegalScreen = pathname === '/legal' || pathname.startsWith('/legal/');
    const onInviteScreen = pathname === '/invite' || pathname.startsWith('/invite/');
    const onSetupVerify = pathname === '/verify' || pathname.startsWith('/verify/');
    const onSetupProfile = pathname === '/complete-profile';
    const onSetupLocation = pathname === '/location' || pathname.startsWith('/location/');
    const onSetupNotifications =
      pathname === '/notifications' || pathname.startsWith('/notifications/');
    const onSetupTour = pathname === '/tour' || pathname.startsWith('/tour/');
    const onSetupLiveness = pathname === '/liveness' || pathname.startsWith('/liveness/');
    const onSetupKyc = pathname === '/kyc' || pathname.startsWith('/kyc/');
    const onOnboarding = pathname === '/onboarding' || pathname.startsWith('/onboarding');
    const allowWithoutLocation =
      onSetupVerify ||
      onSetupProfile ||
      onSetupLocation ||
      onSetupLiveness ||
      onSetupKyc;

    if (!onboardingComplete) {
      target = '/(onboarding)';
    } else if (!user) {
      if (!onAuthScreen && !onLegalScreen && !onInviteScreen) {
        target = '/(auth)/login';
      }
    } else if ((user.email && !user.emailVerified) || (user.phone && !user.phoneVerified)) {
      if (!onSetupVerify) {
        target = '/(setup)/verify';
      }
    } else if (
      locationReady === null ||
      notificationsReady === null ||
      productTourComplete === null
    ) {
      return;
    } else if (!locationReady && !allowWithoutLocation) {
      target = '/(setup)/location';
    } else if (locationReady && !notificationsReady && !onSetupNotifications) {
      target = '/(setup)/notifications';
    } else if (
      locationReady &&
      notificationsReady &&
      !productTourComplete &&
      !onSetupTour
    ) {
      target = '/(setup)/tour';
    } else if (
      onAuthScreen ||
      onOnboarding ||
      onSetupVerify ||
      onSetupLocation ||
      onSetupNotifications ||
      onSetupTour ||
      onSetupProfile
    ) {
      if (locationReady && notificationsReady && productTourComplete) {
        target = '/(tabs)/home';
      }
    }

    if (!target || pathname === target || pathname.startsWith(`${target}/`)) {
      lastTargetRef.current = null;
      if (
        user &&
        locationReady &&
        notificationsReady &&
        productTourComplete &&
        pendingNotificationRef.current
      ) {
        const payload = pendingNotificationRef.current;
        pendingNotificationRef.current = null;
        navigateFromNotification(router, payload);
      }
      return;
    }

    if (lastTargetRef.current === target) return;
    lastTargetRef.current = target;
    router.replace(target as Href);
  }, [user, isHydrated, pathname, router, onboardingComplete, locationReady, notificationsReady, productTourComplete]);

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
        <OfflineBanner />
        <ConfigBootstrap>
          <AppSocketProvider>
            <AuthGate>
              <AppLocationPingBridge />
              <AccountReviewGate />
              <IncomingBannerHost />
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
                <Stack.Screen name="events/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="events/create" options={{ headerShown: false }} />
                <Stack.Screen name="events/[id]/edit" options={{ headerShown: false }} />
                <Stack.Screen name="invite" options={{ headerShown: false }} />
                <Stack.Screen name="premium" options={{ headerShown: false }} />
                <Stack.Screen name="settings" options={{ headerShown: false }} />
                <Stack.Screen name="reputation" options={{ headerShown: false }} />
                <Stack.Screen name="legal" options={{ headerShown: false }} />
                <Stack.Screen name="delete-account" options={{ headerShown: false }} />
                <Stack.Screen name="verification-complete" options={{ headerShown: false }} />
              </Stack>
            </AuthGate>
          </AppSocketProvider>
        </ConfigBootstrap>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <KeyboardProvider>
      <ThemeProvider>
        <AppErrorBoundary>
          <RootLayoutContent />
        </AppErrorBoundary>
      </ThemeProvider>
    </KeyboardProvider>
  );
}

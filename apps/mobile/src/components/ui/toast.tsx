import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset, useTabBarInsets } from '../../hooks/use-tab-bar-insets';
import { navigateFromNotification } from '../../lib/notification-navigation';
import { useIncomingBannerStore } from '../../stores/incoming-banner-store';
import { ToastType, useToastStore } from '../../stores/toast-store';
import { radius, spacing, typography, useTheme } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { AppIcon, type AppIconName } from './app-icon';

const TAB_PATHS = new Set(['/home', '/icebreaker', '/chats', '/profile']);

function isTabRoute(pathname: string) {
  return TAB_PATHS.has(pathname) || pathname.startsWith('/(tabs)');
}

function snackbarMeta(type: ToastType, colors: ReturnType<typeof useTheme>['colors']) {
  switch (type) {
    case 'error':
      return { icon: 'alert-circle' as AppIconName, iconColor: colors.error };
    case 'success':
      return { icon: 'check-circle' as AppIconName, iconColor: colors.online };
    default:
      return { icon: 'info' as AppIconName, iconColor: colors.inkTertiary };
  }
}

export function ToastHost() {
  const pathname = usePathname();
  const bottomInset = useBottomInset();
  const { contentBottom } = useTabBarInsets();
  const { colors, shadows } = useTheme();
  const { message, type, hide } = useToastStore();
  const bottomOffset = isTabRoute(pathname) ? contentBottom : bottomInset + spacing.lg;

  const styles = useThemedStyles(({ colors }) => ({
    wrap: {
      position: 'absolute',
      left: spacing.container,
      right: spacing.container,
      zIndex: 9998,
    },
    snackbar: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    text: {
      ...typography.bodyMd,
      color: colors.ink,
      flex: 1,
      lineHeight: 20,
    },
  }));

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, type === 'error' ? 4000 : 2200);
    return () => clearTimeout(timer);
  }, [message, type, hide]);

  if (!message) return null;

  const meta = snackbarMeta(type, colors);

  return (
    <Pressable
      onPress={hide}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { bottom: bottomOffset }]}
    >
      <View style={[styles.snackbar, shadows.card]}>
        <AppIcon name={meta.icon} size={18} color={meta.iconColor} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </Pressable>
  );
}

export function IncomingBannerHost() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, shadows } = useTheme();
  const { banner, hide } = useIncomingBannerStore();

  const styles = useThemedStyles(({ colors }) => ({
    wrap: {
      position: 'absolute',
      left: spacing.container,
      right: spacing.container,
      zIndex: 9999,
    },
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1 },
    title: { ...typography.bodySemiBold, color: colors.ink, fontSize: 15 },
    body: { ...typography.caption, color: colors.inkSecondary, marginTop: 2, lineHeight: 18 },
  }));

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(hide, 5000);
    return () => clearTimeout(timer);
  }, [banner, hide]);

  if (!banner) return null;

  return (
    <Pressable
      onPress={() => {
        hide();
        if (banner.payload) {
          navigateFromNotification(router, banner.payload);
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={`${banner.title}. ${banner.body}`}
      style={[styles.wrap, { top: insets.top + 8 }]}
    >
      <View style={[styles.card, shadows.card]}>
        <View style={styles.iconWrap}>
          <AppIcon name={banner.icon} size={20} color={colors.accent} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {banner.title}
          </Text>
          {banner.body ? (
            <Text style={styles.body} numberOfLines={2}>
              {banner.body}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

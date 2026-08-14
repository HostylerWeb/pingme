import { Image, Text, View } from 'react-native';
import { PREMIUM_AVATAR_THEMES } from '@pingme/shared';
import { fontFamilies, typography, useTheme, useThemedStyles } from '../theme';
import { AnimatedGradientRing } from './ui/animated-gradient-ring';

type ThemeId = (typeof PREMIUM_AVATAR_THEMES)[number]['id'];

export function getThemeColors(themeId?: string | null): string[] | null {
  if (!themeId) return null;
  const theme = PREMIUM_AVATAR_THEMES.find((item) => item.id === themeId);
  return theme ? [...theme.colors] : null;
}

export function AvatarWithTheme({
  avatarUrl,
  themeId,
  displayName,
  size = 80,
  showPremiumBadge = false,
}: {
  avatarUrl?: string | null;
  themeId?: string | null;
  displayName?: string;
  size?: number;
  showPremiumBadge?: boolean;
}) {
  const { colors: themeColors } = useTheme();
  const gradientColors = getThemeColors(themeId);
  const innerSize = size - 8;
  const initial = (displayName ?? 'U').charAt(0).toUpperCase();

  const styles = useThemedStyles(({ colors }) => ({
    ring: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    inner: {
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    placeholder: {
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initial: {
      fontFamily: fontFamilies.headline,
      fontWeight: '700',
      color: colors.inkSecondary,
    },
    premiumBadge: {
      marginTop: 8,
      backgroundColor: colors.premiumSurfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    premiumBadgeText: {
      ...typography.labelSm,
      color: colors.premiumOnSurface,
    },
  }));

  const avatarContent = avatarUrl ? (
    <Image source={{ uri: avatarUrl }} style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }} />
  ) : (
    <View style={[styles.placeholder, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
      <Text style={[styles.initial, { fontSize: innerSize * 0.4 }]}>{initial}</Text>
    </View>
  );

  return (
    <View style={{ alignItems: 'center' }}>
      {gradientColors ? (
        <AnimatedGradientRing colors={gradientColors} size={size} borderWidth={4} innerBackgroundColor={themeColors.surface}>
          <View style={[styles.inner, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
            {avatarContent}
          </View>
        </AnimatedGradientRing>
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>{avatarContent}</View>
      )}
      {showPremiumBadge ? (
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumBadgeText}>Premium</Text>
        </View>
      ) : null}
    </View>
  );
}

export type { ThemeId };

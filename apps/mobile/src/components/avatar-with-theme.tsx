import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View } from 'react-native';
import { PREMIUM_AVATAR_THEMES } from '@pingme/shared';

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
  const colors = getThemeColors(themeId);
  const innerSize = size - 8;
  const initial = (displayName ?? 'U').charAt(0).toUpperCase();

  const avatarContent = avatarUrl ? (
    <Image source={{ uri: avatarUrl }} style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }} />
  ) : (
    <View style={[styles.placeholder, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
      <Text style={[styles.initial, { fontSize: innerSize * 0.4 }]}>{initial}</Text>
    </View>
  );

  return (
    <View style={{ alignItems: 'center' }}>
      {colors ? (
        <LinearGradient colors={colors as [string, string, ...string[]]} style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
          <View style={[styles.inner, { width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]}>
            {avatarContent}
          </View>
        </LinearGradient>
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

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '700',
    color: '#475569',
  },
  premiumBadge: {
    marginTop: 8,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  premiumBadgeText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700',
  },
});

export type { ThemeId };

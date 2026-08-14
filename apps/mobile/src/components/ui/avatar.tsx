import * as Haptics from 'expo-haptics';
import { ComponentProps } from 'react';
import { Image, Pressable, Text, View, ViewStyle } from 'react-native';
import { PREMIUM_AVATAR_THEMES } from '@pingme/shared';
import { fontFamilies, typography } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { AnimatedGradientRing } from './animated-gradient-ring';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<Size, number> = { xs: 28, sm: 36, md: 44, lg: 56, xl: 72 };

function getThemeColors(themeId?: string | null): string[] | null {
  if (!themeId) return null;
  const theme = PREMIUM_AVATAR_THEMES.find((item) => item.id === themeId);
  return theme ? [...theme.colors] : null;
}

export function Avatar({
  uri,
  name = 'U',
  size = 'md',
  themeId,
  style,
}: {
  uri?: string | null;
  name?: string;
  size?: Size;
  themeId?: string | null;
  style?: ViewStyle;
}) {
  const styles = useThemedStyles(({ colors }) => ({
    placeholder: {
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initial: {
      fontFamily: fontFamilies.headline,
      color: colors.inkSecondary,
    },
    ringInner: {
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  }));

  const px = SIZES[size];
  const inner = px - (themeId ? 6 : 0);
  const initial = name.charAt(0).toUpperCase();
  const ringColors = getThemeColors(themeId);
  const ringInnerBg = styles.ringInner.backgroundColor as string | undefined;

  const innerContent = uri ? (
    <Image source={{ uri }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
  ) : (
    <View style={[styles.placeholder, { width: inner, height: inner, borderRadius: inner / 2 }]}>
      <Text style={[styles.initial, { fontSize: inner * 0.38 }]}>{initial}</Text>
    </View>
  );

  if (ringColors) {
    return (
      <View style={style}>
        <AnimatedGradientRing colors={ringColors} size={px} borderWidth={3} innerBackgroundColor={ringInnerBg}>
          <View style={[styles.ringInner, { width: inner, height: inner, borderRadius: inner / 2 }]}>
            {innerContent}
          </View>
        </AnimatedGradientRing>
      </View>
    );
  }

  return <View style={[{ width: px, height: px, borderRadius: px / 2, overflow: 'hidden' }, style]}>{innerContent}</View>;
}

export function AvatarPressable({
  onPress,
  ...props
}: ComponentProps<typeof Avatar> & { onPress?: () => void }) {
  if (!onPress) return <Avatar {...props} />;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.88 }}>
      <Avatar {...props} />
    </Pressable>
  );
}

export async function hapticLight() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* noop */
  }
}

export async function hapticSuccess() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    /* noop */
  }
}

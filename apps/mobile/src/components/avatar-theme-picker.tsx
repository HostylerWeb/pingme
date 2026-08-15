import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AppIcon } from './ui/app-icon';
import { PREMIUM_AVATAR_THEMES } from '@pingme/shared';
import { AnimatedGradientRing } from './ui/animated-gradient-ring';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../theme';

type ThemeId = (typeof PREMIUM_AVATAR_THEMES)[number]['id'];

export function AvatarThemePicker({
  currentThemeId,
  onSelect,
  loading,
  compact = false,
}: {
  currentThemeId?: string | null;
  onSelect: (themeId: ThemeId) => void;
  loading?: boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();

  const styles = useThemedStyles(({ colors }) => ({
    hint: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      marginBottom: spacing.md,
      fontSize: 14,
      lineHeight: 20,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: compact ? spacing.sm : spacing.md,
    },
    option: { alignItems: 'center', width: compact ? 64 : 72 },
    swatch: {
      width: compact ? 48 : 56,
      height: compact ? 48 : 56,
      borderRadius: compact ? 24 : 28,
      marginBottom: 6,
    },
    swatchSelected: {
      borderWidth: 3,
      borderColor: colors.premiumStart,
    },
    check: {
      position: 'absolute',
      right: 0,
      bottom: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.premiumStart,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      ...typography.labelSm,
      color: colors.inkSecondary,
      textTransform: 'none',
      letterSpacing: 0,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.premiumSurface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.premiumSurfaceBorder,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    cardTitle: {
      ...typography.bodySemiBold,
      color: colors.premiumOnSurface,
      fontSize: 16,
      marginBottom: spacing.xs,
    },
  }));

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Avatar ring</Text>
      <Text style={styles.hint}>Choose an animated gradient ring others see on your profile and posts.</Text>
      <View style={styles.grid}>
        {PREMIUM_AVATAR_THEMES.map((theme) => {
          const isSelected = currentThemeId === theme.id;
          const swatchSize = compact ? 48 : 56;

          return (
            <Pressable
              key={theme.id}
              style={styles.option}
              disabled={loading}
              onPress={() => onSelect(theme.id)}
            >
              <View>
                <AnimatedGradientRing colors={[...theme.colors]} size={swatchSize} borderWidth={3}>
                  <LinearGradient
                    colors={[...theme.colors] as [string, string, ...string[]]}
                    style={[styles.swatch, { marginBottom: 0 }]}
                  />
                </AnimatedGradientRing>
                {isSelected ? (
                  <View style={styles.check}>
                    {loading ? (
                      <ActivityIndicator size={10} color={colors.onPrimary} />
                    ) : (
                      <AppIcon name="check" size={12} color={colors.onPrimary} />
                    )}
                  </View>
                ) : null}
              </View>
              <Text style={styles.label}>{theme.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

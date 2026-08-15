import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../theme';
import { AppIcon } from './ui/app-icon';

export function PremiumCta({
  isPremium,
  onPress,
}: {
  isPremium: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors, shadows }) => ({
    pressed: { opacity: 0.92 },
    card: {
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.premiumSurfaceBorder,
      marginBottom: spacing.md,
      ...shadows.card,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      gap: spacing.md,
    },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.premiumSurfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    title: {
      ...typography.bodySemiBold,
      color: colors.premiumOnSurface,
      fontSize: 16,
    },
    pill: {
      backgroundColor: colors.premiumSurfaceMuted,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    pillText: {
      ...typography.labelSm,
      color: colors.premiumStart,
      textTransform: 'none',
      letterSpacing: 0,
      fontSize: 11,
    },
    hint: {
      ...typography.caption,
      color: colors.premiumOnSurfaceMuted,
      marginTop: 4,
      lineHeight: 18,
    },
  }));

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <LinearGradient
        colors={[colors.premiumSurface, colors.premiumSurfaceMuted]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.row}>
          <View style={styles.icon}>
            <AppIcon name="premium-star" size={20} color={colors.premiumStart} />
          </View>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>
                {isPremium ? 'Premium' : 'Explore Premium'}
              </Text>
              {isPremium ? (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>Active</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.hint}>
              {isPremium
                ? 'Profile ring, read receipts, and perks'
                : 'Avatar themes, read receipts, and more'}
            </Text>
          </View>
          <AppIcon name="chevron-forward" size={18} color={colors.premiumOnSurfaceMuted} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

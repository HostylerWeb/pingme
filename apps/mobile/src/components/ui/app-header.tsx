import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography, useTheme } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { AppIcon } from './app-icon';
import { BrandMark } from './brand-mark';

export function AppHeader({
  title = 'PingMe',
  titleSuffix,
  subtitle,
  right,
  onBack,
  showBrand = true,
  large = false,
  centerTitle = false,
}: {
  title?: string;
  titleSuffix?: ReactNode;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
  showBrand?: boolean;
  large?: boolean;
  centerTitle?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => ({
    wrap: {
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      paddingHorizontal: spacing.container,
      paddingBottom: spacing.md,
      marginBottom: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    rowWithRight: { alignItems: 'center' },
    rowCentered: { alignItems: 'center' },
    sideSlot: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleBlock: { flex: 1 },
    titleBlockCentered: { alignItems: 'center' },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexWrap: 'wrap',
    },
    titleRowCentered: { justifyContent: 'center' },
    brandRow: {
      marginBottom: 6,
    },
    title: { ...typography.headlineMd, color: colors.ink },
    titleLarge: { ...typography.headlineLg, color: colors.ink },
    titleStandalone: { ...typography.headlineLg },
    titleCentered: { textAlign: 'center', ...typography.headlineMd },
    subtitle: {
      ...typography.caption,
      color: colors.inkSecondary,
      marginTop: 4,
    },
    subtitleCentered: { textAlign: 'center' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: 999,
    },
    chipOn: { backgroundColor: colors.onlineSoft },
    chipOff: { backgroundColor: colors.surfaceMuted },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.online,
    },
    chipText: {
      ...typography.labelSm,
      textTransform: 'none',
      letterSpacing: 0,
    },
    chipTextOn: {
      color: colors.onSecondaryContainer,
      fontFamily: typography.bodySemiBold.fontFamily,
    },
    chipTextOff: { color: colors.inkTertiary },
    sectionLabel: {
      ...typography.overline,
      color: colors.inkTertiary,
      marginBottom: spacing.sm,
    },
  }));

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={[styles.row, centerTitle && styles.rowCentered, right && !centerTitle && styles.rowWithRight]}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8} style={styles.sideSlot} accessibilityRole="button" accessibilityLabel="Go back">
            <AppIcon name="back" size={22} color={colors.ink} />
          </Pressable>
        ) : null}
        <View style={[styles.titleBlock, centerTitle && styles.titleBlockCentered]}>
          {showBrand && !large && !centerTitle ? (
            <View style={styles.brandRow}>
              <BrandMark size="sm" />
            </View>
          ) : null}
          <View style={[styles.titleRow, centerTitle && styles.titleRowCentered]}>
            <Text
              style={[
                large ? styles.titleLarge : styles.title,
                !showBrand && !centerTitle && styles.titleStandalone,
                centerTitle && styles.titleCentered,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {titleSuffix}
          </View>
          {subtitle ? <Text style={[styles.subtitle, centerTitle && styles.subtitleCentered]}>{subtitle}</Text> : null}
        </View>
        {right ?? (centerTitle ? <View style={styles.sideSlot} /> : null)}
      </View>
    </View>
  );
}

export function AvailableChip({
  isAvailable,
  onPress,
}: {
  isAvailable: boolean;
  onPress?: () => void;
}) {
  const styles = useThemedStyles(({ colors }) => ({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: 999,
    },
    chipOn: { backgroundColor: colors.onlineSoft },
    chipOff: { backgroundColor: colors.surfaceMuted },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.online,
    },
    chipText: {
      ...typography.labelSm,
      textTransform: 'none',
      letterSpacing: 0,
    },
    chipTextOn: {
      color: colors.onSecondaryContainer,
      fontFamily: typography.bodySemiBold.fontFamily,
    },
    chipTextOff: { color: colors.inkTertiary },
  }));

  const content = (
    <View style={[styles.chip, isAvailable ? styles.chipOn : styles.chipOff]}>
      {isAvailable ? <View style={styles.dot} /> : null}
      <Text style={[styles.chipText, isAvailable ? styles.chipTextOn : styles.chipTextOff]}>
        {isAvailable ? 'Online' : 'Offline'}
      </Text>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
}

export function SectionLabel({ children }: { children: string }) {
  const styles = useThemedStyles(({ colors }) => ({
    sectionLabel: {
      ...typography.overline,
      color: colors.inkTertiary,
      marginBottom: spacing.sm,
    },
  }));

  return <Text style={styles.sectionLabel}>{children}</Text>;
}

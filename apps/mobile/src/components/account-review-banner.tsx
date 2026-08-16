'use client';

import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon } from './ui/app-icon';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../theme';

export function AccountReviewBanner() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => ({
    banner: {
      backgroundColor: colors.errorContainer,
      borderBottomWidth: 1,
      borderBottomColor: colors.destructiveBorder,
      paddingHorizontal: spacing.container,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    text: {
      ...typography.bodyMd,
      color: colors.onErrorContainer,
      flex: 1,
      lineHeight: 20,
    },
    link: {
      ...typography.bodySemiBold,
      color: colors.destructive,
      marginTop: spacing.xs,
    },
  }));

  return (
    <View style={styles.banner}>
      <AppIcon name="alert-circle" size={18} color={colors.destructive} />
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>
          Your account is under review after a safety report. Some features may be limited while our
          team checks in.
        </Text>
        <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
          <Text style={styles.link}>View settings</Text>
        </Pressable>
      </View>
    </View>
  );
}

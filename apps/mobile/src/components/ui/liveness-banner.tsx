import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export function LivenessBanner() {
  const router = useRouter();

  return (
    <Pressable style={styles.banner} onPress={() => router.push('/(setup)/liveness')}>
      <View style={styles.iconWrap}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Verify to post and chat</Text>
        <Text style={styles.body}>Complete a quick liveness check to reply, post, or connect.</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.container,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryFixed,
    borderWidth: 1,
    borderColor: colors.primaryFixedDim,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: { ...typography.bodySemiBold, color: colors.onSurface, marginBottom: 2 },
  body: { ...typography.bodyMd, color: colors.onSurfaceVariant, fontSize: 13, lineHeight: 18 },
});

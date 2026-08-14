import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api, ApiError } from '../../src/lib/api';
import { Button, Input, Screen } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; phone?: string }>();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    try {
      await api.resetPassword({ token: token.trim(), password });
      Alert.alert('Password updated', 'You can sign in with your new password.');
      router.replace('/(auth)/login');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Reset failed';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const hint = params.email
    ? `Resetting password for ${params.email}`
    : params.phone
      ? `Resetting password for ${params.phone}`
      : 'Paste the reset token from your email or API logs.';

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <LinearGradient colors={[colors.background, colors.surfaceContainerLow]} style={styles.gradient}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Choose a new password</Text>
            <Text style={styles.hint}>{hint}</Text>

            <View style={styles.card}>
              <Input
                label="Reset token"
                placeholder="Paste token here"
                autoCapitalize="none"
                value={token}
                onChangeText={setToken}
              />
              <Input
                label="New password"
                placeholder="At least 8 characters"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <Button label="Update password" onPress={onSubmit} loading={loading} />
            </View>

            <Link href="/(auth)/login" style={styles.link}>
              Back to login
            </Link>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.container },
  title: { ...typography.display, color: colors.onSurface, marginBottom: spacing.sm },
  hint: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginBottom: spacing.xxl, lineHeight: 24 },
  card: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.lg,
  },
  link: { ...typography.bodyMd, textAlign: 'center', color: colors.primary },
});

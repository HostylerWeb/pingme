import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { api, ApiError } from '../../src/lib/api';
import { showToast } from '../../src/stores/toast-store';
import { Button, Input, PasswordInput, Screen } from '../../src/components/ui';
import { radius, spacing, typography, useThemedStyles } from '../../src/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; phone?: string }>();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const styles = useThemedStyles(({ colors }) => ({
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.container },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: spacing.xl,
    },
    logoDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    brandText: {
      ...typography.overline,
      color: colors.inkTertiary,
      fontSize: 10,
    },
    title: { ...typography.display, color: colors.ink, marginBottom: spacing.sm },
    hint: { ...typography.bodyMd, color: colors.inkSecondary, marginBottom: spacing.xxl },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: spacing.lg,
    },
    link: { ...typography.bodyMd, textAlign: 'center', color: colors.accent },
  }));

  const onSubmit = async () => {
    setLoading(true);
    try {
      await api.resetPassword({ token: token.trim(), password });
      showToast('You can sign in with your new password.', 'success');
      router.replace('/(auth)/login');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Reset failed';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const hint = params.email
    ? `Enter the reset code we sent to ${params.email}.`
    : params.phone
      ? `Enter the reset code we sent to ${params.phone}.`
      : 'Enter the reset code from your email or SMS.';

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.logoDot} />
            <Text style={styles.brandText}>PingMe</Text>
          </View>

          <Text style={styles.title}>Choose a new password</Text>
          <Text style={styles.hint}>{hint}</Text>

          <View style={styles.card}>
            <Input
              label="Reset code"
              placeholder="Enter code"
              autoCapitalize="none"
              value={token}
              onChangeText={setToken}
            />
            <PasswordInput
              label="New password"
              placeholder="At least 8 characters"
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
    </Screen>
  );
}

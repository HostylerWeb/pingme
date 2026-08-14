import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth-store';
import { showToast } from '../../src/stores/toast-store';
import { Button, Input, PasswordInput, Screen, SegmentedControl } from '../../src/components/ui';
import { radius, spacing, typography, useThemedStyles } from '../../src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const styles = useThemedStyles(({ colors }) => ({
    flex: { flex: 1 },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: spacing.container,
    },
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
    subtitle: { ...typography.bodyMd, color: colors.inkSecondary, marginBottom: spacing.xxl },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    link: {
      ...typography.bodyMd,
      color: colors.accent,
      textAlign: 'center',
      marginTop: spacing.xl,
    },
  }));

  const onSubmit = async () => {
    try {
      if (mode === 'phone') {
        await login(phone.trim(), password, 'phone');
      } else {
        await login(email.trim(), password, 'email');
      }
      router.replace('/(tabs)/home');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Login failed';
      showToast(message, 'error');
    }
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.logoDot} />
            <Text style={styles.brandText}>PingMe</Text>
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your nearby community.</Text>

          <View style={styles.card}>
            <SegmentedControl
              options={[
                { label: 'Email', value: 'email' },
                { label: 'Phone', value: 'phone' },
              ]}
              value={mode}
              onChange={setMode}
            />

            {mode === 'phone' ? (
              <Input
                label="Phone"
                placeholder="+15551234567"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            ) : (
              <Input
                label="Email"
                placeholder="hello@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            )}

            <PasswordInput
              label="Password"
              placeholder="Your password"
              value={password}
              onChangeText={setPassword}
            />

            <Button
              label="Sign in"
              onPress={onSubmit}
              loading={isLoading}
              disabled={!password.trim() || (mode === 'email' ? !email.trim() : !phone.trim())}
            />
          </View>

          <Link href="/(auth)/forgot-password" style={styles.link}>
            Forgot password?
          </Link>
          <Link href="/(auth)/register" style={styles.link}>
            Create an account
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

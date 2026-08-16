import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth-store';
import { showToast } from '../../src/stores/toast-store';
import { BrandMark, Button, Input, PasswordInput, Screen, SegmentedControl } from '../../src/components/ui';
import { spacing, typography, useThemedStyles } from '../../src/theme';

export default function LoginScreen() {
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
      marginBottom: spacing.xl,
    },
    title: { ...typography.display, color: colors.ink, marginBottom: spacing.sm },
    subtitle: { ...typography.bodyMd, color: colors.inkSecondary, marginBottom: spacing.xxl, lineHeight: 22 },
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
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Login failed';
      showToast(message, 'error');
    }
  };

  return (
    <Screen padded={false} transparent edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <BrandMark size="lg" />
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>People nearby are already posting.</Text>

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

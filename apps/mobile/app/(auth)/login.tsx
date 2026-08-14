import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ApiError } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth-store';
import { Button, Input, Screen, SegmentedControl } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

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
      Alert.alert('Login failed', message);
    }
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <LinearGradient colors={[colors.background, colors.surfaceContainerLow, '#fff7ed']} style={styles.gradient}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.brand}>PingMe</Text>
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

              <Input
                label="Password"
                placeholder="Your password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <Button label="Sign in" onPress={onSubmit} loading={isLoading} />
            </View>

            <Link href="/(auth)/forgot-password" style={styles.link}>
              Forgot password?
            </Link>
            <Link href="/(auth)/register" style={styles.link}>
              Create an account
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
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.container,
  },
  brand: { ...typography.headlineLg, color: colors.primary, textAlign: 'center', marginBottom: spacing.xxl },
  title: { ...typography.display, color: colors.onSurface, marginBottom: spacing.sm },
  subtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  link: {
    ...typography.bodyMd,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});

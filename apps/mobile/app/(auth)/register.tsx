import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth-store';
import { Button, Input, Screen, SegmentedControl } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('1995-01-01');

  const onSubmit = async () => {
    try {
      await register({
        ...(mode === 'phone' ? { phone: phone.trim() } : { email: email.trim() }),
        password,
        dateOfBirth,
        displayName: displayName.trim() || undefined,
      });
      router.replace('/(setup)/verify');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Registration failed';
      Alert.alert('Sign up failed', message);
    }
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <LinearGradient colors={[colors.background, colors.surfaceContainerLow, '#fff7ed']} style={styles.gradient}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.brand}>PingMe</Text>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join your digital neighborhood.</Text>

            <View style={styles.card}>
              <SegmentedControl
                options={[
                  { label: 'Email', value: 'email' },
                  { label: 'Phone', value: 'phone' },
                ]}
                value={mode}
                onChange={setMode}
              />

              <Input label="Display name" placeholder="Jane Doe" value={displayName} onChangeText={setDisplayName} />

              {mode === 'phone' ? (
                <Input label="Phone" placeholder="+15551234567" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
              ) : (
                <Input label="Email" placeholder="hello@example.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
              )}

              <Input label="Password" placeholder="Create a password" secureTextEntry value={password} onChangeText={setPassword} />
              <Input label="Date of birth (18+)" placeholder="YYYY-MM-DD" value={dateOfBirth} onChangeText={setDateOfBirth} />

              <View style={styles.privacy}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.secondary} />
                <Text style={styles.privacyText}>Your exact location is never shared.</Text>
              </View>

              <Button label="Sign up" onPress={onSubmit} loading={isLoading} />
            </View>

            <Link href="/(auth)/login" style={styles.link}>
              Already have an account? Log in
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
  scroll: { flexGrow: 1, padding: spacing.container, paddingTop: spacing.section },
  brand: { ...typography.headlineLg, color: colors.primary, marginBottom: spacing.xl },
  title: { ...typography.display, color: colors.onSurface, marginBottom: spacing.sm },
  subtitle: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainerLow,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  privacyText: { ...typography.bodyMd, color: colors.onSecondaryContainer, flex: 1, fontSize: 14 },
  link: { ...typography.bodyMd, color: colors.primary, textAlign: 'center', marginTop: spacing.xl },
});

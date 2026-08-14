import { Link, useRouter } from 'expo-router';
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
import { Button, Input, Screen, SegmentedControl } from '../../src/components/ui';
import { radius, spacing, typography, useThemedStyles } from '../../src/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [usePhone, setUsePhone] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
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
      const result = await api.forgotPassword(
        usePhone ? { phone: phone.trim() } : { email: email.trim() },
      );
      showToast(result.message, 'success');
      router.push({
        pathname: '/(auth)/reset-password',
        params: usePhone ? { phone: phone.trim() } : { email: email.trim() },
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Request failed';
      showToast(message, 'error');
    } finally {
      setLoading(false);
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

          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.hint}>
            Enter your account email or phone and we&apos;ll send you a reset code.
          </Text>

          <View style={styles.card}>
            <SegmentedControl
              options={[
                { label: 'Email', value: 'email' },
                { label: 'Phone', value: 'phone' },
              ]}
              value={usePhone ? 'phone' : 'email'}
              onChange={(value) => setUsePhone(value === 'phone')}
            />

            {usePhone ? (
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

            <Button label="Send reset link" onPress={onSubmit} loading={loading} />
          </View>

          <Link href="/(auth)/login" style={styles.link}>
            Back to login
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

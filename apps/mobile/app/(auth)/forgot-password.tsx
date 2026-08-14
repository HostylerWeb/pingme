import { Link, useRouter } from 'expo-router';
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
import { Button, Input, Screen, SegmentedControl } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [usePhone, setUsePhone] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    try {
      const result = await api.forgotPassword(
        usePhone ? { phone: phone.trim() } : { email: email.trim() },
      );
      Alert.alert('Check your inbox', result.message);
      router.push({
        pathname: '/(auth)/reset-password',
        params: usePhone ? { phone: phone.trim() } : { email: email.trim() },
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Request failed';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <LinearGradient colors={[colors.background, colors.surfaceContainerLow]} style={styles.gradient}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.hint}>
              Enter your account email or phone. In development, check the API logs for the reset token.
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

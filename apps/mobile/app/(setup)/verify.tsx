import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth-store';
import { Button, Screen } from '../../src/components/ui';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function VerifyScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const usePhone = !!user?.phone && !user.phoneVerified;

  const resend = async () => {
    try {
      if (usePhone) {
        await api.sendPhoneOtp();
      } else {
        await api.sendEmailOtp();
      }
      Alert.alert('Code sent', usePhone ? 'Check your SMS messages.' : 'Check your email inbox.');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not send code';
      Alert.alert('Error', message);
    }
  };

  const verify = async () => {
    setLoading(true);
    try {
      if (usePhone) {
        await api.verifyPhone(code.trim());
      } else {
        await api.verifyEmail(code.trim());
      }
      await refreshMe();
      router.replace('/(setup)/profile');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Invalid code';
      Alert.alert('Verification failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <LinearGradient colors={[colors.background, colors.surfaceContainerLow]} style={styles.gradient}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.iconWrap}>
              <Ionicons name={usePhone ? 'phone-portrait-outline' : 'mail-outline'} size={32} color={colors.primary} />
            </View>

            <Text style={styles.title}>{usePhone ? 'Verify your phone' : 'Verify your email'}</Text>
            <Text style={styles.hint}>
              Enter the 6-digit code sent to {usePhone ? user?.phone : user?.email}.
            </Text>

            <View style={styles.card}>
              <TextInput
                style={styles.codeInput}
                placeholder="000000"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
              />
              <Button label="Verify" onPress={verify} loading={loading} disabled={code.length < 6} />
            </View>

            <Button label="Resend code" variant="ghost" onPress={resend} />
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
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  title: { ...typography.display, color: colors.onSurface, textAlign: 'center', marginBottom: spacing.sm },
  hint: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: spacing.xxl, lineHeight: 24 },
  card: {
    backgroundColor: colors.surfaceBright,
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.lg,
  },
  codeInput: {
    ...typography.headlineLg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    padding: spacing.lg,
    textAlign: 'center',
    letterSpacing: 12,
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceContainerLow,
    color: colors.onSurface,
  },
});

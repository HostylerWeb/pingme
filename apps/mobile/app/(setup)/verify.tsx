import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth-store';
import { showToast } from '../../src/stores/toast-store';
import { Button, Card, Screen } from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

export default function VerifyScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const usePhone = !!user?.phone && !user.phoneVerified;

  const styles = useThemedStyles(({ colors }) => ({
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.container },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: radius.xl,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: spacing.xl,
    },
    title: { ...typography.display, color: colors.ink, textAlign: 'center', marginBottom: spacing.sm },
    hint: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      textAlign: 'center',
      marginBottom: spacing.xxl,
      lineHeight: 22,
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
      backgroundColor: colors.surfaceMuted,
      color: colors.ink,
    },
  }));

  const resend = async () => {
    try {
      if (usePhone) await api.sendPhoneOtp();
      else await api.sendEmailOtp();
      showToast(usePhone ? 'Code sent via SMS' : 'Code sent to your email', 'success');
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Could not send code', 'error');
    }
  };

  const verify = async () => {
    setLoading(true);
    try {
      if (usePhone) await api.verifyPhone(code.trim());
      else await api.verifyEmail(code.trim());
      await refreshMe();
      router.replace('/(setup)/profile');
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Invalid code', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <Ionicons
              name={usePhone ? 'phone-portrait-outline' : 'mail-outline'}
              size={32}
              color={colors.accent}
            />
          </View>

          <Text style={styles.title}>{usePhone ? 'Verify your phone' : 'Verify your email'}</Text>
          <Text style={styles.hint}>Enter the 6-digit code sent to {usePhone ? user?.phone : user?.email}.</Text>

          <Card variant="flat">
            <TextInput
              style={styles.codeInput}
              placeholder="000000"
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
            />
            <Button label="Verify" onPress={verify} loading={loading} disabled={code.length < 6} />
          </Card>

          <Button label="Resend code" variant="ghost" onPress={resend} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppIcon } from '../../src/components/ui/app-icon';
import { api, ApiError } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth-store';
import { showToast } from '../../src/stores/toast-store';
import { Button, Card, Input, Screen } from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

export default function VerifyScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(user?.email ?? '');
  const [savingEmail, setSavingEmail] = useState(false);
  const usePhone = !!user?.phone && !user.phoneVerified;
  const canEditEmail = !!user?.email && !user.emailVerified && !usePhone;

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
    editEmailLink: {
      ...typography.bodyMd,
      color: colors.accent,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    expiryNote: {
      ...typography.caption,
      color: colors.inkTertiary,
      textAlign: 'center',
      marginTop: spacing.md,
      lineHeight: 18,
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

  const saveEmail = async () => {
    const trimmed = emailDraft.trim();
    if (!trimmed) {
      showToast('Enter your email address', 'error');
      return;
    }
    if (trimmed === user?.email) {
      setEditingEmail(false);
      return;
    }

    setSavingEmail(true);
    try {
      await api.updateContact({ email: trimmed });
      await refreshMe();
      setCode('');
      setEditingEmail(false);
      await api.sendEmailOtp();
      showToast('Email updated — a new code was sent', 'success');
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Could not update email', 'error');
    } finally {
      setSavingEmail(false);
    }
  };

  const verify = async () => {
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      showToast('Enter the 6-digit code', 'error');
      return;
    }

    setLoading(true);
    try {
      if (usePhone) await api.verifyPhone(trimmedCode);
      else await api.verifyEmail(trimmedCode);
      await refreshMe();
      router.replace('/(setup)/complete-profile' as Href);
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Invalid or expired code', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (editingEmail && canEditEmail) {
    return (
      <Screen padded={false} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Fix your email</Text>
            <Text style={styles.hint}>
              Enter the correct address. We&apos;ll send a new verification code there.
            </Text>
            <Card variant="flat">
              <Input
                label="Email"
                placeholder="hello@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={emailDraft}
                onChangeText={setEmailDraft}
              />
              <Button label="Save and send code" onPress={saveEmail} loading={savingEmail} />
              <Button
                label="Back to verification"
                variant="ghost"
                onPress={() => {
                  setEmailDraft(user?.email ?? '');
                  setEditingEmail(false);
                }}
              />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <AppIcon
              name={usePhone ? 'phone' : 'email'}
              size={32}
              color={colors.accent}
            />
          </View>

          <Text style={styles.title}>{usePhone ? 'Verify your phone' : 'Verify your email'}</Text>
          <Text style={styles.hint}>
            Enter the 6-digit code sent to {usePhone ? user?.phone : user?.email}.
          </Text>

          {canEditEmail ? (
            <Pressable onPress={() => setEditingEmail(true)} accessibilityRole="button">
              <Text style={styles.editEmailLink}>Wrong email? Update it</Text>
            </Pressable>
          ) : null}

          <Card variant="flat">
            <TextInput
              style={styles.codeInput}
              placeholder="000000"
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
            />
            <Button
              label="Verify"
              onPress={verify}
              loading={loading}
              disabled={code.trim().length < 6}
            />
            <Text style={styles.expiryNote}>Codes expire after 1 hour. Tap Resend if yours expired.</Text>
          </Card>

          <Button label="Resend code" variant="ghost" onPress={resend} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

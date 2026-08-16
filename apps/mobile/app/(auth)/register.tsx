import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { AppIcon } from '../../src/components/ui/app-icon';
import type { GenderValue } from '@pingme/shared';
import { ApiError } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth-store';
import { showToast } from '../../src/stores/toast-store';
import { BrandMark, Button, DateOfBirthField, GenderPicker, Input, PasswordInput, Screen, SegmentedControl } from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { ref: inviteRef } = useLocalSearchParams<{ ref?: string | string[] }>();
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { colors } = useTheme();
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<GenderValue | null>(null);

  const styles = useThemedStyles(({ colors }) => ({
    flex: { flex: 1 },
    scroll: { flexGrow: 1, padding: spacing.container, paddingTop: spacing.section },
    brandRow: {
      marginBottom: spacing.xl,
    },
    title: { ...typography.display, color: colors.ink, marginBottom: spacing.sm },
    subtitle: { ...typography.bodyMd, color: colors.inkSecondary, marginBottom: spacing.xl, lineHeight: 22 },
    notice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.accentSoft,
      padding: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.accentMuted,
    },
    noticeText: { ...typography.caption, color: colors.inkSecondary, flex: 1, lineHeight: 18 },
    privacy: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.onlineSoft,
      padding: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.lg,
    },
    privacyText: { ...typography.bodyMd, color: colors.onSecondaryContainer, flex: 1 },
    legalLinks: {
      ...typography.caption,
      color: colors.inkSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    legalLink: { color: colors.accent, textDecorationLine: 'underline' },
    link: { ...typography.bodyMd, color: colors.accent, textAlign: 'center', marginTop: spacing.xl },
  }));

  const inviteCode = typeof inviteRef === 'string' ? inviteRef : Array.isArray(inviteRef) ? inviteRef[0] : undefined;

  const onSubmit = async () => {
    if (!gender) return;
    try {
      await register({
        ...(mode === 'phone' ? { phone: phone.trim() } : { email: email.trim() }),
        password,
        dateOfBirth,
        gender,
        displayName: displayName.trim() || undefined,
      });
      router.replace('/(setup)/verify');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Registration failed';
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

          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>People nearby are already posting. Join them.</Text>

          {inviteCode ? (
            <View style={styles.notice}>
              <AppIcon name="sparkles" size={18} color={colors.accent} />
              <Text style={styles.noticeText}>
                You opened an invite link — finish signup to join PingMe nearby.
              </Text>
            </View>
          ) : null}

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

            <PasswordInput label="Password" placeholder="Create a password" value={password} onChangeText={setPassword} />
            <DateOfBirthField value={dateOfBirth} onChange={(apiValue) => setDateOfBirth(apiValue)} />

            <GenderPicker value={gender} onChange={setGender} />

            <View style={styles.notice}>
              <AppIcon name="info" size={18} color={colors.accent} />
              <Text style={styles.noticeText}>
                Gender is required and cannot be changed later. Choose carefully before signing up.
              </Text>
            </View>

            <View style={styles.privacy}>
              <AppIcon name="verified" size={18} color={colors.online} />
              <Text style={styles.privacyText}>
                Other users never see your exact location — only that you are nearby.
              </Text>
            </View>

            <Text style={styles.legalLinks}>
              By signing up you agree to our{' '}
              <Text
                style={styles.legalLink}
                onPress={() => router.push('/legal?doc=terms')}
              >
                Terms
              </Text>{' '}
              and{' '}
              <Text
                style={styles.legalLink}
                onPress={() => router.push('/legal?doc=privacy')}
              >
                Privacy Policy
              </Text>
              .
            </Text>

            <Button
              label="Sign up"
              onPress={onSubmit}
              loading={isLoading}
              disabled={
                !gender ||
                !password.trim() ||
                !dateOfBirth.trim() ||
                (mode === 'email' ? !email.trim() : !phone.trim())
              }
            />

          <Link href="/(auth)/login" style={styles.link}>
            Already have an account? Log in
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

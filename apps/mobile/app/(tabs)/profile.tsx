import { AppIcon } from '../../src/components/ui/app-icon';
import { genderLabel, type GenderValue } from '@pingme/shared';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../src/stores/auth-store';
import { api } from '../../src/lib/api';
import { showToast } from '../../src/stores/toast-store';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
import { useAvatarPicker } from '../../src/hooks/use-avatar-picker';
import { AvatarWithTheme } from '../../src/components/avatar-with-theme';
import { PremiumCta } from '../../src/components/premium-cta';
import { ActionSheet, AppHeader, BottomSheet, Button, GenderPicker, GenderReadOnly, Input, Screen } from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  const styles = useThemedStyles(({ colors }) => ({
    infoRow: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
    infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
    infoLabel: { ...typography.caption, color: colors.inkTertiary, marginBottom: 4 },
    infoValue: { ...typography.bodyMd, color: colors.ink },
  }));

  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { contentBottom } = useTabBarInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.getSubscription(),
  });
  const isPremium = subscriptionData?.data?.isPremium ?? user?.subscription?.isPremium ?? false;
  const avatarTheme =
    (user?.profile as { avatarConfig?: { theme?: string } } | null | undefined)?.avatarConfig?.theme ??
    null;
  const avatarUrl =
    (user?.profile as { avatarUrl?: string | null } | null | undefined)?.avatarUrl ?? null;
  const displayName = user?.profile?.displayName ?? 'User';
  const bio = user?.profile?.bio;
  const profileGender = user?.profile?.gender ?? null;

  const [editOpen, setEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);
  const [bioDraft, setBioDraft] = useState(bio ?? '');
  const [genderDraft, setGenderDraft] = useState<GenderValue | null>(profileGender);
  const [saving, setSaving] = useState(false);

  const { uploading, sourceSheetOpen, setSourceSheetOpen, pickFromSource } = useAvatarPicker(refreshMe);

  const styles = useThemedStyles(({ colors }) => ({
    content: { paddingHorizontal: spacing.container },
    profileHero: {
      alignItems: 'center',
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
    },
    avatarTap: { position: 'relative' },
    avatarTapPressed: { opacity: 0.85 },
    cameraBadge: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: colors.background,
    },
    name: {
      ...typography.display,
      color: colors.ink,
      marginTop: spacing.lg,
      textAlign: 'center',
    },
    bio: {
      ...typography.bodyLg,
      color: colors.inkSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      lineHeight: 26,
      maxWidth: 320,
    },
    bioPlaceholder: {
      color: colors.inkMuted,
      fontStyle: 'italic',
    },
    editBtn: { marginTop: spacing.lg, minWidth: 160 },
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgePremium: {
      backgroundColor: colors.premiumSurfaceMuted,
      borderColor: colors.premiumSurfaceBorder,
    },
    badgeVerified: {
      backgroundColor: colors.onlineSoft,
      borderColor: colors.online,
    },
    badgeText: {
      ...typography.labelSm,
      color: colors.accent,
      textTransform: 'none',
      letterSpacing: 0,
    },
    badgeTextPremium: { color: colors.premiumOnSurface },
    badgeTextVerified: { color: colors.online },
    cta: { marginBottom: spacing.md },
    sectionLabel: {
      ...typography.overline,
      color: colors.inkTertiary,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    group: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    logout: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.xxl,
      padding: spacing.lg,
    },
    logoutText: { ...typography.bodySemiBold, color: colors.destructive, fontSize: 16 },
    headerIconBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 4,
    },
    headerIconBtnPressed: { opacity: 0.85 },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    menuRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    menuRowPressed: { opacity: 0.85 },
    menuIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuLabel: { ...typography.bodySemiBold, color: colors.ink, fontSize: 16, flex: 1 },
    menuHint: { ...typography.caption, color: colors.inkTertiary, marginTop: 2 },
    sheetBtn: { marginTop: spacing.md },
  }));

  const onLogout = async () => {
    await logout();
    showToast('Logged out', 'success');
  };

  const openEdit = () => {
    setNameDraft(displayName);
    setBioDraft(bio ?? '');
    setGenderDraft(profileGender);
    setEditOpen(true);
  };

  const saveProfile = async () => {
    const trimmedName = nameDraft.trim();
    if (!trimmedName) {
      showToast('Name cannot be empty', 'error');
      return;
    }
    if (!profileGender && !genderDraft) {
      showToast('Please select your gender', 'error');
      return;
    }

    setSaving(true);
    try {
      const result = await api.updateProfile({
        displayName: trimmedName,
        bio: bioDraft.trim() || undefined,
        ...(!profileGender && genderDraft ? { gender: genderDraft } : {}),
      });
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.profile && result.data) {
        useAuthStore.setState({
          user: {
            ...currentUser,
            profile: {
              ...currentUser.profile,
              displayName: result.data.displayName,
              bio: result.data.bio ?? currentUser.profile.bio,
              gender: result.data.gender ?? currentUser.profile.gender,
              avatarUrl: result.data.avatarUrl ?? currentUser.profile.avatarUrl,
              avatarConfig: result.data.avatarConfig ?? currentUser.profile.avatarConfig,
            },
          },
        });
      }
      await refreshMe();
      setEditOpen(false);
      showToast('Profile updated', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader
        large
        title="You"
        showBrand={false}
        subtitle="Your photo, name, and bio — how others see you nearby."
        right={
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={({ pressed }) => [styles.headerIconBtn, pressed && styles.headerIconBtnPressed]}
          >
            <AppIcon name="settings" size={20} color={colors.ink} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]}>
        <View style={styles.profileHero}>
          <Pressable
            onPress={() => setSourceSheetOpen(true)}
            disabled={uploading}
            style={({ pressed }) => [styles.avatarTap, pressed && styles.avatarTapPressed]}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
          >
            <AvatarWithTheme
              avatarUrl={avatarUrl}
              themeId={avatarTheme}
              displayName={displayName}
              size={112}
              showPremiumBadge={false}
            />
            <View style={styles.cameraBadge}>
              {uploading ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <AppIcon name="camera" size={16} color={colors.surface} />
              )}
            </View>
          </Pressable>

          <Text style={styles.name}>{displayName}</Text>
          <Text style={[styles.bio, !bio?.trim() && styles.bioPlaceholder]}>
            {bio?.trim() ? bio : 'Add a short bio so people know who you are.'}
          </Text>

          <Button label="Edit profile" variant="secondary" onPress={openEdit} style={styles.editBtn} />

          <View style={styles.badges}>
            {isPremium ? (
              <View style={[styles.badge, styles.badgePremium]}>
                <AppIcon name="premium-star" size={13} color={colors.premiumStart} />
                <Text style={[styles.badgeText, styles.badgeTextPremium]}>Premium</Text>
              </View>
            ) : null}
            {user?.emailVerified ? (
              <View style={styles.badge}>
                <AppIcon name="email" size={13} color={colors.accent} />
                <Text style={styles.badgeText}>Email verified</Text>
              </View>
            ) : null}
            {user?.livenessVerified ? (
              <View style={[styles.badge, styles.badgeVerified]}>
                <AppIcon name="verified" size={13} color={colors.online} />
                <Text style={[styles.badgeText, styles.badgeTextVerified]}>Verified</Text>
              </View>
            ) : null}
          </View>
        </View>

        <PremiumCta isPremium={isPremium} onPress={() => router.push('/premium')} />

        {!user?.livenessVerified ? (
          <Button
            label="Complete liveness check"
            onPress={() => router.push('/(setup)/liveness')}
            style={styles.cta}
          />
        ) : null}

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.group}>
          <InfoRow label="Email" value={user?.email ?? '—'} />
          <InfoRow label="Phone" value={user?.phone ?? '—'} />
          <InfoRow
            label="Gender"
            value={profileGender ? genderLabel(profileGender) : 'Not set'}
            isLast
          />
        </View>

        <Text style={styles.sectionLabel}>More</Text>
        <View style={styles.group}>
          <Pressable
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.menuRow, styles.menuRowBorder, pressed && styles.menuRowPressed]}
          >
            <View style={styles.menuIcon}>
              <AppIcon name="settings" size={18} color={colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Settings</Text>
              <Text style={styles.menuHint}>Notifications, dark mode, and preferences</Text>
            </View>
            <AppIcon name="chevron-forward" size={18} color={colors.inkTertiary} />
          </Pressable>
        </View>

        <Pressable style={styles.logout} onPress={onLogout}>
          <AppIcon name="logout" size={20} color={colors.destructive} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>

      <ActionSheet
        visible={sourceSheetOpen}
        title="Profile photo"
        subtitle="Crop and position your photo before saving."
        onClose={() => setSourceSheetOpen(false)}
        options={[
          { label: 'Take photo', onPress: () => pickFromSource('camera') },
          { label: 'Choose from library', onPress: () => pickFromSource('library') },
        ]}
      />

      <BottomSheet visible={editOpen} title="Edit profile" onClose={() => setEditOpen(false)}>
        <Input label="Display name" value={nameDraft} onChangeText={setNameDraft} maxLength={50} />
        {profileGender ? (
          <GenderReadOnly label="Gender" value={genderLabel(profileGender)} />
        ) : (
          <>
            <GenderPicker value={genderDraft} onChange={setGenderDraft} />
            <Text style={{ ...typography.caption, color: colors.inkTertiary, marginTop: -spacing.md, marginBottom: spacing.lg }}>
              Gender cannot be changed after you save it.
            </Text>
          </>
        )}
        <Input
          label="Bio"
          placeholder="A line about you"
          value={bioDraft}
          onChangeText={setBioDraft}
          multiline
          maxLength={160}
          hint={`${bioDraft.length}/160`}
        />
        <Button label="Save" onPress={saveProfile} loading={saving} style={styles.sheetBtn} />
      </BottomSheet>
    </Screen>
  );
}

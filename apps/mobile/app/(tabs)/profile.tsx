import { AppIcon } from '../../src/components/ui/app-icon';
import { genderLabel, type GenderValue } from '@pingme/shared';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../src/stores/auth-store';
import { api } from '../../src/lib/api';
import { showToast } from '../../src/stores/toast-store';
import { useTabBarInsets } from '../../src/hooks/use-tab-bar-insets';
import { useAvatarPicker } from '../../src/hooks/use-avatar-picker';
import { AvatarWithTheme } from '../../src/components/avatar-with-theme';
import { PremiumCta } from '../../src/components/premium-cta';
import { ProfileCompletenessCard } from '../../src/components/profile-completeness-card';
import { ProfileStatusBadges } from '../../src/components/profile-status-badges';
import { ReputationCard } from '../../src/components/reputation-card';
import type { ProfileCompletenessField } from '@pingme/shared';
import { shareAppInvite } from '../../src/lib/invite';
import { ActionSheet, AppHeader, BottomSheet, Button, GenderPicker, GenderReadOnly, Input, PhoneInput, Screen } from '../../src/components/ui';
import { isValidE164 } from '../../src/lib/phone-e164';
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
  useFocusEffect(
    useCallback(() => {
      void refreshMe();
    }, [refreshMe]),
  );
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
  const reputation = user?.reputation;

  const [editOpen, setEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);
  const [bioDraft, setBioDraft] = useState(bio ?? '');
  const [phoneDraft, setPhoneDraft] = useState(user?.phone ?? '');
  const [genderDraft, setGenderDraft] = useState<GenderValue | null>(profileGender);
  const [saving, setSaving] = useState(false);
  const [sharingInvite, setSharingInvite] = useState(false);

  const handleCompletenessAction = (field: ProfileCompletenessField) => {
    switch (field) {
      case 'photo':
        setSourceSheetOpen(true);
        break;
      case 'bio':
      case 'gender':
        openEdit();
        break;
      case 'liveness':
        router.push('/(setup)/liveness');
        break;
      case 'contact':
        router.push('/(setup)/verify');
        break;
      default:
        break;
    }
  };

  const onShareInvite = async () => {
    setSharingInvite(true);
    try {
      await shareAppInvite(user?.id);
    } catch (error) {
      if (error instanceof Error && !error.message.includes('User did not share')) {
        showToast(error.message, 'error');
      }
    } finally {
      setSharingInvite(false);
    }
  };

  const { uploading, sourceSheetOpen, setSourceSheetOpen, pickFromSource } = useAvatarPicker(refreshMe);

  const styles = useThemedStyles(({ colors }) => ({
    content: { paddingHorizontal: spacing.container },
    profileHero: {
      paddingTop: spacing.xs,
      paddingBottom: spacing.lg,
    },
    identityCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    avatarTap: { position: 'relative' },
    avatarTapPressed: { opacity: 0.88 },
    cameraBadge: {
      position: 'absolute',
      right: 2,
      bottom: 2,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
    },
    heroCopy: {
      flex: 1,
      minWidth: 0,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    name: {
      ...typography.headlineMd,
      color: colors.ink,
      flexShrink: 1,
    },
    editLink: {
      ...typography.bodySemiBold,
      color: colors.accent,
      fontSize: 13,
    },
    editLinkPressed: { opacity: 0.7 },
    bio: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      marginTop: 4,
      lineHeight: 20,
      fontSize: 14,
    },
    bioPlaceholder: {
      color: colors.inkMuted,
    },
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
    setPhoneDraft(user?.phone ?? '');
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
      const trimmedPhone = phoneDraft.trim();
      const currentPhone = user?.phone ?? '';
      if (trimmedPhone !== currentPhone) {
        if (trimmedPhone && !isValidE164(trimmedPhone)) {
          showToast('Use international format, e.g. +15551234567', 'error');
          setSaving(false);
          return;
        }
        if (!trimmedPhone && !user?.email) {
          showToast('Add an email before removing your phone number', 'error');
          setSaving(false);
          return;
        }
        await api.updateContact({ phone: trimmedPhone || null });
      }

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
        subtitle="Your profile, reputation, and account details."
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
          <View style={styles.identityCard}>
            <View style={styles.heroRow}>
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
                  size={92}
                  showPremiumBadge={false}
                />
                <View style={styles.cameraBadge}>
                  {uploading ? (
                    <ActivityIndicator size="small" color={colors.surface} />
                  ) : (
                    <AppIcon name="camera" size={12} color={colors.surface} />
                  )}
                </View>
              </Pressable>

              <View style={styles.heroCopy}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Pressable
                    onPress={openEdit}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Edit profile"
                    style={({ pressed }) => pressed && styles.editLinkPressed}
                  >
                    <Text style={styles.editLink}>Edit</Text>
                  </Pressable>
                </View>
                <Text style={[styles.bio, !bio?.trim() && styles.bioPlaceholder]} numberOfLines={2}>
                  {bio?.trim() ? bio : 'Add a short bio'}
                </Text>
                <ProfileStatusBadges
                  isPremium={isPremium}
                  livenessVerified={user?.livenessVerified}
                  idVerified={user?.idVerified}
                />
              </View>
            </View>
            {reputation ? (
              <ReputationCard
                score={reputation.score}
                tier={reputation.tier}
                tierLabel={reputation.tierLabel}
                pointsToNextTier={reputation.pointsToNextTier}
                nextTierLabel={reputation.nextTierLabel}
                scoreMax={reputation.scoreMax}
                onLearnMore={() => router.push('/reputation' as Href)}
              />
            ) : null}
          </View>
        </View>

        <ProfileCompletenessCard
          avatarUrl={avatarUrl}
          bio={bio}
          gender={profileGender}
          livenessVerified={user?.livenessVerified}
          emailVerified={user?.emailVerified}
          phoneVerified={user?.phoneVerified}
          onAction={handleCompletenessAction}
        />

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
            onPress={() => void onShareInvite()}
            disabled={sharingInvite}
            style={({ pressed }) => [styles.menuRow, styles.menuRowBorder, pressed && styles.menuRowPressed]}
          >
            <View style={styles.menuIcon}>
              <AppIcon name="megaphone" size={18} color={colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Invite friends</Text>
              <Text style={styles.menuHint}>Share a link so people nearby can join PingMe</Text>
            </View>
            {sharingInvite ? (
              <ActivityIndicator size="small" color={colors.inkTertiary} />
            ) : (
              <AppIcon name="chevron-forward" size={18} color={colors.inkTertiary} />
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
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
        <PhoneInput
          label="Phone"
          value={phoneDraft}
          onChangeText={setPhoneDraft}
          hint={
            user?.phoneVerified && phoneDraft.trim() === (user?.phone ?? '')
              ? 'Verified'
              : 'Changing your number requires verification again.'
          }
        />
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

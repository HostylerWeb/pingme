import { Gender, SubscriptionPlan, SubscriptionStatus, VerificationStatus, VerificationType } from '@pingme/db';
import { getReputationTier, type ReputationTierId } from '@pingme/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface PublicProfileFields {
  isPremium: boolean;
  avatarTheme: string | null;
  livenessVerified: boolean;
  gender: Gender | null;
  reputationTier: ReputationTierId;
}

export function isActivePremiumSubscription(subscription: {
  plan: SubscriptionPlan | string;
  status: SubscriptionStatus | string;
  currentPeriodEnd: Date | null;
} | null | undefined): boolean {
  if (!subscription || subscription.plan !== SubscriptionPlan.premium) {
    return false;
  }
  if (
    subscription.status !== SubscriptionStatus.active &&
    subscription.status !== SubscriptionStatus.trialing
  ) {
    return false;
  }
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) {
    return false;
  }
  return true;
}

export function getPublicProfileFields(
  profile: { avatarConfig?: unknown; gender?: Gender | null } | null | undefined,
  subscription: {
    plan: SubscriptionPlan | string;
    status: SubscriptionStatus | string;
    currentPeriodEnd: Date | null;
  } | null | undefined,
  livenessVerified = false,
  reputationScore = 0,
): PublicProfileFields {
  const isPremium = isActivePremiumSubscription(subscription);
  const avatarConfig = profile?.avatarConfig as { theme?: string } | null | undefined;
  const theme = typeof avatarConfig?.theme === 'string' ? avatarConfig.theme : null;

  return {
    isPremium,
    avatarTheme: isPremium ? theme : null,
    livenessVerified,
    gender: profile?.gender ?? null,
    reputationTier: getReputationTier(reputationScore),
  };
}

export async function loadLivenessVerifiedSet(prisma: PrismaService, userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return new Set<string>();
  }

  const now = new Date();
  const rows = await prisma.verification.findMany({
    where: {
      userId: { in: uniqueIds },
      type: VerificationType.liveness,
      status: VerificationStatus.passed,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  return new Set(rows.map((row) => row.userId));
}

export async function loadPublicProfileMap(prisma: PrismaService, userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map<string, PublicProfileFields>();
  }

  const [profiles, subscriptions, verifiedSet, users] = await Promise.all([
    prisma.profile.findMany({
      where: { userId: { in: uniqueIds } },
      select: { userId: true, avatarConfig: true, gender: true },
    }),
    prisma.subscription.findMany({
      where: { userId: { in: uniqueIds } },
    }),
    loadLivenessVerifiedSet(prisma, uniqueIds),
    prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, reputationScore: true },
    }),
  ]);

  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
  const subscriptionByUserId = new Map(subscriptions.map((subscription) => [subscription.userId, subscription]));
  const reputationByUserId = new Map(users.map((user) => [user.id, user.reputationScore]));

  return new Map(
    uniqueIds.map((userId) => [
      userId,
      getPublicProfileFields(
        profileByUserId.get(userId),
        subscriptionByUserId.get(userId),
        verifiedSet.has(userId),
        reputationByUserId.get(userId) ?? 0,
      ),
    ]),
  );
}

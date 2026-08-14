import { SubscriptionPlan, SubscriptionStatus } from '@pingme/db';
import { PrismaService } from '../../prisma/prisma.service';

export interface PublicProfileFields {
  isPremium: boolean;
  avatarTheme: string | null;
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
  profile: { avatarConfig?: unknown } | null | undefined,
  subscription: {
    plan: SubscriptionPlan | string;
    status: SubscriptionStatus | string;
    currentPeriodEnd: Date | null;
  } | null | undefined,
): PublicProfileFields {
  const isPremium = isActivePremiumSubscription(subscription);
  const avatarConfig = profile?.avatarConfig as { theme?: string } | null | undefined;
  const theme = typeof avatarConfig?.theme === 'string' ? avatarConfig.theme : null;

  return {
    isPremium,
    avatarTheme: isPremium ? theme : null,
  };
}

export async function loadPublicProfileMap(prisma: PrismaService, userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map<string, PublicProfileFields>();
  }

  const [profiles, subscriptions] = await Promise.all([
    prisma.profile.findMany({
      where: { userId: { in: uniqueIds } },
      select: { userId: true, avatarConfig: true },
    }),
    prisma.subscription.findMany({
      where: { userId: { in: uniqueIds } },
    }),
  ]);

  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
  const subscriptionByUserId = new Map(subscriptions.map((subscription) => [subscription.userId, subscription]));

  return new Map(
    uniqueIds.map((userId) => [
      userId,
      getPublicProfileFields(profileByUserId.get(userId), subscriptionByUserId.get(userId)),
    ]),
  );
}

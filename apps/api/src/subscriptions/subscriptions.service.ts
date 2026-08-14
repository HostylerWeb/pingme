import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  Prisma,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@pingme/db';
import { PREMIUM_AVATAR_THEMES, SUBSCRIPTION_PLANS } from '@pingme/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnconfiguredGateway } from './gateways/unconfigured.gateway';
import { DemoGateway } from './gateways/demo.gateway';
import { PaymentGateway } from './payment-gateway.interface';

export interface SubscriptionView {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isPremium: boolean;
  paymentProvider: PaymentProvider | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  features: {
    avatarThemes: boolean;
    readReceipts: boolean;
    profileFlair: boolean;
  };
}

@Injectable()
export class SubscriptionsService {
  private readonly configuredProvider: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly unconfiguredGateway: UnconfiguredGateway,
    private readonly demoGateway: DemoGateway,
  ) {
    this.configuredProvider = this.config.get<string>('PAYMENT_PROVIDER', 'none').toLowerCase();
  }

  getPlans() {
    const paymentsEnabled = this.getGateway().isConfigured();
    return {
      paymentsEnabled,
      paymentProvider: paymentsEnabled ? this.configuredProvider : null,
      plans: Object.values(SUBSCRIPTION_PLANS),
      premiumThemes: PREMIUM_AVATAR_THEMES,
    };
  }

  async getOrCreateSubscription(userId: string) {
    const existing = await this.prisma.subscription.findUnique({ where: { userId } });
    if (existing) return existing;

    return this.prisma.subscription.create({
      data: {
        userId,
        plan: SubscriptionPlan.free,
        status: SubscriptionStatus.active,
      },
    });
  }

  async getSubscriptionView(userId: string): Promise<SubscriptionView> {
    const subscription = await this.getOrCreateSubscription(userId);
    return this.toView(subscription);
  }

  async isPremium(userId: string): Promise<boolean> {
    const subscription = await this.getOrCreateSubscription(userId);
    return this.isActivePremium(subscription);
  }

  async createCheckout(userId: string, planId: string) {
    if (planId !== SubscriptionPlan.premium) {
      throw new BadRequestException('Only premium plan is available');
    }

    const gateway = this.getGateway();
    if (!gateway.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'PAYMENTS_NOT_CONFIGURED',
        message: 'Payments are not configured yet. Premium will be available soon.',
      });
    }

    const session = await gateway.createCheckoutSession(userId, planId);
    if (!session.checkoutUrl) {
      throw new ServiceUnavailableException({
        code: 'CHECKOUT_UNAVAILABLE',
        message: 'Unable to start checkout. Please try again later.',
      });
    }

    await this.audit.log({
      userId,
      action: 'subscription.checkout_started',
      entityType: 'subscription',
      metadata: { planId, provider: gateway.providerId },
    });

    return {
      checkoutUrl: session.checkoutUrl,
      sessionId: session.sessionId ?? null,
      provider: gateway.providerId,
      inAppCheckout: session.inAppCheckout ?? false,
    };
  }

  async confirmCheckout(userId: string, sessionId: string) {
    if (this.configuredProvider !== 'demo') {
      throw new BadRequestException('In-app checkout confirmation is only available for the demo provider');
    }

    const gateway = this.demoGateway;
    const session = gateway.consumeSession(sessionId, userId);
    if (session.planId !== SubscriptionPlan.premium) {
      throw new BadRequestException('Only premium plan is available');
    }

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        plan: SubscriptionPlan.premium,
        status: SubscriptionStatus.active,
        paymentProvider: PaymentProvider.manual,
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        metadata: { source: 'demo_checkout', sessionId },
      },
      create: {
        userId,
        plan: SubscriptionPlan.premium,
        status: SubscriptionStatus.active,
        paymentProvider: PaymentProvider.manual,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        metadata: { source: 'demo_checkout', sessionId },
      },
    });

    await this.audit.log({
      userId,
      action: 'subscription.demo_checkout_completed',
      entityType: 'subscription',
      entityId: subscription.id,
      metadata: { sessionId },
    });

    return this.toView(subscription);
  }

  async cancelSubscription(userId: string) {
    const subscription = await this.getOrCreateSubscription(userId);
    if (!this.isActivePremium(subscription)) {
      throw new BadRequestException('No active premium subscription to cancel');
    }

    if (subscription.paymentProvider === PaymentProvider.manual) {
      return this.revokePremium(userId, 'user_cancelled');
    }

    const gateway = this.getGateway();
    if (!gateway.isConfigured()) {
      throw new ServiceUnavailableException('Payments are not configured');
    }

    await gateway.cancelSubscription(userId);

    const updated = await this.prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true },
    });

    await this.audit.log({
      userId,
      action: 'subscription.cancel_requested',
      entityType: 'subscription',
      entityId: updated.id,
    });

    return this.toView(updated);
  }

  async grantPremium(userId: string, adminUserId: string, note?: string) {
    await this.requireUser(userId);

    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        plan: SubscriptionPlan.premium,
        status: SubscriptionStatus.active,
        paymentProvider: PaymentProvider.manual,
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        metadata: { grantedBy: adminUserId, note: note ?? null },
      },
      create: {
        userId,
        plan: SubscriptionPlan.premium,
        status: SubscriptionStatus.active,
        paymentProvider: PaymentProvider.manual,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        metadata: { grantedBy: adminUserId, note: note ?? null },
      },
    });

    await this.audit.log({
      userId,
      action: 'subscription.admin_grant',
      entityType: 'subscription',
      entityId: subscription.id,
      metadata: { adminUserId, note },
    });

    return this.toView(subscription);
  }

  async revokePremium(userId: string, reason = 'admin_revoked') {
    const subscription = await this.getOrCreateSubscription(userId);

    const updated = await this.prisma.subscription.update({
      where: { userId },
      data: {
        plan: SubscriptionPlan.free,
        status: SubscriptionStatus.active,
        paymentProvider: null,
        providerCustomerId: null,
        providerSubscriptionId: null,
        cancelAtPeriodEnd: false,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        metadata: { ...(subscription.metadata as object | null), revokedReason: reason },
      },
    });

    await this.clearPremiumProfileTheme(userId);

    await this.audit.log({
      userId,
      action: 'subscription.revoked',
      entityType: 'subscription',
      entityId: updated.id,
      metadata: { reason },
    });

    return this.toView(updated);
  }

  async handlePaymentWebhook(provider: string, payload: unknown, signature?: string) {
    const gateway = this.getGateway();
    if (gateway.providerId !== provider && provider !== 'manual') {
      throw new NotFoundException('Unknown payment provider');
    }

    if (!gateway.isConfigured() && provider !== 'manual') {
      throw new ServiceUnavailableException('Payments are not configured');
    }

    await gateway.handleWebhook(provider, payload, signature);
    return { received: true };
  }

  async canShowReadReceipts(userId: string): Promise<boolean> {
    const [isPremium, settings] = await Promise.all([
      this.isPremium(userId),
      this.prisma.userSettings.findUnique({ where: { userId } }),
    ]);
    return isPremium && (settings?.showReadReceipts ?? false);
  }

  private getGateway(): PaymentGateway {
    if (this.configuredProvider === 'demo') {
      return this.demoGateway;
    }
    if (this.configuredProvider === 'none' || !this.configuredProvider) {
      return this.unconfiguredGateway;
    }
    // Future: return stripe/paddle/revenuecat gateway when implemented
    return this.unconfiguredGateway;
  }

  private isActivePremium(subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
  }): boolean {
    if (subscription.plan !== SubscriptionPlan.premium) return false;
    if (subscription.status !== SubscriptionStatus.active && subscription.status !== SubscriptionStatus.trialing) {
      return false;
    }
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) {
      return false;
    }
    return true;
  }

  private toView(subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    paymentProvider: PaymentProvider | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
  }): SubscriptionView {
    const isPremium = this.isActivePremium(subscription);
    return {
      plan: subscription.plan,
      status: subscription.status,
      isPremium,
      paymentProvider: subscription.paymentProvider,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      features: {
        avatarThemes: isPremium,
        readReceipts: isPremium,
        profileFlair: isPremium,
      },
    };
  }

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async clearPremiumProfileTheme(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile?.avatarConfig) return;

    const config = profile.avatarConfig as Record<string, unknown>;
    if (!config.theme) return;

    const { theme: _theme, ...rest } = config;
    await this.prisma.profile.update({
      where: { userId },
      data: {
        avatarConfig: (Object.keys(rest).length ? rest : Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }
}

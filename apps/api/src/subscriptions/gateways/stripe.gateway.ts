import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@pingme/db';
import Stripe from 'stripe';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutSessionResult, PaymentGateway } from '../payment-gateway.interface';

type StripeSubscriptionWithPeriod = Stripe.Subscription & {
  current_period_start: number;
  current_period_end: number;
};

type StripeInvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
};

@Injectable()
export class StripeGateway implements PaymentGateway {
  readonly providerId = 'stripe';
  private readonly logger = new Logger(StripeGateway.name);
  private readonly stripe: Stripe | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = secretKey ? new Stripe(secretKey) : null;
  }

  isConfigured(): boolean {
    return !!this.stripe && !!this.config.get<string>('STRIPE_PREMIUM_PRICE_ID');
  }

  async createCheckoutSession(userId: string, planId: string): Promise<CheckoutSessionResult> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const priceId = this.config.get<string>('STRIPE_PREMIUM_PRICE_ID');
    if (!priceId) {
      throw new BadRequestException('Stripe premium price is not configured');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) {
      throw new BadRequestException('Add a verified email before subscribing');
    }

    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    let customerId = subscription?.providerCustomerId ?? undefined;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await this.prisma.subscription.upsert({
        where: { userId },
        update: { providerCustomerId: customerId, paymentProvider: PaymentProvider.stripe },
        create: {
          userId,
          plan: SubscriptionPlan.free,
          status: SubscriptionStatus.active,
          paymentProvider: PaymentProvider.stripe,
          providerCustomerId: customerId,
        },
      });
    }

    const successUrl =
      this.config.get<string>('STRIPE_CHECKOUT_SUCCESS_URL') ?? 'pingme://premium?checkout=success';
    const cancelUrl =
      this.config.get<string>('STRIPE_CHECKOUT_CANCEL_URL') ?? 'pingme://premium?checkout=cancelled';

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: { userId, planId },
      subscription_data: {
        metadata: { userId, planId },
      },
    });

    if (!session.url) {
      throw new BadRequestException('Unable to create Stripe checkout session');
    }

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      inAppCheckout: false,
    };
  }

  async cancelSubscription(userId: string): Promise<void> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!subscription?.providerSubscriptionId) {
      throw new NotFoundException('No Stripe subscription found');
    }

    await this.stripe.subscriptions.update(subscription.providerSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  async handleWebhook(_provider: string, payload: unknown, signature?: string): Promise<void> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret || !signature) {
      throw new BadRequestException('Missing Stripe webhook signature');
    }

    if (!Buffer.isBuffer(payload)) {
      throw new BadRequestException('Stripe webhook requires raw request body');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      this.logger.warn(
        `Stripe webhook signature verification failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.syncStripeSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }

    const userId = this.extractUserIdFromEvent(event);
    if (userId) {
      await this.audit.log({
        userId,
        action: `subscription.stripe.${event.type}`,
        entityType: 'subscription',
        metadata: { stripeEventId: event.id },
      });
    }
  }

  private extractUserIdFromEvent(event: Stripe.Event): string | null {
    const object = event.data.object as { metadata?: { userId?: string }; client_reference_id?: string };
    return object.metadata?.userId ?? object.client_reference_id ?? null;
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId ?? session.client_reference_id;
    const stripeSubscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const stripeCustomerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;

    if (!userId || !stripeSubscriptionId || !this.stripe) {
      return;
    }

    const stripeSubscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
    await this.upsertPremiumFromStripe(userId, stripeSubscription, stripeCustomerId ?? undefined);
  }

  private async syncStripeSubscription(stripeSubscription: Stripe.Subscription) {
    const userId = stripeSubscription.metadata?.userId;
    if (userId) {
      await this.upsertPremiumFromStripe(userId, stripeSubscription);
      return;
    }

    const local = await this.prisma.subscription.findFirst({
      where: { providerSubscriptionId: stripeSubscription.id },
    });
    if (local) {
      await this.upsertPremiumFromStripe(local.userId, stripeSubscription);
    }
  }

  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
    const local = await this.prisma.subscription.findFirst({
      where: { providerSubscriptionId: stripeSubscription.id },
    });
    if (!local) {
      return;
    }

    await this.prisma.subscription.update({
      where: { userId: local.userId },
      data: {
        plan: SubscriptionPlan.free,
        status: SubscriptionStatus.active,
        paymentProvider: null,
        providerCustomerId: null,
        providerSubscriptionId: null,
        cancelAtPeriodEnd: false,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        metadata: { revokedReason: 'stripe_subscription_deleted' },
      },
    });
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const invoiceWithSubscription = invoice as StripeInvoiceWithSubscription;
    const stripeSubscriptionId =
      typeof invoiceWithSubscription.subscription === 'string'
        ? invoiceWithSubscription.subscription
        : invoiceWithSubscription.subscription?.id;
    if (!stripeSubscriptionId) {
      return;
    }

    const local = await this.prisma.subscription.findFirst({
      where: { providerSubscriptionId: stripeSubscriptionId },
    });
    if (!local) {
      return;
    }

    await this.prisma.subscription.update({
      where: { userId: local.userId },
      data: { status: SubscriptionStatus.past_due },
    });
  }

  private async upsertPremiumFromStripe(
    userId: string,
    stripeSubscription: Stripe.Subscription,
    stripeCustomerId?: string,
  ) {
    const subscriptionWithPeriod = stripeSubscription as StripeSubscriptionWithPeriod;
    const periodStart = subscriptionWithPeriod.current_period_start
      ? new Date(subscriptionWithPeriod.current_period_start * 1000)
      : null;
    const periodEnd = subscriptionWithPeriod.current_period_end
      ? new Date(subscriptionWithPeriod.current_period_end * 1000)
      : null;

    const status = this.mapStripeStatus(stripeSubscription.status);
    const isPremiumActive =
      status === SubscriptionStatus.active || status === SubscriptionStatus.trialing;

    await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        plan: isPremiumActive ? SubscriptionPlan.premium : SubscriptionPlan.free,
        status,
        paymentProvider: PaymentProvider.stripe,
        providerCustomerId:
          stripeCustomerId ??
          (typeof stripeSubscription.customer === 'string'
            ? stripeSubscription.customer
            : stripeSubscription.customer?.id) ??
          undefined,
        providerSubscriptionId: stripeSubscription.id,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        metadata: { source: 'stripe_webhook' },
      },
      create: {
        userId,
        plan: isPremiumActive ? SubscriptionPlan.premium : SubscriptionPlan.free,
        status,
        paymentProvider: PaymentProvider.stripe,
        providerCustomerId:
          stripeCustomerId ??
          (typeof stripeSubscription.customer === 'string'
            ? stripeSubscription.customer
            : stripeSubscription.customer?.id) ??
          undefined,
        providerSubscriptionId: stripeSubscription.id,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        metadata: { source: 'stripe_webhook' },
      },
    });
  }

  private mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    switch (status) {
      case 'trialing':
        return SubscriptionStatus.trialing;
      case 'active':
        return SubscriptionStatus.active;
      case 'past_due':
      case 'unpaid':
        return SubscriptionStatus.past_due;
      case 'canceled':
      case 'incomplete_expired':
        return SubscriptionStatus.cancelled;
      default:
        return SubscriptionStatus.active;
    }
  }
}

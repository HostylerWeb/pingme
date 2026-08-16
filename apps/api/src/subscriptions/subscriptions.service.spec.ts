import { ConfigService } from '@nestjs/config';
import { SubscriptionPlan, SubscriptionStatus } from '@pingme/db';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DemoGateway } from './gateways/demo.gateway';
import { UnconfiguredGateway } from './gateways/unconfigured.gateway';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  const prisma = {
    subscription: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    profile: { findUnique: jest.fn(), update: jest.fn() },
    userSettings: { findUnique: jest.fn() },
  } as unknown as PrismaService;

  const audit = { log: jest.fn() } as unknown as AuditService;
  const config = {
    get: jest.fn().mockReturnValue('none'),
  } as unknown as ConfigService;

  let service: SubscriptionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SubscriptionsService(prisma, audit, config, new UnconfiguredGateway(), new DemoGateway());
  });

  it('returns free plan when no subscription exists', async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.subscription.create as jest.Mock).mockResolvedValue({
      plan: SubscriptionPlan.free,
      status: SubscriptionStatus.active,
      paymentProvider: null,
      cancelAtPeriodEnd: false,
      currentPeriodStart: null,
      currentPeriodEnd: null,
    });

    const view = await service.getSubscriptionView('user-1');
    expect(view.plan).toBe(SubscriptionPlan.free);
    expect(view.isPremium).toBe(false);
  });

  it('detects active premium subscription', async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      plan: SubscriptionPlan.premium,
      status: SubscriptionStatus.active,
      paymentProvider: 'manual',
      cancelAtPeriodEnd: false,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });

    const isPremium = await service.isPremium('user-1');
    expect(isPremium).toBe(true);
  });

  it('rejects checkout when payments are not configured', async () => {
    await expect(service.createCheckout('user-1', 'premium')).rejects.toThrow(
      'Payments are not configured yet',
    );
  });

  it('blocks demo gateway in production', async () => {
    const prodConfig = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'PAYMENT_PROVIDER') return 'demo';
        if (key === 'NODE_ENV') return 'production';
        return fallback;
      }),
    } as unknown as ConfigService;
    const prodService = new SubscriptionsService(
      prisma,
      audit,
      prodConfig,
      new UnconfiguredGateway(),
      new DemoGateway(),
    );

    await expect(prodService.createCheckout('user-1', 'premium')).rejects.toThrow(
      'Payments are not configured yet',
    );
  });
});

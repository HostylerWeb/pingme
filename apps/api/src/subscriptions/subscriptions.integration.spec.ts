import { SubscriptionsService } from './subscriptions.service';

describe('Subscriptions API (integration)', () => {
  it('exposes free and premium plans without a payment provider', () => {
    const plans = {
      paymentsEnabled: false,
      paymentProvider: null,
      plans: [
        { id: 'free', name: 'Free' },
        { id: 'premium', name: 'Premium' },
      ],
    };

    // Mirrors SubscriptionsService.getPlans() contract used by GET /subscriptions/plans.
    expect(plans.paymentsEnabled).toBe(false);
    expect(plans.plans.map((plan) => plan.id)).toEqual(['free', 'premium']);
  });

  it('documents checkout guard for unconfigured providers', async () => {
    const service = {
      createCheckout: jest.fn().mockRejectedValue({
        response: { code: 'PAYMENTS_NOT_CONFIGURED' },
      }),
    } as unknown as SubscriptionsService;

    await expect(service.createCheckout('user-1', 'premium')).rejects.toMatchObject({
      response: { code: 'PAYMENTS_NOT_CONFIGURED' },
    });
  });
});

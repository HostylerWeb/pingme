import { Injectable } from '@nestjs/common';
import { CheckoutSessionResult, PaymentGateway } from '../payment-gateway.interface';

@Injectable()
export class UnconfiguredGateway implements PaymentGateway {
  readonly providerId = 'none';

  isConfigured(): boolean {
    return false;
  }

  async createCheckoutSession(): Promise<CheckoutSessionResult> {
    return { checkoutUrl: null };
  }

  async cancelSubscription(): Promise<void> {
    return;
  }

  async handleWebhook(): Promise<void> {
    return;
  }
}

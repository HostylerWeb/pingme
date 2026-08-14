import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CheckoutSessionResult, PaymentGateway } from '../payment-gateway.interface';

type DemoCheckoutSession = {
  userId: string;
  planId: string;
  createdAt: number;
};

@Injectable()
export class DemoGateway implements PaymentGateway {
  readonly providerId = 'demo';

  private readonly sessions = new Map<string, DemoCheckoutSession>();
  private readonly ttlMs = 30 * 60 * 1000;

  isConfigured(): boolean {
    return true;
  }

  async createCheckoutSession(userId: string, planId: string): Promise<CheckoutSessionResult> {
    this.pruneExpired();
    const sessionId = randomUUID();
    this.sessions.set(sessionId, { userId, planId, createdAt: Date.now() });
    return {
      checkoutUrl: null,
      sessionId,
      inAppCheckout: true,
    };
  }

  async cancelSubscription(): Promise<void> {
    return;
  }

  async handleWebhook(): Promise<void> {
    return;
  }

  consumeSession(sessionId: string, userId: string) {
    this.pruneExpired();
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('Checkout session not found or expired');
    }
    if (session.userId !== userId) {
      throw new BadRequestException('Checkout session does not belong to this user');
    }
    this.sessions.delete(sessionId);
    return session;
  }

  private pruneExpired() {
    const cutoff = Date.now() - this.ttlMs;
    for (const [id, session] of this.sessions) {
      if (session.createdAt < cutoff) {
        this.sessions.delete(id);
      }
    }
  }
}

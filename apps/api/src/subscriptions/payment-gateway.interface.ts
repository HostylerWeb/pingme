export interface CheckoutSessionResult {
  checkoutUrl: string | null;
  sessionId?: string;
}

export interface PaymentGateway {
  readonly providerId: string;
  isConfigured(): boolean;
  createCheckoutSession(userId: string, planId: string): Promise<CheckoutSessionResult>;
  cancelSubscription(userId: string): Promise<void>;
  handleWebhook(provider: string, payload: unknown, signature?: string): Promise<void>;
}

import { Module } from '@nestjs/common';
import { DemoGateway } from './gateways/demo.gateway';
import { UnconfiguredGateway } from './gateways/unconfigured.gateway';
import { StripeGateway } from './gateways/stripe.gateway';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  controllers: [SubscriptionsController, PaymentWebhooksController],
  providers: [SubscriptionsService, UnconfiguredGateway, DemoGateway, StripeGateway],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}

import { Module } from '@nestjs/common';
import { UnconfiguredGateway } from './gateways/unconfigured.gateway';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  controllers: [SubscriptionsController, PaymentWebhooksController],
  providers: [SubscriptionsService, UnconfiguredGateway],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}

import { Module } from '@nestjs/common';
import { DemoGateway } from './gateways/demo.gateway';
import { UnconfiguredGateway } from './gateways/unconfigured.gateway';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  controllers: [SubscriptionsController, PaymentWebhooksController],
  providers: [SubscriptionsService, UnconfiguredGateway, DemoGateway],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}

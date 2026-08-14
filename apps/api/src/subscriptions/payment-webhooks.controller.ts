import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('webhooks')
@Controller('webhooks/payments')
export class PaymentWebhooksController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Public()
  @Post(':provider')
  @ApiOperation({ summary: 'Payment provider webhook (stub until gateway is chosen)' })
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() body: unknown,
    @Headers('stripe-signature') stripeSignature?: string,
    @Headers('paddle-signature') paddleSignature?: string,
  ) {
    const signature = stripeSignature ?? paddleSignature;
    const data = await this.subscriptions.handlePaymentWebhook(provider, body, signature);
    return { success: true, data };
  }
}

import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@pingme/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';

class ConfirmCheckoutDto {
  sessionId!: string;
}

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current subscription' })
  async getMe(@CurrentUser() user: User) {
    const data = await this.subscriptions.getSubscriptionView(user.id);
    return { success: true, data };
  }

  @Get('plans')
  @ApiOperation({ summary: 'List subscription plans and premium features' })
  getPlans() {
    const data = this.subscriptions.getPlans();
    return { success: true, data };
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Start premium checkout (when payment provider is configured)' })
  async checkout(@CurrentUser() user: User) {
    const data = await this.subscriptions.createCheckout(user.id, 'premium');
    return { success: true, data };
  }

  @Post('checkout/confirm')
  @ApiOperation({ summary: 'Confirm in-app demo checkout session' })
  async confirmCheckout(@CurrentUser() user: User, @Body() body: ConfirmCheckoutDto) {
    const data = await this.subscriptions.confirmCheckout(user.id, body.sessionId);
    return { success: true, data };
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancel premium at period end' })
  async cancel(@CurrentUser() user: User) {
    const data = await this.subscriptions.cancelSubscription(user.id);
    return { success: true, data };
  }
}

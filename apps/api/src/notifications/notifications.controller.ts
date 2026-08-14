import { Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NOTIFICATION_TYPES } from '@pingme/shared';
import { User } from '@pingme/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  @Post('test')
  @ApiOperation({ summary: 'Send a test push notification to the current user (non-production only)' })
  async sendTest(@CurrentUser() user: User) {
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    const testEnabled = this.config.get<string>('NOTIFICATIONS_TEST_ENABLED', 'false') === 'true';

    if (nodeEnv === 'production' && !testEnabled) {
      throw new ForbiddenException('Test notifications are disabled in production');
    }
    await this.notifications.sendToUser(user.id, {
      type: NOTIFICATION_TYPES.CHAT_MESSAGE,
      title: 'PingMe test',
      body: 'Push notifications are working via the API.',
      data: {
        type: NOTIFICATION_TYPES.CHAT_MESSAGE,
        chatId: 'test',
      },
    });

    return {
      success: true,
      message: 'Test notification queued for your registered devices.',
    };
  }
}

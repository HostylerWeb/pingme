import { Controller, Post, UseGuards } from '@nestjs/common';
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
  constructor(private readonly notifications: NotificationService) {}

  @Post('test')
  @ApiOperation({ summary: 'Send a test push notification to the current user' })
  async sendTest(@CurrentUser() user: User) {
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

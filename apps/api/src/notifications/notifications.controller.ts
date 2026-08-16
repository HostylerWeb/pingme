import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NOTIFICATION_TYPES } from '@pingme/shared';
import { User } from '@pingme/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InboxService } from './inbox.service';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly inbox: InboxService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Unread counts for tab badges' })
  getSummary(@CurrentUser() user: User) {
    return this.inbox.getSummary(user.id).then((data) => ({ success: true, data }));
  }

  @Get('wall')
  @ApiOperation({ summary: 'Wall reply notifications for the bell inbox' })
  listWall(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
  ) {
    return this.inbox
      .listWallNotifications(user.id, limit ? Number(limit) : 30)
      .then((data) => ({ success: true, data }));
  }

  @Post('wall/mark-read')
  @ApiOperation({ summary: 'Mark wall notifications read' })
  markWallRead(@CurrentUser() user: User, @Body() body: { postId?: string }) {
    return this.inbox.markWallNotificationsRead(user.id, body.postId);
  }

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

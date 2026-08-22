import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InboxService } from './inbox.service';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationsController } from './notifications.controller';
import { NotificationService } from './notification.service';
import { PushSenderService } from './push-sender.service';

@Module({
  imports: [DevicesModule, PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationService, NotificationQueueService, PushSenderService, InboxService],
  exports: [NotificationService, InboxService, NotificationQueueService],
})
export class NotificationsModule {}

import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationsController } from './notifications.controller';
import { NotificationService } from './notification.service';
import { PushSenderService } from './push-sender.service';

@Module({
  imports: [DevicesModule],
  controllers: [NotificationsController],
  providers: [NotificationService, NotificationQueueService, PushSenderService],
  exports: [NotificationService],
})
export class NotificationsModule {}

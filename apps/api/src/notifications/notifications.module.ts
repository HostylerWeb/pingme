import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationService } from './notification.service';
import { PushSenderService } from './push-sender.service';

@Module({
  imports: [DevicesModule],
  providers: [NotificationService, NotificationQueueService, PushSenderService],
  exports: [NotificationService],
})
export class NotificationsModule {}

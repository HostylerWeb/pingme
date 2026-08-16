import { Module } from '@nestjs/common';
import { BlocksService } from '../common/services/blocks.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { VerificationModule } from '../verification/verification.module';
import { EventsController } from './events.controller';
import { EventsNearbyPushService } from './events-nearby-push.service';
import { EventsService } from './events.service';

@Module({
  imports: [NotificationsModule, VerificationModule],
  controllers: [EventsController],
  providers: [EventsService, EventsNearbyPushService, BlocksService],
  exports: [EventsService],
})
export class EventsModule {}

import { Module, forwardRef } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { BlocksService } from '../common/services/blocks.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { VerificationModule } from '../verification/verification.module';
import { IcebreakerController } from './icebreaker.controller';
import { IcebreakerMatchingService } from './icebreaker-matching.service';
import { IcebreakerNearbyPushService } from './icebreaker-nearby-push.service';
import { IcebreakerService } from './icebreaker.service';

@Module({
  imports: [NotificationsModule, VerificationModule, forwardRef(() => ChatModule)],
  controllers: [IcebreakerController],
  providers: [
    IcebreakerService,
    IcebreakerMatchingService,
    IcebreakerNearbyPushService,
    BlocksService,
  ],
  exports: [IcebreakerService],
})
export class IcebreakerModule {}

import { Module } from '@nestjs/common';
import { BlocksService } from '../common/services/blocks.service';
import { RateLimitService } from '../common/services/rate-limit.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { VerificationModule } from '../verification/verification.module';
import { IcebreakerController } from './icebreaker.controller';
import { IcebreakerMatchingService } from './icebreaker-matching.service';
import { IcebreakerService } from './icebreaker.service';

@Module({
  imports: [NotificationsModule, VerificationModule],
  controllers: [IcebreakerController],
  providers: [
    IcebreakerService,
    IcebreakerMatchingService,
    BlocksService,
    RateLimitService,
  ],
  exports: [IcebreakerService],
})
export class IcebreakerModule {}

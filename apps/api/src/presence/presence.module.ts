import { Module } from '@nestjs/common';
import { BlocksService } from '../common/services/blocks.service';
import { RateLimitService } from '../common/services/rate-limit.service';
import { VerificationModule } from '../verification/verification.module';
import { PresenceController } from './presence.controller';
import { PresenceExpiryService } from './presence-expiry.service';
import { PresenceService } from './presence.service';

@Module({
  imports: [VerificationModule],
  controllers: [PresenceController],
  providers: [PresenceService, PresenceExpiryService, BlocksService, RateLimitService],
  exports: [PresenceService, PresenceExpiryService],
})
export class PresenceModule {}

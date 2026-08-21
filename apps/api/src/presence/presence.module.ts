import { Module, forwardRef } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { BlocksService } from '../common/services/blocks.service';
import { VerificationModule } from '../verification/verification.module';
import { PresenceController } from './presence.controller';
import { PresenceExpiryService } from './presence-expiry.service';
import { PresenceService } from './presence.service';

@Module({
  imports: [VerificationModule, forwardRef(() => ChatModule)],
  controllers: [PresenceController],
  providers: [PresenceService, PresenceExpiryService, BlocksService],
  exports: [PresenceService, PresenceExpiryService],
})
export class PresenceModule {}

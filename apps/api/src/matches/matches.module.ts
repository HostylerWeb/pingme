import { Module } from '@nestjs/common';
import { BlocksService } from '../common/services/blocks.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { VerificationModule } from '../verification/verification.module';
import { MatchExpiryService } from './match-expiry.service';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [NotificationsModule, VerificationModule],
  controllers: [MatchesController],
  providers: [MatchesService, MatchExpiryService, BlocksService],
  exports: [MatchesService],
})
export class MatchesModule {}

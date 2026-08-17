import { Module } from '@nestjs/common';
import { BlocksService } from '../common/services/blocks.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReputationModule } from '../reputation/reputation.module';
import { VerificationModule } from '../verification/verification.module';
import { WallController } from './wall.controller';
import { WallService } from './wall.service';

@Module({
  imports: [NotificationsModule, VerificationModule, ReputationModule],
  controllers: [WallController],
  providers: [WallService, BlocksService],
  exports: [WallService],
})
export class WallModule {}

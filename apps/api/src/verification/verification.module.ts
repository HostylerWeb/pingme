import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReputationModule } from '../reputation/reputation.module';
import { DiditService } from './didit.service';
import { VerifiedGuard } from './guards/verified.guard';
import { IdVerifiedGuard } from './guards/id-verified.guard';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  imports: [NotificationsModule, ReputationModule],
  controllers: [VerificationController],
  providers: [DiditService, VerificationService, VerifiedGuard, IdVerifiedGuard],
  exports: [VerificationService, VerifiedGuard, IdVerifiedGuard, DiditService],
})
export class VerificationModule {}

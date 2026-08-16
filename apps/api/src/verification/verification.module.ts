import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { DiditService } from './didit.service';
import { VerifiedGuard } from './guards/verified.guard';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  imports: [NotificationsModule],
  controllers: [VerificationController],
  providers: [DiditService, VerificationService, VerifiedGuard],
  exports: [VerificationService, VerifiedGuard, DiditService],
})
export class VerificationModule {}

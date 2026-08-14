import { Module } from '@nestjs/common';
import { BlocksService } from '../common/services/blocks.service';
import { VerificationModule } from '../verification/verification.module';
import { ReportsService } from './reports.service';
import { SafetyController } from './safety.controller';

@Module({
  imports: [VerificationModule],
  controllers: [SafetyController],
  providers: [BlocksService, ReportsService],
})
export class SafetyModule {}

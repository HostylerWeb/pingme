import { Module } from '@nestjs/common';
import { BlocksService } from '../common/services/blocks.service';
import { ReportsService } from './reports.service';
import { SafetyController } from './safety.controller';

@Module({
  controllers: [SafetyController],
  providers: [BlocksService, ReportsService],
})
export class SafetyModule {}

import { Module } from '@nestjs/common';
import { PresenceModule } from '../presence/presence.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PresenceModule],
  controllers: [HealthController],
})
export class HealthModule {}

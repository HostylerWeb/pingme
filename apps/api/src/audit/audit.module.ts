import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { SecurityEventsService } from './security-events.service';

@Global()
@Module({
  providers: [AuditService, SecurityEventsService],
  exports: [AuditService, SecurityEventsService],
})
export class AuditModule {}

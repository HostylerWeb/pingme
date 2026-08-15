import { Global, Module } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { R2Service } from './services/r2.service';
import { RateLimitService } from './services/rate-limit.service';
import { SmsService } from './services/sms.service';

@Global()
@Module({
  providers: [EmailService, SmsService, R2Service, RateLimitService],
  exports: [EmailService, SmsService, R2Service, RateLimitService],
})
export class CommonModule {}

import { Module } from '@nestjs/common';
import { VerificationModule } from '../verification/verification.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [VerificationModule, SubscriptionsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

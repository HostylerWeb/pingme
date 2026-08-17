import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { ReputationModule } from '../reputation/reputation.module';
import { VerificationModule } from '../verification/verification.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AccountDeletionService } from './account-deletion.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [RedisModule, VerificationModule, SubscriptionsModule, ReputationModule],
  controllers: [UsersController],
  providers: [UsersService, AccountDeletionService],
  exports: [UsersService],
})
export class UsersModule {}

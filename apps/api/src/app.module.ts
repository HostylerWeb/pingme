import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { ChatModule } from './chat/chat.module';
import { HealthModule } from './health/health.module';
import { SafetyModule } from './safety/safety.module';
import { IcebreakerModule } from './icebreaker/icebreaker.module';
import { MatchesModule } from './matches/matches.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PresenceModule } from './presence/presence.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';
import { WallModule } from './wall/wall.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    RedisModule,
    CommonModule,
    AuditModule,
    AuthModule,
    UsersModule,
    DevicesModule,
    NotificationsModule,
    PresenceModule,
    WallModule,
    IcebreakerModule,
    MatchesModule,
    ChatModule,
    SafetyModule,
    VerificationModule,
    HealthModule,
  ],
})
export class AppModule {}

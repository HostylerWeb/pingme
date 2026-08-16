import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/app-config.module';
import { CommonModule } from './common/common.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { ChatModule } from './chat/chat.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { SafetyModule } from './safety/safety.module';
import { SiteModule } from './site/site.module';
import { IcebreakerModule } from './icebreaker/icebreaker.module';
import { MatchesModule } from './matches/matches.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PresenceModule } from './presence/presence.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';
import { WallModule } from './wall/wall.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    AppConfigModule,
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
    SubscriptionsModule,
    AdminModule,
    HealthModule,
    SiteModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
